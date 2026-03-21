use tauri::{
    menu::{
        AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, Submenu, SubmenuBuilder,
    },
    App, Emitter, Manager,
};

use super::{emit_command, show_and_emit};

pub fn setup_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(target_os = "macos") {
        setup_macos_menu(app)
    } else {
        setup_default_menu(app)
    }
}

fn setup_macos_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let app_menu = SubmenuBuilder::new(handle, "Motrix")
        .about(Some(
            AboutMetadataBuilder::new()
                .name(Some("Motrix"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .build(),
        ))
        .separator()
        .item(
            &MenuItemBuilder::with_id("preferences", "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("check-for-updates", "Check for Updates...")
                .build(handle)?,
        )
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(
            &MenuItemBuilder::with_id("quit", "Quit Motrix")
                .accelerator("CmdOrCtrl+Q")
                .build(handle)?,
        )
        .build()?;

    let task_menu = build_task_submenu(handle, true)?;
    let edit_menu = build_edit_submenu(handle)?;

    let window_menu = SubmenuBuilder::new(handle, "Window")
        .item(
            &MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(handle)?,
        )
        .close_window()
        .minimize()
        .maximize()
        .fullscreen()
        .separator()
        .item(&MenuItemBuilder::with_id("front", "Bring All to Front").build(handle)?)
        .build()?;

    let help_menu = build_help_submenu(handle)?;

    let menu = MenuBuilder::new(handle)
        .items(&[&app_menu, &task_menu, &edit_menu, &window_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;
    setup_menu_event_handler(app);
    Ok(())
}

fn setup_default_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&MenuItemBuilder::with_id("about", "About Motrix").build(handle)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("preferences", "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("check-for-updates", "Check for Updates...")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("show-window", "Show Motrix")
                .build(handle)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("quit", "Quit Motrix")
                .accelerator("CmdOrCtrl+Q")
                .build(handle)?,
        )
        .build()?;

    let task_menu = build_task_submenu(handle, false)?;
    let edit_menu = build_edit_submenu(handle)?;

    let window_menu = SubmenuBuilder::new(handle, "Window")
        .item(
            &MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(handle)?,
        )
        .close_window()
        .minimize()
        .fullscreen()
        .build()?;

    let help_menu = build_help_submenu(handle)?;

    let menu = MenuBuilder::new(handle)
        .items(&[&file_menu, &task_menu, &edit_menu, &window_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;
    setup_menu_event_handler(app);
    Ok(())
}

fn build_task_submenu(
    handle: &tauri::AppHandle,
    include_clear_recent: bool,
) -> Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>> {
    let mut builder = SubmenuBuilder::new(handle, "Task")
        .item(
            &MenuItemBuilder::with_id("new-task", "New Task")
                .accelerator("CmdOrCtrl+N")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("new-bt-task", "New BT Task")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("open-file", "Open Torrent File...")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("task-list", "Task List")
                .accelerator("CmdOrCtrl+L")
                .build(handle)?,
        )
        .item(&MenuItemBuilder::with_id("pause-task", "Pause Task").build(handle)?)
        .item(&MenuItemBuilder::with_id("resume-task", "Resume Task").build(handle)?)
        .item(&MenuItemBuilder::with_id("delete-task", "Delete Task").build(handle)?)
        .item(&MenuItemBuilder::with_id("move-task-up", "Move Task Up").build(handle)?)
        .item(
            &MenuItemBuilder::with_id("move-task-down", "Move Task Down").build(handle)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("pause-all-task", "Pause All Tasks")
                .accelerator("CmdOrCtrl+Shift+P")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("resume-all-task", "Resume All Tasks")
                .accelerator("CmdOrCtrl+Shift+R")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("select-all-task", "Select All Tasks")
                .accelerator("Ctrl+Shift+A")
                .build(handle)?,
        );

    if include_clear_recent {
        builder = builder
            .separator()
            .item(
                &MenuItemBuilder::with_id("clear-recent-tasks", "Clear Recent Tasks")
                    .build(handle)?,
            );
    }

    Ok(builder.build()?)
}

fn build_edit_submenu(
    handle: &tauri::AppHandle,
) -> Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>> {
    Ok(SubmenuBuilder::new(handle, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?)
}

fn build_help_submenu(
    handle: &tauri::AppHandle,
) -> Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>> {
    Ok(SubmenuBuilder::new(handle, "Help")
        .item(&MenuItemBuilder::with_id("official-website", "Official Website").build(handle)?)
        .item(&MenuItemBuilder::with_id("manual", "Manual").build(handle)?)
        .item(&MenuItemBuilder::with_id("release-notes", "Release Notes").build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("report-problem", "Report Problem").build(handle)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("toggle-dev-tools", "Toggle Developer Tools")
                .accelerator("F12")
                .build(handle)?,
        )
        .build()?)
}

fn setup_menu_event_handler(app: &App) {
    app.on_menu_event(move |app, event| {
        let id = event.id().as_ref();
        match id {
            "new-task" => show_and_emit(app, "application:new-task"),
            "new-bt-task" => show_and_emit(app, "application:new-bt-task"),
            "open-file" => show_and_emit(app, "application:open-file"),
            "task-list" => emit_command(app, "application:task-list"),
            "pause-task" => emit_command(app, "application:pause-task"),
            "resume-task" => emit_command(app, "application:resume-task"),
            "delete-task" => emit_command(app, "application:delete-task"),
            "move-task-up" => emit_command(app, "application:move-task-up"),
            "move-task-down" => emit_command(app, "application:move-task-down"),
            "pause-all-task" => emit_command(app, "application:pause-all-task"),
            "resume-all-task" => emit_command(app, "application:resume-all-task"),
            "select-all-task" => emit_command(app, "application:select-all-task"),
            "clear-recent-tasks" => emit_command(app, "application:clear-recent-tasks"),
            "preferences" => emit_command(app, "application:preferences"),
            "about" => emit_command(app, "application:about"),
            "check-for-updates" => emit_command(app, "application:check-for-updates"),
            "show-window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "official-website" => { let _ = open::that("https://motrix.app"); }
            "manual" => { let _ = open::that("https://github.com/agalwood/Motrix/wiki"); }
            "release-notes" => { let _ = open::that("https://github.com/agalwood/Motrix/releases"); }
            "report-problem" => { let _ = open::that("https://github.com/agalwood/Motrix/issues"); }
            "reload" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("window.location.reload()");
                }
            }
            "front" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "toggle-dev-tools" => {
                #[cfg(debug_assertions)]
                if let Some(window) = app.get_webview_window("main") {
                    {
                        if window.is_devtools_open() {
                            window.close_devtools();
                        } else {
                            window.open_devtools();
                        }
                    }
                }
            }
            "quit" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("confirm-quit", ());
            }
            _ => {}
        }
    });
}
