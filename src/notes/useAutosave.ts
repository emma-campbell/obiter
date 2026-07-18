// Autosave for the note editor. The save model is calm and manual-mode-free:
// a change schedules a debounced write; leaving the note or the window
// flushes it; ⌘S forces it. A failed write never discards the buffer — the
// status shows the error and the next change or flush retries.
//
// Extracted from the editor component so the timing/flush/status logic is
// testable in isolation (see useAutosave.test.tsx) with a mocked write.

import { useCallback, useEffect, useRef, useState } from "react";

/** 100ms after the last edit — short enough that at most a moment's typing
 *  is ever unsaved, paired with flush-on-leave/blur. */
export const AUTOSAVE_DEBOUNCE_MS = 100;

export type SaveStatus = "saved" | "saving" | "error";

export interface Autosave {
  status: SaveStatus;
  /** Note the current content and (re)start the debounce. */
  schedule: () => void;
  /** Write immediately, bypassing the debounce (⌘S, blur, unmount). */
  flush: () => void;
  /** Set the clean baseline after loading a note, so no save fires for it. */
  markSaved: (content: string) => void;
}

export interface UseAutosaveArgs {
  /** Reads the note's current full markdown (frontmatter + body). */
  read: () => string;
  /** Persists the content; rejects on failure (buffer is kept, we retry). */
  write: (content: string) => Promise<void>;
}

export function useAutosave({ read, write }: UseAutosaveArgs): Autosave {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const baseline = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Refs so the stable callbacks below always see the latest closures.
  const readRef = useRef(read);
  readRef.current = read;
  const writeRef = useRef(write);
  writeRef.current = write;

  const save = useCallback(async () => {
    const content = readRef.current();
    if (content === baseline.current) return; // nothing changed since last save
    setStatus("saving");
    try {
      await writeRef.current(content);
      baseline.current = content;
      setStatus("saved");
    } catch {
      // Keep the buffer; the next schedule()/flush() retries.
      setStatus("error");
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
  }, [save]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    void save();
  }, [save]);

  const markSaved = useCallback((content: string) => {
    baseline.current = content;
    setStatus("saved");
  }, []);

  // Flush pending edits when the window loses focus — the symmetric partner
  // to the sidebar's refresh-on-focus. Covers ⌘-Tab-away and quit.
  useEffect(() => {
    const onBlur = () => flush();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [flush]);

  return { status, schedule, flush, markSaved };
}
