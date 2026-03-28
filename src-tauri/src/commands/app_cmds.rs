use tauri::{AppHandle, Manager};

const RUN_MODE_STANDARD: i64 = 1;
#[cfg(target_os = "macos")]
const RUN_MODE_TRAY: i64 = 2;
#[cfg(target_os = "macos")]
const RUN_MODE_HIDE_TRAY_LEGACY: i64 = 3;

fn current_run_mode(handle: &AppHandle) -> i64 {
    handle
        .state::<crate::state::AppState>()
        .config
        .lock()
        .ok()
        .and_then(|cfg| {
            cfg.get_user_config()
                .get("run-mode")
                .and_then(|value| value.as_i64())
        })
        .unwrap_or(RUN_MODE_STANDARD)
}

#[cfg(target_os = "macos")]
fn update_macos_activation_policy_for_mode(handle: &AppHandle, run_mode: i64) {
    let policy = if matches!(run_mode, RUN_MODE_TRAY | RUN_MODE_HIDE_TRAY_LEGACY) {
        tauri::ActivationPolicy::Accessory
    } else {
        tauri::ActivationPolicy::Regular
    };
    let _ = handle.set_activation_policy(policy);
}

#[cfg(not(target_os = "macos"))]
fn update_macos_activation_policy_for_mode(_handle: &AppHandle, _run_mode: i64) {}

pub fn show_main_window(handle: &AppHandle) -> Result<(), String> {
    update_macos_activation_policy_for_mode(handle, RUN_MODE_STANDARD);
    if let Some(window) = handle.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn hide_main_window(handle: &AppHandle) -> Result<(), String> {
    let run_mode = current_run_mode(handle);
    if let Some(window) = handle.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    update_macos_activation_policy_for_mode(handle, run_mode);
    Ok(())
}

#[tauri::command]
pub async fn relaunch_app(handle: AppHandle) -> Result<(), String> {
    crate::engine::stop_engine(&handle)
        .await
        .map_err(|e| e.to_string())?;
    handle.restart();
}

#[tauri::command]
pub async fn quit_app(handle: AppHandle) -> Result<(), String> {
    crate::engine::stop_engine(&handle)
        .await
        .map_err(|e| e.to_string())?;
    handle.exit(0);
    Ok(())
}

#[tauri::command]
pub fn show_window(handle: AppHandle) -> Result<(), String> {
    show_main_window(&handle)
}

#[tauri::command]
pub fn hide_window(handle: AppHandle) -> Result<(), String> {
    hide_main_window(&handle)
}

#[tauri::command]
pub fn factory_reset(
    handle: AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.reset()?;
    drop(config);
    handle.restart();
}

#[tauri::command]
pub fn check_for_updates() -> Result<(), String> {
    Err("Update checking is not implemented for this build".to_string())
}

#[tauri::command]
pub async fn reset_session(handle: AppHandle) -> Result<(), String> {
    crate::engine::stop_engine(&handle)
        .await
        .map_err(|e| e.to_string())?;
    if let Ok(config_dir) = handle.path().app_config_dir() {
        let session_path = config_dir.join(crate::engine::SESSION_FILENAME);
        let _ = std::fs::remove_file(&session_path);
    }
    crate::engine::start_engine(&handle)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn auto_hide_window(enabled: bool) -> Result<(), String> {
    log::info!("auto_hide_window: {}", enabled);
    Ok(())
}

#[tauri::command]
pub fn is_opened_at_login() -> bool {
    std::env::args().any(|arg| arg == "--opened-at-login=1")
}
