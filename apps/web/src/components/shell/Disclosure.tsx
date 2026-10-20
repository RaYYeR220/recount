"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type DisclosureProps = {
  /** Content of the <summary> toggle. */
  summary: ReactNode;
  /** Accessible name of the toggle when its content is an icon. */
  summaryLabel?: string;
  className?: string;
  children: ReactNode;
};

/**
 * A native <details> menu: opens and closes without JavaScript. Once hydrated it
 * also closes on Escape, on a click outside, after following a link inside, and
 * once a form inside has been sent.
 */
export function Disclosure({ summary, summaryLabel, className, children }: DisclosureProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const details = ref.current;
    if (!details) return;
    const close = (focusToggle: boolean) => {
      details.open = false;
      if (focusToggle) details.querySelector("summary")?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (!details.contains(event.target as Node)) close(false);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest("summary")) return;
      if (target.closest("a[href]")) close(false);
    };
    const onSubmit = () => window.setTimeout(() => close(false), 0);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    details.addEventListener("click", onClick);
    details.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      details.removeEventListener("click", onClick);
      details.removeEventListener("submit", onSubmit);
    };
  }, [open]);

  return (
    <details ref={ref} className={className} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary aria-label={summaryLabel}>{summary}</summary>
      {children}
    </details>
  );
}
