mod notebook;
mod secrets;
mod settings;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notebook::{Entry, Notebook, NotebookError};
use settings::{AiProvider, RecoveryNotice, Settings};
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
fn reload_settings_impl(path: &Path, current: &Mutex<Settings>) -> Result<Settings, String> {
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

// Reading the connected notebook. The command builds a Notebook from the
// current in-memory settings each call, so a settings reload (new path,
// changed visibility) is reflected without extra plumbing.

#[tauri::command]
fn list_dir(
    state: tauri::State<'_, SettingsState>,
    path: String,
) -> Result<Vec<Entry>, NotebookError> {
    list_dir_impl(&state.current.lock().unwrap(), &path)
}

fn list_dir_impl(settings: &Settings, rel: &str) -> Result<Vec<Entry>, NotebookError> {
    connected_notebook(settings)?.list_dir(rel)
}

#[tauri::command]
fn read_note(
    state: tauri::State<'_, SettingsState>,
    path: String,
) -> Result<String, NotebookError> {
    read_note_impl(&state.current.lock().unwrap(), &path)
}

fn read_note_impl(settings: &Settings, rel: &str) -> Result<String, NotebookError> {
    connected_notebook(settings)?.read_note(rel)
}

#[tauri::command]
fn write_note(
    state: tauri::State<'_, SettingsState>,
    path: String,
    contents: String,
) -> Result<(), NotebookError> {
    write_note_impl(&state.current.lock().unwrap(), &path, &contents)
}

fn write_note_impl(settings: &Settings, rel: &str, contents: &str) -> Result<(), NotebookError> {
    connected_notebook(settings)?.write_note(rel, contents)
}

#[tauri::command]
fn search_notes(
    state: tauri::State<'_, SettingsState>,
    query: String,
) -> Result<Vec<Entry>, NotebookError> {
    search_notes_impl(&state.current.lock().unwrap(), &query)
}

fn search_notes_impl(settings: &Settings, query: &str) -> Result<Vec<Entry>, NotebookError> {
    connected_notebook(settings)?.search(query)
}

fn connected_notebook(settings: &Settings) -> Result<Notebook, NotebookError> {
    let root = settings
        .notebook
        .path
        .as_ref()
        .ok_or(NotebookError::NotConnected)?;
    Ok(Notebook::new(
        root,
        settings.notebook.files.extensions.clone(),
        settings.notebook.files.show_hidden,
    ))
}

// API keys live in the OS keychain, never in the settings JSON. The
// provider argument is the typed enum, so keychain accounts can only ever
// be known provider names. No command returns the key value.

#[tauri::command]
fn set_api_key(provider: AiProvider, key: String) -> Result<(), String> {
    secrets::set_api_key(provider.as_str(), &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_api_key(provider: AiProvider) -> Result<bool, String> {
    secrets::has_api_key(provider.as_str()).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_api_key(provider: AiProvider) -> Result<(), String> {
    secrets::delete_api_key(provider.as_str()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            reload_settings,
            set_api_key,
            has_api_key,
            delete_api_key,
            list_dir,
            read_note,
            search_notes,
            write_note
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
    fn list_dir_maps_no_connected_notebook_to_not_connected() {
        let settings = Settings::default(); // notebook.path is None
        let err = list_dir_impl(&settings, "").unwrap_err();
        assert!(matches!(err, NotebookError::NotConnected));
    }

    #[test]
    fn list_dir_reads_the_connected_notebook_with_visibility_settings() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("note.md"), "").unwrap();
        fs::write(root.join("ignore.txt"), "").unwrap();

        let mut settings = Settings::default();
        settings.notebook.path = Some(root.to_string_lossy().into_owned());

        let entries = list_dir_impl(&settings, "").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "note.md");
    }

    #[test]
    fn write_note_persists_via_the_connected_notebook_and_maps_not_connected() {
        let dir = tempfile::tempdir().unwrap();
        let mut settings = Settings::default();
        assert!(matches!(
            write_note_impl(&settings, "note.md", "x"),
            Err(NotebookError::NotConnected)
        ));

        settings.notebook.path = Some(dir.path().to_string_lossy().into_owned());
        write_note_impl(&settings, "note.md", "hello").unwrap();
        assert_eq!(read_note_impl(&settings, "note.md").unwrap(), "hello");
    }

    #[test]
    fn read_note_returns_contents_and_maps_no_notebook_to_not_connected() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("note.md"), "# Hi\n\nbody").unwrap();

        let mut settings = Settings::default();
        assert!(matches!(
            read_note_impl(&settings, "note.md"),
            Err(NotebookError::NotConnected)
        ));

        settings.notebook.path = Some(dir.path().to_string_lossy().into_owned());
        assert_eq!(
            read_note_impl(&settings, "note.md").unwrap(),
            "# Hi\n\nbody"
        );
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
