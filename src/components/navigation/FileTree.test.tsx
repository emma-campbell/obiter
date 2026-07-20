// @vitest-environment jsdom
// The lazy FileTree: loads the root on mount, and fetches a folder's
// children only when it's expanded — with the correct notebook-relative
// path.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Entry } from "../../notebook/notebook";
import { FileTree } from "./FileTree";

const ROOT: Entry[] = [
  { name: "recipes", path: "recipes", kind: "folder" },
  { name: "reading.md", path: "reading.md", kind: "file" },
];
const RECIPES: Entry[] = [{ name: "dumplings.md", path: "recipes/dumplings.md", kind: "file" }];

function loader() {
  return vi.fn((path: string) => {
    if (path === "") return Promise.resolve(ROOT);
    if (path === "recipes") return Promise.resolve(RECIPES);
    return Promise.resolve([]);
  });
}

afterEach(cleanup);

describe("FileTree (lazy)", () => {
  it("loads and renders the notebook root on mount", async () => {
    const load = loader();
    render(<FileTree loadChildren={load} />);

    await waitFor(() => {
      expect(screen.getByText("recipes")).toBeTruthy();
    });
    expect(screen.getByText("reading.md")).toBeTruthy();
    expect(load).toHaveBeenCalledWith("");
    // A collapsed folder's children are not fetched yet.
    expect(load).not.toHaveBeenCalledWith("recipes");
  });

  it("fetches a folder's children only when expanded, by relative path", async () => {
    const load = loader();
    render(<FileTree loadChildren={load} />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());

    fireEvent.click(screen.getByText("recipes"));

    await waitFor(() => {
      expect(screen.getByText("dumplings.md")).toBeTruthy();
    });
    expect(load).toHaveBeenCalledWith("recipes");
  });

  it("selecting a note reports its notebook-relative path", async () => {
    const load = loader();
    const onSelect = vi.fn();
    render(<FileTree loadChildren={load} onSelect={onSelect} />);
    await waitFor(() => expect(screen.getByText("reading.md")).toBeTruthy());

    fireEvent.click(screen.getByText("reading.md"));
    expect(onSelect).toHaveBeenCalledWith("reading.md");
  });

  it("re-lists the root and expanded folders on window focus", async () => {
    let recipesChildren: Entry[] = [
      { name: "dumplings.md", path: "recipes/dumplings.md", kind: "file" },
    ];
    let rootChildren: Entry[] = [
      { name: "recipes", path: "recipes", kind: "folder" },
      { name: "reading.md", path: "reading.md", kind: "file" },
    ];
    const load = vi.fn((path: string) => {
      if (path === "") return Promise.resolve(rootChildren);
      if (path === "recipes") return Promise.resolve(recipesChildren);
      return Promise.resolve([]);
    });
    render(<FileTree loadChildren={load} />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());

    fireEvent.click(screen.getByText("recipes"));
    await waitFor(() => expect(screen.getByText("dumplings.md")).toBeTruthy());

    // Notes added externally to both the root and the expanded folder.
    rootChildren = [...rootChildren, { name: "new-top.md", path: "new-top.md", kind: "file" }];
    recipesChildren = [
      ...recipesChildren,
      { name: "gyoza.md", path: "recipes/gyoza.md", kind: "file" },
    ];

    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(screen.getByText("new-top.md")).toBeTruthy();
      expect(screen.getByText("gyoza.md")).toBeTruthy();
    });
  });

  it("does not re-list collapsed folders on focus", async () => {
    const load = vi.fn((path: string): Promise<Entry[]> => {
      if (path === "")
        return Promise.resolve([{ name: "recipes", path: "recipes", kind: "folder" }]);
      return Promise.resolve([]);
    });
    render(<FileTree loadChildren={load} />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());

    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(load.mock.calls.filter(([p]) => p === "").length).toBeGreaterThanOrEqual(2);
    });
    // "recipes" was never expanded, so focus never fetches it.
    expect(load).not.toHaveBeenCalledWith("recipes");
  });

  it("exposes tree/treeitem roles, aria-level, and the selected tab stop", async () => {
    render(<FileTree loadChildren={loader()} selected="reading.md" />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());

    expect(screen.getByRole("tree", { name: "Notebook files" })).toBeTruthy();
    const recipes = screen.getByText("recipes").closest('[role="treeitem"]')!;
    expect(recipes.getAttribute("aria-level")).toBe("1");
    expect(recipes.getAttribute("aria-expanded")).toBe("false");

    const reading = screen.getByText("reading.md").closest('[role="treeitem"]')!;
    expect(reading.getAttribute("aria-selected")).toBe("true");
    // The selected note is the single tab stop; siblings are removed from the
    // tab order (roving tabindex).
    expect(reading.getAttribute("tabindex")).toBe("0");
    expect(recipes.getAttribute("tabindex")).toBe("-1");
  });

  it("moves focus with the arrow keys", async () => {
    render(<FileTree loadChildren={loader()} />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());

    fireEvent.keyDown(screen.getByRole("tree"), { key: "ArrowDown" });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByText("reading.md").closest('[role="treeitem"]'),
      );
    });
  });

  it("expands with ArrowRight and collapses with ArrowLeft", async () => {
    render(<FileTree loadChildren={loader()} />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());
    const tree = screen.getByRole("tree");

    fireEvent.keyDown(tree, { key: "ArrowRight" }); // recipes is the first row
    await waitFor(() => expect(screen.getByText("dumplings.md")).toBeTruthy());
    expect(
      screen.getByText("recipes").closest('[role="treeitem"]')!.getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.queryByText("dumplings.md")).toBeNull());
  });

  it("activates a file with Enter", async () => {
    const onSelect = vi.fn();
    render(<FileTree loadChildren={loader()} onSelect={onSelect} />);
    await waitFor(() => expect(screen.getByText("reading.md")).toBeTruthy());
    const tree = screen.getByRole("tree");

    fireEvent.keyDown(tree, { key: "ArrowDown" }); // recipes -> reading.md
    fireEvent.keyDown(tree, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("reading.md");
  });

  it("collapsing a folder doesn't refetch on re-expand", async () => {
    const load = loader();
    render(<FileTree loadChildren={load} />);
    await waitFor(() => expect(screen.getByText("recipes")).toBeTruthy());

    fireEvent.click(screen.getByText("recipes"));
    await waitFor(() => expect(screen.getByText("dumplings.md")).toBeTruthy());
    fireEvent.click(screen.getByText("recipes")); // collapse
    fireEvent.click(screen.getByText("recipes")); // re-expand

    await waitFor(() => expect(screen.getByText("dumplings.md")).toBeTruthy());
    // Cached: only the one fetch for "recipes".
    expect(load.mock.calls.filter(([p]) => p === "recipes")).toHaveLength(1);
  });
});
