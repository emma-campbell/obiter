import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

const SIZES: Record<"sm" | "md", CSSProperties> = {
  sm: {
    height: "var(--control-sm)",
    minWidth: "var(--control-sm)",
    fontSize: "var(--text-small)",
    padding: "0 var(--u-2)",
  },
  md: {
    height: "var(--control)",
    minWidth: "var(--control)",
    fontSize: "var(--text-base)",
    padding: "0 var(--u-3)",
  },
};

const VARIANTS: Record<"solid" | "outline" | "ghost", CSSProperties> = {
  // Ink on Paper. The commit action.
  solid: { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" },
  // The default. One hairline, no fill.
  outline: { background: "transparent", color: "var(--ink)", borderColor: "var(--border-color)" },
  // Toolbar / text actions.
  ghost: { background: "transparent", color: "var(--text-muted)", borderColor: "transparent" },
};

const HOVER: Record<"solid" | "outline" | "ghost", CSSProperties> = {
  solid: { background: "var(--graphite)", borderColor: "var(--graphite)" },
  outline: { background: "var(--bg-subtle)" },
  ghost: { background: "var(--bg-subtle)", color: "var(--ink)" },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md";
  startIcon?: ReactNode;
}

/**
 * Obiter Button. Outline by default — most actions in this app are not
 * important. Solid (ink on paper) is the one commit action per view.
 */
export function Button({
  variant = "outline",
  size = "md",
  disabled = false,
  type = "button",
  startIcon = null,
  children,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--u-2)",
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
    lineHeight: 1,
    letterSpacing: 0,
    borderRadius: "var(--radius)",
    borderWidth: 1,
    borderStyle: "solid",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    whiteSpace: "nowrap",
    transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
    ...SIZES[size],
    ...VARIANTS[variant],
    ...(hover && !disabled ? HOVER[variant] : null),
    ...style,
  };
  return (
    <button
      type={type}
      disabled={disabled}
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {startIcon}
      {children}
    </button>
  );
}
