import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { Icon } from "../core/Icon";
import type { Entry } from "../../notebook/notebook";

interface RowProps {
  node: Entry;
  depth: number;
  expanded: Set<string>;
  childrenByPath: Map<string, Entry[]>;
  toggle: (node: Entry) => void;
  selected?: string;
  onSelect?: (path: string) => void;
}

// One row — folder or file. Indent tracks depth; the tree mirrors the folder
// on disk, so there are no virtual collections here, only what's really there.
// A folder's children are loaded lazily, so they appear only once expanded.
function Row({ node, depth, expanded, childrenByPath, toggle, selected, onSelect }: RowProps) {
  const [hover, setHover] = useState(false);
  const isFolder = node.kind === "folder";
  const open = expanded.has(node.path);
  const on = node.path === selected;
  const pad = 8 + depth * 14;
  const children = childrenByPath.get(node.path) ?? [];
  return (
    <div>
      <button
        type="button"
        onClick={() => (isFolder ? toggle(node) : onSelect?.(node.path))}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          textAlign: "left",
          border: "none",
          borderRadius: "var(--radius)",
          padding: "5px 8px",
          paddingLeft: pad,
          cursor: "pointer",
          background: on || hover ? "var(--bg-subtle)" : "transparent",
          color: on ? "var(--text-body)" : "var(--text-muted)",
          borderLeft: on ? "2px solid var(--pencil-500)" : "2px solid transparent",
        }}
      >
        {isFolder ? (
          <Icon
            icon={open ? ChevronDown : ChevronRight}
            size={13}
            style={{ color: "var(--slate)" }}
          />
        ) : (
          <span style={{ width: 13, flex: "0 0 auto" }} />
        )}
        <Icon
          icon={isFolder ? (open ? FolderOpen : Folder) : FileText}
          size={14}
          style={{ color: on && !isFolder ? "var(--pencil-600)" : "var(--slate)" }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </span>
      </button>
      {isFolder &&
        open &&
        children.map((c) => (
          <Row
            key={c.path}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            childrenByPath={childrenByPath}
            toggle={toggle}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export interface FileTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Lists one folder's children; `""` is the notebook root. */
  loadChildren: (path: string) => Promise<Entry[]>;
  selected?: string;
  onSelect?: (path: string) => void;
  style?: CSSProperties;
}

/**
 * Obiter FileTree. A recursive folder/file tree that mirrors the notebook
 * one-to-one — the folder is the truth. Children load lazily: the root on
 * mount, each folder when expanded. Selection is controlled via `selected`
 * + `onSelect` (notebook-relative paths).
 */
export function FileTree({ loadChildren, selected, onSelect, style, ...rest }: FileTreeProps) {
  const [childrenByPath, setChildrenByPath] = useState<Map<string, Entry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      // A missing/unreadable notebook is the shell's concern (the error
      // surface lands in a later slice); the tree just stays empty here.
    });
  }, [load]);

  const toggle = (node: Entry) => {
    const opening = !expanded.has(node.path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (opening) next.add(node.path);
      else next.delete(node.path);
      return next;
    });
    if (opening && !childrenByPath.has(node.path)) {
      void load(node.path).catch(() => {});
    }
  };

  const roots = childrenByPath.get("") ?? [];
  return (
    <div style={style} {...rest}>
      {roots.map((c) => (
        <Row
          key={c.path}
          node={c}
          depth={0}
          expanded={expanded}
          childrenByPath={childrenByPath}
          toggle={toggle}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
