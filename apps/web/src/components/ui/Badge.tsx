import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { CheckIcon, CrossIcon, DotIcon, WarnIcon } from "./icons";

export type BadgeTone = "match" | "warn" | "fail" | "info" | "neutral" | "gilt";

export type BadgeProps = {
  tone?: BadgeTone;
  /** Lighter treatment for walnut and felt grounds. */
  onDark?: boolean;
  size?: "md" | "lg";
  /**
   * Status glyph before the text. Defaults on for match, warn and fail, which must
   * never rely on colour alone.
   */
  icon?: boolean;
  className?: string;
  children: ReactNode;
};

const GLYPH = { match: CheckIcon, warn: WarnIcon, fail: CrossIcon, info: DotIcon } as const;

/** A small label for state: matched, within N votes, mismatch, scheduled, closed, winner. */
export function Badge({ tone = "neutral", onDark, size = "md", icon, className, children }: BadgeProps) {
  const showIcon = icon ?? (tone === "match" || tone === "warn" || tone === "fail");
  const Glyph = tone in GLYPH ? GLYPH[tone as keyof typeof GLYPH] : null;
  return (
    <span className={cx("badge", `badge-${tone}`, onDark && "badge-dark", size === "lg" && "badge-lg", className)}>
      {showIcon && Glyph ? <Glyph /> : null}
      {children}
    </span>
  );
}
