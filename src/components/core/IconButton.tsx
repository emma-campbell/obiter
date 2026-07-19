import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button as BaseButton } from "@base-ui/react/button";
import { Icon } from "./Icon";
import "./IconButton.css";

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
 * Runs on Base UI's Button (ADR 0001); the look lives in IconButton.css.
 */
export function IconButton({
  iconNode,
  icon,
  "aria-label": label,
  size = "md",
  active = false,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <BaseButton
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      className={className ? `icon-btn ${className}` : "icon-btn"}
      data-size={size}
      {...rest}
    >
      {iconNode ?? <Icon icon={icon} size={size === "sm" ? 14 : 16} />}
    </BaseButton>
  );
}
