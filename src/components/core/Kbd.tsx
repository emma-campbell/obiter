import type { CSSProperties, HTMLAttributes } from "react";

export type KbdProps = HTMLAttributes<HTMLElement>;

/**
 * Obiter Kbd. A keyboard key rendered in mono — the app is keyboard-first, so
 * shortcuts are shown literally. One hairline, chalk fill, no elevation.
 * Group keys with a small gap; don't string them inside a single Kbd.
 */
export function Kbd({ children, style, ...rest }: KbdProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-micro)",
    lineHeight: 1,
    color: "var(--text-muted)",
    background: "var(--bg-subtle)",
    border: "1px solid var(--border-color)",
    borderRadius: "var(--radius)",
    ...style,
  };
  return (
    <kbd style={base} {...rest}>
      {children}
    </kbd>
  );
}
