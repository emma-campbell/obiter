import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../components/core/Button";
import { Icon } from "../components/core/Icon";
import { Input } from "../components/core/Input";

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

export interface SettingsProps {
  onClose: () => void;
  onDisconnect?: () => void;
}

/**
 * Settings. Note the dark-mode copy: the brand guide flags it unresolved, so
 * the control states why it's off rather than hiding.
 */
export function Settings({ onClose, onDisconnect }: SettingsProps) {
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600,
          maxHeight: "80%",
          overflow: "auto",
          background: "var(--paper)",
          border: "1px solid var(--ash)",
          borderRadius: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 22px",
            borderBottom: "1px solid var(--chalk)",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.015em" }}>Settings</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
            style={{ marginLeft: "auto", padding: "0 8px" }}
          >
            <Icon icon={X} size={16} />
          </Button>
        </div>
        <div style={{ padding: "6px 22px 20px" }}>
          <Row
            label="Notes folder"
            hint="The folder Obiter reads and writes. Everything else is derived from it."
          >
            <div style={{ display: "flex", gap: 8 }}>
              <Input mono defaultValue="/Users/you/Notes" />
              <Button size="md" style={{ flex: "0 0 auto" }}>
                Change
              </Button>
            </div>
          </Row>
          <Row label="Editor font" hint="Self-hosted. Obiter never fetches a font at launch.">
            <Input mono defaultValue="IBM Plex Mono — 14.5px" />
          </Row>
          <Row
            label="Appearance"
            hint="Dark mode is off. The neutrals invert cleanly but the accent needs a pass before it ships; a half-decided dark mode is worse than none."
          >
            <Button disabled>Dark mode — not yet</Button>
          </Row>
          <Row
            label="Delete folder link"
            hint="Obiter forgets this folder. The files stay exactly where they are on disk."
          >
            <span style={{ display: "inline-flex" }}>
              <button
                type="button"
                onClick={onDisconnect}
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
        </div>
      </div>
    </div>
  );
}
