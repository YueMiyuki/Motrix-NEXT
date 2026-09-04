//! Tray "Quick Panel" flyout window

#[cfg(not(target_os = "android"))]
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

#[cfg(not(target_os = "android"))]
pub const FLYOUT_LABEL: &str = "tray-panel";

/// Logical size of the flyout window
#[cfg(not(target_os = "android"))]
const FLYOUT_WIDTH: f64 = 396.0;
#[cfg(not(target_os = "android"))]
const FLYOUT_HEIGHT: f64 = 540.0;

/// Create the flyout window
#[cfg(not(target_os = "android"))]
pub fn setup_flyout(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    // Skip if it somehow already exists
    if handle.get_webview_window(FLYOUT_LABEL).is_some() {
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(app, FLYOUT_LABEL, WebviewUrl::App("tray.html".into()))
        .title("Risuko Quick Panel")
        .inner_size(FLYOUT_WIDTH, FLYOUT_HEIGHT)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .focused(false)
        .transparent(true)
        .shadow(false)
        .accept_first_mouse(true);

    #[cfg(target_os = "macos")]
    let builder = builder.visible_on_all_workspaces(true);

    builder.build()?;
    Ok(())
}

#[cfg(target_os = "android")]
pub fn setup_flyout(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

/// Drop to Accessory policy when the flyout closes in tray mode, but only if the main window is hidden — demoting while it is visible deactivates the app and strands the window (no Dock icon, no Cmd-Tab)
#[cfg(target_os = "macos")]
pub fn demote_if_ui_hidden(app: &AppHandle) {
    let run_mode = crate::utils::run_mode::current_run_mode(app);
    if !crate::utils::run_mode::is_tray_mode(run_mode) {
        return;
    }
    let main_visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if !main_visible {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
}

/// Cache the tray icon rect
#[cfg(not(target_os = "android"))]
pub fn cache_tray_rect(app: &AppHandle, rect: &tauri::Rect, scale_factor: f64) {
    let pos = rect.position.to_physical::<f64>(scale_factor);
    let size = rect.size.to_physical::<f64>(scale_factor);
    if let Some(state) = app.try_state::<crate::state::AppState>() {
        if let Ok(mut anchor) = state.tray_anchor.lock() {
            *anchor = Some((pos.x, pos.y, size.width, size.height));
        }
    }
}

/// Toggle the flyout
#[cfg(not(target_os = "android"))]
pub fn toggle_flyout(app: &AppHandle) {
    let Some(window) = app.get_webview_window(FLYOUT_LABEL) else {
        tracing::warn!("[Risuko] flyout window not found");
        return;
    };

    if window.is_visible().unwrap_or(false) {
        #[cfg(target_os = "macos")]
        demote_if_ui_hidden(app);
        let _ = window.hide();
        return;
    }

    position_flyout(app, &window);
    let _ = window.show();
    let _ = window.set_focus();
    // Wake the webview's polling loop so the panel is fresh on open
    let _ = window.emit("flyout:show", ());
}

/// Position the flyout near the cached tray anchor
#[cfg(not(target_os = "android"))]
fn position_flyout(app: &AppHandle, window: &WebviewWindow) {
    // Resolve the anchor point (icon center) in physical pixels
    let anchor = app
        .try_state::<crate::state::AppState>()
        .and_then(|state| state.tray_anchor.lock().ok().and_then(|guard| *guard));

    let (icon_x, icon_y, icon_w, icon_h) = match anchor {
        Some(rect) => rect,
        None => {
            // No tray rect was ever delivered
            match app.cursor_position() {
                Ok(pos) => (pos.x, pos.y, 0.0, 0.0),
                Err(_) => (0.0, 0.0, 0.0, 0.0),
            }
        }
    };

    let icon_center_x = icon_x + icon_w / 2.0;
    let icon_center_y = icon_y + icon_h / 2.0;

    // Find the monitor under the icon; fall back to primary
    let monitor = app
        .monitor_from_point(icon_center_x, icon_center_y)
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        // Last resort: drop it at the anchor with no clamping
        let _ = window.set_position(PhysicalPosition::new(icon_x as i32, icon_y as i32));
        return;
    };

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let wa_x = work.position.x as f64;
    let wa_y = work.position.y as f64;
    let wa_w = work.size.width as f64;
    let wa_h = work.size.height as f64;

    // Window size in physical pixels
    let win_w = FLYOUT_WIDTH * scale;
    let win_h = FLYOUT_HEIGHT * scale;

    // Decide above vs below using the icon center relative to the work area
    let in_top_half = icon_center_y < wa_y + wa_h / 2.0;
    let mut y = if in_top_half {
        // Place below the icon
        icon_y + icon_h
    } else {
        // Place above the icon
        icon_y - win_h
    };

    // Horizontally center on the icon
    let mut x = icon_center_x - win_w / 2.0;

    // Clamp into the work area
    let max_x = wa_x + wa_w - win_w;
    let max_y = wa_y + wa_h - win_h;
    if x < wa_x {
        x = wa_x;
    } else if x > max_x {
        x = max_x.max(wa_x);
    }
    if y < wa_y {
        y = wa_y;
    } else if y > max_y {
        y = max_y.max(wa_y);
    }

    let _ = window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
}
