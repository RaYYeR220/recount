import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** The next step, usually one button. */
  action?: ReactNode;
  /** Heading level of the title, default 3. */
  level?: 2 | 3;
  className?: string;
};

/** An empty tray and the next step: "No polls yet", "No ballots yet." */
export function EmptyState({ title, description, action, level = 3, className }: EmptyStateProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cx("empty", className)}>
      <svg viewBox="0 0 140 76" width="140" height="76" aria-hidden="true">
        <rect x="4" y="10" width="132" height="62" rx="20" fill="#2f4a3a" />
        <rect x="4" y="10" width="132" height="12" rx="10" fill="rgba(0,0,0,.25)" />
        <ellipse cx="70" cy="48" rx="15" ry="8" fill="none" stroke="rgba(243,239,230,.25)" strokeDasharray="3 3" />
      </svg>
      <Heading className="empty-title">{title}</Heading>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
