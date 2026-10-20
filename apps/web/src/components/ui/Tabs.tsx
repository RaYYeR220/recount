"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TabItem = {
  id: string;
  label: ReactNode;
  /** Small figure after the label, e.g. a count of polls. */
  count?: ReactNode;
  panel: ReactNode;
};

export type TabsProps = {
  /** Accessible name of the tab list. */
  label: string;
  tabs: TabItem[];
  /** Id of the tab shown first. Default: the first tab. */
  defaultTab?: string;
  /** "paper" (default) or "dark" for walnut and felt grounds. */
  tone?: "paper" | "dark";
  className?: string;
  panelClassName?: string;
};

/**
 * Tabs switch views of the same thing (request and response, table and chart).
 * Arrow keys, Home and End move between tabs; only the selected tab is in the tab order.
 */
export function Tabs({ label, tabs, defaultTab, tone = "paper", className, panelClassName }: TabsProps) {
  const base = useId();
  const [selected, setSelected] = useState(defaultTab ?? tabs[0]?.id);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex((t) => t.id === selected);
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (current === last ? 0 : current + 1)
      : event.key === "ArrowLeft" ? (current === 0 ? last : current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(tabs[next]!.id);
    refs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className={cx("tabs", tone === "dark" && "tabs-dark")} onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => {
          const isOn = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={isOn}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={isOn ? 0 : -1}
              className="tab"
              onClick={() => setSelected(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined ? <span className="count">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== selected}
          tabIndex={0}
          className={cx("mt-3.5 focus-visible:rounded-card", panelClassName)}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
