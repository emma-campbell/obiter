import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { Icon } from "../core/Icon";
import type { Entry } from "../../notebook/notebook";
import "./FileTree.css";

/** A flattened visible row, in DOM order — the model the keyboard navigates. */
interface VisibleRow {
  path: string;
  kind: Entry["kind"];
  depth: number;
  parent: string;
}

function flatten(
  entries: Entry[],
  depth: number,
  parent: string,
  expanded: Set<string>,
  byPath: Map<string, Entry[]>,
  out: VisibleRow[],
): void {
  for (const e of entries) {
    out.push({ path: e.path, kind: e.kind, depth, parent });
    if (e.kind === "folder" && expanded.has(e.path)) {
      flatten(byPath.get(e.path) ?? [], depth + 1, e.path, expanded, byPath, out);
    }
  }
}

interface NodeProps {
  node: Entry;
  depth: number;
  expanded: Set<string>;
  childrenByPath: Map<string, Entry[]>;
  current?: string;
  selected?: string;
  onSetOpen: (node: Entry, open: boolean) => void;
  onFocusRow: (path: string) => void;
  onActivate: (node: Entry) => void;
}

// One tree row. Folders use Base UI's Collapsible for the disclosure — the
// trigger IS the treeitem (Collapsible adds aria-expanded / aria-controls and
// the click toggle), and the Panel holds the child group, unmounted when
// collapsed. Files are a bare treeitem.
function TreeNode({
  node,
  depth,
  expanded,
  childrenByPath,
  current,
  selected,
  onSetOpen,
  onFocusRow,
  onActivate,
}: NodeProps) {
  const isFolder = node.kind === "folder";
  const open = expanded.has(node.path);
  const isSelected = node.path === selected;
  const children = childrenByPath.get(node.path) ?? [];

  const row = (
    <div
      role="treeitem"
      data-path={node.path}
      aria-level={depth + 1}
      aria-selected={isFolder ? undefined : isSelected}
      tabIndex={node.path === current ? 0 : -1}
      className={isSelected ? "tree__row tree__row--selected" : "tree__row"}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => {
        onFocusRow(node.path);
        // A folder's click-toggle is owned by Collapsible.Trigger (which fires
        // on click, not on keyboard) — activating here too would double-toggle.
        // Keyboard Enter/Space still routes through onActivate below.
        if (!isFolder) onActivate(node);
      }}
    >
      {isFolder ? (
        <Icon icon={open ? ChevronDown : ChevronRight} size={13} className="tree__chevron" />
      ) : (
        <span className="tree__chevron-spacer" />
      )}
      <Icon
        icon={isFolder ? (open ? FolderOpen : Folder) : FileText}
        size={14}
        className="tree__icon"
      />
      <span className="tree__name">{node.name}</span>
    </div>
  );

  if (!isFolder) return row;

  return (
    <Collapsible.Root open={open} onOpenChange={(next) => onSetOpen(node, next)}>
      <Collapsible.Trigger render={row} />
      <Collapsible.Panel render={<div role="group" />}>
        {children.map((c) => (
          <TreeNode
            key={c.path}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            childrenByPath={childrenByPath}
            current={current}
            selected={selected}
            onSetOpen={onSetOpen}
            onFocusRow={onFocusRow}
            onActivate={onActivate}
          />
        ))}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export interface FileTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Lists one folder's children; `""` is the notebook root. */
  loadChildren: (path: string) => Promise<Entry[]>;
  selected?: string;
  onSelect?: (path: string) => void;
}

/**
 * Obiter FileTree. A recursive folder/file tree that mirrors the notebook
 * one-to-one — the folder is the truth. Children load lazily: the root on
 * mount, each folder when expanded. Selection is controlled via `selected`
 * + `onSelect` (notebook-relative paths).
 *
 * It's a real WAI-ARIA tree (ADR 0001): role=tree/treeitem/group, a single
 * roving tab stop, and arrow-key navigation (up/down move, right/left
 * expand/collapse or step to parent, Enter/Space activate). Each folder's
 * expand/collapse rides on Base UI's Collapsible.
 */
export function FileTree({ loadChildren, selected, onSelect, ...rest }: FileTreeProps) {
  const [childrenByPath, setChildrenByPath] = useState<Map<string, Entry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | undefined>(undefined);
  const treeRef = useRef<HTMLDivElement>(null);
  // Set just before a keyboard move so the focus effect only steals focus in
  // response to the keyboard, never on mount or an async children load.
  const wantFocus = useRef(false);

  const load = useCallback(
    async (path: string) => {
      const entries = await loadChildren(path);
      setChildrenByPath((prev) => new Map(prev).set(path, entries));
    },
    [loadChildren],
  );

  // Load the root on mount (and whenever the notebook it reads changes).
  useEffect(() => {
    void load("").catch(() => {
      // A missing/unreadable notebook is the shell's concern (the gate); the
      // tree just stays empty here.
    });
  }, [load]);

  // Re-list the root and every expanded folder when the window regains focus,
  // so notes added or removed in another app appear without a restart. This is
  // the interim for having no file watcher (deliberately out of scope).
  useEffect(() => {
    const onFocus = () => {
      void load("").catch(() => {});
      for (const path of expanded) void load(path).catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, expanded]);

  const setOpen = useCallback(
    (node: Entry, open: boolean) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (open) next.add(node.path);
        else next.delete(node.path);
        return next;
      });
      if (open && !childrenByPath.has(node.path)) void load(node.path).catch(() => {});
    },
    [childrenByPath, load],
  );

  const roots = childrenByPath.get("") ?? [];
  const visible = useMemo(() => {
    const out: VisibleRow[] = [];
    flatten(roots, 0, "", expanded, childrenByPath, out);
    return out;
  }, [roots, expanded, childrenByPath]);

  // The single tab stop: the row the user last touched, else the selected note,
  // else the first row.
  const current = focusedPath ?? selected ?? visible[0]?.path;

  const focusRow = useCallback((path: string) => {
    wantFocus.current = true;
    setFocusedPath(path);
  }, []);

  // Move DOM focus to the current row after a keyboard move. Depending on
  // `visible` too means a right-arrow that expands a folder focuses the child
  // once it has rendered.
  useEffect(() => {
    if (!wantFocus.current || !focusedPath) return;
    wantFocus.current = false;
    // Escape for a quoted attribute selector (jsdom has no CSS.escape).
    const sel = `[data-path="${focusedPath.replace(/["\\]/g, "\\$&")}"]`;
    treeRef.current?.querySelector<HTMLElement>(sel)?.focus();
  }, [focusedPath, visible]);

  const activate = useCallback(
    (node: Entry) => {
      if (node.kind === "folder") setOpen(node, !expanded.has(node.path));
      else onSelect?.(node.path);
    },
    [expanded, setOpen, onSelect],
  );

  const rowOf = (r: VisibleRow): Entry => ({
    path: r.path,
    name: r.path.split("/").pop() ?? r.path,
    kind: r.kind,
  });

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (current == null) return;
    const idx = visible.findIndex((r) => r.path === current);
    if (idx === -1) return;
    const row = visible[idx];
    const moveTo = (i: number) => {
      const target = visible[Math.max(0, Math.min(i, visible.length - 1))];
      if (target) focusRow(target.path);
    };

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveTo(idx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveTo(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(visible.length - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (row.kind === "folder") {
          if (!expanded.has(row.path)) setOpen(rowOf(row), true);
          else moveTo(idx + 1); // first child is the next visible row
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (row.kind === "folder" && expanded.has(row.path)) setOpen(rowOf(row), false);
        else if (row.parent) focusRow(row.parent);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activate(rowOf(row));
        break;
    }
  };

  return (
    <div ref={treeRef} role="tree" aria-label="Notebook files" onKeyDown={onKeyDown} {...rest}>
      {roots.map((c) => (
        <TreeNode
          key={c.path}
          node={c}
          depth={0}
          expanded={expanded}
          childrenByPath={childrenByPath}
          current={current}
          selected={selected}
          onSetOpen={setOpen}
          onFocusRow={focusRow}
          onActivate={activate}
        />
      ))}
    </div>
  );
}
