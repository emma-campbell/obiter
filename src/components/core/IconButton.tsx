import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

const SIZES: Record<"sm" | "md", CSSProperties> = {
  sm: { width: "var(--control-sm)", height: "var(--control-sm)" },
  md: { width: "var(--control)", height: "var(--control)" },
};

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** a rendered icon node; or use `icon` for a Lucide glyph */
  iconNode?: ReactNode;
  icon?: LucideIcon;
  /** required — the accessible label the missing text would have carried */
  "aria-label": string;
  size?: "sm" | "md";
  /** pressed/selected state (e.g. active toolbar toggle) */
  active?: boolean;
}

/**
 * Obiter IconButton. The ghost button reduced to a square — for toolbar and
 * chrome actions where a label would be noise. Always give an `aria-label`.
 */
export function IconButton({
  iconNode,
  icon,
  "aria-label": label,
  size = "md",
  active = false,
  disabled = false,
  style,
  ...rest
}: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: "var(--radius)",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    background: active
      ? "var(--bg-subtle)"
      : hover && !disabled
        ? "var(--bg-subtle)"
        : "transparent",
    color: active ? "var(--ink)" : "var(--text-muted)",
    transition: "background 120ms ease, color 120ms ease",
    ...SIZES[size],
    ...style,
  };
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {iconNode ?? <Icon icon={icon} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}
