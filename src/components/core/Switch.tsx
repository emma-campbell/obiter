import { useId, type ReactNode } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import "./Switch.css";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** The visible label sitting beside the track. */
  children: ReactNode;
}

/**
 * Obiter Switch — a labelled toggle over Base UI's Switch (ADR 0001). Replaces
 * a bare <input type="checkbox">; the track/thumb look lives in Switch.css,
 * keyed off Base UI's [data-checked] state. The label is associated by id so
 * clicking the text toggles it.
 */
export function Switch({ checked, onCheckedChange, disabled = false, children }: SwitchProps) {
  const id = useId();
  return (
    <span className="switch-field">
      <BaseSwitch.Root
        id={id}
        className="switch"
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
      >
        <BaseSwitch.Thumb className="switch__thumb" />
      </BaseSwitch.Root>
      <label htmlFor={id} className="switch-field__label">
        {children}
      </label>
    </span>
  );
}
