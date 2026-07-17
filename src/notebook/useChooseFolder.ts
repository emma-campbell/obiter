// Choosing the notebook folder: the native OS directory picker, persisted
// to settings. Shared by first-run, the missing-notebook error surface, and
// the settings modal so the pick behaves identically everywhere.

import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettings } from "../settings/SettingsProvider";

/** Returns a picker that opens the dialog, persists the choice, and resolves
 *  to the chosen path (or null if the user cancelled). */
export function useChooseFolder(): () => Promise<string | null> {
  const { settings, update } = useSettings();
  return useCallback(async () => {
    const picked = await open({ directory: true, multiple: false, title: "Choose notes folder" });
    if (typeof picked === "string" && settings) {
      await update({ ...settings, notebook: { ...settings.notebook, path: picked } });
      return picked;
    }
    return null;
  }, [settings, update]);
}
