// @vitest-environment jsdom
// The editable note view: loads real contents via read_note and mounts an
// editable editor with the formatting toolbar and a save-state indicator.
// The autosave timing/write logic is covered directly in useAutosave.test;
// here we assert the wiring — contents load, the toolbar renders, the
// indicator shows, and the error state appears — not ProseMirror internals.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Editor } from "./Editor";

function mockBackend(bodyByPath: Record<string, string | Error>) {
  const reads: string[] = [];
  mockIPC((cmd, args) => {
    if (cmd === "read_note") {
      const path = (args as { path: string }).path;
      reads.push(path);
      const body = bodyByPath[path];
      if (body instanceof Error) throw "io: no such file";
      return body ?? "";
    }
    if (cmd === "write_note") return null; // autosave writes are a no-op here
    throw new Error(`unexpected command: ${cmd}`);
  });
  return reads;
}

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("Editor (editable)", () => {
  it("loads the note by path and mounts the editable toolbar + indicator", async () => {
    const reads = mockBackend({ "recipes/dumplings.md": "# Dumplings\n\nRest the dough." });
    render(<Editor path="recipes/dumplings.md" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Bold")).toBeTruthy();
    });
    expect(reads).toContain("recipes/dumplings.md");
    // Formatting toolbar is present now, and the read-only hint is gone.
    expect(screen.getByLabelText("Inline code")).toBeTruthy();
    expect(screen.queryByText(/Read-only preview/)).toBeNull();
    // The save-state indicator starts clean.
    expect(screen.getByText("saved")).toBeTruthy();
  });

  it("exposes the formatting controls as a roving-tabindex toolbar", async () => {
    mockBackend({ "n.md": "# Hi" });
    render(<Editor path="n.md" />);

    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
    });
    // Base UI Toolbar gives the group one tab stop (roving tabindex): the first
    // control is tabbable, the rest are reached with the arrow keys.
    expect(screen.getByLabelText("Bold").getAttribute("tabindex")).toBe("0");
    expect(screen.getByLabelText("Italic").getAttribute("tabindex")).toBe("-1");
    expect(screen.getByLabelText("Link").getAttribute("tabindex")).toBe("-1");
  });

  it("renders an error state when the note can't be read", async () => {
    mockBackend({ "gone.md": new Error("missing") });
    render(<Editor path="gone.md" />);

    await waitFor(() => {
      expect(screen.getByText(/Couldn't open this note/)).toBeTruthy();
    });
  });

  it("reloads when the open path changes", async () => {
    const reads = mockBackend({ "a.md": "note a", "b.md": "note b" });
    const { rerender } = render(<Editor path="a.md" />);
    await waitFor(() => expect(reads).toContain("a.md"));

    rerender(<Editor path="b.md" />);
    await waitFor(() => expect(reads).toContain("b.md"));
  });
});
