import type { ReactElement, ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import "./Tooltip.css";

/**
 * Obiter Tooltip over Base UI's Tooltip (ADR 0001). Surfaces an icon-only
 * button's label on hover and keyboard focus, so the meaning of a glyph is one
 * hover away without cluttering the chrome with text.
 */

/** Shared hover-delay grouping — mount once near the app root. */
export const TooltipProvider = BaseTooltip.Provider;

/** The portalled popup half. Shared by the standalone wrapper and by triggers
 *  that are composed with another behaviour (e.g. a Toolbar.Button). */
export function TooltipContent({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={6} className="tooltip-positioner">
        <BaseTooltip.Popup className="tooltip">{children}</BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

// Re-exported so a trigger can be composed with another primitive's `render`
// (the toolbar buttons are both a Toolbar.Button and a TooltipTrigger).
export const TooltipRoot = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;

/** Wrap a single element so its `label` shows on hover/focus. */
export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipRoot>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </TooltipRoot>
  );
}
