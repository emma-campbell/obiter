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
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { Folder, PanelLeft, Plus, Settings as SettingsIcon } from "lucide-react";
import { EmptyState } from "./app/EmptyState";
import { RecoveryToast } from "./app/RecoveryToast";
import { Settings } from "./app/Settings";
import { Sidebar } from "./app/Sidebar";
import { Titlebar } from "./app/Titlebar";
import { CommandPalette, type PaletteItem } from "./components/navigation/CommandPalette";
import { Editor } from "./notes/Editor";

function RootLayout() {
  const navigate = useNavigate();
  const { _splat: splat } = useParams({ strict: false });
  const [sidebar, setSidebar] = useState(true);
  const [cmd, setCmd] = useState(false);
  const [settings, setSettings] = useState(false);

  // In the app whenever we're under /notes — with a note open (/notes/<path>)
  // or not (/notes). Only the first-run picker ("/") hides the sidebar.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inApp = pathname.startsWith("/notes");
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
      if (e.key === "Escape") {
        setCmd(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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
      run: () => navigate({ to: "/" }),
    },
    // Jump-to-note (backend search) lands in a later slice.
  ];

  return (
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
        {inApp && sidebar && (
          <Sidebar selected={splat} onSelect={openRelative} onNew={() => setCmd(true)} />
        )}
        <Outlet />
      </div>
      <RecoveryToast onViewSettings={() => setSettings(true)} />
      {cmd && <CommandPalette open items={paletteItems} onClose={() => setCmd(false)} />}
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
  );
}

function EmptyRoute() {
  const navigate = useNavigate();
  return <EmptyState onOpen={() => navigate({ to: "/notes" })} />;
}

function NoteRoute() {
  const { _splat: splat } = noteRoute.useParams();
  return <Editor path={splat ?? ""} />;
}

/** "/notes" with nothing selected — the notebook is open, pick a note. */
function NoNoteSelected() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--slate)",
        fontSize: 14,
      }}
    >
      Select a note from the sidebar.
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: EmptyRoute,
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
