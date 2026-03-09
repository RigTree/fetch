#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hardware;

#[tauri::command]
fn scan_hardware() -> hardware::HardwareInfo {
    hardware::collect()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![scan_hardware])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
