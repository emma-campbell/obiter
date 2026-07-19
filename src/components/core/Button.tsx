import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import "./Button.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md";
  startIcon?: ReactNode;
}

/**
 * Obiter Button. Outline by default — most actions in this app are not
 * important. Solid (ink on paper) is the one commit action per view. Runs on
 * Base UI's Button (ADR 0001); the look lives in Button.css, keyed off the
 * data-variant / data-size attributes.
 */
export function Button({
  variant = "outline",
  size = "md",
  type = "button",
  startIcon = null,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      className={className ? `btn ${className}` : "btn"}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {startIcon}
      {children}
    </BaseButton>
  );
}
