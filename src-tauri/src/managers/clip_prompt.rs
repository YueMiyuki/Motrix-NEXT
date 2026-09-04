//! Clipboard Watcher prompt
#[cfg(not(target_os = "android"))]
use tauri::{Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[cfg(not(target_os = "android"))]
pub const CLIP_PROMPT_LABEL: &str = "clip-prompt";

#[cfg(not(target_os = "android"))]
const PROMPT_WIDTH: f64 = 384.0;
#[cfg(not(target_os = "android"))]
const PROMPT_HEIGHT: f64 = 156.0;

#[cfg(not(target_os = "android"))]
pub fn setup_clip_prompt(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    if handle.get_webview_window(CLIP_PROMPT_LABEL).is_some() {
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        CLIP_PROMPT_LABEL,
        WebviewUrl::App("clip-prompt.html".into()),
    )
    .title("Risuko")
    .inner_size(PROMPT_WIDTH, PROMPT_HEIGHT)
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
pub fn setup_clip_prompt(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(not(target_os = "android"))]
pub fn show_clip_prompt(app: &tauri::AppHandle, uri: &str) {
    #[cfg(target_os = "macos")]
    {
        let already_open = app
            .get_webview_window(CLIP_PROMPT_LABEL)
            .and_then(|w| w.is_visible().ok())
            .unwrap_or(false);
        if !already_open {
            prev_focus::remember();
        }
    }
    if let Some(state) = app.try_state::<crate::state::AppState>() {
        if let Ok(mut pending) = state.pending_clip_uri.lock() {
            *pending = Some(uri.to_string());
        }
    }
    let Some(window) = app.get_webview_window(CLIP_PROMPT_LABEL) else {
        tracing::warn!("[Risuko] clip-prompt window not found");
        return;
    };
    position_prompt(app, &window);
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit("clip-prompt:show", uri.to_string());
}

/// Hide the prompt window
#[cfg(not(target_os = "android"))]
pub fn hide_clip_prompt(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(CLIP_PROMPT_LABEL) {
        #[cfg(target_os = "macos")]
        crate::managers::flyout::demote_if_ui_hidden(app);
        let _ = window.hide();
    }
}

#[cfg(target_os = "macos")]
pub fn restore_prev_focus() {
    prev_focus::restore();
}

#[cfg(target_os = "macos")]
mod prev_focus {
    use std::sync::atomic::{AtomicI32, Ordering};

    // pid of the app frontmost when the prompt opened (0 = none / we were front)
    static PREV_APP_PID: AtomicI32 = AtomicI32::new(0);

    pub fn remember() {
        use objc2_app_kit::NSWorkspace;
        let self_pid = std::process::id() as i32;
        let pid = NSWorkspace::sharedWorkspace()
            .frontmostApplication()
            .map(|a| a.processIdentifier())
            .filter(|&p| p != self_pid)
            .unwrap_or(0);
        PREV_APP_PID.store(pid, Ordering::SeqCst);
    }

    pub fn restore() {
        let pid = PREV_APP_PID.swap(0, Ordering::SeqCst);
        if pid == 0 {
            return;
        }
        use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
        if let Some(app) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid) {
            app.activateWithOptions(NSApplicationActivationOptions::empty());
        }
    }
}

#[cfg(not(target_os = "android"))]
fn position_prompt(app: &tauri::AppHandle, window: &WebviewWindow) {
    let anchor = app
        .try_state::<crate::state::AppState>()
        .and_then(|state| state.tray_anchor.lock().ok().and_then(|guard| *guard));

    let (icon_x, icon_y, icon_w, icon_h) = match anchor {
        Some(rect) => rect,
        None => match app.cursor_position() {
            Ok(pos) => (pos.x, pos.y, 0.0, 0.0),
            Err(_) => (0.0, 0.0, 0.0, 0.0),
        },
    };

    let icon_center_x = icon_x + icon_w / 2.0;
    let icon_center_y = icon_y + icon_h / 2.0;

    let monitor = app
        .monitor_from_point(icon_center_x, icon_center_y)
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        let _ = window.set_position(PhysicalPosition::new(icon_x as i32, icon_y as i32));
        return;
    };

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let wa_x = work.position.x as f64;
    let wa_y = work.position.y as f64;
    let wa_w = work.size.width as f64;
    let wa_h = work.size.height as f64;

    let win_w = PROMPT_WIDTH * scale;
    let win_h = PROMPT_HEIGHT * scale;

    let in_top_half = icon_center_y < wa_y + wa_h / 2.0;
    let mut y = if in_top_half {
        icon_y + icon_h
    } else {
        icon_y - win_h
    };

    let mut x = icon_center_x - win_w / 2.0;

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
