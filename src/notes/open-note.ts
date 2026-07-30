// The open note — the note currently loaded in the editor, plus any edits
// not yet on disk. One module owns the whole lifecycle: read it, hold its
// frontmatter aside, track whether it differs from disk, autosave it, and
// pick up changes another tool made to the file.
//
// It is deliberately framework-free. The live document lives in ProseMirror
// (serializing it is expensive, so we pull rather than push), which is the
// one thing this module can't own — it arrives through `attach`. Everything
// else is in here, which is why the state below can make the dangerous
// combinations unrepresentable rather than merely guarded:
//
//   - there is no `body` and no save machinery until the read succeeded
//   - a save with no attached document is refused, so an empty editor can
//     never be written over a real file
//
// Callers drive it — the module registers no window listeners of its own.

import { joinFrontmatter, splitFrontmatter } from "../editor/markdown";
import type { NoteIo } from "./note-io";

/** 100ms after the last edit — short enough that at most a moment's typing
 *  is ever unsaved, paired with a flush when the note or window is left. */
export const AUTOSAVE_DEBOUNCE_MS = 100;

/**
 * Where a ready note stands with the copy on disk.
 * `failed` keeps the buffer: the next edit or flush retries.
 * `conflicted` is entered by the simultaneous-edit UX (#34); autosave is
 * suppressed until the user resolves it, so neither side is lost silently.
 */
export type SaveState = "clean" | "saving" | "failed" | "conflicted";

export type OpenNoteState =
  | { status: "loading" }
  /** The note couldn't be read. `error` is the rejection from the io port. */
  | { status: "unreadable"; error: unknown }
  | {
      status: "ready";
      /** Markdown to seed the editor with — frontmatter already split off.
       *  Changes only on load and on a reload from disk, never per keystroke. */
      body: string;
      save: SaveState;
      /** Whether edits have arrived since the last save. Set optimistically
       *  on `edit()`, so typing and undoing back reads as dirty until the
       *  next save no-ops. Whether to actually write is decided by comparing
       *  content at save time, not by this flag. */
      dirty: boolean;
    };

export interface OpenNote {
  /** Referentially stable between changes, for useSyncExternalStore. */
  getState(): OpenNoteState;
  subscribe(listener: () => void): () => void;
  /** Reads the note. Idempotent; construction does no I/O. */
  load(): Promise<void>;
  /** Registers the live document, once the editor is mounted over `body`,
   *  and re-baselines to what the editor renders — so a note whose markdown
   *  the editor normalizes isn't reported dirty the moment it opens. */
  attach(getContent: () => string): void;
  /** Forget the live document, before the editor holding it is torn down.
   *  Saves are refused until something attaches again, so teardown order
   *  can never get as far as serializing a destroyed editor. */
  detach(): void;
  /** A change happened: mark dirty and debounce a save. */
  edit(): void;
  /** Save now, skipping the debounce (⌘S, leaving the note or the window). */
  flush(): Promise<void>;
  /** Pick up an external change: reload silently when our buffer is clean,
   *  keep the buffer when it isn't. */
  reconcile(): Promise<void>;
  dispose(): void;
}

export function openNote(path: string, { io }: { io: NoteIo }): OpenNote {
  let state: OpenNoteState = { status: "loading" };
  const listeners = new Set<() => void>();

  /** Frontmatter held aside verbatim: it has no HTML form, so it never goes
   *  through the editor, and is re-attached on every save. */
  let frontmatter = "";
  /** Full markdown last known to match disk, or null before the first read. */
  let baseline: string | null = null;
  let getContent: (() => string) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Whether `edit()` fired since the in-flight save took its snapshot — so
   *  a save completing doesn't report clean over edits it didn't include. */
  let editedSinceSnapshot = false;
  let disposed = false;

  function publish(next: OpenNoteState): void {
    state = next;
    for (const listener of listeners) listener();
  }

  /** Update the ready state in place. A no-op unless something actually
   *  changed, so getState stays referentially stable. */
  function patchReady(patch: { body?: string; save?: SaveState; dirty?: boolean }): void {
    if (state.status !== "ready") return;
    const next = { ...state, ...patch };
    if (next.body === state.body && next.save === state.save && next.dirty === state.dirty) return;
    publish(next);
  }

  /** Adopt a full markdown document read from disk as the clean truth. */
  function adopt(md: string): void {
    const split = splitFrontmatter(md);
    frontmatter = split.frontmatter;
    baseline = md;
    editedSinceSnapshot = false;
    publish({ status: "ready", body: split.body, save: "clean", dirty: false });
  }

  async function save(): Promise<void> {
    if (disposed) return;
    // Nothing safe to write: the read hasn't landed, or the editor isn't
    // mounted yet so there is no document to serialize.
    if (state.status !== "ready" || getContent === null) return;
    // #34 owns resolving this; writing would defeat the choice it offers.
    if (state.save === "conflicted") return;

    const content = joinFrontmatter(frontmatter, getContent());
    if (content === baseline) {
      patchReady({ dirty: false });
      return;
    }

    editedSinceSnapshot = false;
    patchReady({ save: "saving" });
    try {
      await io.write(path, content);
      if (disposed) return;
      baseline = content;
      // Edits that arrived mid-write are still pending; their own debounce
      // will save them, but the note is not clean.
      patchReady({ save: "clean", dirty: editedSinceSnapshot });
    } catch {
      if (disposed) return;
      // The buffer is kept, so the next edit or flush retries.
      patchReady({ save: "failed" });
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async load() {
      let md: string;
      try {
        md = await io.read(path);
      } catch (error) {
        if (!disposed) publish({ status: "unreadable", error });
        return;
      }
      if (!disposed) adopt(md);
    },

    attach(next) {
      if (disposed || state.status !== "ready") return;
      getContent = next;
      baseline = joinFrontmatter(frontmatter, next());
      editedSinceSnapshot = false;
      patchReady({ save: "clean", dirty: false });
    },

    detach() {
      getContent = null;
    },

    edit() {
      if (disposed || state.status !== "ready") return;
      editedSinceSnapshot = true;
      patchReady({ dirty: true });
      clearTimeout(timer);
      timer = setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
    },

    async flush() {
      clearTimeout(timer);
      await save();
    },

    async reconcile() {
      if (disposed || state.status !== "ready" || getContent === null) return;
      let disk: string;
      try {
        disk = await io.read(path);
      } catch {
        return; // unreadable now is the shell's concern, not ours
      }
      if (disposed || state.status !== "ready" || getContent === null) return;
      if (disk === baseline) return; // disk unchanged
      // Dirty buffer: keep the user's edits. Surfacing the clash is #34.
      if (joinFrontmatter(frontmatter, getContent()) !== baseline) return;
      adopt(disk);
    },

    dispose() {
      disposed = true;
      clearTimeout(timer);
      listeners.clear();
    },
  };
}
