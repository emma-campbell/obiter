mod settings;

use std::path::PathBuf;
use std::sync::Mutex;

use settings::{RecoveryNotice, Settings};
use tauri::Manager;

/// In-memory settings behind managed state. The backend is the source of
/// truth: settings load once at startup and every update persists before
/// the in-memory copy changes. `recovery` is set when the startup load
/// found a corrupt file and reset it (the original lives on as a .bak).
struct SettingsState {
    path: PathBuf,
    current: Mutex<Settings>,
    recovery: Option<RecoveryNotice>,
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, SettingsState>) -> Settings {
    state.current.lock().unwrap().clone()
}

#[tauri::command]
fn get_recovery_notice(state: tauri::State<'_, SettingsState>) -> Option<RecoveryNotice> {
    state.recovery.clone()
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
            // Corrupt file → backed up as .bak, reset to defaults, notice
            // kept for the UI. A real I/O error (permissions, etc.) is not
            // corruption: leave the file alone and run on defaults.
            let (current, recovery) = match settings::load_or_recover(&path) {
                Ok(outcome) => (outcome.settings, outcome.recovery),
                Err(e) => {
                    eprintln!("obiter: could not load settings, using defaults: {e}");
                    (Settings::default(), None)
                }
            };
            app.manage(SettingsState {
                path,
                current: Mutex::new(current),
                recovery,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            get_recovery_notice
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
