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
fn reload_settings(state: tauri::State<'_, SettingsState>) -> Result<Settings, String> {
    reload_settings_impl(&state.path, &state.current)
}

/// Body of `reload_settings`, extracted so the contract is testable without
/// a running Tauri app. A failed re-read keeps the in-memory settings
/// untouched and never writes to the file — unlike startup recovery, there
/// is a working state to preserve, so the error is returned for the UI and
/// the hand-edit stays on disk for the user to fix.
fn reload_settings_impl(path: &PathBuf, current: &Mutex<Settings>) -> Result<Settings, String> {
    let loaded = settings::load(path).map_err(|e| e.to_string())?;
    *current.lock().unwrap() = loaded.clone();
    Ok(loaded)
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
            get_recovery_notice,
            reload_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use settings::Theme;
    use std::fs;

    #[test]
    fn successful_reload_replaces_in_memory_state() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        settings::save(&path, &Settings::default()).unwrap();
        let current = Mutex::new(Settings::default());

        // Hand-edit while "running".
        let edited = fs::read_to_string(&path)
            .unwrap()
            .replace("\"theme\": \"system\"", "\"theme\": \"dark\"");
        fs::write(&path, edited).unwrap();

        let reloaded = reload_settings_impl(&path, &current).unwrap();

        assert_eq!(reloaded.appearance.theme, Theme::Dark);
        assert_eq!(current.lock().unwrap().appearance.theme, Theme::Dark);
    }

    #[test]
    fn failed_reload_preserves_state_and_never_touches_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut in_memory = Settings::default();
        in_memory.appearance.theme = Theme::Light;
        let current = Mutex::new(in_memory.clone());

        let broken = "{ \"appearance\": { \"theme\": \"blurple\" } }";
        fs::write(&path, broken).unwrap();

        let err = reload_settings_impl(&path, &current).unwrap_err();

        assert!(err.contains("parse"), "error should be descriptive: {err}");
        // In-memory settings untouched.
        assert_eq!(*current.lock().unwrap(), in_memory);
        // The broken hand-edit stays on disk exactly as written: no backup,
        // no rewrite — distinct from the startup recovery path.
        assert_eq!(fs::read_to_string(&path).unwrap(), broken);
        assert!(!path.with_extension("json.bak").exists());
    }
}
