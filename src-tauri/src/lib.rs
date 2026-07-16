mod settings;

use std::path::PathBuf;
use std::sync::Mutex;

use settings::Settings;
use tauri::Manager;

/// In-memory settings behind managed state. The backend is the source of
/// truth: settings load once at startup and every update persists before
/// the in-memory copy changes.
struct SettingsState {
    path: PathBuf,
    current: Mutex<Settings>,
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, SettingsState>) -> Settings {
    state.current.lock().unwrap().clone()
}

#[tauri::command]
fn update_settings(
    state: tauri::State<'_, SettingsState>,
    settings: Settings,
) -> Result<Settings, String> {
    // Persist first: if the write fails, memory still matches disk.
    settings::save(&state.path, &settings).map_err(|e| e.to_string())?;
    *state.current.lock().unwrap() = settings.clone();
    Ok(settings)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let path = app.path().app_config_dir()?.join("settings.json");
            let current = settings::load(&path).unwrap_or_else(|e| {
                // Corrupt-file recovery (backup + reset) is a later slice;
                // until then a bad file is left untouched and the app runs
                // on defaults in memory.
                eprintln!("obiter: could not load settings, using defaults: {e}");
                Settings::default()
            });
            app.manage(SettingsState {
                path,
                current: Mutex::new(current),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_settings, update_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
