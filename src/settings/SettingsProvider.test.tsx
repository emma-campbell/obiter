// @vitest-environment jsdom
// SettingsProvider against a mocked invoke layer (Tauri's official mockIPC):
// loads on mount, and update() round-trips through the backend before the
// context changes. These are the repo's first frontend component tests.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SettingsProvider, useSettings } from "./SettingsProvider";
import type { Settings } from "./settings";

function testSettings(): Settings {
  return {
    version: 1,
    vault: {
      path: null,
      save: { mode: "auto", autosaveDebounceMs: 1000 },
      dailyNote: { filenameFormat: "YYYY-MM-DD", folder: "" },
      delete: "trash",
      files: { extensions: ["md"], showHidden: false },
    },
    appearance: { theme: "system", editorFontSize: 16 },
    ai: { enabled: false, provider: "anthropic", model: "claude-opus-4-8", baseUrl: null },
    flags: {},
  };
}

/** Backend stand-in: serves `stored`, replaces it on update, logs commands. */
function mockBackend(stored: Settings) {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  let current = stored;
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "get_settings") return current;
    if (cmd === "update_settings") {
      current = (args as { settings: Settings }).settings;
      return current;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return calls;
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

  it("useSettings outside a provider throws", () => {
    function Naked() {
      useSettings();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(/within a SettingsProvider/);
  });
});
