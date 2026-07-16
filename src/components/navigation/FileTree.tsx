import { useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { Icon } from "../core/Icon";
import type { NoteFile, TreeNode } from "../../notes/notes-data";

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selected?: string;
  onSelect?: (path: string, node: NoteFile) => void;
}

// One row — folder or file. Indent tracks depth; the tree mirrors the folder
// on disk, so there are no virtual collections here, only what's really there.
function Row({ node, depth, expanded, toggle, selected, onSelect }: RowProps) {
  const [hover, setHover] = useState(false);
  const isFolder = node.type === "folder";
  const open = expanded.has(node.path);
  const on = node.path === selected;
  const pad = 8 + depth * 14;
  return (
    <div>
      <button
        type="button"
        onClick={() => (isFolder ? toggle(node.path) : onSelect?.(node.path, node))}
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
        node.children.map((c) => (
          <Row
            key={c.path}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export interface FileTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  tree?: TreeNode[];
  selected?: string;
  onSelect?: (path: string, node: NoteFile) => void;
  defaultExpanded?: string[];
  style?: CSSProperties;
}

/**
 * Obiter FileTree. A recursive folder/file tree that mirrors a directory
 * one-to-one — the folder is the truth. Expand state is internal (seed it with
 * `defaultExpanded`); selection is controlled via `selected` + `onSelect`.
 */
export function FileTree({
  tree = [],
  selected,
  onSelect,
  defaultExpanded = [],
  style,
  ...rest
}: FileTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));
  const toggle = (p: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  return (
    <div style={style} {...rest}>
      {tree.map((c) => (
        <Row
          key={c.path}
          node={c}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
