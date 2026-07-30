// Binds an open note to React. The note itself is framework-free (see
// open-note.ts); this is the whole of its React surface.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { tauriNoteIo, type NoteIo } from "./note-io";
import { openNote, type OpenNote, type OpenNoteState } from "./open-note";

export interface UseOpenNote {
  state: OpenNoteState;
  note: OpenNote;
}

/**
 * Opens `path` and keeps its state in sync with React. One note per path —
 * the editor is keyed by path in the router, so a given instance never sees
 * its path change.
 *
 * The window wiring lives here rather than in the note: blur flushes pending
 * edits, focus picks up a change another tool made to the file. Both move to
 * the refresh seam once it exists, without the note changing.
 */
export function useOpenNote(path: string, io: NoteIo = tauriNoteIo): UseOpenNote {
  const note = useMemo(() => openNote(path, { io }), [path, io]);

  useEffect(() => {
    void note.load();
    // Flush before disposing so leaving a note never drops its edits. The
    // editor detaches its document as it tears down, so this is safe
    // whichever cleanup React runs first.
    return () => {
      void note.flush();
      note.dispose();
    };
  }, [note]);

  useEffect(() => {
    const onBlur = () => void note.flush();
    const onFocus = () => void note.reconcile();
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [note]);

  const state = useSyncExternalStore(note.subscribe, note.getState);

  return { state, note };
}
