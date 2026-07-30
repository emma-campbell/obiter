// The open note's window onto disk. Two operations, injected as a port so
// the note's state machine can be exercised without a Rust backend or a
// global IPC mock: the Tauri notebook client in the app, an in-memory fake
// in the tests.

import { readNote, writeNote } from "../notebook/client";

export interface NoteIo {
  /** Reads a note's full markdown by notebook-relative path. */
  read(path: string): Promise<string>;
  /** Writes a note's full markdown; rejects on failure. */
  write(path: string, contents: string): Promise<void>;
}

export const tauriNoteIo: NoteIo = {
  read: readNote,
  write: writeNote,
};
