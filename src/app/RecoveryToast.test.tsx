// @vitest-environment jsdom
// The startup recovery toast: visible without opening settings, names the
// backup, dismisses on demand, and its action opens the settings modal. Now
// backed by Base UI's Toast manager (ADR 0001), so it renders through a
// ToastProvider + ToastViewport; the assertions key on the visible text and
// button labels, which are stable across the Base UI internals.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ToastProvider, ToastViewport } from "../components/core/Toast";
import { SettingsProvider } from "../settings/SettingsProvider";
import type { RecoveryNotice, Settings as SettingsDoc } from "../settings/settings";
import { RecoveryToast } from "./RecoveryToast";

function testSettings(): SettingsDoc {
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

function renderToast(onViewSettings: () => void = () => {}) {
  return render(
    <SettingsProvider>
      <ToastProvider>
        <RecoveryToast onViewSettings={onViewSettings} />
        <ToastViewport />
      </ToastProvider>
    </SettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  clearMocks();
});

// Base UI renders each toast twice — the visible one plus a hidden
// screen-reader announcement clone — and marks the visible toast (and its
// buttons) aria-hidden until focused. So text assertions use getAllBy* and
// button queries pass hidden: true.
describe("RecoveryToast", () => {
  it("appears after a corrupt-file recovery, naming the backup", async () => {
    mockBackend(NOTICE);
    renderToast();

    await waitFor(() => {
      expect(screen.getAllByText("settings.json.bak").length).toBeGreaterThan(0);
    });
    // The full path is one hover away.
    expect(screen.getAllByTitle(NOTICE.backupPath).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "View settings", hidden: true })).toBeTruthy();
  });

  it("stays absent on a clean launch", async () => {
    mockBackend(null);
    renderToast();

    // Give the mount fetch time to resolve, then confirm nothing rendered.
    await waitFor(() => {
      expect(screen.queryByText("settings.json.bak")).toBeNull();
    });
  });

  it("dismisses on demand", async () => {
    mockBackend(NOTICE);
    renderToast();
    await waitFor(() => {
      expect(screen.getAllByText("settings.json.bak").length).toBeGreaterThan(0);
    });

    // Icon-only close button — query by class (it's portaled to document.body).
    const close = document.querySelector<HTMLButtonElement>("button.toast__close");
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    await waitFor(() => {
      expect(screen.queryByText("settings.json.bak")).toBeNull();
    });
  });

  it("its action opens settings", async () => {
    mockBackend(NOTICE);
    let opened = false;
    renderToast(() => (opened = true));
    await waitFor(() => {
      expect(screen.getAllByText("settings.json.bak").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "View settings", hidden: true }));
    expect(opened).toBe(true);
  });
});
