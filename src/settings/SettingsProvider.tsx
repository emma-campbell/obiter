// React context over the settings backend. Loads once on mount so
// consumers don't each re-invoke the backend; `update` round-trips through
// the backend (validate + persist) before the context changes.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSettings, updateSettings } from "./client";
import type { Settings } from "./settings";

export interface SettingsContextValue {
  /** Null while the initial load is in flight. */
  settings: Settings | null;
  update: (next: Settings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((err: unknown) => {
        // No Rust backend (plain `pnpm dev` in a browser) lands here.
        console.error("obiter: failed to load settings", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (next: Settings) => {
    const saved = await updateSettings(next);
    setSettings(saved);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
