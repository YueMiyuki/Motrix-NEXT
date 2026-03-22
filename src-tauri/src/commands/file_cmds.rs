use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

fn canonicalize_path(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("Path must be absolute".to_string());
    }

    std::fs::canonicalize(path).map_err(|e| e.to_string())
}

fn allowed_roots(handle: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(path) = dirs::download_dir() {
        roots.push(path);
    }
    if let Some(path) = dirs::document_dir() {
        roots.push(path);
    }
    if let Some(path) = dirs::desktop_dir() {
        roots.push(path);
    }
    if let Ok(path) = handle.path().app_data_dir() {
        roots.push(path);
    }
    if let Ok(path) = handle.path().app_local_data_dir() {
        roots.push(path);
    }
    if let Ok(path) = handle.path().app_config_dir() {
        roots.push(path);
    }
    if let Ok(path) = handle.path().resource_dir() {
        roots.push(path);
    }

    roots
}

fn resolve_allowed_path(
    handle: &AppHandle,
    path: &Path,
    scope_err_msg: &str,
) -> Result<PathBuf, String> {
    let canonical_path = canonicalize_path(path).map_err(|_| scope_err_msg.to_string())?;
    let allowed = allowed_roots(handle)
        .into_iter()
        .filter_map(|root| canonicalize_path(&root).ok())
        .any(|root| canonical_path.starts_with(&root));

    if allowed {
        Ok(canonical_path)
    } else {
        Err(scope_err_msg.to_string())
    }
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = p.parent() {
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
pub fn read_binary_file(handle: AppHandle, path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(path);

    if path
        .extension()
        .and_then(|value| value.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("torrent"))
        != Some(true)
    {
        return Err("Only .torrent files can be read".to_string());
    }

    let path = resolve_allowed_path(&handle, &path, "Path is outside the allowed read scope")?;
    std::fs::read(path).map_err(|e| e.to_string())
}

fn normalize_info_hash(raw: &str) -> String {
    let value = raw.trim().to_ascii_lowercase();
    let stripped = value.strip_prefix("urn:btih:").unwrap_or(&value);
    stripped.chars().filter(|c| c.is_ascii_hexdigit()).collect()
}

fn parse_generated_torrent_hash(file_name: &str) -> Option<String> {
    let lower = file_name.to_ascii_lowercase();
    if !lower.ends_with(".torrent") {
        return None;
    }

    let stem = lower.strip_suffix(".torrent")?;
    let hash = stem.strip_prefix("[metadata]").unwrap_or(stem);
    let valid_len = hash.len() == 40 || hash.len() == 64;
    if !valid_len || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }

    Some(hash.to_string())
}

#[tauri::command]
pub fn trash_generated_torrent_sidecars(
    handle: AppHandle,
    dir: String,
    info_hash: String,
) -> Result<u32, String> {
    let normalized = normalize_info_hash(&info_hash);
    if normalized.len() != 40 && normalized.len() != 64 {
        return Ok(0);
    }
    let dir = PathBuf::from(dir);

    let dir = resolve_allowed_path(
        &handle,
        &dir,
        "Directory is outside the allowed write scope",
    )?;

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
        let Some(file_hash) = parse_generated_torrent_hash(file_name) else {
            continue;
        };

        if file_hash == normalized {
            let deleted_ok = trash::delete(&path).is_ok() || std::fs::remove_file(&path).is_ok();
            if deleted_ok {
                deleted += 1;
            }
        }
    }

    Ok(deleted)
}
