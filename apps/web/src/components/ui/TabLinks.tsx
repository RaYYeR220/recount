import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TabLinkItem = {
  href: string;
  label: ReactNode;
  count?: ReactNode;
  current?: boolean;
};

export type TabLinksProps = {
  /** Accessible name of the navigation, e.g. "Poll status". */
  label: string;
  items: TabLinkItem[];
  tone?: "paper" | "dark";
  className?: string;
};

/**
 * Tab-shaped links for filters that live in the URL (status, page). Plain links,
 * so they work without JavaScript and keep their place in history.
 */
export function TabLinks({ label, items, tone = "paper", className }: TabLinksProps) {
  return (
    <nav aria-label={label} className={cx("tabs", tone === "dark" && "tabs-dark", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="tab" aria-current={item.current ? "page" : undefined}>
          {item.label}
          {item.count !== undefined ? <span className="count">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
