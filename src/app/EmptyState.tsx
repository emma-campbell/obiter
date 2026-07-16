import { Folder } from "lucide-react";
import { Button } from "../components/core/Button";
import { Icon } from "../components/core/Icon";

/** The [...] mark — text elided from a quotation. Ink only, never the accent. */
function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ color: "var(--ink)" }}
      aria-hidden="true"
    >
      <path
        d="M 10 5 L 4 5 L 4 27 L 10 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
      <path
        d="M 22 5 L 28 5 L 28 27 L 22 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
      <rect x="8.5" y="14.5" width="3" height="3" fill="currentColor" />
      <rect x="14.5" y="14.5" width="3" height="3" fill="currentColor" />
      <rect x="20.5" y="14.5" width="3" height="3" fill="currentColor" />
    </svg>
  );
}

export interface EmptyStateProps {
  onOpen: () => void;
}

/**
 * First launch. No folder yet. The copy shows the folder rather than promising
 * privacy, and there is exactly one solid action.
 */
export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center", padding: "0 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <LogoMark />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
          }}
        >
          Pick a folder
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--graphite)", margin: "0 0 22px" }}>
          Obiter reads and writes plain markdown files in a folder you choose. Nothing leaves it.
          Pick one with notes already, or an empty one to start.
        </p>
        <Button variant="solid" startIcon={<Icon icon={Folder} size={16} />} onClick={onOpen}>
          Open folder
        </Button>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--slate)",
            marginTop: 22,
          }}
        >
          Works offline. There's nothing to be offline from.
        </p>
      </div>
    </div>
  );
}
