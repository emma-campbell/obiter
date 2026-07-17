import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface ToastProps {
  /** Danger borders the toast in red; spend it on data loss only. */
  tone?: "info" | "danger";
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Obiter Toast. A floating hairline bar pinned bottom-center — no
 * elevation, per the form tokens: floating surfaces get a border, not a
 * shadow. Toasts never dismiss themselves; anything worth interrupting
 * the user for is worth staying until acknowledged.
 */
export function Toast({ tone = "info", action, onDismiss, children }: ToastProps) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: 560,
        padding: "10px 10px 10px 16px",
        background: "var(--paper)",
        border: `1px solid ${tone === "danger" ? "var(--danger)" : "var(--ash)"}`,
        borderRadius: "var(--radius-lg)",
        fontSize: 14,
        lineHeight: 1.45,
        color: "var(--ink)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {action && (
        <Button size="sm" onClick={action.onClick} style={{ flex: "0 0 auto" }}>
          {action.label}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Dismiss"
        onClick={onDismiss}
        style={{ flex: "0 0 auto", padding: "0 6px" }}
      >
        <Icon icon={X} size={14} />
      </Button>
    </div>
  );
}
