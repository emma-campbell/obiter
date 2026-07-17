// React context over the settings backend. Loads once on mount so
// consumers don't each re-invoke the backend; `update` round-trips through
// the backend (validate + persist) before the context changes.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getRecoveryNotice, getSettings, reloadSettings, updateSettings } from "./client";
import type { RecoveryNotice, Settings } from "./settings";

export interface SettingsContextValue {
  /** Null while the initial load is in flight. */
  settings: Settings | null;
  update: (next: Settings) => Promise<void>;
  /**
   * Re-reads the settings file to pick up hand-edits made while the app
   * runs. On failure the current settings stay in effect and the parse
   * error lands in `reloadError`.
   */
  reload: () => Promise<void>;
  /** Parse error from the last reload attempt; null once one succeeds. */
  reloadError: string | null;
  /** Clears the reload error (UI acknowledged it). */
  clearReloadError: () => void;
  /** Set when the backend reset a corrupt settings file at startup. */
  recovery: RecoveryNotice | null;
  /** Clears the recovery notice for this session (UI acknowledged it). */
  dismissRecovery: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recovery, setRecovery] = useState<RecoveryNotice | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSettings(), getRecoveryNotice()])
      .then(([loaded, notice]) => {
        if (cancelled) return;
        setSettings(loaded);
        setRecovery(notice);
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

  const reload = useCallback(async () => {
    try {
      const loaded = await reloadSettings();
      setSettings(loaded);
      setReloadError(null);
    } catch (err: unknown) {
      // The command returns Result<_, String>, so a failed invoke rejects
      // with the backend's error string. Current settings stay in effect.
      setReloadError(typeof err === "string" ? err : String(err));
    }
  }, []);

  const dismissRecovery = useCallback(() => setRecovery(null), []);
  const clearReloadError = useCallback(() => setReloadError(null), []);

  return (
    <SettingsContext.Provider
      value={{ settings, update, reload, reloadError, clearReloadError, recovery, dismissRecovery }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
