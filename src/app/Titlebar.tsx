import { PanelLeft, Search, Settings } from "lucide-react";
import { IconButton } from "../components/core/IconButton";

export interface TitlebarProps {
  /** the open note's full path, or "obiter" on the empty state */
  path: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSearch: () => void;
  onSettings: () => void;
}

// In the Tauri window the title bar is overlay-style: the native traffic
// lights float over this toolbar, so inset the controls past them. In a plain
// browser (pnpm dev) there are no lights and no inset.
const isTauri = "__TAURI_INTERNALS__" in window;

/** The app toolbar. Doubles as the window drag region under Tauri's overlay
    title bar — the traffic lights are native, everything else is ours. */
export function Titlebar({
  path,
  sidebarOpen,
  onToggleSidebar,
  onSearch,
  onSettings,
}: TitlebarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 38,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        paddingLeft: isTauri ? 78 : 12,
        borderBottom: "1px solid var(--ash)",
        background: "var(--paper)",
        WebkitUserSelect: "none",
      }}
    >
      <IconButton
        icon={PanelLeft}
        aria-label="Toggle sidebar"
        size="sm"
        active={sidebarOpen}
        onClick={onToggleSidebar}
      />
      {/* drag-region only covers the element itself, not children — repeat it
          here so the wide middle of the bar drags the window too */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--slate)",
        }}
      >
        {path}
      </div>
      <IconButton icon={Search} aria-label="Search" size="sm" onClick={onSearch} />
      <IconButton icon={Settings} aria-label="Settings" size="sm" onClick={onSettings} />
    </div>
  );
}
