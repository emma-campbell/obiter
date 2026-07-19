// @vitest-environment jsdom
// Rendering smoke test: opening markdown must produce the DOM structure the
// prose stylesheet targets — flat-list items with the right data-list-kind,
// a real checkbox for task items, and a <table> for GFM tables. This guards
// the #50 rendering fix: if a construct is silently dropped on parse or the
// parse stops mapping GFM tasks to task-kind items, the markers/hairlines the
// CSS draws would have nothing to attach to. (Round-trip serialization back to
// markdown is covered separately — see #51.)

import { afterEach, describe, expect, it } from "vite-plus/test";
import { mount, type NoteEditor } from "./prosekit-editor";

let el: HTMLElement | null = null;
let editor: NoteEditor | null = null;

function open(md: string) {
  el = document.createElement("div");
  document.body.appendChild(el);
  editor = mount(el, md, {}, { editable: false });
  return el;
}

afterEach(() => {
  editor?.destroy();
  el?.remove();
  editor = null;
  el = null;
});

describe("prosekit rendering", () => {
  it("renders bullet and ordered lists as flat-list items with kind markers", () => {
    const dom = open("- apple\n- pear\n\n1. first\n2. second\n");
    expect(dom.querySelector('[data-list-kind="bullet"]')).toBeTruthy();
    expect(dom.querySelector('[data-list-kind="ordered"]')).toBeTruthy();
    // every list item carries the flat-list class the stylesheet keys off
    expect(dom.querySelectorAll(".prosemirror-flat-list").length).toBeGreaterThan(0);
  });

  it("renders a GFM task list as task-kind items with real checkboxes", () => {
    const dom = open("- [ ] todo\n- [x] done\n");
    const tasks = dom.querySelectorAll('[data-list-kind="task"]');
    expect(tasks.length).toBe(2);
    const boxes = dom.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBe(2);
    // the checked item reflects [x]
    expect(dom.querySelector("[data-list-checked]")).toBeTruthy();
  });

  it("renders a GFM table as a real table element", () => {
    const dom = open("| a | b |\n| - | - |\n| 1 | 2 |\n");
    expect(dom.querySelector("table")).toBeTruthy();
    expect(dom.querySelectorAll("th").length).toBe(2);
    expect(dom.querySelectorAll("td").length).toBe(2);
  });
});
