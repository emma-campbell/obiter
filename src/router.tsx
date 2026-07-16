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
import { Folder, FileText, PanelLeft, Plus, Settings as SettingsIcon } from "lucide-react";
import { EmptyState } from "./app/EmptyState";
import { Settings } from "./app/Settings";
import { Sidebar } from "./app/Sidebar";
import { Titlebar } from "./app/Titlebar";
import { CommandPalette, type PaletteItem } from "./components/navigation/CommandPalette";
import { Editor } from "./notes/Editor";
import { DEFAULT_NOTE, FILES, findNote, NOTES_ROOT, toRelative } from "./notes/notes-data";

function RootLayout() {
  const navigate = useNavigate();
  const { _splat: splat } = useParams({ strict: false });
  const [sidebar, setSidebar] = useState(true);
  const [cmd, setCmd] = useState(false);
  const [settings, setSettings] = useState(false);

  const opened = splat !== undefined;
  const path = opened ? `${NOTES_ROOT}/${splat}` : "obiter";

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
      if (e.key === "Escape") {
        setCmd(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const openNote = (fullPath: string) =>
    navigate({ to: "/notes/$", params: { _splat: toRelative(fullPath) } });

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
    ...FILES.map(
      (f): PaletteItem => ({
        id: f.path,
        label: f.path,
        section: "Notes",
        icon: FileText,
        mono: true,
        hint: f.dir,
        run: () => openNote(f.path),
      }),
    ),
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
        {opened && sidebar && (
          <Sidebar
            selected={`${NOTES_ROOT}/${splat}`}
            onSelect={openNote}
            onNew={() => setCmd(true)}
          />
        )}
        <Outlet />
      </div>
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
  const file = findNote(splat ?? "") ?? DEFAULT_NOTE;
  return <Editor file={file} />;
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

// "/notes" alone means "the folder is open" — land on the default note.
const notesIndexRoute = createRoute({
  getParentRoute: () => notesRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/notes/$", params: { _splat: toRelative(DEFAULT_NOTE.path) } });
  },
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
