import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

type SurfaceProps = {
  /** Element to render. Default "div"; use "section" or "article" with a heading. */
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

export type PaperProps = SurfaceProps & {
  /** Double gilt rule inside the edge, for ballots and receipts. */
  frame?: boolean;
  /** Standard panel padding (22px 24px, 18px 16px on phones). Default true. */
  padded?: boolean;
};

/** Paper: documents on the table. Ink text, gilt focus rings. */
export function Paper({ as: Tag = "div", frame, padded = true, className, children, ...rest }: PaperProps) {
  return (
    <Tag className={cx("paper", frame && "gilt-frame", padded && "px-4 py-[18px] sm:px-6 sm:py-[22px]", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Felt: where counting happens. Cream text. */
export function Felt({ as: Tag = "div", className, children, ...rest }: SurfaceProps) {
  return (
    <Tag className={cx("felt", className)} {...rest}>
      {children}
    </Tag>
  );
}

export type PanelHeaderProps = {
  title: ReactNode;
  /** Short note on the right (wraps under the title on narrow screens). */
  description?: ReactNode;
  /** Heading level, default 2. */
  level?: 2 | 3;
  id?: string;
  className?: string;
};

/** The heading row of a paper panel: display title plus a quiet note. */
export function PanelHeader({ title, description, level = 2, id, className }: PanelHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cx("panel-head", className)}>
      <Heading id={id}>{title}</Heading>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
