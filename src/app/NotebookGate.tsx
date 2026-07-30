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
//
// The probe is also refresh's precondition: it runs first on every refresh,
// so a folder that went away while the app was in the background surfaces
// here rather than being discovered when some later read happens to fail —
// and the tree and the open note don't each hang on an unmounted volume
// before finding out.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { listDir } from "../notebook/client";
import { useChooseFolder } from "../notebook/useChooseFolder";
import { useSettings } from "../settings/SettingsProvider";
import { EmptyState } from "./EmptyState";
import { NotebookMissing } from "./NotebookMissing";
import { useRefresh } from "./RefreshProvider";

/** `empty` and `ready` both mean the app is open; they differ only in whether
 *  the notebook has any entries at its root. */
export type NotebookStatus = "loading" | "missing" | "empty" | "ready";

const NotebookStatusContext = createContext<NotebookStatus>("loading");
export const useNotebookStatus = () => useContext(NotebookStatusContext);

export function NotebookGate({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const chooseFolder = useChooseFolder();
  const refresh = useRefresh();
  const path = settings?.notebook.path ?? null;
  const [status, setStatus] = useState<NotebookStatus>("loading");

  /** Resolves to whether the notebook is readable — refresh stops if not. */
  const probe = useCallback(async (): Promise<boolean> => {
    if (!path) return false;
    try {
      const entries = await listDir("");
      setStatus(entries.length > 0 ? "ready" : "empty");
      return true;
    } catch {
      // Any failure to read the root means the folder is gone/unreadable.
      // We never clear notebook.path here — the choice is preserved.
      setStatus("missing");
      return false;
    }
  }, [path]);

  useEffect(() => void probe(), [probe]);

  // Every refresh re-probes before anything else runs.
  useEffect(() => refresh.setPrecondition(probe), [refresh, probe]);

  if (!settings) return null;
  if (path === null) return <EmptyState onOpen={() => void chooseFolder()} />;
  if (status === "missing") {
    return <NotebookMissing path={path} onRetry={probe} onChoose={() => void chooseFolder()} />;
  }
  return <NotebookStatusContext.Provider value={status}>{children}</NotebookStatusContext.Provider>;
}
