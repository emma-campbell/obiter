// Startup recovery notice, surfaced where the user actually is: if the
// backend had to back up and reset a corrupt settings file, say so at
// launch — without requiring the settings modal to be open.
//
// Renders nothing itself; it pushes one persistent, high-priority toast into
// the Base UI manager when a recovery notice appears (ADR 0001). The toast
// stays until the user acts (timeout: 0), and closing it — via Dismiss or the
// action — clears the notice so it doesn't return on the next render.

import { useEffect, useRef } from "react";
import { useToast } from "../components/core/Toast";
import { useSettings } from "../settings/SettingsProvider";

const RECOVERY_TOAST_ID = "settings-recovery";

export function RecoveryToast({ onViewSettings }: { onViewSettings: () => void }) {
  const { recovery, dismissRecovery } = useSettings();
  const toast = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (!recovery || shown.current) return;
    shown.current = true;

    const backupName = recovery.backupPath.split("/").pop() ?? recovery.backupPath;
    toast.add({
      id: RECOVERY_TOAST_ID,
      timeout: 0,
      priority: "high",
      data: { tone: "danger", actionLabel: "View settings", onAction: onViewSettings },
      description: (
        <>
          Your settings file couldn't be read, so Obiter reset it to defaults. The original is
          unchanged as{" "}
          <code className="toast__code" title={recovery.backupPath}>
            {backupName}
          </code>{" "}
          beside it.
        </>
      ),
      onClose: () => {
        shown.current = false;
        dismissRecovery();
      },
    });
  }, [recovery, toast, onViewSettings, dismissRecovery]);

  return null;
}
