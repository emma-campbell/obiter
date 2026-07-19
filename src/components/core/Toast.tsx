// Obiter Toast — the first Base UI adoption (ADR 0001). A floating hairline
// bar pinned bottom-center; floating surfaces get a border, not a shadow.
//
// Base UI's Toast is a manager/queue: a Provider holds the toasts, a Viewport
// renders them, and callers add imperatively via useToast(). This gives the
// live-region announcement, timeout, keyboard dismissal, and focus management
// we used to lack — the old component was a hand-rolled role="status" div.
// Persistent notices (Obiter never auto-dismisses anything worth interrupting
// for) pass timeout: 0 when they add.

import { Toast as BaseToast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import { Icon } from "./Icon";
import "./Toast.css";

export type ToastTone = "info" | "danger";

/** Custom fields we hang on each toast to drive our rendering. */
export interface ToastData {
  /** Danger borders the toast in red; spend it on data loss only. */
  tone?: ToastTone;
  /** An optional action button (e.g. "View settings"). */
  actionLabel?: string;
  onAction?: () => void;
}

/** The manager, typed with our custom data. Call add()/close()/update(). */
export function useToast() {
  return BaseToast.useToastManager<ToastData>();
}

/** Wrap the app once so any descendant can useToast(). */
export const ToastProvider = BaseToast.Provider;

/** Renders the live toast stack. Mount once, inside ToastProvider. */
export function ToastViewport() {
  return (
    <BaseToast.Portal>
      <BaseToast.Viewport className="toast-viewport">
        <ToastList />
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
}

function ToastList() {
  const { toasts } = useToast();
  return toasts.map((toast) => (
    <BaseToast.Root
      key={toast.id}
      toast={toast}
      className="toast"
      data-tone={toast.data?.tone ?? "info"}
    >
      <BaseToast.Content className="toast__content">
        <BaseToast.Description className="toast__desc" />
      </BaseToast.Content>
      {toast.data?.actionLabel && (
        <BaseToast.Action className="toast__action" onClick={toast.data.onAction}>
          {toast.data.actionLabel}
        </BaseToast.Action>
      )}
      <BaseToast.Close className="toast__close" aria-label="Dismiss">
        <Icon icon={X} size={14} />
      </BaseToast.Close>
    </BaseToast.Root>
  ));
}
