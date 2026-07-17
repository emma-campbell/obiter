// Invoke wrappers for the notebook backend commands. Rejections carry the
// tagged NotebookError from the Rust side.

import { invoke } from "@tauri-apps/api/core";
import type { Entry } from "./notebook";

/** List one folder's immediate children; `""` is the notebook root. */
export function listDir(path: string): Promise<Entry[]> {
  return invoke<Entry[]>("list_dir", { path });
}

/** Read a note's markdown contents by notebook-relative path. */
export function readNote(path: string): Promise<string> {
  return invoke<string>("read_note", { path });
}

/** Find notes whose filename matches `query` (case-insensitive subsequence). */
export function searchNotes(query: string): Promise<Entry[]> {
  return invoke<Entry[]>("search_notes", { query });
}
