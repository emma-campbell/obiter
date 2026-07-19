// Obiter — a real ProseKit editor over a markdown file.
//
// ProseKit (like all ProseMirror editors) holds the document as an in-memory
// node tree, not text. Persistence happens through the string round-trip in
// markdown.ts: markdown -> HTML on open (defaultContent), rendered HTML ->
// markdown on save (getMarkdown).

import { defineBasicExtension } from "prosekit/basic";
import { createEditor, defineDocChangeHandler, definePlugin, union } from "prosekit/core";
import { ListDOMSerializer } from "prosekit/extensions/list";
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

// Serializing the note back to markdown does NOT read the editor's rendered
// innerHTML. ProseKit stores lists as flat-list nodes that render as
// <div class="prosemirror-flat-list"> — markup rehype-remark doesn't recognize
// as a list, so reading innerHTML silently turns every list into loose
// paragraphs (and mangles task checkboxes into literal "[x]" text). Instead the
// doc is serialized through ListDOMSerializer, which re-emits native <ul>/<ol>,
// then two DOM fixups make the result faithful GFM before it reaches htmlToMd.

/**
 * Unwrap a list item's lone leading <p> into inline content so remark
 * serializes it as a TIGHT item. Flat-list content is always a paragraph, so
 * without this every list round-trips loose (a blank line between each item).
 * Items with two or more paragraphs are genuinely loose and left untouched.
 * Tightness isn't recorded in the flat-list schema, so an intentionally-loose
 * single-paragraph list normalizes to tight — an accepted trade-off.
 */
function tightenListItems(root: HTMLElement): void {
  for (const li of Array.from(root.querySelectorAll("li"))) {
    const paragraphs = Array.from(li.children).filter((c) => c.tagName === "P");
    if (paragraphs.length === 1 && li.firstElementChild === paragraphs[0]) {
      const p = paragraphs[0];
      while (p.firstChild) li.insertBefore(p.firstChild, p);
      p.remove();
    }
  }
}

/**
 * Give GFM task items the leading <input type="checkbox"> that remark needs to
 * emit "- [ ]" / "- [x]". ListDOMSerializer carries the state as
 * data-list-kind / data-list-checked attributes; this translates them. Runs
 * after tightening so the checkbox lands ahead of the now-inline content.
 */
function addTaskCheckboxes(root: HTMLElement): void {
  for (const li of Array.from(root.querySelectorAll('li[data-list-kind="task"]'))) {
    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    if (li.hasAttribute("data-list-checked")) input.setAttribute("checked", "");
    li.insertBefore(input, li.firstChild);
  }
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
    getMarkdown: () => {
      const serializer = ListDOMSerializer.fromSchema(editor.schema);
      const box = document.createElement("div");
      box.appendChild(serializer.serializeFragment(editor.state.doc.content, { document }));
      tightenListItems(box);
      addTaskCheckboxes(box);
      return htmlToMd(box.innerHTML);
    },
    destroy: () => {
      clearTimeout(t);
      dom.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", onSel);
      run(() => editor.unmount());
    },
  };
}
