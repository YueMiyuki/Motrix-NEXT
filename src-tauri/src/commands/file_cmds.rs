use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;

const MAX_TORRENT_PREVIEW_FILES: usize = 2_000;
const MAX_TORRENT_PREVIEW_BYTES: usize = 8 * 1024 * 1024;
const DEFAULT_TORRENT_PREVIEW_PAGE_SIZE: usize = 300;
const MAX_TORRENT_PREVIEW_PAGE_SIZE: usize = 2_000;
const TEMP_DOWNLOAD_SUFFIX: &str = ".part";

#[derive(Debug)]
enum BencodeValue {
    Integer(i64),
    Bytes(Vec<u8>),
    List(Vec<BencodeValue>),
    Dictionary(BTreeMap<Vec<u8>, BencodeValue>),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedTorrentFile {
    path: String,
    length: i64,
    name: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedTorrentItem {
    path: String,
    length: i64,
    name: String,
    #[serde(rename = "type")]
    item_type: String,
    has_children: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    select_ranges: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedTorrentPayload {
    files: Vec<ResolvedTorrentFile>,
    items: Vec<ResolvedTorrentItem>,
    file_count: usize,
    items_total: usize,
    next_offset: usize,
    preview_disabled: bool,
    preview_reason: String,
}

fn normalize_preview_limit(limit: Option<usize>) -> usize {
    let value = limit.unwrap_or(DEFAULT_TORRENT_PREVIEW_PAGE_SIZE);
    value.clamp(1, MAX_TORRENT_PREVIEW_PAGE_SIZE)
}

fn canonicalize_path(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("Path must be absolute".to_string());
    }

    std::fs::canonicalize(path).map_err(|e| e.to_string())
}

fn canonicalize_parent_path(path: &Path) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Path has no parent directory".to_string())?;
    canonicalize_path(parent)
}

fn strip_temp_download_suffix(name: &str) -> Option<String> {
    if name.len() <= TEMP_DOWNLOAD_SUFFIX.len() {
        return None;
    }

    let lower = name.to_ascii_lowercase();
    if !lower.ends_with(TEMP_DOWNLOAD_SUFFIX) {
        return None;
    }

    Some(name[..name.len() - TEMP_DOWNLOAD_SUFFIX.len()].to_string())
}

fn ensure_torrent_extension(path: &Path) -> Result<(), String> {
    if path
        .extension()
        .and_then(|value| value.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("torrent"))
        == Some(true)
    {
        Ok(())
    } else {
        Err("Only .torrent files can be read".to_string())
    }
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }

    let is_dir = p.is_dir();

    #[cfg(target_os = "macos")]
    {
        if is_dir {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("open")
                .args(["-R", &path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if is_dir {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            let normalized_path = path.replace('/', "\\");
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", normalized_path))
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        if is_dir {
            open::that(path).map_err(|e| e.to_string())?;
        } else if let Some(parent) = p.parent() {
            open::that(parent.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;
        } else {
            return Err("Path has no parent directory".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trash_item(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(from_path: String, to_path: String) -> Result<(), String> {
    let from_path = from_path.trim();
    let to_path = to_path.trim();
    if from_path.is_empty() || to_path.is_empty() {
        return Err("Invalid path".to_string());
    }
    if from_path == to_path {
        return Ok(());
    }

    let from = PathBuf::from(from_path);
    let to = PathBuf::from(to_path);
    if !from.is_absolute() || !to.is_absolute() {
        return Err("Path must be absolute".to_string());
    }

    if !from.exists() {
        if to.exists() {
            return Ok(());
        }
        return Err("Source path does not exist".to_string());
    }

    // Limit rename_path to in-place temporary suffix finalization to avoid arbitrary moves.
    let from_parent = canonicalize_parent_path(&from)?;
    let to_parent = canonicalize_parent_path(&to)?;
    if from_parent != to_parent {
        return Err("Cross-directory rename is not allowed".to_string());
    }
    let from_name = from
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid source path".to_string())?;
    let to_name = to
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid target path".to_string())?;
    let expected_to_name = strip_temp_download_suffix(from_name)
        .ok_or_else(|| "Only temporary download files can be renamed".to_string())?;
    if expected_to_name != to_name {
        return Err("Invalid rename target".to_string());
    }

    std::fs::rename(from, to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    read_torrent_bytes_from_path(&path)
}

fn resolve_torrent_fs_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    ensure_torrent_extension(&path)?;
    canonicalize_path(&path).map_err(|_| "Path does not exist".to_string())
}

fn read_torrent_bytes_from_path(path: &str) -> Result<Vec<u8>, String> {
    let path = resolve_torrent_fs_path(path)?;
    std::fs::read(path).map_err(|e| e.to_string())
}

fn parse_bencode_integer(input: &[u8], cursor: &mut usize) -> Result<BencodeValue, String> {
    *cursor += 1; // skip `i`
    let start = *cursor;
    while *cursor < input.len() && input[*cursor] != b'e' {
        *cursor += 1;
    }
    if *cursor >= input.len() {
        return Err("Invalid torrent metadata".to_string());
    }

    let text =
        std::str::from_utf8(&input[start..*cursor]).map_err(|_| "Invalid torrent metadata")?;
    *cursor += 1; // skip `e`
    let value = text
        .parse::<i64>()
        .map_err(|_| "Invalid torrent metadata".to_string())?;
    Ok(BencodeValue::Integer(value))
}

fn parse_bencode_bytes(input: &[u8], cursor: &mut usize) -> Result<BencodeValue, String> {
    let start = *cursor;
    while *cursor < input.len() && input[*cursor].is_ascii_digit() {
        *cursor += 1;
    }
    if start == *cursor || *cursor >= input.len() || input[*cursor] != b':' {
        return Err("Invalid torrent metadata".to_string());
    }

    let len_text =
        std::str::from_utf8(&input[start..*cursor]).map_err(|_| "Invalid torrent metadata")?;
    let len = len_text
        .parse::<usize>()
        .map_err(|_| "Invalid torrent metadata".to_string())?;
    *cursor += 1; // skip `:`
    let end = cursor
        .checked_add(len)
        .ok_or_else(|| "Invalid torrent metadata".to_string())?;
    if end > input.len() {
        return Err("Invalid torrent metadata".to_string());
    }

    let value = input[*cursor..end].to_vec();
    *cursor = end;
    Ok(BencodeValue::Bytes(value))
}

fn parse_bencode_list(input: &[u8], cursor: &mut usize) -> Result<BencodeValue, String> {
    *cursor += 1; // skip `l`
    let mut list = Vec::new();
    while *cursor < input.len() && input[*cursor] != b'e' {
        list.push(parse_bencode_value(input, cursor)?);
    }
    if *cursor >= input.len() {
        return Err("Invalid torrent metadata".to_string());
    }
    *cursor += 1; // skip `e`
    Ok(BencodeValue::List(list))
}

fn parse_bencode_dictionary(input: &[u8], cursor: &mut usize) -> Result<BencodeValue, String> {
    *cursor += 1; // skip `d`
    let mut dict = BTreeMap::new();
    while *cursor < input.len() && input[*cursor] != b'e' {
        let key = parse_bencode_bytes(input, cursor)?;
        let BencodeValue::Bytes(key) = key else {
            return Err("Invalid torrent metadata".to_string());
        };
        let value = parse_bencode_value(input, cursor)?;
        dict.insert(key, value);
    }
    if *cursor >= input.len() {
        return Err("Invalid torrent metadata".to_string());
    }
    *cursor += 1; // skip `e`
    Ok(BencodeValue::Dictionary(dict))
}

fn parse_bencode_value(input: &[u8], cursor: &mut usize) -> Result<BencodeValue, String> {
    if *cursor >= input.len() {
        return Err("Invalid torrent metadata".to_string());
    }
    match input[*cursor] {
        b'i' => parse_bencode_integer(input, cursor),
        b'l' => parse_bencode_list(input, cursor),
        b'd' => parse_bencode_dictionary(input, cursor),
        b'0'..=b'9' => parse_bencode_bytes(input, cursor),
        _ => Err("Invalid torrent metadata".to_string()),
    }
}

fn as_dict(value: &BencodeValue) -> Option<&BTreeMap<Vec<u8>, BencodeValue>> {
    let BencodeValue::Dictionary(dict) = value else {
        return None;
    };
    Some(dict)
}

fn as_list(value: &BencodeValue) -> Option<&[BencodeValue]> {
    let BencodeValue::List(list) = value else {
        return None;
    };
    Some(list)
}

fn as_string(value: &BencodeValue) -> String {
    match value {
        BencodeValue::Bytes(bytes) => String::from_utf8_lossy(bytes).to_string(),
        BencodeValue::Integer(value) => value.to_string(),
        _ => String::new(),
    }
}

fn as_length(value: Option<&BencodeValue>) -> i64 {
    match value {
        Some(BencodeValue::Integer(value)) if *value > 0 => *value,
        _ => 0,
    }
}

fn dict_get_first<'a>(
    dict: &'a BTreeMap<Vec<u8>, BencodeValue>,
    keys: &[&[u8]],
) -> Option<&'a BencodeValue> {
    keys.iter().find_map(|key| dict.get(*key))
}

fn normalize_torrent_path(path: &str) -> String {
    path.replace('\\', "/").trim_start_matches('/').to_string()
}

pub(crate) fn inspect_torrent_metadata(
    bytes: &[u8],
    fallback: &str,
) -> Result<(bool, String), String> {
    if bytes.is_empty() {
        return Err("Torrent payload is empty".to_string());
    }

    let mut cursor = 0usize;
    let root = parse_bencode_value(bytes, &mut cursor)?;
    let root_dict = as_dict(&root).ok_or_else(|| "Invalid torrent metadata".to_string())?;
    let info_value = dict_get_first(root_dict, &[b"info"])
        .ok_or_else(|| "Invalid torrent metadata".to_string())?;
    let info = as_dict(info_value).ok_or_else(|| "Invalid torrent metadata".to_string())?;

    let is_multi_file = matches!(
        dict_get_first(info, &[b"files"]).and_then(as_list),
        Some(files) if !files.is_empty()
    );

    let name = dict_get_first(info, &[b"name.utf-8", b"name"])
        .map(as_string)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string());
    Ok((is_multi_file, name))
}

fn split_torrent_path_segments(path: &str) -> Vec<String> {
    normalize_torrent_path(path)
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect()
}

fn normalize_parent_segments(parent_path: Option<&str>, normalized_root_name: &str) -> Vec<String> {
    let raw = normalize_torrent_path(parent_path.unwrap_or(""));
    if raw.is_empty() || raw == normalized_root_name {
        return Vec::new();
    }

    let relative = if !normalized_root_name.is_empty() {
        let prefix = format!("{normalized_root_name}/");
        if raw.starts_with(&prefix) {
            raw[prefix.len()..].to_string()
        } else {
            raw
        }
    } else {
        raw
    };

    split_torrent_path_segments(&relative)
}

fn push_index_to_ranges(ranges: &mut Vec<(usize, usize)>, index: usize) {
    if index == 0 {
        return;
    }

    if let Some((_, end)) = ranges.last_mut() {
        if index <= end.saturating_add(1) {
            if index > *end {
                *end = index;
            }
            return;
        }
    }

    ranges.push((index, index));
}

fn encode_index_ranges(ranges: &[(usize, usize)]) -> Option<String> {
    if ranges.is_empty() {
        return None;
    }

    let encoded = ranges
        .iter()
        .map(|(start, end)| {
            if start == end {
                format!("{start}")
            } else {
                format!("{start}-{end}")
            }
        })
        .collect::<Vec<_>>()
        .join(",");

    if encoded.is_empty() {
        None
    } else {
        Some(encoded)
    }
}

fn collect_direct_children(
    raw_files: &[BencodeValue],
    normalized_root_name: &str,
    parent_segments: &[String],
) -> Vec<ResolvedTorrentItem> {
    let mut folder_items: BTreeMap<String, ResolvedTorrentItem> = BTreeMap::new();
    let mut file_items: BTreeMap<String, ResolvedTorrentItem> = BTreeMap::new();
    let mut folder_index_ranges: BTreeMap<String, Vec<(usize, usize)>> = BTreeMap::new();

    for (file_index, item) in raw_files.iter().enumerate() {
        let Some(item_dict) = as_dict(item) else {
            continue;
        };

        let segments = dict_get_first(item_dict, &[b"path.utf-8", b"path"])
            .and_then(as_list)
            .map(|parts| {
                parts
                    .iter()
                    .map(as_string)
                    .filter(|part| !part.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if segments.is_empty() {
            continue;
        }

        if parent_segments.len() > segments.len() {
            continue;
        }
        let is_child_of_parent = parent_segments
            .iter()
            .zip(segments.iter())
            .all(|(parent, child)| parent == child);
        if !is_child_of_parent {
            continue;
        }

        let remaining = &segments[parent_segments.len()..];
        if remaining.is_empty() {
            continue;
        }

        let child_name = remaining[0].clone();
        let mut full_path_segments: Vec<String> = Vec::new();
        if !normalized_root_name.is_empty() {
            full_path_segments.push(normalized_root_name.to_string());
        }
        full_path_segments.extend(parent_segments.iter().cloned());
        full_path_segments.push(child_name.clone());
        let full_path = normalize_torrent_path(&full_path_segments.join("/"));
        if full_path.is_empty() {
            continue;
        }

        if remaining.len() == 1 {
            let length = as_length(dict_get_first(item_dict, &[b"length"]));
            file_items
                .entry(full_path.clone())
                .or_insert_with(|| ResolvedTorrentItem {
                    path: full_path,
                    length,
                    name: child_name,
                    item_type: "file".to_string(),
                    has_children: false,
                    index: Some(file_index + 1),
                    select_ranges: None,
                });
        } else {
            folder_items
                .entry(full_path.clone())
                .or_insert_with(|| ResolvedTorrentItem {
                    path: full_path.clone(),
                    length: 0,
                    name: child_name,
                    item_type: "folder".to_string(),
                    has_children: true,
                    index: None,
                    select_ranges: None,
                });
            let ranges = folder_index_ranges.entry(full_path.clone()).or_default();
            push_index_to_ranges(ranges, file_index + 1);
        }
    }

    let mut items = folder_items
        .into_iter()
        .map(|(path, mut item)| {
            item.select_ranges = folder_index_ranges
                .get(&path)
                .and_then(|ranges| encode_index_ranges(ranges.as_slice()));
            item
        })
        .collect::<Vec<_>>();
    items.extend(file_items.into_values());
    items.sort_by(|a, b| {
        let a_folder = a.item_type == "folder";
        let b_folder = b.item_type == "folder";
        if a_folder != b_folder {
            if a_folder {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        } else {
            a.name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase())
                .then_with(|| a.path.cmp(&b.path))
        }
    });
    items
}

fn resolve_torrent_from_bytes(
    bytes: &[u8],
    file_name: &str,
    force_preview: bool,
    parent_path: Option<&str>,
    offset: usize,
    limit: usize,
) -> Result<ResolvedTorrentPayload, String> {
    if bytes.is_empty() {
        return Err("Torrent payload is empty".to_string());
    }

    if !force_preview && bytes.len() > MAX_TORRENT_PREVIEW_BYTES {
        return Ok(ResolvedTorrentPayload {
            files: Vec::new(),
            items: Vec::new(),
            file_count: 0,
            items_total: 0,
            next_offset: 0,
            preview_disabled: true,
            preview_reason: "size".to_string(),
        });
    }

    let mut cursor = 0usize;
    let root = parse_bencode_value(bytes, &mut cursor)?;
    let root_dict = as_dict(&root).ok_or_else(|| "Invalid torrent metadata".to_string())?;
    let info_value = dict_get_first(root_dict, &[b"info"])
        .ok_or_else(|| "Invalid torrent metadata".to_string())?;
    let info = as_dict(info_value).ok_or_else(|| "Invalid torrent metadata".to_string())?;

    let root_name = dict_get_first(info, &[b"name.utf-8", b"name"])
        .map(as_string)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| file_name.to_string());
    let normalized_root_name = normalize_torrent_path(&root_name);

    if let Some(files_value) = dict_get_first(info, &[b"files"]) {
        if let Some(raw_files) = as_list(files_value) {
            let file_count = raw_files.len();
            if !force_preview && file_count > MAX_TORRENT_PREVIEW_FILES {
                return Ok(ResolvedTorrentPayload {
                    files: Vec::new(),
                    items: Vec::new(),
                    file_count,
                    items_total: 0,
                    next_offset: 0,
                    preview_disabled: true,
                    preview_reason: "count".to_string(),
                });
            }

            if force_preview {
                let parent_segments = normalize_parent_segments(parent_path, &normalized_root_name);
                let items =
                    collect_direct_children(raw_files, &normalized_root_name, &parent_segments);
                let items_total = items.len();
                let safe_offset = offset.min(items_total);
                let paged_items = items
                    .into_iter()
                    .skip(safe_offset)
                    .take(limit)
                    .collect::<Vec<_>>();
                let next_offset = safe_offset + paged_items.len();
                return Ok(ResolvedTorrentPayload {
                    files: Vec::new(),
                    items: paged_items,
                    file_count,
                    items_total,
                    next_offset,
                    preview_disabled: false,
                    preview_reason: String::new(),
                });
            }

            let mut files = Vec::with_capacity(file_count);
            for item in raw_files {
                let Some(item_dict) = as_dict(item) else {
                    continue;
                };

                let length = as_length(dict_get_first(item_dict, &[b"length"]));
                let segments = dict_get_first(item_dict, &[b"path.utf-8", b"path"])
                    .and_then(as_list)
                    .map(|parts| {
                        parts
                            .iter()
                            .map(as_string)
                            .filter(|part| !part.is_empty())
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();

                let relative_path = normalize_torrent_path(&segments.join("/"));
                let full_path = if relative_path.is_empty() {
                    normalized_root_name.clone()
                } else {
                    normalize_torrent_path(&format!("{}/{}", normalized_root_name, relative_path))
                };
                if full_path.is_empty() {
                    continue;
                }

                let name = segments
                    .last()
                    .cloned()
                    .unwrap_or_else(|| root_name.clone());
                files.push(ResolvedTorrentFile {
                    path: full_path,
                    length,
                    name,
                });
            }

            return Ok(ResolvedTorrentPayload {
                files,
                items: Vec::new(),
                file_count,
                items_total: 0,
                next_offset: 0,
                preview_disabled: false,
                preview_reason: String::new(),
            });
        }
    }

    let single_name = if normalized_root_name.is_empty() {
        file_name.to_string()
    } else {
        root_name
    };
    let single_path = normalize_torrent_path(&single_name);
    let length = as_length(dict_get_first(info, &[b"length"]));

    if force_preview {
        let parent_segments = normalize_parent_segments(parent_path, &normalized_root_name);
        let items = if parent_segments.is_empty() {
            vec![ResolvedTorrentItem {
                path: single_path.clone(),
                length,
                name: single_name.clone(),
                item_type: "file".to_string(),
                has_children: false,
                index: Some(1),
                select_ranges: None,
            }]
        } else {
            Vec::new()
        };
        let items_total = items.len();
        let safe_offset = offset.min(items_total);
        let paged_items = items
            .into_iter()
            .skip(safe_offset)
            .take(limit)
            .collect::<Vec<_>>();
        let next_offset = safe_offset + paged_items.len();
        return Ok(ResolvedTorrentPayload {
            files: Vec::new(),
            items: paged_items,
            file_count: 1,
            items_total,
            next_offset,
            preview_disabled: false,
            preview_reason: String::new(),
        });
    }

    Ok(ResolvedTorrentPayload {
        files: vec![ResolvedTorrentFile {
            path: single_path.clone(),
            length,
            name: single_name,
        }],
        items: Vec::new(),
        file_count: 1,
        items_total: 0,
        next_offset: 0,
        preview_disabled: false,
        preview_reason: String::new(),
    })
}

#[tauri::command]
pub fn resolve_torrent_path(
    path: String,
    file_name: Option<String>,
    force_preview: Option<bool>,
    parent_path: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<ResolvedTorrentPayload, String> {
    let resolved_path = resolve_torrent_fs_path(&path)?;
    let bytes = std::fs::read(&resolved_path).map_err(|e| e.to_string())?;
    let fallback_name = file_name
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .or_else(|| {
            resolved_path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.to_string())
        })
        .unwrap_or_else(|| "task.torrent".to_string());

    resolve_torrent_from_bytes(
        &bytes,
        &fallback_name,
        force_preview.unwrap_or(false),
        parent_path.as_deref(),
        offset.unwrap_or(0),
        normalize_preview_limit(limit),
    )
}

fn normalize_info_hash(raw: &str) -> String {
    let value = raw.trim().to_ascii_lowercase();
    let stripped = value.strip_prefix("urn:btih:").unwrap_or(&value);
    stripped.chars().filter(|c| c.is_ascii_hexdigit()).collect()
}

fn matches_generated_torrent_sidecar(file_name: &str, normalized_info_hash: &str) -> bool {
    if normalized_info_hash.len() != 40 && normalized_info_hash.len() != 64 {
        return false;
    }

    let lower = file_name.to_ascii_lowercase();
    if !lower.ends_with(".torrent") {
        return false;
    }

    let stem = lower.strip_suffix(".torrent").unwrap_or(&lower);
    if stem.contains(normalized_info_hash) {
        return true;
    }

    let is_hex_stem = stem.chars().all(|c| c.is_ascii_hexdigit());
    is_hex_stem && (stem.len() == 40 || stem.len() == 64) && stem == normalized_info_hash
}

#[tauri::command]
pub fn trash_generated_torrent_sidecars(
    _handle: AppHandle,
    dir: String,
    info_hash: String,
) -> Result<u32, String> {
    let normalized = normalize_info_hash(&info_hash);
    if normalized.len() != 40 && normalized.len() != 64 {
        return Ok(0);
    }
    let dir = PathBuf::from(dir);
    let dir = canonicalize_path(&dir).map_err(|_| "Path does not exist".to_string())?;
    if !dir.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut deleted = 0u32;
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !matches_generated_torrent_sidecar(file_name, &normalized) {
            continue;
        }

        let deleted_ok = trash::delete(&path).is_ok() || std::fs::remove_file(&path).is_ok();
        if deleted_ok {
            deleted += 1;
        }
    }

    Ok(deleted)
}
