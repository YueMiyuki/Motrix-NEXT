use std::collections::HashMap;

use tauri::{
    image::Image,
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager,
};

use super::{emit_command, show_and_emit};

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = crate::commands::app_cmds::hide_main_window(app);
        } else {
            let _ = crate::commands::app_cmds::show_main_window(app);
        }
    }
}

fn get_tray_menu_text(labels: &HashMap<String, String>, id: &str, fallback: &str) -> String {
    labels
        .get(id)
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn build_tray_menu(
    handle: &AppHandle,
    labels: &HashMap<String, String>,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let new_task = MenuItemBuilder::with_id(
        "tray-new-task",
        get_tray_menu_text(labels, "tray-new-task", "New Task"),
    )
    .build(handle)?;
    let new_bt_task = MenuItemBuilder::with_id(
        "tray-new-bt-task",
        get_tray_menu_text(labels, "tray-new-bt-task", "New BT Task"),
    )
    .build(handle)?;
    let open_file = MenuItemBuilder::with_id(
        "tray-open-file",
        get_tray_menu_text(labels, "tray-open-file", "Open Torrent File..."),
    )
    .build(handle)?;
    let sep1 = PredefinedMenuItem::separator(handle)?;
    let show = MenuItemBuilder::with_id(
        "tray-show",
        get_tray_menu_text(labels, "tray-show", "Show Motrix"),
    )
    .build(handle)?;
    let manual = MenuItemBuilder::with_id(
        "tray-manual",
        get_tray_menu_text(labels, "tray-manual", "Manual"),
    )
    .build(handle)?;
    let check_updates = MenuItemBuilder::with_id(
        "tray-check-updates",
        get_tray_menu_text(labels, "tray-check-updates", "Check for Updates..."),
    )
    .build(handle)?;
    let sep2 = PredefinedMenuItem::separator(handle)?;
    let task_list = MenuItemBuilder::with_id(
        "tray-task-list",
        get_tray_menu_text(labels, "tray-task-list", "Task List"),
    )
    .build(handle)?;
    let preferences = MenuItemBuilder::with_id(
        "tray-preferences",
        get_tray_menu_text(labels, "tray-preferences", "Preferences..."),
    )
    .build(handle)?;
    let sep3 = PredefinedMenuItem::separator(handle)?;
    let quit =
        MenuItemBuilder::with_id("tray-quit", get_tray_menu_text(labels, "tray-quit", "Quit"))
            .build(handle)?;

    let menu = MenuBuilder::new(handle)
        .items(&[
            &new_task,
            &new_bt_task,
            &open_file,
            &sep1,
            &show,
            &manual,
            &check_updates,
            &sep2,
            &task_list,
            &preferences,
            &sep3,
            &quit,
        ])
        .build()?;

    Ok(menu)
}

pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    let menu = build_tray_menu(handle, &HashMap::new())?;

    let icon_bytes = include_bytes!("../../icons/icon.png");
    let icon = Image::from_bytes(icon_bytes).expect("Failed to load tray icon");

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .tooltip("Motrix")
        .icon_as_template(true)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            match id {
                "tray-new-task" => show_and_emit(app, "application:new-task"),
                "tray-new-bt-task" => show_and_emit(app, "application:new-bt-task"),
                "tray-open-file" => show_and_emit(app, "application:open-file"),
                "tray-show" => {
                    let _ = crate::commands::app_cmds::show_main_window(app);
                }
                "tray-manual" => {
                    let _ = open::that("https://github.com/agalwood/Motrix/wiki");
                }
                "tray-check-updates" => emit_command(app, "application:check-for-updates"),
                "tray-task-list" => show_and_emit(app, "application:task-list"),
                "tray-preferences" => show_and_emit(app, "application:preferences"),
                "tray-quit" => {
                    let _ = crate::commands::app_cmds::show_main_window(app);
                    let _ = app.emit("confirm-quit", ());
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

pub fn update_tray_menu_labels(
    handle: &AppHandle,
    labels: &HashMap<String, String>,
) -> Result<(), String> {
    let Some(tray) = handle.tray_by_id("main") else {
        return Ok(());
    };

    let menu = build_tray_menu(handle, labels).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}
