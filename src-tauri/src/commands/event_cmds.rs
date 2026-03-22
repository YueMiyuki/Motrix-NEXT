#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::process::{Child, Command};
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::sync::{Mutex, OnceLock};
#[cfg(target_os = "windows")]
use std::{
    ffi::c_void,
    os::windows::ffi::OsStrExt,
    path::Path,
    sync::{mpsc, OnceLock},
    thread,
};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn on_download_status_change(
    downloading: bool,
    _state: tauri::State<'_, crate::state::AppState>,
) -> Result<(), String> {
    apply_download_inhibit(downloading);
    Ok(())
}

#[tauri::command]
pub fn on_speed_change(
    handle: AppHandle,
    upload_speed: u64,
    download_speed: u64,
    show_tray_speed: bool,
) -> Result<(), String> {
    if let Some(tray) = handle.tray_by_id("main") {
        if !show_tray_speed {
            let _ = tray.set_tooltip(Some("Motrix"));
            return Ok(());
        }

        let tooltip = if upload_speed > 0 || download_speed > 0 {
            format!(
                "Motrix\nDL: {}/s  UL: {}/s",
                format_speed(download_speed),
                format_speed(upload_speed)
            )
        } else {
            "Motrix".to_string()
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
    Ok(())
}

#[tauri::command]
pub fn on_progress_change(
    handle: AppHandle,
    progress: f64,
    show_progress_bar: bool,
) -> Result<(), String> {
    if let Some(window) = handle.get_webview_window("main") {
        let (status, prog) = if show_progress_bar && (0.0..=1.0).contains(&progress) {
            (
                tauri::window::ProgressBarStatus::Normal,
                Some((progress * 100.0) as u64),
            )
        } else {
            (tauri::window::ProgressBarStatus::None, None)
        };
        let _ = window.set_progress_bar(tauri::window::ProgressBarState {
            status: Some(status),
            progress: prog,
        });
    }
    Ok(())
}

#[tauri::command]
pub fn on_task_download_complete(_handle: AppHandle, path: String) -> Result<(), String> {
    add_recent_document(&path)?;
    Ok(())
}

#[tauri::command]
pub fn update_tray(
    handle: AppHandle,
    image_data: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    if let Some(tray) = handle.tray_by_id("main") {
        let image = tauri::image::Image::new_owned(image_data, width, height);
        let _ = tray.set_icon(Some(image));
    }
    Ok(())
}

fn format_speed(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn apply_download_inhibit(downloading: bool) {
    #[cfg(target_os = "windows")]
    {
        windows_apply_download_inhibit(downloading);
    }

    #[cfg(target_os = "macos")]
    {
        macos_apply_download_inhibit(downloading);
    }

    #[cfg(target_os = "linux")]
    {
        linux_apply_download_inhibit(downloading);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = downloading;
    }
}

fn add_recent_document(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_add_recent_document(path)?;
    }

    #[cfg(target_os = "macos")]
    {
        // No stable Rust std API exists for app-scoped recent-docs registration on macOS.
        // Keep this a no-op for now to avoid opening files as a side effect.
        let _ = path;
    }

    #[cfg(target_os = "linux")]
    {
        // No freedesktop-wide app-scoped recent-doc API is available through std.
        let _ = path;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_inhibit_slot() -> &'static Mutex<Option<Child>> {
    static SLOT: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "macos")]
fn clear_macos_inhibit_child(child_guard: &mut Option<Child>) {
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(target_os = "macos")]
fn macos_apply_download_inhibit(downloading: bool) {
    let slot = macos_inhibit_slot();
    let Ok(mut child_guard) = slot.lock() else {
        return;
    };

    if downloading {
        if child_guard.is_none() {
            match Command::new("caffeinate").args(["-ims"]).spawn() {
                Ok(child) => {
                    *child_guard = Some(child);
                }
                Err(err) => {
                    log::warn!("Failed to spawn caffeinate: {}", err);
                }
            }
        }
    } else {
        clear_macos_inhibit_child(&mut child_guard);
    }
}

#[cfg(target_os = "linux")]
fn linux_inhibit_cookie_slot() -> &'static Mutex<Option<u32>> {
    static SLOT: OnceLock<Mutex<Option<u32>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "linux")]
fn parse_dbus_uint32(output: &[u8]) -> Option<u32> {
    let stdout = String::from_utf8_lossy(output);
    stdout
        .split_whitespace()
        .find_map(|part| part.parse::<u32>().ok())
}

#[cfg(target_os = "linux")]
fn linux_apply_download_inhibit(downloading: bool) {
    let slot = linux_inhibit_cookie_slot();
    let Ok(mut cookie_guard) = slot.lock() else {
        return;
    };

    if downloading {
        if cookie_guard.is_none() {
            match Command::new("dbus-send")
                .args([
                    "--session",
                    "--dest=org.freedesktop.ScreenSaver",
                    "--type=method_call",
                    "--print-reply",
                    "/org/freedesktop/ScreenSaver",
                    "org.freedesktop.ScreenSaver.Inhibit",
                    "string:Motrix",
                    "string:Downloading active tasks",
                ])
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        if let Some(cookie) = parse_dbus_uint32(&output.stdout) {
                            *cookie_guard = Some(cookie);
                        } else {
                            log::warn!("Failed to parse DBus inhibit cookie from response");
                        }
                    } else {
                        log::warn!(
                            "DBus Inhibit call failed with status {:?}",
                            output.status.code()
                        );
                    }
                }
                Err(err) => {
                    log::warn!("Failed to invoke DBus Inhibit call: {}", err);
                }
            }
        }
    } else if let Some(cookie) = cookie_guard.as_ref().copied() {
        match Command::new("dbus-send")
            .args([
                "--session",
                "--dest=org.freedesktop.ScreenSaver",
                "--type=method_call",
                "--print-reply",
                "/org/freedesktop/ScreenSaver",
                "org.freedesktop.ScreenSaver.UnInhibit",
                &format!("uint32:{cookie}"),
            ])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    *cookie_guard = None;
                } else {
                    log::warn!(
                        "DBus UnInhibit call failed with status {:?}, keeping cookie {} for retry",
                        output.status.code(),
                        cookie
                    );
                }
            }
            Err(err) => {
                log::warn!(
                    "Failed to invoke DBus UnInhibit call, keeping cookie {} for retry: {}",
                    cookie,
                    err
                );
            }
        }
    }
}

#[cfg(target_os = "windows")]
struct WindowsInhibitWorker {
    tx: mpsc::Sender<bool>,
}

#[cfg(target_os = "windows")]
fn windows_inhibit_worker() -> &'static WindowsInhibitWorker {
    const ES_CONTINUOUS: u32 = 0x8000_0000;
    const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;

    static WORKER: OnceLock<WindowsInhibitWorker> = OnceLock::new();
    WORKER.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<bool>();

        thread::spawn(move || {
            let mut inhibited = false;
            while let Ok(downloading) = rx.recv() {
                if downloading == inhibited {
                    continue;
                }

                let flags = if downloading {
                    ES_CONTINUOUS | ES_SYSTEM_REQUIRED
                } else {
                    ES_CONTINUOUS
                };

                unsafe {
                    // SAFETY: All SetThreadExecutionState calls happen on this dedicated worker thread.
                    let _ = SetThreadExecutionState(flags);
                }

                inhibited = downloading;
            }
        });

        WindowsInhibitWorker { tx }
    })
}

#[cfg(target_os = "windows")]
fn windows_apply_download_inhibit(downloading: bool) {
    let worker = windows_inhibit_worker();
    if let Err(err) = worker.tx.send(downloading) {
        log::warn!("Failed to update Windows sleep inhibit state: {}", err);
    }
}

pub fn cleanup_download_inhibit() {
    #[cfg(target_os = "windows")]
    {
        windows_apply_download_inhibit(false);
    }

    #[cfg(target_os = "macos")]
    {
        let slot = macos_inhibit_slot();
        if let Ok(mut child_guard) = slot.lock() {
            clear_macos_inhibit_child(&mut child_guard);
        }
    }

    #[cfg(target_os = "linux")]
    {
        linux_apply_download_inhibit(false);
    }
}

#[cfg(target_os = "windows")]
fn windows_add_recent_document(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    const SHARD_PATHW: u32 = 0x0000_0003;
    unsafe {
        // SAFETY: SHAddToRecentDocs reads a null-terminated wide path pointer for SHARD_PATHW.
        SHAddToRecentDocs(SHARD_PATHW, wide.as_ptr() as *const c_void);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn SetThreadExecutionState(es_flags: u32) -> u32;
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
unsafe extern "system" {
    fn SHAddToRecentDocs(u_flags: u32, pv: *const c_void);
}
