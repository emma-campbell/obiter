// Settings modal — three tabs (Notebook / Appearance / AI) over the
// SettingsProvider. Every control applies on change: selects and toggles
// immediately, text inputs on blur/Enter. There is no Save button — the
// backend persists each change atomically, so the file always matches the
// screen. Destructive actions (disconnect folder, remove API key) confirm
// through the native dialog first.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { RotateCw, X } from "lucide-react";
import { Button } from "../components/core/Button";
import { Icon } from "../components/core/Icon";
import { Input } from "../components/core/Input";
import { useSettings } from "../settings/SettingsProvider";
import { deleteApiKey, hasApiKey, setApiKey } from "../settings/secrets";
import type { AiProvider, Settings as SettingsDoc } from "../settings/settings";

/** Curated model ids per provider; the dropdown adds an "Other…" escape. */
export const CURATED_MODELS: Record<AiProvider, string[]> = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
};

const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic",
};

type Tab = "notebook" | "appearance" | "ai";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "notebook", label: "Notebook" },
  { id: "appearance", label: "Appearance" },
  { id: "ai", label: "AI" },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
        padding: "16px 0",
        borderBottom: "1px solid var(--chalk)",
      }}
    >
      <div style={{ width: 180, flex: "0 0 auto" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 2, lineHeight: 1.45 }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

const selectStyle: CSSProperties = {
  height: "var(--control)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  color: "var(--text-body)",
  background: "var(--bg)",
  border: "1px solid var(--border-color)",
  borderRadius: "var(--radius)",
  padding: "0 var(--u-2)",
};

/**
 * Text input that applies on blur/Enter rather than per keystroke, so a
 * half-typed value never hits the settings file.
 */
function CommitInput({
  value,
  onCommit,
  mono = false,
  ...rest
}: {
  value: string;
  onCommit: (next: string) => void;
  mono?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  style?: CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  // Re-sync when the backend value changes underneath us (reload, etc).
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <Input
      mono={mono}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      {...rest}
    />
  );
}

function ApiKeyField({ provider }: { provider: AiProvider }) {
  const [hasKey, setHasKey] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    setHasKey(false);
    void hasApiKey(provider).then((has) => {
      if (!cancelled) setHasKey(has);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const save = async () => {
    const key = draft.trim();
    if (!key) return;
    await setApiKey(provider, key);
    setDraft(""); // write-only: the value never lingers in the DOM
    setHasKey(true);
  };

  const remove = async () => {
    if (!(await confirm("Remove the stored API key? Obiter will forget it immediately."))) return;
    await deleteApiKey(provider);
    setHasKey(false);
  };

  if (hasKey) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: "var(--graphite)" }}>
          Key set — stored in the system keychain
        </span>
        <Button size="sm" onClick={() => void remove()}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <Input
      type="password"
      mono
      placeholder="Paste key, press Enter"
      aria-label="API key"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void save();
      }}
    />
  );
}

export interface SettingsProps {
  onClose: () => void;
  onDisconnect?: () => void;
}

export function Settings({ onClose, onDisconnect }: SettingsProps) {
  const { settings, update, reload, reloadError, clearReloadError } = useSettings();
  const [tab, setTab] = useState<Tab>("notebook");
  // "Other…" chosen in the model dropdown; a stored model outside the
  // curated list also renders as custom.
  const [customModel, setCustomModel] = useState(false);

  if (!settings) return null;

  // Every control funnels through here: build the next document, hand it
  // to the backend, let the context re-render with what was persisted.
  const patch = (make: (s: SettingsDoc) => SettingsDoc) => {
    void update(make(settings));
  };

  const disconnect = async () => {
    const ok = await confirm(
      "Disconnect this folder? Obiter forgets the folder; the files stay exactly where they are on disk.",
    );
    if (!ok) return;
    patch((s) => ({ ...s, notebook: { ...s.notebook, path: null } }));
    onDisconnect?.();
  };

  const changeFolder = async () => {
    const picked = await open({ directory: true, multiple: false, title: "Choose notes folder" });
    if (typeof picked === "string") {
      patch((s) => ({ ...s, notebook: { ...s.notebook, path: picked } }));
    }
  };

  const modelIsCurated = CURATED_MODELS[settings.ai.provider].includes(settings.ai.model);
  const showCustomModel = customModel || !modelIsCurated;

  const darkModeEnabled = settings.flags["darkMode"] ?? false;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(28,27,24,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620,
          maxHeight: "80%",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper)",
          border: "1px solid var(--ash)",
          borderRadius: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 22px 0",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.015em" }}>Settings</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            aria-label="Reload settings from file"
            title="Reload settings from file"
            style={{ marginLeft: "auto", padding: "0 8px" }}
          >
            <Icon icon={RotateCw} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
            style={{ padding: "0 8px" }}
          >
            <Icon icon={X} size={16} />
          </Button>
        </div>

        <div
          role="tablist"
          aria-label="Settings sections"
          style={{
            display: "flex",
            gap: 4,
            padding: "10px 22px 0",
            borderBottom: "1px solid var(--chalk)",
          }}
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: active ? "var(--ink)" : "var(--graphite)",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {reloadError && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              margin: "12px 22px 0",
              padding: "8px 8px 8px 12px",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              lineHeight: 1.45,
              color: "var(--danger)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              Reload failed — your current settings are still in effect.{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>{reloadError}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Dismiss reload error"
              onClick={clearReloadError}
              style={{ flex: "0 0 auto", padding: "0 6px", color: "var(--danger)" }}
            >
              <Icon icon={X} size={14} />
            </Button>
          </div>
        )}

        <div style={{ padding: "6px 22px 20px", overflow: "auto" }}>
          {tab === "notebook" && (
            <>
              <Row
                label="Notes folder"
                hint="The folder Obiter reads and writes. Everything else is derived from it."
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Input
                    mono
                    readOnly
                    value={settings.notebook.path ?? ""}
                    placeholder="No folder connected"
                    aria-label="Notes folder path"
                  />
                  <Button
                    size="md"
                    style={{ flex: "0 0 auto" }}
                    onClick={() => void changeFolder()}
                  >
                    Change
                  </Button>
                </div>
              </Row>
              <Row label="Saving" hint="Autosave writes after you pause; manual is ⌘S.">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <select
                    style={selectStyle}
                    aria-label="Save mode"
                    value={settings.notebook.save.mode}
                    onChange={(e) =>
                      patch((s) => ({
                        ...s,
                        notebook: {
                          ...s.notebook,
                          save: { ...s.notebook.save, mode: e.target.value as "manual" | "auto" },
                        },
                      }))
                    }
                  >
                    <option value="auto">Autosave</option>
                    <option value="manual">Manual (⌘S)</option>
                  </select>
                  {settings.notebook.save.mode === "auto" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <CommitInput
                        aria-label="Autosave debounce in milliseconds"
                        style={{ width: 90 }}
                        value={String(settings.notebook.save.autosaveDebounceMs)}
                        onCommit={(raw) => {
                          const ms = Number.parseInt(raw, 10);
                          if (!Number.isFinite(ms) || ms < 0) return;
                          patch((s) => ({
                            ...s,
                            notebook: {
                              ...s.notebook,
                              save: { ...s.notebook.save, autosaveDebounceMs: ms },
                            },
                          }));
                        }}
                      />
                      <span style={{ fontSize: 13, color: "var(--slate)" }}>ms debounce</span>
                    </div>
                  )}
                </div>
              </Row>
              <Row
                label="Daily notes"
                hint="Filename format, and the folder (relative to the notebook) they land in."
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <CommitInput
                    mono
                    aria-label="Daily note filename format"
                    value={settings.notebook.dailyNote.filenameFormat}
                    onCommit={(filenameFormat) =>
                      patch((s) => ({
                        ...s,
                        notebook: {
                          ...s.notebook,
                          dailyNote: { ...s.notebook.dailyNote, filenameFormat },
                        },
                      }))
                    }
                  />
                  <CommitInput
                    mono
                    aria-label="Daily note folder"
                    placeholder="notebook root"
                    value={settings.notebook.dailyNote.folder}
                    onCommit={(folder) =>
                      patch((s) => ({
                        ...s,
                        notebook: { ...s.notebook, dailyNote: { ...s.notebook.dailyNote, folder } },
                      }))
                    }
                  />
                </div>
              </Row>
              <Row
                label="Deleting notes"
                hint="Trash is recoverable. Permanent deletion is exactly that."
              >
                <select
                  style={selectStyle}
                  aria-label="Delete behavior"
                  value={settings.notebook.delete}
                  onChange={(e) =>
                    patch((s) => ({
                      ...s,
                      notebook: { ...s.notebook, delete: e.target.value as "trash" | "permanent" },
                    }))
                  }
                >
                  <option value="trash">Move to system trash</option>
                  <option value="permanent">Delete permanently</option>
                </select>
              </Row>
              <Row
                label="Visible files"
                hint="Extensions the note tree shows, and whether dotfiles appear."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <CommitInput
                    mono
                    aria-label="Shown file extensions"
                    value={settings.notebook.files.extensions.join(", ")}
                    onCommit={(raw) => {
                      const extensions = raw
                        .split(",")
                        .map((ext) => ext.trim().replace(/^\./, ""))
                        .filter(Boolean);
                      patch((s) => ({
                        ...s,
                        notebook: { ...s.notebook, files: { ...s.notebook.files, extensions } },
                      }));
                    }}
                  />
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      fontSize: 14,
                      color: "var(--graphite)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings.notebook.files.showHidden}
                      onChange={(e) =>
                        patch((s) => ({
                          ...s,
                          notebook: {
                            ...s.notebook,
                            files: { ...s.notebook.files, showHidden: e.target.checked },
                          },
                        }))
                      }
                    />
                    Show hidden files
                  </label>
                </div>
              </Row>
              <Row
                label="Disconnect folder"
                hint="Obiter forgets this folder. The files stay exactly where they are on disk."
              >
                <span style={{ display: "inline-flex" }}>
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    style={{
                      height: 32,
                      padding: "0 12px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      fontSize: 15,
                      color: "var(--danger)",
                      background: "transparent",
                      border: "1px solid var(--danger)",
                      borderRadius: 2,
                      cursor: "pointer",
                    }}
                  >
                    Disconnect folder
                  </button>
                </span>
              </Row>
            </>
          )}

          {tab === "appearance" && (
            <>
              {darkModeEnabled && (
                <Row
                  label="Theme"
                  hint="System follows your OS. Enabled by the darkMode flag in settings.json."
                >
                  <select
                    style={selectStyle}
                    aria-label="Theme"
                    value={settings.appearance.theme}
                    onChange={(e) =>
                      patch((s) => ({
                        ...s,
                        appearance: {
                          ...s.appearance,
                          theme: e.target.value as "light" | "dark" | "system",
                        },
                      }))
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </Row>
              )}
              <Row label="Editor font size" hint="The prose size in the editor, in pixels.">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <CommitInput
                    aria-label="Editor font size in pixels"
                    style={{ width: 90 }}
                    value={String(settings.appearance.editorFontSize)}
                    onCommit={(raw) => {
                      const px = Number.parseFloat(raw);
                      if (!Number.isFinite(px) || px < 8 || px > 40) return;
                      patch((s) => ({
                        ...s,
                        appearance: { ...s.appearance, editorFontSize: px },
                      }));
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--slate)" }}>px</span>
                </div>
              </Row>
              <Row
                label="Fonts"
                hint="Self-hosted and fixed: sans is the app talking, mono is your text."
              >
                <Input mono readOnly value="Public Sans · IBM Plex Mono" aria-label="Fonts" />
              </Row>
            </>
          )}

          {tab === "ai" && (
            <>
              <Row
                label="AI features"
                hint="Off means off — a plain notes app that talks to nothing."
              >
                <label
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 14,
                    color: "var(--graphite)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settings.ai.enabled}
                    onChange={(e) =>
                      patch((s) => ({ ...s, ai: { ...s.ai, enabled: e.target.checked } }))
                    }
                  />
                  Enable AI features
                </label>
              </Row>
              <Row label="Provider">
                <select
                  style={selectStyle}
                  aria-label="AI provider"
                  value={settings.ai.provider}
                  onChange={(e) =>
                    patch((s) => ({
                      ...s,
                      ai: { ...s.ai, provider: e.target.value as AiProvider },
                    }))
                  }
                >
                  {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Model">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <select
                    style={selectStyle}
                    aria-label="Model"
                    value={showCustomModel ? "__custom__" : settings.ai.model}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setCustomModel(true);
                        return;
                      }
                      setCustomModel(false);
                      const model = e.target.value;
                      patch((s) => ({ ...s, ai: { ...s.ai, model } }));
                    }}
                  >
                    {CURATED_MODELS[settings.ai.provider].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom__">Other…</option>
                  </select>
                  {showCustomModel && (
                    <CommitInput
                      mono
                      aria-label="Custom model id"
                      placeholder="model id"
                      value={modelIsCurated ? "" : settings.ai.model}
                      onCommit={(model) => {
                        if (!model.trim()) return;
                        patch((s) => ({ ...s, ai: { ...s.ai, model: model.trim() } }));
                      }}
                    />
                  )}
                </div>
              </Row>
              <Row
                label="Base URL"
                hint="Optional override for a proxy or compatible local endpoint."
              >
                <CommitInput
                  mono
                  aria-label="Base URL"
                  placeholder="provider default"
                  value={settings.ai.baseUrl ?? ""}
                  onCommit={(raw) =>
                    patch((s) => ({ ...s, ai: { ...s.ai, baseUrl: raw.trim() || null } }))
                  }
                />
              </Row>
              <Row
                label="API key"
                hint="Stored in the OS keychain, never in the settings file. Obiter can only tell that a key exists."
              >
                <ApiKeyField provider={settings.ai.provider} />
              </Row>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
