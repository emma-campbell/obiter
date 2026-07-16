//! Settings core: schema, defaults, persistence.
//!
//! No Tauri dependency — everything here is testable against a plain
//! directory. The command layer in `lib.rs` owns *where* the file lives and
//! the in-memory copy; this module owns what the file means.
//!
//! Parse semantics are "lenient keys, strict values": unknown keys are
//! ignored, missing keys fall back to defaults, but a known key with an
//! invalid value is a parse error.

use std::collections::BTreeMap;
use std::fmt;
use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

pub const SETTINGS_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    pub vault: VaultSettings,
    pub appearance: AppearanceSettings,
    pub ai: AiSettings,
    /// Free-form runtime feature flags. Must be a known schema key so a
    /// rewrite doesn't drop it under lenient-keys parsing.
    pub flags: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct VaultSettings {
    /// Absolute path to the notes folder. Null until the user picks one.
    pub path: Option<String>,
    pub save: SaveSettings,
    pub daily_note: DailyNoteSettings,
    pub delete: DeleteMode,
    pub files: FileVisibilitySettings,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SaveSettings {
    pub mode: SaveMode,
    pub autosave_debounce_ms: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DailyNoteSettings {
    pub filename_format: String,
    /// Folder for daily notes, relative to the vault root. Empty = root.
    pub folder: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FileVisibilitySettings {
    pub extensions: Vec<String>,
    pub show_hidden: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppearanceSettings {
    pub theme: Theme,
    pub editor_font_size: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AiSettings {
    pub enabled: bool,
    pub provider: AiProvider,
    pub model: String,
    /// Override for proxies / compatible local endpoints. Null = provider default.
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SaveMode {
    Manual,
    Auto,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeleteMode {
    Trash,
    Permanent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Anthropic,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            vault: VaultSettings::default(),
            appearance: AppearanceSettings::default(),
            ai: AiSettings::default(),
            flags: BTreeMap::new(),
        }
    }
}

impl Default for VaultSettings {
    fn default() -> Self {
        Self {
            path: None,
            save: SaveSettings::default(),
            daily_note: DailyNoteSettings::default(),
            delete: DeleteMode::Trash,
            files: FileVisibilitySettings::default(),
        }
    }
}

impl Default for SaveSettings {
    fn default() -> Self {
        Self {
            mode: SaveMode::Auto,
            autosave_debounce_ms: 1000,
        }
    }
}

impl Default for DailyNoteSettings {
    fn default() -> Self {
        Self {
            filename_format: "YYYY-MM-DD".to_string(),
            folder: String::new(),
        }
    }
}

impl Default for FileVisibilitySettings {
    fn default() -> Self {
        Self {
            extensions: vec!["md".to_string()],
            show_hidden: false,
        }
    }
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            editor_font_size: 16.0,
        }
    }
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: AiProvider::Anthropic,
            model: "claude-opus-4-8".to_string(),
            base_url: None,
        }
    }
}

#[derive(Debug)]
pub enum SettingsError {
    Io(io::Error),
    Parse(serde_json::Error),
}

impl fmt::Display for SettingsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SettingsError::Io(e) => write!(f, "settings file error: {e}"),
            SettingsError::Parse(e) => write!(f, "settings parse error: {e}"),
        }
    }
}

impl std::error::Error for SettingsError {}

/// Read settings from `path`. A missing file yields defaults without
/// creating the file — it's written on first save, not first launch.
pub fn load(path: &Path) -> Result<Settings, SettingsError> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map_err(SettingsError::Parse),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(e) => Err(SettingsError::Io(e)),
    }
}

/// Persist settings to `path` as pretty-printed JSON, atomically: the
/// document is written to a temp file in the same directory and renamed
/// into place, so a crash mid-write can't leave a half-written file.
pub fn save(path: &Path, settings: &Settings) -> Result<(), SettingsError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(SettingsError::Io)?;
    }
    let mut json = serde_json::to_string_pretty(settings).map_err(SettingsError::Parse)?;
    json.push('\n');
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(SettingsError::Io)?;
    fs::rename(&tmp, path).map_err(SettingsError::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings_path(dir: &tempfile::TempDir) -> std::path::PathBuf {
        dir.path().join("settings.json")
    }

    #[test]
    fn missing_file_yields_defaults_without_creating_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);

        let loaded = load(&path).unwrap();

        assert_eq!(loaded, Settings::default());
        assert!(!path.exists());
    }

    #[test]
    fn defaults_round_trip_through_save_and_load() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        let settings = Settings::default();

        save(&path, &settings).unwrap();
        let loaded = load(&path).unwrap();

        assert_eq!(loaded, settings);
    }

    #[test]
    fn modified_settings_round_trip_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        let mut settings = Settings::default();
        settings.vault.path = Some("/Users/emma/Notes".to_string());
        settings.vault.save.mode = SaveMode::Manual;
        settings.vault.delete = DeleteMode::Permanent;
        settings.appearance.theme = Theme::Dark;
        settings.appearance.editor_font_size = 14.5;
        settings.ai.enabled = true;
        settings.ai.base_url = Some("http://localhost:11434".to_string());

        save(&path, &settings).unwrap();
        let loaded = load(&path).unwrap();

        assert_eq!(loaded, settings);
    }

    #[test]
    fn written_file_is_pretty_printed_and_version_stamped() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);

        save(&path, &Settings::default()).unwrap();
        let text = fs::read_to_string(&path).unwrap();

        assert!(text.contains("\"version\": 1"));
        // Pretty-printed means multi-line with indentation, not one blob.
        assert!(text.lines().count() > 10);
        assert!(text.contains("\n  \"vault\""));
    }

    #[test]
    fn save_leaves_no_temp_file_behind() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);

        save(&path, &Settings::default()).unwrap();

        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(entries, vec![std::ffi::OsString::from("settings.json")]);
    }

    #[test]
    fn save_creates_missing_parent_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/config/settings.json");

        save(&path, &Settings::default()).unwrap();

        assert!(path.exists());
    }

    #[test]
    fn flags_round_trip_and_survive_rewrites() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        let mut settings = Settings::default();
        settings.flags.insert("experimentalCanvas".to_string(), true);
        settings.flags.insert("noisyLogging".to_string(), false);

        save(&path, &settings).unwrap();
        // A second rewrite of what was loaded must not drop the flags.
        let loaded = load(&path).unwrap();
        save(&path, &loaded).unwrap();
        let reloaded = load(&path).unwrap();

        assert_eq!(reloaded.flags, settings.flags);
    }

    #[test]
    fn hand_edits_on_disk_take_effect_on_next_load() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        save(&path, &Settings::default()).unwrap();

        let edited = fs::read_to_string(&path)
            .unwrap()
            .replace("\"theme\": \"system\"", "\"theme\": \"dark\"");
        fs::write(&path, edited).unwrap();

        let loaded = load(&path).unwrap();
        assert_eq!(loaded.appearance.theme, Theme::Dark);
    }

    #[test]
    fn invalid_value_for_known_key_is_a_parse_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        save(&path, &Settings::default()).unwrap();

        let edited = fs::read_to_string(&path)
            .unwrap()
            .replace("\"theme\": \"system\"", "\"theme\": \"blurple\"");
        fs::write(&path, edited).unwrap();

        assert!(matches!(load(&path), Err(SettingsError::Parse(_))));
    }
}
