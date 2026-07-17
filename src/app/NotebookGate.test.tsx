// @vitest-environment jsdom
// The notebook gate decides first-run / app / missing from settings + a
// readability probe. The acceptance case: a missing folder renders the
// error surface, never the first-run picker (which would look like the
// user's choice was forgotten).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { Entry } from "../notebook/notebook";
import { SettingsProvider } from "../settings/SettingsProvider";
import type { Settings as SettingsDoc } from "../settings/settings";
import { NotebookGate, useNotebookStatus } from "./NotebookGate";

function settingsWith(path: string | null): SettingsDoc {
  return {
    version: 1,
    notebook: {
      path,
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

interface BackendOptions {
  path: string | null;
  listDir?: () => Entry[]; // throw to simulate an unreadable notebook
}

function mockBackend({ path, listDir }: BackendOptions) {
  let listCalls = 0;
  mockIPC((cmd) => {
    if (cmd === "get_settings") return settingsWith(path);
    if (cmd === "get_recovery_notice") return null;
    if (cmd === "list_dir") {
      listCalls += 1;
      if (!listDir) return [];
      return listDir();
    }
    if (cmd === "plugin:dialog|open") return null;
    throw new Error(`unexpected command: ${cmd}`);
  });
  return () => listCalls;
}

function StatusProbe() {
  return <span data-testid="status">{useNotebookStatus()}</span>;
}

function renderGate() {
  return render(
    <SettingsProvider>
      <NotebookGate>
        <StatusProbe />
      </NotebookGate>
    </SettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("NotebookGate", () => {
  it("shows the first-run picker when no folder is connected", async () => {
    mockBackend({ path: null });
    renderGate();

    await waitFor(() => {
      expect(screen.getByText("Pick a folder")).toBeTruthy();
    });
    expect(screen.queryByTestId("status")).toBeNull();
  });

  it("renders the app once a readable notebook is connected", async () => {
    mockBackend({
      path: "/Users/emma/Notes",
      listDir: () => [{ name: "n.md", path: "n.md", kind: "file" }],
    });
    renderGate();

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
  });

  it("reports an empty notebook so the app can say so", async () => {
    mockBackend({ path: "/Users/emma/Notes", listDir: () => [] });
    renderGate();

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("empty");
    });
  });

  it("shows the missing surface — not first-run — for a connected-but-unreadable folder", async () => {
    mockBackend({
      path: "/Volumes/usb/Notes",
      listDir: () => {
        throw { kind: "missing" };
      },
    });
    renderGate();

    await waitFor(() => {
      expect(screen.getByText("Can't find your notes folder")).toBeTruthy();
    });
    // The user's choice is named, and first-run is nowhere in sight.
    expect(screen.getByText("/Volumes/usb/Notes")).toBeTruthy();
    expect(screen.queryByText("Pick a folder")).toBeNull();
    expect(screen.queryByTestId("status")).toBeNull();
  });

  it("Retry re-probes and enters the app once the folder is back", async () => {
    let readable = false;
    mockBackend({
      path: "/Volumes/usb/Notes",
      listDir: () => {
        if (!readable) throw { kind: "missing" };
        return [{ name: "n.md", path: "n.md", kind: "file" }];
      },
    });
    renderGate();

    await waitFor(() => expect(screen.getByText("Can't find your notes folder")).toBeTruthy());

    readable = true; // drive remounted
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
  });
});
