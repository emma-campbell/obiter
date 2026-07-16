import { useState } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";

const SIZES: Record<"sm" | "md", CSSProperties> = {
  sm: { height: "var(--control-sm)", fontSize: "var(--text-small)", padding: "0 var(--u-2)" },
  md: { height: "var(--control)", fontSize: "var(--text-base)", padding: "0 var(--u-2)" },
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  /** set for paths, keys, and machine text */
  mono?: boolean;
  invalid?: boolean;
}

/**
 * Obiter text Input. One hairline, no fill. Focus is a 2px Pencil ring — a
 * keyboard-first tool that hides focus is lying about being keyboard-first.
 */
export function Input({
  size = "md",
  mono = false,
  invalid = false,
  disabled = false,
  style,
  ...rest
}: InputProps) {
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const borderColor = invalid
    ? "var(--danger)"
    : focus
      ? "var(--pencil-500)"
      : hover
        ? "var(--border-emphasized)"
        : "var(--border-color)";
  const base: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    color: "var(--text-body)",
    background: "var(--bg)",
    border: `1px solid ${borderColor}`,
    borderRadius: "var(--radius)",
    outline: focus ? "2px solid var(--pencil-500)" : "none",
    outlineOffset: 0,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "text",
    transition: "border-color 120ms ease",
    ...SIZES[size],
    ...style,
  };
  return (
    <input
      disabled={disabled}
      aria-invalid={invalid || undefined}
      style={base}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    />
  );
}
