// @vitest-environment jsdom
// The palette's note-jump: typing queries the backend (debounced), shows
// the hits as a Notes section, and Enter/click opens the note by its
// notebook-relative path. Commands stay client-filtered.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Entry } from "../../notebook/notebook";
import { CommandPalette, type PaletteItem } from "./CommandPalette";

const COMMANDS: PaletteItem[] = [
  { id: "new", label: "New note", section: "Commands", run: () => {} },
];

const HITS: Entry[] = [
  { name: "dumplings.md", path: "recipes/dumplings.md", kind: "file" },
  { name: "reading.md", path: "reading.md", kind: "file" },
];

afterEach(cleanup);

describe("CommandPalette note jump", () => {
  it("queries the backend on input and lists the hits", async () => {
    const search = vi.fn(async () => HITS);
    render(<CommandPalette open items={COMMANDS} searchNotes={search} onOpenNote={() => {}} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "dmp" } });

    await waitFor(() => {
      expect(screen.getByText("dumplings.md")).toBeTruthy();
    });
    expect(search).toHaveBeenCalledWith("dmp");
    // The hint shows the parent folder.
    expect(screen.getByText("recipes")).toBeTruthy();
  });

  it("does not search on an empty query", async () => {
    const search = vi.fn(async () => HITS);
    render(<CommandPalette open items={COMMANDS} searchNotes={search} onOpenNote={() => {}} />);

    // Commands still show, but no backend call for the empty initial query.
    expect(screen.getByText("New note")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 160));
    expect(search).not.toHaveBeenCalled();
  });

  it("opens a note by its relative path and closes", async () => {
    const search = vi.fn(async () => HITS);
    const onOpenNote = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        items={COMMANDS}
        searchNotes={search}
        onOpenNote={onOpenNote}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "read" } });
    await waitFor(() => expect(screen.getByText("reading.md")).toBeTruthy());

    fireEvent.click(screen.getByText("reading.md"));
    expect(onOpenNote).toHaveBeenCalledWith("reading.md");
    expect(onClose).toHaveBeenCalled();
  });

  it("debounces rapid typing into a single query", async () => {
    const search = vi.fn(async (_query: string) => HITS);
    render(<CommandPalette open items={COMMANDS} searchNotes={search} onOpenNote={() => {}} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "d" } });
    fireEvent.change(input, { target: { value: "du" } });
    fireEvent.change(input, { target: { value: "dum" } });

    await waitFor(() => expect(search).toHaveBeenCalled());
    // Only the final keystroke's query survives the debounce.
    expect(search.mock.calls.every(([q]) => q === "dum")).toBe(true);
  });
});
