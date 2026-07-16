// Invoke wrappers for the settings backend commands. Whole-document API:
// get and update, no per-field patching.

import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "./settings";

export function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

export function updateSettings(settings: Settings): Promise<Settings> {
  return invoke<Settings>("update_settings", { settings });
}
