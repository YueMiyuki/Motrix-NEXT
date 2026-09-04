use tauri::{AppHandle, Manager};

pub const RUN_MODE_STANDARD: i64 = 1;
#[cfg(target_os = "macos")]
pub const RUN_MODE_TRAY: i64 = 2;
#[cfg(target_os = "macos")]
pub const RUN_MODE_HIDE_TRAY_LEGACY: i64 = 3;

/// Get the current run mode from app config (1 = standard, 2 = tray, 3 = hide tray legacy)
pub fn current_run_mode(handle: &AppHandle) -> i64 {
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

/// Check if the current run mode is a tray mode (2 or 3)
#[cfg(target_os = "macos")]
pub fn is_tray_mode(run_mode: i64) -> bool {
    matches!(run_mode, RUN_MODE_TRAY | RUN_MODE_HIDE_TRAY_LEGACY)
}

#[cfg(target_os = "macos")]
/// Update macOS activation policy based on run mode
pub fn update_macos_activation_policy_for_mode(handle: &AppHandle, run_mode: i64) {
    let policy = if is_tray_mode(run_mode) {
        tauri::ActivationPolicy::Accessory
    } else {
        tauri::ActivationPolicy::Regular
    };
    let _ = handle.set_activation_policy(policy);
}

#[cfg(not(target_os = "macos"))]
/// No-op on non-macOS platforms
pub fn update_macos_activation_policy_for_mode(_handle: &AppHandle, _run_mode: i64) {}
