// Obiter — navigation. TanStack Router owns what the prototype kept in
// booleans: "/" is the first-run folder picker, "/notes/<path>" is the app
// shell with that note open. Ephemeral chrome (sidebar, ⌘K palette, settings
// modal) stays React state in the root layout — it isn't a place you can be.

import { useEffect, useState } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { Folder, PanelLeft, Plus, Settings as SettingsIcon } from "lucide-react";
import { searchNotes } from "./notebook/client";
import { useChooseFolder } from "./notebook/useChooseFolder";
import { NotebookGate, useNotebookStatus } from "./app/NotebookGate";
import { RecoveryToast } from "./app/RecoveryToast";
import { Settings } from "./app/Settings";
import { Sidebar } from "./app/Sidebar";
import { Titlebar } from "./app/Titlebar";
import { CommandPalette, type PaletteItem } from "./components/navigation/CommandPalette";
import { ToastProvider, ToastViewport } from "./components/core/Toast";
import { Editor } from "./notes/Editor";

function RootLayout() {
  const navigate = useNavigate();
  const { _splat: splat } = useParams({ strict: false });
  const [sidebar, setSidebar] = useState(true);
  const [cmd, setCmd] = useState(false);
  const [settings, setSettings] = useState(false);

  const opened = splat !== undefined && splat !== "";
  const path = opened && splat ? splat : "obiter";

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((c) => !c);
      }
      // ⌘⇧B toggles the sidebar (plain ⌘B stays bold in the editor)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebar((s) => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettings(true);
      }
      // The settings modal is a Base UI Dialog now — it owns its own Escape.
      if (e.key === "Escape") {
        setCmd(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const chooseFolder = useChooseFolder();
  // The lazy tree speaks notebook-relative paths, matching the route.
  const openRelative = (relPath: string) =>
    navigate({ to: "/notes/$", params: { _splat: relPath } });

  const paletteItems: PaletteItem[] = [
    {
      id: "new",
      label: "New note",
      section: "Commands",
      icon: Plus,
      shortcut: ["⌘", "N"],
      run: () => navigate({ to: "/notes" }),
    },
    {
      id: "sidebar",
      label: sidebar ? "Hide sidebar" : "Show sidebar",
      section: "Commands",
      icon: PanelLeft,
      shortcut: ["⌘", "⇧", "B"],
      run: () => setSidebar((s) => !s),
    },
    {
      id: "settings",
      label: "Open settings",
      section: "Commands",
      icon: SettingsIcon,
      shortcut: ["⌘", ","],
      run: () => setSettings(true),
    },
    {
      id: "folder",
      label: "Change folder",
      section: "Commands",
      icon: Folder,
      run: () => void chooseFolder(),
    },
    // Jump-to-note (backend search) lands in a later slice.
  ];

  return (
    <ToastProvider>
      <NotebookGate>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--paper)",
          }}
        >
          <Titlebar
            path={path}
            sidebarOpen={sidebar}
            onToggleSidebar={() => setSidebar((s) => !s)}
            onSearch={() => setCmd(true)}
            onSettings={() => setSettings(true)}
          />
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {sidebar && (
              <Sidebar selected={splat} onSelect={openRelative} onNew={() => setCmd(true)} />
            )}
            <Outlet />
          </div>
          <RecoveryToast onViewSettings={() => setSettings(true)} />
          <ToastViewport />
          {cmd && (
            <CommandPalette
              open
              items={paletteItems}
              searchNotes={searchNotes}
              onOpenNote={(p) => openRelative(p)}
              onClose={() => setCmd(false)}
            />
          )}
          {settings && (
            <Settings
              onClose={() => setSettings(false)}
              onDisconnect={() => {
                setSettings(false);
                navigate({ to: "/" });
              }}
            />
          )}
        </div>
      </NotebookGate>
    </ToastProvider>
  );
}

function NoteRoute() {
  const { _splat: splat } = noteRoute.useParams();
  const path = splat ?? "";
  // Key by path so switching notes remounts the editor — its unmount flushes
  // the outgoing note's pending save before the next note loads.
  return <Editor key={path} path={path} />;
}

/**
 * "/notes" with nothing selected. The notebook is open; the message depends
 * on whether it actually holds anything.
 */
function NoNoteSelected() {
  const status = useNotebookStatus();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--slate)",
        fontSize: 14,
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      {status === "empty"
        ? "This notebook is empty. Add a markdown file to the folder to get started."
        : "Select a note from the sidebar."}
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

// "/" is just the app entry — the NotebookGate decides first-run vs app from
// settings, so the URL only needs to land inside the notebook shell.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/notes" });
  },
});

const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "notes",
});

// "/notes" alone means "the notebook is open, no note selected" — a neutral
// pane. (Restoring the last-opened note is a deferred session-state feature.)
const notesIndexRoute = createRoute({
  getParentRoute: () => notesRoute,
  path: "/",
  component: NoNoteSelected,
});

const noteRoute = createRoute({
  getParentRoute: () => notesRoute,
  path: "$",
  component: NoteRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  notesRoute.addChildren([notesIndexRoute, noteRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
