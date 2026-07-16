// Invoke wrappers for the settings backend commands. Whole-document API:
// get and update, no per-field patching.

import { invoke } from "@tauri-apps/api/core";
import type { RecoveryNotice, Settings } from "./settings";

export function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

export function getRecoveryNotice(): Promise<RecoveryNotice | null> {
  return invoke<RecoveryNotice | null>("get_recovery_notice");
}

export function updateSettings(settings: Settings): Promise<Settings> {
  return invoke<Settings>("update_settings", { settings });
}

/** Re-read the file on disk. Rejects with the parse error on failure. */
export function reloadSettings(): Promise<Settings> {
  return invoke<Settings>("reload_settings");
}
