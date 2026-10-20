import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type LedgerProps = {
  /** Table caption. Required: every table needs a name. */
  caption: ReactNode;
  /** Keep the caption for screen readers only (the panel heading already says it). */
  captionHidden?: boolean;
  className?: string;
  /** <thead> and <tbody>. Use className="num" on figure cells, "win" on a winning row. */
  children: ReactNode;
};

/**
 * Ledger rules: a heavy rule under the header, hairlines between rows, figures
 * right-aligned in tabular numerals. Scrolls sideways inside its box, never the page.
 */
export function Ledger({ caption, captionHidden, className, children }: LedgerProps) {
  return (
    <div className="ledger-scroll">
      <table className={cx("ledger", className)}>
        <caption className={captionHidden ? "sr-only" : undefined}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
