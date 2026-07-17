// The connected notebook folder is gone or unreadable (renamed, unmounted,
// deleted). We never forget the user's choice — we say what happened and
// offer to retry (drive plugged back in) or pick another folder.

import { FolderX } from "lucide-react";
import { Button } from "../components/core/Button";
import { Icon } from "../components/core/Icon";

export interface NotebookMissingProps {
  path: string;
  onRetry: () => void;
  onChoose: () => void;
}

export function NotebookMissing({ path, onRetry, onChoose }: NotebookMissingProps) {
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
      <div style={{ maxWidth: 440, textAlign: "center", padding: "0 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Icon icon={FolderX} size={40} style={{ color: "var(--slate)" }} />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
          }}
        >
          Can't find your notes folder
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--graphite)", margin: "0 0 8px" }}>
          Obiter looked for it here but couldn't read it. If it's on a drive that isn't mounted,
          reconnect it and retry — your choice is remembered.
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--slate)",
            wordBreak: "break-all",
            margin: "0 0 24px",
          }}
        >
          {path}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Button variant="solid" onClick={onRetry}>
            Retry
          </Button>
          <Button onClick={onChoose}>Choose another folder</Button>
        </div>
      </div>
    </div>
  );
}
