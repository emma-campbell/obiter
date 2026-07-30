// Binds the refresh module to React and to the window. This is the whole of
// refresh's contact with the browser: refresh.ts itself registers no
// listeners, so a filesystem watcher (#18) becomes a second trigger here
// without that module changing.

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { createRefresh, type Refresh } from "./refresh";

const RefreshContext = createContext<Refresh | null>(null);

export interface RefreshProviderProps {
  children: ReactNode;
  /** Supply an instance to drive refreshes directly (tests). */
  refresh?: Refresh;
}

export function RefreshProvider({ children, refresh: provided }: RefreshProviderProps) {
  // Never disposed on cleanup: StrictMode remounts effects while this
  // instance survives, and subscribers re-register on the way through.
  const refresh = useMemo(() => provided ?? createRefresh(), [provided]);

  useEffect(() => {
    const onFocus = () => void refresh.run("focus");
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return <RefreshContext.Provider value={refresh}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): Refresh {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within a RefreshProvider");
  return ctx;
}
