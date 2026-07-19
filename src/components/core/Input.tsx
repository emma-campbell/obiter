import type { InputHTMLAttributes } from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import "./Input.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  /** set for paths, keys, and machine text */
  mono?: boolean;
  invalid?: boolean;
}

/**
 * Obiter text Input. One hairline, no fill. Focus is a 2px Pencil ring — a
 * keyboard-first tool that hides focus is lying about being keyboard-first.
 * Runs on Base UI's Input (ADR 0001); focus/hover/invalid are CSS states now
 * (the look lives in Input.css) rather than tracked in React.
 */
export function Input({
  size = "md",
  mono = false,
  invalid = false,
  className,
  ...rest
}: InputProps) {
  return (
    <BaseInput
      className={className ? `input ${className}` : "input"}
      data-size={size}
      data-mono={mono || undefined}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
