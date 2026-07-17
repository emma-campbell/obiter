// @vitest-environment jsdom
// Settings modal against a mocked invoke layer: apply-on-change reaches
// update_settings, the theme control is gated by the darkMode flag, the
// folder picker goes through the native dialog plugin, and the API key
// field is write-only.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SettingsProvider } from "../settings/SettingsProvider";
import type { Settings as SettingsDoc } from "../settings/settings";
import { Settings } from "./Settings";

function testSettings(): SettingsDoc {
  return {
    version: 1,
    vault: {
      path: "/Users/emma/Notes",
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
  confirmAnswer?: boolean;
  pickedFolder?: string | null;
}

/**
 * Backend stand-in covering settings commands, the keychain commands, and
 * the dialog plugin. Returns the mutable store so tests can assert on
 * what was persisted.
 */
function mockBackend(
  stored: SettingsDoc,
  { confirmAnswer = true, pickedFolder }: BackendOptions = {},
) {
  const store = { settings: stored, keys: new Set<string>() };
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    switch (cmd) {
      case "get_settings":
        return store.settings;
      case "get_recovery_notice":
        return null;
      case "update_settings":
        store.settings = (args as { settings: SettingsDoc }).settings;
        return store.settings;
      case "set_api_key":
        store.keys.add((args as { provider: string }).provider);
        return null;
      case "has_api_key":
        return store.keys.has((args as { provider: string }).provider);
      case "delete_api_key":
        store.keys.delete((args as { provider: string }).provider);
        return null;
      // confirm() ships over the shared message command and compares the
      // returned button label to "Ok".
      case "plugin:dialog|message":
        return confirmAnswer ? "Ok" : "Cancel";
      case "plugin:dialog|open":
        return pickedFolder ?? null;
      default:
        throw new Error(`unexpected command: ${cmd}`);
    }
  });
  return { store, calls };
}

function renderSettings(props: { onClose?: () => void; onDisconnect?: () => void } = {}) {
  return render(
    <SettingsProvider>
      <Settings onClose={props.onClose ?? (() => {})} onDisconnect={props.onDisconnect} />
    </SettingsProvider>,
  );
}

async function settled() {
  // The modal renders nothing until the provider has loaded.
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  });
}

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("Settings modal", () => {
  it("applies a control change straight to the backend", async () => {
    const { store, calls } = mockBackend(testSettings());
    renderSettings();
    await settled();

    fireEvent.change(screen.getByLabelText("Delete behavior"), {
      target: { value: "permanent" },
    });

    await waitFor(() => {
      expect(store.settings.vault.delete).toBe("permanent");
    });
    expect(calls.some((c) => c.cmd === "update_settings")).toBe(true);
    // The control now reads the persisted value back from the provider.
    expect((screen.getByLabelText("Delete behavior") as HTMLSelectElement).value).toBe("permanent");
  });

  it("commits text inputs on Enter, not per keystroke", async () => {
    const { store, calls } = mockBackend(testSettings());
    renderSettings();
    await settled();

    const format = screen.getByLabelText("Daily note filename format");
    fireEvent.change(format, { target: { value: "YYYY-MM-DD-dddd" } });
    expect(calls.filter((c) => c.cmd === "update_settings")).toHaveLength(0);

    fireEvent.keyDown(format, { key: "Enter" });
    await waitFor(() => {
      expect(store.settings.vault.dailyNote.filenameFormat).toBe("YYYY-MM-DD-dddd");
    });
  });

  it("hides the theme control unless the darkMode flag is on", async () => {
    mockBackend(testSettings());
    renderSettings();
    await settled();

    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    expect(screen.queryByLabelText("Theme")).toBeNull();
  });

  it("shows a live theme control when the darkMode flag is on", async () => {
    const flagged = testSettings();
    flagged.flags["darkMode"] = true;
    const { store } = mockBackend(flagged);
    renderSettings();
    await settled();

    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    const theme = screen.getByLabelText("Theme");

    fireEvent.change(theme, { target: { value: "dark" } });
    await waitFor(() => {
      expect(store.settings.appearance.theme).toBe("dark");
    });
  });

  it("changes the folder through the native picker", async () => {
    const { store } = mockBackend(testSettings(), { pickedFolder: "/Users/emma/Writing" });
    renderSettings();
    await settled();

    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    await waitFor(() => {
      expect(store.settings.vault.path).toBe("/Users/emma/Writing");
    });
  });

  it("disconnect confirms, clears the path, and hands off navigation", async () => {
    const { store, calls } = mockBackend(testSettings(), { confirmAnswer: true });
    let disconnected = false;
    renderSettings({ onDisconnect: () => (disconnected = true) });
    await settled();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect folder" }));

    await waitFor(() => {
      expect(store.settings.vault.path).toBeNull();
    });
    expect(calls.some((c) => c.cmd === "plugin:dialog|message")).toBe(true);
    expect(disconnected).toBe(true);
  });

  it("disconnect declined leaves everything alone", async () => {
    const { store } = mockBackend(testSettings(), { confirmAnswer: false });
    let disconnected = false;
    renderSettings({ onDisconnect: () => (disconnected = true) });
    await settled();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect folder" }));

    // Confirm resolves async; give the handler a beat before asserting.
    await waitFor(() => {
      expect(store.settings.vault.path).toBe("/Users/emma/Notes");
    });
    expect(disconnected).toBe(false);
  });

  it("API key is write-only: saved on Enter, never re-displayed", async () => {
    const { store, calls } = mockBackend(testSettings());
    const { container } = renderSettings();
    await settled();

    fireEvent.click(screen.getByRole("tab", { name: "AI" }));
    const field = screen.getByLabelText("API key");
    fireEvent.change(field, { target: { value: "sk-ant-super-secret" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/Key set/)).toBeTruthy();
    });
    const setCall = calls.find((c) => c.cmd === "set_api_key");
    if (!setCall) throw new Error("set_api_key was never invoked");
    expect((setCall.args as { key: string }).key).toBe("sk-ant-super-secret");
    expect(store.keys.has("anthropic")).toBe(true);
    // The value is gone from the DOM entirely.
    expect(container.innerHTML).not.toContain("sk-ant-super-secret");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(screen.getByLabelText("API key")).toBeTruthy();
    });
    expect(store.keys.has("anthropic")).toBe(false);
  });

  it("model dropdown offers curated ids plus a custom escape", async () => {
    const { store } = mockBackend(testSettings());
    renderSettings();
    await settled();

    fireEvent.click(screen.getByRole("tab", { name: "AI" }));
    const model = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(model.value).toBe("claude-opus-4-8");

    // Curated pick persists directly.
    fireEvent.change(model, { target: { value: "claude-haiku-4-5" } });
    await waitFor(() => {
      expect(store.settings.ai.model).toBe("claude-haiku-4-5");
    });

    // "Other…" reveals a free-text input; committing persists the id.
    fireEvent.change(model, { target: { value: "__custom__" } });
    const custom = screen.getByLabelText("Custom model id");
    fireEvent.change(custom, { target: { value: "claude-fable-5" } });
    fireEvent.keyDown(custom, { key: "Enter" });
    await waitFor(() => {
      expect(store.settings.ai.model).toBe("claude-fable-5");
    });
  });
});
