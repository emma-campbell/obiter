// Binds an open note to React. The note itself is framework-free (see
// open-note.ts); this is the whole of its React surface.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRefresh } from "../app/RefreshProvider";
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
 * Picking up an outside change goes through the refresh seam, which probes
 * the notebook first and coordinates with the tree. Flushing on the way out
 * stays here: it has one subscriber and nothing to order it against, so it
 * needs no coordination.
 */
export function useOpenNote(path: string, io: NoteIo = tauriNoteIo): UseOpenNote {
  const note = useMemo(() => openNote(path, { io }), [path, io]);
  const refresh = useRefresh();

  useEffect(() => {
    void note.load();
    // Flush on the way out so leaving a note never drops its edits.
    //
    // Deliberately does NOT dispose. React gives no signal that separates a
    // real unmount from StrictMode's remount, and the note outlives that
    // remount (useMemo keeps it) — so disposing here would leave a note that
    // can never load again. Nothing leaks by skipping it: flush clears the
    // pending debounce, and useSyncExternalStore removes its own listener.
    // dispose() is for owners outside React.
    return () => {
      void note.flush();
    };
  }, [note]);

  useEffect(() => {
    const onBlur = () => void note.flush();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [note]);

  useEffect(() => refresh.subscribe(() => note.reconcile()), [refresh, note]);

  const state = useSyncExternalStore(note.subscribe, note.getState);

  return { state, note };
}
