import { Folder, Plus } from "lucide-react";
import { Button } from "../components/core/Button";
import { Icon } from "../components/core/Icon";
import { FileTree } from "../components/navigation/FileTree";
import { listDir } from "../notebook/client";
import { useSettings } from "../settings/SettingsProvider";

export interface SidebarProps {
  /** Notebook-relative path of the open note. */
  selected?: string;
  onSelect: (path: string) => void;
  onNew: () => void;
}

/** Left rail: the notebook header, the lazy FileTree, and New note. */
export function Sidebar({ selected, onSelect, onNew }: SidebarProps) {
  const { settings } = useSettings();
  const path = settings?.notebook.path ?? "";
  const name = path.split("/").filter(Boolean).pop() ?? path;

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
        <span
          title={path}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "6px 6px" }}>
        <FileTree loadChildren={listDir} selected={selected} onSelect={onSelect} />
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
