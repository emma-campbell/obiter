// @vitest-environment jsdom
// The read-only note view: loads real contents via read_note and renders
// them with editing disabled. ProseKit needs a real DOM (jsdom) but doesn't
// fully lay out here; we assert on the loaded contents and the read-only
// affordances, not on ProseMirror internals.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Editor } from "./Editor";

function mockReadNote(bodyByPath: Record<string, string | Error>) {
  const calls: string[] = [];
  mockIPC((cmd, args) => {
    if (cmd === "read_note") {
      const path = (args as { path: string }).path;
      calls.push(path);
      const body = bodyByPath[path];
      if (body instanceof Error) throw "io: no such file";
      return body ?? "";
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return calls;
}

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("Editor (read-only)", () => {
  it("loads the note's contents by path and shows the read-only hint", async () => {
    const calls = mockReadNote({ "recipes/dumplings.md": "# Dumplings\n\nRest the dough." });
    render(<Editor path="recipes/dumplings.md" />);

    await waitFor(() => {
      expect(screen.getByText(/Read-only preview/)).toBeTruthy();
    });
    expect(calls).toContain("recipes/dumplings.md");
    // No save affordance and no formatting toolbar in read-only mode.
    expect(screen.queryByLabelText("Bold")).toBeNull();
  });

  it("renders an error state when the note can't be read", async () => {
    mockReadNote({ "gone.md": new Error("missing") });
    render(<Editor path="gone.md" />);

    await waitFor(() => {
      expect(screen.getByText(/Couldn't open this note/)).toBeTruthy();
    });
  });

  it("reloads when the open path changes", async () => {
    const calls = mockReadNote({ "a.md": "note a", "b.md": "note b" });
    const { rerender } = render(<Editor path="a.md" />);
    await waitFor(() => expect(calls).toContain("a.md"));

    rerender(<Editor path="b.md" />);
    await waitFor(() => expect(calls).toContain("b.md"));
  });
});
