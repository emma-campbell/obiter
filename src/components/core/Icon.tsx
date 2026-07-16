import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface IconProps {
  /** a Lucide icon component (e.g. `Bold` from lucide-react); or pass your own <svg> as children */
  icon?: LucideIcon;
  children?: ReactNode;
  size?: number;
  strokeWidth?: number;
  "aria-label"?: string;
  style?: CSSProperties;
}

/**
 * Obiter Icon. A sizing + color wrapper for line icons. Obiter uses Lucide
 * (1.5px stroke, sentence-plain geometry); glyphs inherit `currentColor`.
 * Decorative by default — give `aria-label` when the icon carries meaning.
 */
export function Icon({
  icon: Glyph,
  size = 16,
  strokeWidth = 1.5,
  style,
  children,
  ...rest
}: IconProps) {
  const wrap: CSSProperties = {
    display: "inline-flex",
    width: size,
    height: size,
    flex: "0 0 auto",
    color: "inherit",
    ...style,
  };
  return (
    <span aria-hidden={rest["aria-label"] ? undefined : "true"} style={wrap} {...rest}>
      {Glyph ? <Glyph size={size} strokeWidth={strokeWidth} /> : children}
    </span>
  );
}
