// Obiter settings schema, mirroring the Rust `Settings` struct in
// src-tauri/src/settings.rs (serde renames everything to camelCase).
// The backend owns defaults and validation; the frontend only ever sees
// a fully-populated document.

export type SaveMode = "manual" | "auto";
export type DeleteMode = "trash" | "permanent";
export type Theme = "light" | "dark" | "system";
export type AiProvider = "anthropic";

export interface SaveSettings {
  mode: SaveMode;
  autosaveDebounceMs: number;
}

export interface DailyNoteSettings {
  filenameFormat: string;
  /** Folder for daily notes, relative to the notebook root. Empty = root. */
  folder: string;
}

export interface FileVisibilitySettings {
  extensions: string[];
  showHidden: boolean;
}

export interface NotebookSettings {
  /** Absolute path to the notes folder. Null until the user picks one. */
  path: string | null;
  save: SaveSettings;
  dailyNote: DailyNoteSettings;
  delete: DeleteMode;
  files: FileVisibilitySettings;
}

export interface AppearanceSettings {
  theme: Theme;
  editorFontSize: number;
}

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  /** Override for proxies / compatible local endpoints. Null = provider default. */
  baseUrl: string | null;
}

/** Sent by the backend when a corrupt settings file was reset at startup. */
export interface RecoveryNotice {
  /** Where the broken original was preserved (settings.json.bak). */
  backupPath: string;
  /** The parse error that made recovery necessary. */
  error: string;
}

export interface Settings {
  version: number;
  notebook: NotebookSettings;
  appearance: AppearanceSettings;
  ai: AiSettings;
  /** Free-form runtime feature flags. Read as `flags[name] ?? false`. */
  flags: Record<string, boolean>;
}
