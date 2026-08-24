import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, PanelLeft, Search, Settings, Square, X } from "lucide-react";
import { IconButton } from "../components/core/IconButton";
import { Tooltip } from "../components/core/Tooltip";

export interface TitlebarProps {
  /** the open note's full path, or "obiter" on the empty state */
  path: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSearch: () => void;
  onSettings: () => void;
}

// Platform checks are functions, not module constants: the Tauri internals
// (and their test mocks) can land on `window` after this module is imported.
const isTauri = () => "__TAURI_INTERNALS__" in window;

// The window chrome differs per platform. On macOS the title bar is
// overlay-style (tauri.conf.json): the native traffic lights float over this
// toolbar, so the controls inset past them and we draw no buttons of our own.
// On Linux the window is undecorated (tauri.linux.conf.json) — no native
// title bar at all — so this toolbar carries its own minimize/maximize/close.
// In a plain browser (pnpm dev) there is no window to control either way.
const isMac = () => navigator.userAgent.includes("Macintosh");

/** Minimize / maximize / close for the undecorated (non-mac) window. */
function WindowControls() {
  return (
    <div style={{ display: "flex", gap: 2, marginLeft: 6 }}>
      <IconButton
        icon={Minus}
        aria-label="Minimize window"
        size="sm"
        onClick={() => void getCurrentWindow().minimize()}
      />
      <IconButton
        icon={Square}
        aria-label="Maximize window"
        size="sm"
        onClick={() => void getCurrentWindow().toggleMaximize()}
      />
      <IconButton
        icon={X}
        aria-label="Close window"
        size="sm"
        onClick={() => void getCurrentWindow().close()}
      />
    </div>
  );
}

/** The app toolbar. Doubles as the window drag region under Tauri — the
    traffic lights are native on macOS, everything else is ours. */
export function Titlebar({
  path,
  sidebarOpen,
  onToggleSidebar,
  onSearch,
  onSettings,
}: TitlebarProps) {
  const tauri = isTauri();
  const nativeLights = tauri && isMac();
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
        paddingLeft: nativeLights ? 78 : 12,
        borderBottom: "1px solid var(--ash)",
        background: "var(--paper)",
        WebkitUserSelect: "none",
      }}
    >
      <Tooltip label="Toggle sidebar">
        <IconButton
          icon={PanelLeft}
          aria-label="Toggle sidebar"
          size="sm"
          active={sidebarOpen}
          onClick={onToggleSidebar}
        />
      </Tooltip>
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
      <Tooltip label="Search">
        <IconButton icon={Search} aria-label="Search" size="sm" onClick={onSearch} />
      </Tooltip>
      <Tooltip label="Settings">
        <IconButton icon={Settings} aria-label="Settings" size="sm" onClick={onSettings} />
      </Tooltip>
      {tauri && !nativeLights && <WindowControls />}
    </div>
  );
}
