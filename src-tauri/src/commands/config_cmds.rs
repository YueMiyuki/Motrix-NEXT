use serde_json::Value;
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

use crate::state::AppState;

#[tauri::command]
pub fn get_app_config(handle: AppHandle, state: State<'_, AppState>) -> Result<Value, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let mut merged = config.get_merged_config();

    if let Ok(enabled) = handle.autolaunch().is_enabled() {
        if let Some(map) = merged.as_object_mut() {
            map.insert("open-at-login".into(), Value::Bool(enabled));
        }
    }

    Ok(merged)
}

#[tauri::command]
pub fn save_preference(
    handle: AppHandle,
    state: State<'_, AppState>,
    config: Value,
) -> Result<(), String> {
    let open_at_login = config
        .get("user")
        .and_then(|v| v.get("open-at-login"))
        .and_then(|v| v.as_bool())
        .or_else(|| config.get("open-at-login").and_then(|v| v.as_bool()));

    let mut mgr = state.config.lock().map_err(|e| e.to_string())?;
    let mut user = config
        .get("user")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    if let Some(enabled) = open_at_login {
        user.insert("open-at-login".into(), Value::Bool(enabled));
    }

    if let Some(system) = config.get("system").and_then(|v| v.as_object()) {
        mgr.set_system_config_map(system)?;
    }

    if !user.is_empty() {
        mgr.set_user_config_map(&user)?;
    }

    if let Some(enabled) = open_at_login {
        apply_open_at_login(&handle, enabled)?;
    }

    Ok(())
}

fn apply_open_at_login(handle: &AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        handle.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        handle.autolaunch().disable().map_err(|e| e.to_string())?;
    }

    Ok(())
}
