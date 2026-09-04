//! Usenet

use crate::engine::archive_safety::{
    check_limits, validate_member_path, ArchiveLimits, ArchiveSafetyError, ArchiveUsage,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveFormat {
    Zip,
    Rar,
    SevenZip,
    Tar,
    Gzip,
    Bzip2,
    Xz,
    Zstd,
    Unknown,
}

pub fn detect_archive_format(bytes: &[u8]) -> ArchiveFormat {
    if bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(b"PK\x05\x06") {
        ArchiveFormat::Zip
    } else if bytes.starts_with(b"Rar!\x1a\x07\x00") || bytes.starts_with(b"Rar!\x1a\x07\x01\x00") {
        ArchiveFormat::Rar
    } else if bytes.starts_with(b"7z\xbc\xaf\x27\x1c") {
        ArchiveFormat::SevenZip
    } else if bytes.starts_with(&[0x1f, 0x8b]) {
        ArchiveFormat::Gzip
    } else if bytes.starts_with(b"BZh") {
        ArchiveFormat::Bzip2
    } else if bytes.starts_with(&[0xfd, b'7', b'z', b'X', b'Z', 0x00]) {
        ArchiveFormat::Xz
    } else if bytes.starts_with(&[0x28, 0xb5, 0x2f, 0xfd]) {
        ArchiveFormat::Zstd
    } else if bytes.len() >= 262 && &bytes[257..262] == b"ustar" {
        ArchiveFormat::Tar
    } else {
        ArchiveFormat::Unknown
    }
}

pub fn decode_yenc(input: &[u8]) -> Result<Vec<u8>, YEncError> {
    let text = input;
    let begin = find_line(text, b"=ybegin ").ok_or(YEncError::MissingBegin)?;
    let end = find_line_after(text, b"=yend ", begin.1).ok_or(YEncError::MissingEnd)?;
    let end_header = parse_header(&text[end.0..end.1]);
    let expected_size = match end_header.get("size") {
        Some(value) => Some(
            value
                .parse::<usize>()
                .map_err(|_| YEncError::InvalidHeader)?,
        ),
        None => None,
    };
    let expected_crc = end_header.get("crc32");

    let mut out = Vec::new();
    let mut cursor = begin.1;
    while cursor < end.0 {
        let line_end = line_end(text, cursor);
        let mut line = &text[cursor..line_end];
        if line.starts_with(b"=ypart ") || line.starts_with(b"=ybegin ") {
            cursor = skip_line(text, line_end);
            continue;
        }
        while let Some(&last) = line.last() {
            if last == b'\r' || last == b'\n' {
                line = &line[..line.len() - 1];
            } else {
                break;
            }
        }
        decode_yenc_line(line, &mut out).map_err(|error| match error {
            "truncated yEnc escape" => YEncError::DanglingEscape,
            _ => YEncError::InvalidHeader,
        })?;
        cursor = skip_line(text, line_end);
    }
    if let Some(size) = expected_size {
        if out.len() != size {
            return Err(YEncError::SizeMismatch {
                expected: size,
                actual: out.len(),
            });
        }
    }
    if let Some(crc) = expected_crc {
        let expected = u32::from_str_radix(crc, 16).map_err(|_| YEncError::InvalidCrc)?;
        let actual = crate::engine::usenet_pipeline::crc32(&out);
        if actual != expected {
            return Err(YEncError::CrcMismatch { expected, actual });
        }
    }
    Ok(out)
}

/// Decode one yEnc payload line; the worker's multipart decoder uses this shared primitive so escaped bytes have identical semantics everywhere
pub(crate) fn decode_yenc_line(input: &[u8], output: &mut Vec<u8>) -> Result<(), &'static str> {
    let mut index = 0;
    while index < input.len() {
        let mut value = input[index];
        index += 1;
        if value == b'=' {
            if index >= input.len() {
                return Err("truncated yEnc escape");
            }
            value = input[index].wrapping_sub(64);
            index += 1;
        }
        output.push(value.wrapping_sub(42));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum YEncError {
    MissingBegin,
    MissingEnd,
    InvalidHeader,
    DanglingEscape,
    InvalidCrc,
    SizeMismatch { expected: usize, actual: usize },
    CrcMismatch { expected: u32, actual: u32 },
}

fn find_line(input: &[u8], marker: &[u8]) -> Option<(usize, usize)> {
    find_line_after(input, marker, 0)
}

fn find_line_after(input: &[u8], marker: &[u8], from: usize) -> Option<(usize, usize)> {
    let mut pos = from;
    while pos < input.len() {
        let end = line_end(input, pos);
        if input[pos..end].starts_with(marker) {
            return Some((pos, end));
        }
        pos = skip_line(input, end);
    }
    None
}

fn line_end(input: &[u8], start: usize) -> usize {
    input[start..]
        .iter()
        .position(|b| *b == b'\r' || *b == b'\n')
        .map_or(input.len(), |offset| start + offset)
}

fn skip_line(input: &[u8], end: usize) -> usize {
    if input.get(end) == Some(&b'\r') && input.get(end + 1) == Some(&b'\n') {
        end + 2
    } else if input.get(end).is_some() {
        end + 1
    } else {
        end
    }
}

fn parse_header(line: &[u8]) -> std::collections::HashMap<String, String> {
    let value = String::from_utf8_lossy(line);
    value
        .split_whitespace()
        .skip(1)
        .filter_map(|item| item.split_once('='))
        .map(|(key, value)| (key.to_ascii_lowercase(), value.to_string()))
        .collect()
}

/// Archive entry type supplied by a format reader
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveEntryKind {
    File,
    Directory,
    Symlink,
    Hardlink,
    Special,
}

/// A decoded archive member
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveMember {
    pub path: String,
    pub kind: ArchiveEntryKind,
    pub data: Vec<u8>,
    pub compressed_bytes: u64,
    pub depth: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractionReport {
    pub usage: ArchiveUsage,
    pub files_written: u64,
}

/// Validate and extract already-decoded members into `destination`
pub fn extract_members<I>(
    members: I,
    destination: &Path,
    limits: ArchiveLimits,
    free_space_bytes: Option<u64>,
) -> Result<ExtractionReport, ArchivePipelineError>
where
    I: IntoIterator<Item = ArchiveMember>,
{
    extract_members_with_started_at(
        members,
        destination,
        limits,
        free_space_bytes,
        Instant::now(),
    )
}

fn extract_members_with_started_at<I>(
    members: I,
    destination: &Path,
    limits: ArchiveLimits,
    free_space_bytes: Option<u64>,
    started_at: Instant,
) -> Result<ExtractionReport, ArchivePipelineError>
where
    I: IntoIterator<Item = ArchiveMember>,
{
    fs::create_dir_all(destination).map_err(ArchivePipelineError::Io)?;
    let mut usage = ArchiveUsage::default();
    let mut compressed_bytes = 0u64;
    let mut files_written = 0;
    for member in members {
        validate_member_path(&member.path).map_err(ArchivePipelineError::Safety)?;
        if matches!(
            member.kind,
            ArchiveEntryKind::Symlink | ArchiveEntryKind::Hardlink | ArchiveEntryKind::Special
        ) {
            return Err(ArchivePipelineError::UnsafeEntry(member.path));
        }
        usage.entries = usage.entries.saturating_add(1);
        usage.expanded_bytes = usage
            .expanded_bytes
            .saturating_add(member.data.len() as u64);
        usage.max_entry_bytes = usage.max_entry_bytes.max(member.data.len() as u64);
        usage.nesting_depth = usage.nesting_depth.max(member.depth);
        compressed_bytes = compressed_bytes.saturating_add(member.compressed_bytes);
        usage.active_seconds = started_at.elapsed().as_secs();
        check_limits(limits, usage, compressed_bytes, free_space_bytes)
            .map_err(ArchivePipelineError::Safety)?;
        let mut path = destination.join(&member.path);
        if has_symlink_ancestor(destination, &member.path)? {
            return Err(ArchivePipelineError::UnsafeEntry(member.path));
        }
        match member.kind {
            ArchiveEntryKind::Directory => {
                fs::create_dir_all(&path).map_err(ArchivePipelineError::Io)?
            }
            ArchiveEntryKind::File => {
                if path_exists(&path) {
                    path = collision_path(&path);
                }
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent).map_err(ArchivePipelineError::Io)?;
                }
                let mut file = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)
                    .map_err(ArchivePipelineError::Io)?;
                file.write_all(&member.data)
                    .map_err(ArchivePipelineError::Io)?;
                file.sync_all().map_err(ArchivePipelineError::Io)?;
                // Never preserve executable bits from archive metadata
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;

                    let mut perms = file
                        .metadata()
                        .map_err(ArchivePipelineError::Io)?
                        .permissions();
                    perms.set_mode(perms.mode() & 0o666);
                    file.set_permissions(perms)
                        .map_err(ArchivePipelineError::Io)?;
                }
                files_written += 1;
            }
            _ => unreachable!(),
        }
        usage.active_seconds = started_at.elapsed().as_secs();
        check_limits(limits, usage, compressed_bytes, free_space_bytes)
            .map_err(ArchivePipelineError::Safety)?;
    }
    Ok(ExtractionReport {
        usage,
        files_written,
    })
}

fn collision_path(path: &Path) -> PathBuf {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 1..10_000u32 {
        let name = match extension {
            Some(extension) => format!("{stem} ({index}).{extension}"),
            None => format!("{stem} ({index})"),
        };
        let candidate = path.with_file_name(name);
        if !path_exists(&candidate) {
            return candidate;
        }
    }
    path.with_file_name(format!("{stem}.{}", uuid::Uuid::new_v4().simple()))
}

fn path_exists(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

fn has_symlink_ancestor(destination: &Path, relative: &str) -> Result<bool, ArchivePipelineError> {
    let mut current = destination.to_path_buf();
    for component in relative.split('/') {
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => return Ok(true),
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(ArchivePipelineError::Io(error)),
        }
    }
    Ok(false)
}

#[derive(Debug)]
pub enum ArchivePipelineError {
    Io(io::Error),
    Safety(ArchiveSafetyError),
    UnsafeEntry(String),
}

impl std::fmt::Display for ArchivePipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(err) => write!(f, "archive I/O: {err}"),
            Self::Safety(err) => write!(f, "archive safety: {err:?}"),
            Self::UnsafeEntry(path) => write!(f, "unsafe archive entry: {path}"),
        }
    }
}

impl std::error::Error for ArchivePipelineError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Par2Outcome {
    Verified,
    Repaired,
    MissingParity,
    Unrecoverable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Par2Report {
    pub outcome: Par2Outcome,
    pub recovered_bytes: u64,
}

pub trait Par2Verifier {
    fn verify_or_repair(
        &self,
        data_files: &[PathBuf],
        parity_files: &[PathBuf],
    ) -> io::Result<Par2Report>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CleanupMode {
    KeepAll,
    DeletePar2,
    #[serde(alias = "delete-par2-and-archives")]
    DeletePar2AndVolumes,
}

impl CleanupMode {
    pub fn from_setting(value: Option<&str>) -> Self {
        match value.unwrap_or_default() {
            "delete-par2" => Self::DeletePar2,
            "delete-par2-and-volumes" | "delete-par2-and-archives" => Self::DeletePar2AndVolumes,
            _ => Self::KeepAll,
        }
    }
}

pub fn is_archive_volume_name(name: &str) -> bool {
    let name = Path::new(name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(name)
        .to_ascii_lowercase();
    let extension = Path::new(&name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if matches!(
        extension,
        "zip"
            | "rar"
            | "rev"
            | "7z"
            | "tar"
            | "gz"
            | "tgz"
            | "tbz"
            | "tbz2"
            | "bz2"
            | "xz"
            | "txz"
            | "zst"
            | "tzst"
    ) {
        return true;
    }
    let legacy_volume_digits = extension
        .strip_prefix('r')
        .or_else(|| extension.strip_prefix('z'));
    if legacy_volume_digits.is_some_and(|digits| {
        !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
    }) {
        return true;
    }
    if extension.bytes().all(|byte| byte.is_ascii_digit()) {
        let without_volume = Path::new(&name).with_extension("");
        let container_extension = without_volume
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        return matches!(container_extension, "zip" | "7z" | "tar");
    }
    false
}

pub fn cleanup_after_success(
    mode: CleanupMode,
    verified_success: bool,
    par2_files: &[PathBuf],
    archive_volumes: &[PathBuf],
) -> io::Result<()> {
    if !verified_success {
        return Ok(());
    }
    if matches!(
        mode,
        CleanupMode::DeletePar2 | CleanupMode::DeletePar2AndVolumes
    ) {
        remove_existing(par2_files)?;
    }
    if matches!(mode, CleanupMode::DeletePar2AndVolumes) {
        remove_existing(archive_volumes)?;
    }
    Ok(())
}

fn remove_existing(paths: &[PathBuf]) -> io::Result<()> {
    for path in paths {
        if path.exists() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

/// Durable, non-secret per-task resume metadata
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsenetResumeState {
    pub manifest_fingerprint: String,
    #[serde(default)]
    pub segments: std::collections::BTreeMap<String, u64>,
    #[serde(default)]
    pub updated_at: u64,
}

impl UsenetResumeState {
    pub fn load(path: &Path) -> io::Result<Option<Self>> {
        match fs::read(path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err)),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(err) => Err(err),
        }
    }

    pub fn save_atomic(&mut self, path: &Path) -> io::Result<()> {
        self.updated_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_secs();
        let bytes = serde_json::to_vec(self)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension(format!(
            "{}tmp",
            path.extension()
                .and_then(|e| e.to_str())
                .map_or(String::new(), |e| format!("{e}."))
        ));
        let mut file = fs::File::create(&tmp)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(tmp, path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn yenc_encode(bytes: &[u8]) -> Vec<u8> {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(
            format!("=ybegin line=128 size={} name=x.bin\r\n", bytes.len()).as_bytes(),
        );
        for &byte in bytes {
            let value = byte.wrapping_add(42);
            if value == 0 || value == b'=' || value == b'\r' || value == b'\n' {
                encoded.push(b'=');
                encoded.push(value.wrapping_add(64));
            } else {
                encoded.push(value);
            }
        }
        encoded.extend_from_slice(
            format!(
                "\r\n=yend size={} crc32={:08x}\r\n",
                bytes.len(),
                crate::engine::usenet_pipeline::crc32(bytes)
            )
            .as_bytes(),
        );
        encoded
    }

    #[test]
    fn decodes_yenc_and_checks_crc() {
        let source = b"hello\0world\n";
        let encoded = yenc_encode(source);
        assert_eq!(decode_yenc(&encoded).unwrap(), source);
        assert_eq!(
            crate::engine::usenet_pipeline::decode_yenc(&encoded).unwrap(),
            source
        );
        let mut corrupt = encoded;
        let crc_offset = corrupt
            .windows(6)
            .position(|window| window == b"crc32=")
            .unwrap()
            + 6;
        corrupt[crc_offset] = if corrupt[crc_offset] == b'0' {
            b'1'
        } else {
            b'0'
        };
        assert!(decode_yenc(&corrupt).is_err());
    }

    #[test]
    fn detects_supported_archive_headers() {
        assert_eq!(detect_archive_format(b"PK\x03\x04..."), ArchiveFormat::Zip);
        assert_eq!(
            detect_archive_format(b"Rar!\x1a\x07\x01\x00..."),
            ArchiveFormat::Rar
        );
        assert_eq!(
            detect_archive_format(b"7z\xbc\xaf\x27\x1c..."),
            ArchiveFormat::SevenZip
        );
        assert_eq!(detect_archive_format(&[0x1f, 0x8b]), ArchiveFormat::Gzip);
        assert_eq!(detect_archive_format(b"unknown"), ArchiveFormat::Unknown);
    }

    #[test]
    fn rejects_unsafe_entries_and_enforces_limits() {
        let dir = tempdir().unwrap();
        let limits = ArchiveLimits {
            max_entries: 1,
            max_expanded_bytes: 4,
            max_entry_bytes: 4,
            max_nesting_depth: 1,
            max_compression_ratio: 10,
            free_space_reserve_bytes: 0,
            max_active_seconds: 10,
        };
        let result = extract_members(
            [ArchiveMember {
                path: "../x".into(),
                kind: ArchiveEntryKind::File,
                data: vec![1],
                compressed_bytes: 1,
                depth: 0,
            }],
            dir.path(),
            limits,
            None,
        );
        assert!(matches!(
            result,
            Err(ArchivePipelineError::Safety(ArchiveSafetyError::UnsafePath))
        ));
        let result = extract_members(
            [ArchiveMember {
                path: "x".into(),
                kind: ArchiveEntryKind::File,
                data: vec![1, 2, 3, 4, 5],
                compressed_bytes: 1,
                depth: 0,
            }],
            dir.path(),
            limits,
            None,
        );
        assert!(matches!(
            result,
            Err(ArchivePipelineError::Safety(
                ArchiveSafetyError::ExpandedBytes | ArchiveSafetyError::EntryBytes
            ))
        ));
    }

    #[test]
    fn extraction_accounts_for_elapsed_active_time() {
        let dir = tempdir().unwrap();
        let limits = ArchiveLimits {
            max_entries: 1,
            max_expanded_bytes: 10,
            max_entry_bytes: 10,
            max_nesting_depth: 1,
            max_compression_ratio: 10,
            free_space_reserve_bytes: 0,
            max_active_seconds: 0,
        };
        let result = extract_members_with_started_at(
            [ArchiveMember {
                path: "x".into(),
                kind: ArchiveEntryKind::File,
                data: vec![1],
                compressed_bytes: 1,
                depth: 0,
            }],
            dir.path(),
            limits,
            None,
            Instant::now() - Duration::from_secs(1),
        );
        assert!(matches!(
            result,
            Err(ArchivePipelineError::Safety(ArchiveSafetyError::ActiveTime))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_dangling_symlink_at_the_output_path() {
        use std::os::unix::fs::symlink;

        let destination = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let output = destination.path().join("x");
        symlink(outside.path().join("missing"), &output).unwrap();
        let limits = ArchiveLimits {
            max_entries: 1,
            max_expanded_bytes: 10,
            max_entry_bytes: 10,
            max_nesting_depth: 1,
            max_compression_ratio: 10,
            free_space_reserve_bytes: 0,
            max_active_seconds: 10,
        };

        let result = extract_members(
            [ArchiveMember {
                path: "x".into(),
                kind: ArchiveEntryKind::File,
                data: vec![1],
                compressed_bytes: 1,
                depth: 0,
            }],
            destination.path(),
            limits,
            None,
        );
        assert!(matches!(result, Err(ArchivePipelineError::UnsafeEntry(_))));
        assert!(!outside.path().join("missing").exists());
    }

    #[test]
    fn resume_save_load_is_atomic_and_cleanup_is_success_gated() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("resume.json");
        let mut state = UsenetResumeState {
            manifest_fingerprint: "abc".into(),
            ..Default::default()
        };
        state.segments.insert("1".into(), 42);
        state.save_atomic(&path).unwrap();
        assert_eq!(UsenetResumeState::load(&path).unwrap().unwrap(), state);
        let par2 = dir.path().join("x.par2");
        fs::write(&par2, b"x").unwrap();
        cleanup_after_success(
            CleanupMode::DeletePar2,
            false,
            std::slice::from_ref(&par2),
            &[],
        )
        .unwrap();
        assert!(par2.exists());
        let archive = dir.path().join("x.part01.rar");
        fs::write(&archive, b"x").unwrap();
        cleanup_after_success(
            CleanupMode::DeletePar2AndVolumes,
            false,
            std::slice::from_ref(&par2),
            std::slice::from_ref(&archive),
        )
        .unwrap();
        assert!(par2.exists() && archive.exists());
        cleanup_after_success(
            CleanupMode::DeletePar2,
            true,
            std::slice::from_ref(&par2),
            &[],
        )
        .unwrap();
        assert!(!par2.exists());
    }

    #[test]
    fn cleanup_modes_preserve_sidecars_and_non_archive_auxiliary_files() {
        let dir = tempdir().unwrap();
        let par2 = dir.path().join("release.vol00+01.par2");
        let rar = dir.path().join("release.part01.rar");
        let zip_volume = dir.path().join("release.z01");
        let nfo = dir.path().join("release.nfo");
        let resume = dir.path().join("release.part01.rar.resume.json");
        for path in [&par2, &rar, &zip_volume, &nfo, &resume] {
            fs::write(path, b"input").unwrap();
        }

        cleanup_after_success(
            CleanupMode::KeepAll,
            true,
            std::slice::from_ref(&par2),
            &[rar.clone(), zip_volume.clone()],
        )
        .unwrap();
        assert!(par2.exists() && rar.exists() && zip_volume.exists());

        cleanup_after_success(
            CleanupMode::DeletePar2,
            true,
            std::slice::from_ref(&par2),
            &[rar.clone(), zip_volume.clone()],
        )
        .unwrap();
        assert!(!par2.exists());
        assert!(rar.exists() && zip_volume.exists());

        fs::write(&par2, b"input").unwrap();
        cleanup_after_success(
            CleanupMode::DeletePar2AndVolumes,
            true,
            std::slice::from_ref(&par2),
            &[rar.clone(), zip_volume.clone()],
        )
        .unwrap();
        assert!(!par2.exists() && !rar.exists() && !zip_volume.exists());
        assert!(nfo.exists() && resume.exists());
    }

    #[test]
    fn cleanup_setting_accepts_frontend_archive_spelling() {
        assert_eq!(
            CleanupMode::from_setting(Some("delete-par2-and-archives")),
            CleanupMode::DeletePar2AndVolumes
        );
        assert_eq!(
            CleanupMode::from_setting(Some("delete-par2-and-volumes")),
            CleanupMode::DeletePar2AndVolumes
        );
        assert_eq!(
            CleanupMode::from_setting(Some("unknown")),
            CleanupMode::KeepAll
        );
        assert_eq!(
            serde_json::from_str::<CleanupMode>("\"delete-par2-and-archives\"").unwrap(),
            CleanupMode::DeletePar2AndVolumes
        );
    }

    #[test]
    fn archive_volume_classifier_excludes_auxiliary_files() {
        assert!(is_archive_volume_name("release.part01.rar"));
        assert!(is_archive_volume_name("release.r00"));
        assert!(is_archive_volume_name("release.z01"));
        assert!(is_archive_volume_name("release.7z.001"));
        assert!(is_archive_volume_name("release.tar.gz"));
        assert!(!is_archive_volume_name("release.nfo"));
        assert!(!is_archive_volume_name("release.sfv"));
        assert!(!is_archive_volume_name("release.par2"));
    }
}
