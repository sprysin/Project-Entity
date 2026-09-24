#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let config = app.config().app.windows[0].clone();
            let window = tauri::WebviewWindowBuilder::from_config(app, &config)?
                .on_navigation(|url| {
                    if cfg!(debug_assertions) {
                        url.host_str() == Some("127.0.0.1") && url.port() == Some(3000)
                    } else {
                        url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
                    }
                })
                .build()?;
            // Tauri disables the maximize button when creating a fixed-size window.
            // Re-enable it after creation so the normal window remains non-resizable.
            window.set_maximizable(true)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Project Entity could not start");
}
