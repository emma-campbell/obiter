import { Folder, Plus } from "lucide-react";
import { Button } from "../components/core/Button";
import { Icon } from "../components/core/Icon";
import { FileTree } from "../components/navigation/FileTree";
import { NOTES_ROOT, TREE, type NoteFile } from "../notes/notes-data";

export interface SidebarProps {
  selected?: string;
  onSelect: (path: string, node: NoteFile) => void;
  onNew: () => void;
}

/** Left rail: the folder header, the reusable FileTree, and New note. */
export function Sidebar({ selected, onSelect, onNew }: SidebarProps) {
  return (
    <div
      style={{
        width: 230,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--ash)",
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          padding: "12px 14px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--chalk)",
        }}
      >
        <Icon icon={Folder} size={15} style={{ color: "var(--graphite)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)" }}>
          {NOTES_ROOT}
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "6px 6px" }}>
        <FileTree
          tree={TREE}
          selected={selected}
          onSelect={onSelect}
          defaultExpanded={["~/Notes/obiter", "~/Notes/recipes"]}
        />
      </div>
      <div style={{ padding: 10, borderTop: "1px solid var(--chalk)" }}>
        <Button
          size="sm"
          startIcon={<Icon icon={Plus} size={14} />}
          onClick={onNew}
          style={{ width: "100%" }}
        >
          New note
        </Button>
      </div>
    </div>
  );
}
