// Invoke wrappers for the notebook backend commands. Rejections carry the
// tagged NotebookError from the Rust side.

import { invoke } from "@tauri-apps/api/core";
import type { Entry } from "./notebook";

/** List one folder's immediate children; `""` is the notebook root. */
export function listDir(path: string): Promise<Entry[]> {
  return invoke<Entry[]>("list_dir", { path });
}
