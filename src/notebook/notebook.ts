// Obiter notebook — the frontend view of the connected folder. Mirrors the
// Rust `notebook` module: paths are notebook-relative with `/` separators,
// `""` is the root.

export type EntryKind = "file" | "folder";

export interface Entry {
  name: string;
  /** Notebook-relative path, e.g. "recipes/dumplings.md". */
  path: string;
  kind: EntryKind;
}

/** Tagged error the backend rejects notebook commands with. */
export type NotebookError =
  | { kind: "notConnected" }
  | { kind: "missing" }
  | { kind: "outsideRoot" }
  | { kind: "io"; message: string };
