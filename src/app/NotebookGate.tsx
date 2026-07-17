// The notebook connection gate. The connected-ness of a notebook is app
// state (from settings + a readability probe), not something the URL can
// express, so it's decided here, above the routed content:
//
//   - no folder chosen        → first-run picker
//   - chosen but unreadable   → missing-notebook error surface
//   - chosen and readable     → the app (children)
//
// The probe (a single list_dir of the root) also tells the app whether the
// notebook is empty, exposed via context so the no-note pane can say so.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { listDir } from "../notebook/client";
import { useChooseFolder } from "../notebook/useChooseFolder";
import { useSettings } from "../settings/SettingsProvider";
import { EmptyState } from "./EmptyState";
import { NotebookMissing } from "./NotebookMissing";

/** `empty` and `ready` both mean the app is open; they differ only in whether
 *  the notebook has any entries at its root. */
export type NotebookStatus = "loading" | "missing" | "empty" | "ready";

const NotebookStatusContext = createContext<NotebookStatus>("loading");
export const useNotebookStatus = () => useContext(NotebookStatusContext);

export function NotebookGate({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const chooseFolder = useChooseFolder();
  const path = settings?.notebook.path ?? null;
  const [status, setStatus] = useState<NotebookStatus>("loading");

  const probe = useCallback(() => {
    if (!path) return;
    setStatus("loading");
    listDir("")
      .then((entries) => setStatus(entries.length > 0 ? "ready" : "empty"))
      // Any failure to read the root means the folder is gone/unreadable.
      // We never clear notebook.path here — the choice is preserved.
      .catch(() => setStatus("missing"));
  }, [path]);

  useEffect(() => probe(), [probe]);

  if (!settings) return null;
  if (path === null) return <EmptyState onOpen={() => void chooseFolder()} />;
  if (status === "missing") {
    return <NotebookMissing path={path} onRetry={probe} onChoose={() => void chooseFolder()} />;
  }
  return <NotebookStatusContext.Provider value={status}>{children}</NotebookStatusContext.Provider>;
}
