// @vitest-environment jsdom
// The startup recovery toast: visible without opening settings, names the
// backup, dismisses on demand, and its action opens the settings modal.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SettingsProvider } from "../settings/SettingsProvider";
import type { RecoveryNotice, Settings as SettingsDoc } from "../settings/settings";
import { RecoveryToast } from "./RecoveryToast";

function testSettings(): SettingsDoc {
  return {
    version: 1,
    notebook: {
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

function mockBackend(recovery: RecoveryNotice | null) {
  mockIPC((cmd) => {
    if (cmd === "get_settings") return testSettings();
    if (cmd === "get_recovery_notice") return recovery;
    throw new Error(`unexpected command: ${cmd}`);
  });
}

const NOTICE: RecoveryNotice = {
  backupPath: "/Users/emma/Library/Application Support/obiter/settings.json.bak",
  error: "settings parse error: expected value at line 4 column 1",
};

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("RecoveryToast", () => {
  it("appears after a corrupt-file recovery, naming the backup", async () => {
    mockBackend(NOTICE);
    render(
      <SettingsProvider>
        <RecoveryToast onViewSettings={() => {}} />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });
    expect(screen.getByText("settings.json.bak")).toBeTruthy();
    // The full path is one hover away.
    expect(screen.getByTitle(NOTICE.backupPath)).toBeTruthy();
  });

  it("stays absent on a clean launch", async () => {
    mockBackend(null);
    render(
      <SettingsProvider>
        <RecoveryToast onViewSettings={() => {}} />
      </SettingsProvider>,
    );

    // Give the mount fetch time to resolve, then confirm nothing rendered.
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  it("dismisses on demand", async () => {
    mockBackend(NOTICE);
    render(
      <SettingsProvider>
        <RecoveryToast onViewSettings={() => {}} />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("its action opens settings", async () => {
    mockBackend(NOTICE);
    let opened = false;
    render(
      <SettingsProvider>
        <RecoveryToast onViewSettings={() => (opened = true)} />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "View settings" }));
    expect(opened).toBe(true);
  });
});
