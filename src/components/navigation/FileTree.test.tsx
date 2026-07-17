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
