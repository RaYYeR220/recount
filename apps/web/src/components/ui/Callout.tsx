import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { FailGlyph, InfoGlyph, MatchGlyph, WarnGlyph } from "./icons";

export type CalloutTone = "match" | "warn" | "info" | "fail";

export type CalloutProps = {
  tone?: CalloutTone;
  /**
   * "status" for results that appear after an action (recount matches), "alert" for
   * errors that need attention now. Leave it out for text that is there on load.
   */
  role?: "status" | "alert";
  className?: string;
  id?: string;
  children: ReactNode;
};

const GLYPH = { match: MatchGlyph, warn: WarnGlyph, info: InfoGlyph, fail: FailGlyph } as const;

/** An inline note next to the thing it is about: DST warnings, hidden results, recount outcome. */
export function Callout({ tone = "info", role, className, id, children }: CalloutProps) {
  const Glyph = GLYPH[tone];
  return (
    <div id={id} role={role} className={cx("callout", `callout-${tone}`, className)}>
      <Glyph />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
