// @vitest-environment jsdom
// Round-trip through the REAL editor path. The string-pipeline golden test in
// markdown.test.ts never touches ProseMirror; this one mounts the actual
// editor and reads getMarkdown(), which is what autosave writes to disk. It
// guards the flat-list serialization: without it, opening a note with a list
// and letting autosave fire rewrites every list into loose paragraphs and
// destroys task checkboxes.

import { afterEach, describe, expect, it } from "vite-plus/test";
import { splitFrontmatter } from "./markdown";
import { mount, type NoteEditor } from "./prosekit-editor";

const fixtures = import.meta.glob("./fixtures/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

// nested-lists.md is intentionally loose and is the subject of #40 (tight→loose
// reflow); it does not round-trip byte-stable through either pipeline, so it is
// not part of this slice's guarantee.
const KNOWN_LOOSE = "nested-lists.md";

let editors: NoteEditor[] = [];
let els: HTMLElement[] = [];

function open(body: string): NoteEditor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const ed = mount(el, body, {}, { editable: true });
  editors.push(ed);
  els.push(el);
  return ed;
}

afterEach(() => {
  for (const ed of editors) ed.destroy();
  for (const el of els) el.remove();
  editors = [];
  els = [];
});

describe("ProseMirror round-trip (real editor path)", () => {
  for (const [path, md] of Object.entries(fixtures)) {
    if (path.endsWith(KNOWN_LOOSE)) continue;
    it(`open+save through the editor is a byte no-op: ${path}`, () => {
      // The app splits frontmatter off before the editor; mirror that here.
      const { frontmatter, body } = splitFrontmatter(md);
      const ed = open(body);
      expect(frontmatter + ed.getMarkdown()).toBe(md);
    });
  }

  it("keeps the known-loose #40 fixture from silently losing its list", () => {
    // Not byte-stable (that's #40), but it must still round-trip as a LIST with
    // its items — never collapse into bare paragraphs.
    const { body } = splitFrontmatter(fixtures["./fixtures/nested-lists.md"]);
    const out = open(body).getMarkdown();
    expect(out).toMatch(/^- Groceries/m);
    expect(out).toMatch(/- Apples/);
    expect(out).toMatch(/1\. Dishes/);
  });
});

describe("task checkbox interaction", () => {
  // ProseKit toggles a task item on a mousedown against its marker click
  // target; the toggled `checked` state must survive serialization to markdown.
  function clickCheckbox(el: HTMLElement, index: number): void {
    const marker = el.querySelectorAll(".list-marker-click-target")[index];
    marker.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  }

  it("clicking a checkbox toggles [ ] <-> [x] and persists to markdown", () => {
    const ed = open("- [ ] one\n- [x] two\n");
    clickCheckbox(els[0], 0); // check the first
    expect(ed.getMarkdown()).toBe("- [x] one\n- [x] two\n");
    clickCheckbox(els[0], 1); // uncheck the second
    expect(ed.getMarkdown()).toBe("- [x] one\n- [ ] two\n");
  });
});
