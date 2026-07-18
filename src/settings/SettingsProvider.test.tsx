// @vitest-environment jsdom
// SettingsProvider against a mocked invoke layer (Tauri's official mockIPC):
// loads on mount, and update() round-trips through the backend before the
// context changes. These are the repo's first frontend component tests.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SettingsProvider, useSettings } from "./SettingsProvider";
import type { RecoveryNotice, Settings } from "./settings";

function testSettings(): Settings {
  return {
    version: 1,
    notebook: {
      path: null,
      dailyNote: { filenameFormat: "YYYY-MM-DD", folder: "" },
      delete: "trash",
      files: { extensions: ["md"], showHidden: false },
    },
    appearance: { theme: "system", editorFontSize: 16 },
    ai: { enabled: false, provider: "anthropic", model: "claude-opus-4-8", baseUrl: null },
    flags: {},
  };
}

interface MockBackendOptions {
  recovery?: RecoveryNotice | null;
  /** What `reload_settings` yields; throw to simulate a parse failure. */
  onReload?: () => Settings;
}

/** Backend stand-in: serves `stored`, replaces it on update, logs commands. */
function mockBackend(stored: Settings, { recovery = null, onReload }: MockBackendOptions = {}) {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  let current = stored;
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "get_settings") return current;
    if (cmd === "get_recovery_notice") return recovery;
    if (cmd === "reload_settings") {
      current = onReload ? onReload() : current;
      return current;
    }
    if (cmd === "update_settings") {
      current = (args as { settings: Settings }).settings;
      return current;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return calls;
}

function ReloadProbe() {
  const { settings, reload, reloadError } = useSettings();
  if (!settings) return <span data-testid="state">loading</span>;
  return (
    <div>
      <span data-testid="theme">{settings.appearance.theme}</span>
      <span data-testid="reload-error">{reloadError ?? "none"}</span>
      <button type="button" onClick={() => void reload()}>
        reload
      </button>
    </div>
  );
}

function ThemeProbe() {
  const { settings, update } = useSettings();
  if (!settings) return <span data-testid="state">loading</span>;
  return (
    <div>
      <span data-testid="theme">{settings.appearance.theme}</span>
      <button
        type="button"
        onClick={() =>
          void update({ ...settings, appearance: { ...settings.appearance, theme: "dark" } })
        }
      >
        go dark
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("SettingsProvider", () => {
  it("loads settings from the backend on mount", async () => {
    const stored = testSettings();
    stored.appearance.theme = "light";
    const calls = mockBackend(stored);

    render(
      <SettingsProvider>
        <ThemeProbe />
      </SettingsProvider>,
    );

    expect(screen.getByTestId("state").textContent).toBe("loading");
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("light");
    });
    expect(calls.filter((c) => c.cmd === "get_settings")).toHaveLength(1);
  });

  it("update() round-trips through the backend and updates the context", async () => {
    const calls = mockBackend(testSettings());

    render(
      <SettingsProvider>
        <ThemeProbe />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("system");
    });

    fireEvent.click(screen.getByRole("button", { name: "go dark" }));

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });
    const update = calls.find((c) => c.cmd === "update_settings");
    if (!update) throw new Error("update_settings was never invoked");
    expect((update.args as { settings: Settings }).settings.appearance.theme).toBe("dark");
  });

  it("reload() applies hand-edited values from disk", async () => {
    const edited = testSettings();
    edited.appearance.theme = "dark";
    mockBackend(testSettings(), { onReload: () => edited });

    render(
      <SettingsProvider>
        <ReloadProbe />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("system");
    });

    fireEvent.click(screen.getByRole("button", { name: "reload" }));

    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });
    expect(screen.getByTestId("reload-error").textContent).toBe("none");
  });

  it("a failed reload keeps current settings and surfaces the error", async () => {
    mockBackend(testSettings(), {
      onReload: () => {
        throw "settings parse error: unknown variant `blurple`";
      },
    });

    render(
      <SettingsProvider>
        <ReloadProbe />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("system");
    });

    fireEvent.click(screen.getByRole("button", { name: "reload" }));

    await waitFor(() => {
      expect(screen.getByTestId("reload-error").textContent).toContain("blurple");
    });
    // In-memory settings untouched.
    expect(screen.getByTestId("theme").textContent).toBe("system");
  });

  it("a successful reload clears a previous reload error", async () => {
    let fail = true;
    const edited = testSettings();
    edited.appearance.theme = "light";
    mockBackend(testSettings(), {
      onReload: () => {
        if (fail) throw "settings parse error: trailing comma";
        return edited;
      },
    });

    render(
      <SettingsProvider>
        <ReloadProbe />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("system");
    });

    fireEvent.click(screen.getByRole("button", { name: "reload" }));
    await waitFor(() => {
      expect(screen.getByTestId("reload-error").textContent).toContain("trailing comma");
    });

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "reload" }));
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("light");
    });
    expect(screen.getByTestId("reload-error").textContent).toBe("none");
  });

  it("surfaces the startup recovery notice and can dismiss it", async () => {
    mockBackend(testSettings(), {
      recovery: {
        backupPath: "/config/obiter/settings.json.bak",
        error: "settings parse error: expected value at line 3",
      },
    });

    function RecoveryProbe() {
      const { recovery, dismissRecovery } = useSettings();
      if (!recovery) return <span data-testid="recovery">none</span>;
      return (
        <div>
          <span data-testid="recovery">{recovery.backupPath}</span>
          <button type="button" onClick={dismissRecovery}>
            dismiss
          </button>
        </div>
      );
    }

    render(
      <SettingsProvider>
        <RecoveryProbe />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("recovery").textContent).toBe("/config/obiter/settings.json.bak");
    });

    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.getByTestId("recovery").textContent).toBe("none");
  });

  it("reports no recovery notice on a clean startup", async () => {
    mockBackend(testSettings());

    function RecoveryProbe() {
      const { settings, recovery } = useSettings();
      if (!settings) return <span data-testid="recovery">loading</span>;
      return <span data-testid="recovery">{recovery ? "notice" : "none"}</span>;
    }

    render(
      <SettingsProvider>
        <RecoveryProbe />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("recovery").textContent).toBe("none");
    });
  });

  it("useSettings outside a provider throws", () => {
    function Naked() {
      useSettings();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(/within a SettingsProvider/);
  });
});
