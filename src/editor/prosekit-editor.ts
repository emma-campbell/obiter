// Obiter — a real ProseKit editor over a markdown file.
//
// ProseKit (like all ProseMirror editors) holds the document as an in-memory
// node tree, not text. Persistence happens through the string round-trip in
// markdown.ts: markdown -> HTML on open (defaultContent), rendered HTML ->
// markdown on save (getMarkdown).

import { defineBasicExtension } from "prosekit/basic";
import { createEditor, defineDocChangeHandler, definePlugin, union } from "prosekit/core";
import { Plugin } from "prosekit/pm/state";
import { defineActiveLine } from "./active-line";
import { htmlToMd, mdToHtml } from "./markdown";

/** Disables user editing at the ProseMirror level — the canonical read-only. */
function defineReadonly() {
  return definePlugin(new Plugin({ props: { editable: () => false } }));
}

export interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  code: boolean;
}

export interface EditorSnapshot {
  active: ActiveMarks;
  words: number;
}

export interface NoteEditorHandlers {
  onState?: (snapshot: EditorSnapshot) => void;
  /** Fires on every document change (typing and toolbar commands alike). */
  onChange?: () => void;
}

export interface NoteEditor {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleCode: () => void;
  toggleList: () => void;
  toggleLink: () => void;
  getMarkdown: () => string;
  destroy: () => void;
}

const safe = (fn: () => boolean): boolean => {
  try {
    return !!fn();
  } catch {
    return false;
  }
};

const run = (fn: () => unknown): void => {
  try {
    fn();
  } catch {
    // command not present in this build
  }
};

export interface MountOptions {
  /** When false, the editor renders content but rejects edits. Default true. */
  editable?: boolean;
}

export function mount(
  el: HTMLElement,
  md: string,
  handlers: NoteEditorHandlers = {},
  options: MountOptions = {},
): NoteEditor {
  const { onState, onChange } = handlers;
  const { editable = true } = options;
  // Pass the mark/command-contributing extensions as direct union args so
  // their types infer (an intermediate Extension[] widens them to `never`).
  // The optional extensions are plain (no marks/commands): readonly disables
  // editing; doc-change fires the autosave trigger for typing and toolbar
  // commands alike (dom "input" misses programmatic edits).
  const editor = createEditor({
    extension: union(
      defineBasicExtension(),
      defineActiveLine(),
      ...(editable ? [] : [defineReadonly()]),
      ...(onChange ? [defineDocChangeHandler(() => onChange())] : []),
    ),
    defaultContent: mdToHtml(md),
  });
  editor.mount(el);
  const dom = el.querySelector<HTMLElement>(".ProseMirror") ?? el;

  const active = (): ActiveMarks => ({
    bold: safe(() => editor.marks.bold.isActive()),
    italic: safe(() => editor.marks.italic.isActive()),
    code: safe(() => editor.marks.code.isActive()),
  });
  const words = () => (dom.innerText || "").trim().split(/\s+/).filter(Boolean).length;
  const emit = () => onState?.({ active: active(), words: words() });

  let t: ReturnType<typeof setTimeout> | undefined;
  const onInput = () => {
    clearTimeout(t);
    t = setTimeout(emit, 150);
  };
  const onSel = () => emit();
  dom.addEventListener("input", onInput);
  document.addEventListener("selectionchange", onSel);
  emit();

  const focus = () => run(() => editor.focus());
  return {
    toggleBold: () => {
      run(() => editor.commands.toggleBold());
      focus();
      emit();
    },
    toggleItalic: () => {
      run(() => editor.commands.toggleItalic());
      focus();
      emit();
    },
    toggleCode: () => {
      run(() => editor.commands.toggleCode());
      focus();
      emit();
    },
    toggleList: () => {
      run(() => editor.commands.toggleList({ kind: "bullet" }));
      focus();
      emit();
    },
    toggleLink: () => {
      run(() => editor.commands.toggleLink({ href: "#" }));
      focus();
      emit();
    },
    getMarkdown: () => htmlToMd(dom.innerHTML),
    destroy: () => {
      clearTimeout(t);
      dom.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", onSel);
      run(() => editor.unmount());
    },
  };
}
