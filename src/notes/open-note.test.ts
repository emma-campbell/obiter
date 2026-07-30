// The open note's whole lifecycle, driven directly through its interface.
// No React, no jsdom, no ProseKit, no IPC mock: the live document is a
// closure over a string and disk is an object, so "the file changed while
// you were away" is one assignment.
//
// Replaces useAutosave.test.tsx — same behaviours, plus the ones the old
// shape couldn't reach: a save refused before the read lands, a save
// refused with no editor attached, and dirty being observable at all.

import { describe, expect, it } from "vite-plus/test";
import { AUTOSAVE_DEBOUNCE_MS, openNote } from "./open-note";
import type { NoteIo } from "./note-io";

/** In-memory disk. `control` forces the next read/write to reject. */
function fakeIo(initial: Record<string, string> = {}) {
  const disk: Record<string, string> = { ...initial };
  const writes: Array<{ path: string; contents: string }> = [];
  const control: { readError: unknown; writeError: unknown } = {
    readError: null,
    writeError: null,
  };

  const io: NoteIo = {
    read(path) {
      if (control.readError !== null) return Promise.reject(control.readError);
      const at = disk[path];
      if (at === undefined) return Promise.reject(new Error(`no such note: ${path}`));
      return Promise.resolve(at);
    },
    write(path, contents) {
      if (control.writeError !== null) {
        const error = control.writeError;
        control.writeError = null; // one-shot, so a retry can succeed
        return Promise.reject(error);
      }
      disk[path] = contents;
      writes.push({ path, contents });
      return Promise.resolve();
    },
  };

  return { io, disk, writes, control };
}

/** Wait past the autosave debounce. */
const settle = () => new Promise((resolve) => setTimeout(resolve, AUTOSAVE_DEBOUNCE_MS + 20));

/** A note loaded and attached to a mutable document, ready to be edited. */
async function opened(contents: string, path = "n.md") {
  const fake = fakeIo({ [path]: contents });
  const note = openNote(path, { io: fake.io });
  await note.load();
  const ready = note.getState();
  const doc = { value: ready.status === "ready" ? ready.body : "" };
  note.attach(() => doc.value);
  return { ...fake, note, doc };
}

describe("openNote — loading", () => {
  it("reads the note and lands ready with its body", async () => {
    const { io } = fakeIo({ "recipes/dumplings.md": "# Dumplings\n\nRest the dough.\n" });
    const note = openNote("recipes/dumplings.md", { io });

    expect(note.getState()).toEqual({ status: "loading" });
    await note.load();

    expect(note.getState()).toEqual({
      status: "ready",
      body: "# Dumplings\n\nRest the dough.\n",
      save: "clean",
      dirty: false,
    });
  });

  it("holds frontmatter aside so it never reaches the editor", async () => {
    const { io } = fakeIo({ "n.md": "---\ntitle: Hi\n---\n\n# Body\n" });
    const note = openNote("n.md", { io });
    await note.load();

    const state = note.getState();
    expect(state.status === "ready" && state.body).toBe("# Body\n");
  });

  it("becomes unreadable, carrying the error, when the read rejects", async () => {
    const { io, control } = fakeIo({ "n.md": "x" });
    control.readError = { kind: "missing" };
    const note = openNote("n.md", { io });

    await note.load();

    expect(note.getState()).toEqual({ status: "unreadable", error: { kind: "missing" } });
  });
});

describe("openNote — refusing to write", () => {
  it("writes nothing before the read has landed", async () => {
    const { io, writes } = fakeIo({ "n.md": "# Real contents\n" });
    const note = openNote("n.md", { io }); // load() never called

    note.edit();
    await note.flush();
    await settle();

    expect(writes).toEqual([]);
    expect(note.getState()).toEqual({ status: "loading" });
  });

  it("writes nothing while no document is attached", async () => {
    const { io, writes } = fakeIo({ "n.md": "# Real contents\n" });
    const note = openNote("n.md", { io });
    await note.load(); // ready, but the editor hasn't mounted

    await note.flush();

    expect(writes).toEqual([]);
  });

  it("writes nothing once the document has been detached", async () => {
    // The editor holding the document is about to be torn down, so there is
    // nothing left that can safely be serialized.
    const { note, doc, writes } = await opened("x\n");

    doc.value = "xy\n";
    note.edit();
    note.detach();
    await note.flush();

    expect(writes).toEqual([]);
  });

  it("writes nothing when the note could not be read", async () => {
    const { io, writes, control } = fakeIo({ "n.md": "x" });
    control.readError = new Error("gone");
    const note = openNote("n.md", { io });
    await note.load();

    await note.flush();

    expect(writes).toEqual([]);
  });
});

describe("openNote — saving", () => {
  it("writes the current content a moment after a change", async () => {
    const { note, doc, writes } = await opened("a\n");

    doc.value = "ab\n";
    note.edit();
    await settle();

    expect(writes).toEqual([{ path: "n.md", contents: "ab\n" }]);
  });

  it("coalesces rapid changes into a single write", async () => {
    const { note, doc, writes } = await opened("");

    for (const value of ["a", "ab", "abc"]) {
      doc.value = value;
      note.edit();
    }
    await settle();

    expect(writes).toEqual([{ path: "n.md", contents: "abc" }]);
  });

  it("does not write when the content is unchanged from the last save", async () => {
    const { note, writes } = await opened("same\n");

    note.edit(); // a change event that didn't actually change anything
    await note.flush();

    expect(writes).toEqual([]);
    expect(note.getState()).toMatchObject({ save: "clean", dirty: false });
  });

  it("flush writes immediately, bypassing the debounce", async () => {
    const { note, doc, writes } = await opened("x\n");

    doc.value = "xy\n";
    note.edit();
    await note.flush();

    expect(writes).toEqual([{ path: "n.md", contents: "xy\n" }]);
  });

  it("re-attaches frontmatter on save", async () => {
    const path = "n.md";
    const fake = fakeIo({ [path]: "---\ntitle: Hi\n---\n\n# Body\n" });
    const note = openNote(path, { io: fake.io });
    await note.load();
    const doc = { value: "# Body\n" };
    note.attach(() => doc.value);

    doc.value = "# Body edited\n";
    note.edit();
    await note.flush();

    expect(fake.writes).toEqual([{ path, contents: "---\ntitle: Hi\n---\n\n# Body edited\n" }]);
  });

  it("keeps the buffer and retries after a failed write", async () => {
    const { note, doc, writes, control } = await opened("x\n");
    control.writeError = new Error("disk full");

    doc.value = "xy\n";
    note.edit();
    await note.flush();
    expect(note.getState()).toMatchObject({ save: "failed", dirty: true });
    expect(writes).toEqual([]);

    // The buffer wasn't discarded — a later flush retries and succeeds.
    await note.flush();

    expect(writes).toEqual([{ path: "n.md", contents: "xy\n" }]);
    expect(note.getState()).toMatchObject({ save: "clean", dirty: false });
  });

  it("does not report a note dirty just because the editor normalizes it", async () => {
    // The editor's markdown can differ from the bytes on disk (#40). attach
    // re-baselines to what the editor renders, so merely opening a note
    // never rewrites it.
    const path = "n.md";
    const fake = fakeIo({ [path]: "- a\n- b\n" });
    const note = openNote(path, { io: fake.io });
    await note.load();

    note.attach(() => "- a\n\n- b\n"); // rendered loose instead of tight
    await note.flush();

    expect(fake.writes).toEqual([]);
    expect(note.getState()).toMatchObject({ save: "clean", dirty: false });
  });
});

describe("openNote — dirty", () => {
  it("is observable from the moment an edit arrives until the save lands", async () => {
    const { note, doc } = await opened("x\n");
    expect(note.getState()).toMatchObject({ dirty: false });

    doc.value = "xy\n";
    note.edit();
    expect(note.getState()).toMatchObject({ dirty: true });

    await note.flush();
    expect(note.getState()).toMatchObject({ save: "clean", dirty: false });
  });

  it("stays dirty when an edit arrives while a save is in flight", async () => {
    const { note, doc } = await opened("x\n");

    doc.value = "xy\n";
    note.edit();
    const saving = note.flush();
    // Typed during the write: this content is not in the snapshot being saved.
    doc.value = "xyz\n";
    note.edit();
    await saving;

    expect(note.getState()).toMatchObject({ save: "clean", dirty: true });
    // Its own debounce still lands it.
    await settle();
    expect(note.getState()).toMatchObject({ dirty: false });
  });
});

describe("openNote — reconcile", () => {
  it("reloads silently when the file changed and the buffer is clean", async () => {
    const { note, disk } = await opened("v1\n");

    disk["n.md"] = "v2, edited in another app\n";
    await note.reconcile();

    expect(note.getState()).toMatchObject({
      status: "ready",
      body: "v2, edited in another app\n",
      save: "clean",
      dirty: false,
    });
  });

  it("keeps the buffer when the file changed and the buffer is dirty", async () => {
    const { note, doc, disk } = await opened("v1\n");

    doc.value = "v1 with my edits\n";
    note.edit();
    disk["n.md"] = "v2 from elsewhere\n";
    await note.reconcile();

    // Our edits survive; #34 adds the choice between them.
    expect(note.getState()).toMatchObject({ body: "v1\n", dirty: true });
  });

  it("does nothing when the file is unchanged", async () => {
    const { note } = await opened("v1\n");
    const before = note.getState();

    await note.reconcile();

    expect(note.getState()).toBe(before);
  });

  it("leaves the buffer alone when the file has become unreadable", async () => {
    const { note, control } = await opened("v1\n");
    control.readError = new Error("unmounted");

    await note.reconcile();

    expect(note.getState()).toMatchObject({ status: "ready", body: "v1\n" });
  });
});

describe("openNote — subscription and disposal", () => {
  it("notifies subscribers on change and stops once unsubscribed", async () => {
    const { io } = fakeIo({ "n.md": "x\n" });
    const note = openNote("n.md", { io });
    let notifications = 0;
    const unsubscribe = note.subscribe(() => notifications++);

    await note.load();
    expect(notifications).toBe(1);

    unsubscribe();
    note.attach(() => "x\n");
    note.edit();

    expect(notifications).toBe(1);
    note.dispose();
  });

  it("returns a stable state reference when nothing changed", async () => {
    const { note, doc } = await opened("x\n");

    doc.value = "xy\n";
    note.edit();
    const first = note.getState();
    note.edit(); // already dirty — nothing to publish

    expect(note.getState()).toBe(first);
    note.dispose();
  });

  it("does not write after disposal", async () => {
    const { note, doc, writes } = await opened("x\n");

    doc.value = "xy\n";
    note.edit(); // debounce pending
    note.dispose();
    await settle();

    expect(writes).toEqual([]);
  });
});
