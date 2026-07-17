// Startup recovery notice, surfaced where the user actually is: if the
// backend had to back up and reset a corrupt settings file, say so at
// launch — without requiring the settings modal to be open.

import { Toast } from "../components/core/Toast";
import { useSettings } from "../settings/SettingsProvider";

export function RecoveryToast({ onViewSettings }: { onViewSettings: () => void }) {
  const { recovery, dismissRecovery } = useSettings();
  if (!recovery) return null;

  const backupName = recovery.backupPath.split("/").pop() ?? recovery.backupPath;

  return (
    <Toast
      tone="danger"
      action={{ label: "View settings", onClick: onViewSettings }}
      onDismiss={dismissRecovery}
    >
      Your settings file couldn't be read, so Obiter reset it to defaults. The original is unchanged
      as{" "}
      <code title={recovery.backupPath} style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {backupName}
      </code>{" "}
      beside it.
    </Toast>
  );
}
