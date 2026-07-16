// Obiter — sample notes. The tree mirrors the folder on disk exactly —
// folders then files, no virtual collections. Production replaces this module
// with a real read of the chosen folder (and writes on ⌘S).

export interface NoteFile {
  type: "file";
  name: string;
  path: string;
  body: string;
}

export interface NoteFolder {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = NoteFile | NoteFolder;

export const NOTES_ROOT = "~/Notes";

export const TREE: TreeNode[] = [
  {
    type: "folder",
    name: "obiter",
    path: "~/Notes/obiter",
    children: [
      {
        type: "file",
        name: "brand-notes.md",
        path: "~/Notes/obiter/brand-notes.md",
        body: "# Brand notes\n\nThe mark is `[…]` — text elided from a quotation.\n\n- sans is the app talking\n- mono is your text and the machine's\n- pencil marks, it never decorates",
      },
    ],
  },
  {
    type: "folder",
    name: "recipes",
    path: "~/Notes/recipes",
    children: [
      {
        type: "file",
        name: "dumplings.md",
        path: "~/Notes/recipes/dumplings.md",
        body: "# Dumplings\n\n- 2 cups flour\n- ¾ cup warm water\n- pinch of salt\n\nRest the dough 30 minutes. The fold takes practice; the filling forgives you.",
      },
    ],
  },
  {
    type: "file",
    name: "2026-07-16.md",
    path: "~/Notes/2026-07-16.md",
    body: "# Thursday\n\nRebuilt the folder picker. It shows the path now instead of promising anything.\n\n- [x] read `~/Notes` on launch\n- [ ] handle a folder that moved\n\nSee [yesterday](2026-07-15.md) for the version that lied.",
  },
  {
    type: "file",
    name: "reading.md",
    path: "~/Notes/reading.md",
    body: "# Reading\n\nA plain list. No tags, no database — just a file.\n\n- *Seeing Like a State*, Scott\n- *The Timeless Way of Building*, Alexander\n- notes on `obiter dicta` and marginalia\n\nEverything here opens with `cat`.",
  },
];

export interface FlatNote extends NoteFile {
  /** parent folder, e.g. "~/Notes/obiter" */
  dir: string;
}

function flatten(nodes: TreeNode[]): NoteFile[] {
  let out: NoteFile[] = [];
  for (const n of nodes) {
    if (n.type === "folder") out = out.concat(flatten(n.children));
    else out.push(n);
  }
  return out;
}

export const FILES: FlatNote[] = flatten(TREE).map((f) => ({
  ...f,
  dir: f.path.slice(0, f.path.lastIndexOf("/")),
}));

/** the note shown when the folder opens with nothing selected yet */
export const DEFAULT_NOTE = FILES.find((f) => f.name === "2026-07-16.md") ?? FILES[0];

/** "~/Notes/obiter/brand-notes.md" -> "obiter/brand-notes.md" (routes carry the relative path) */
export function toRelative(path: string): string {
  return path.startsWith(`${NOTES_ROOT}/`) ? path.slice(NOTES_ROOT.length + 1) : path;
}

export function findNote(relPath: string): FlatNote | undefined {
  return FILES.find((f) => f.path === `${NOTES_ROOT}/${relPath}`);
}
