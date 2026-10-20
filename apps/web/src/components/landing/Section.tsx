import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type SectionProps = {
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Ground: walnut (lighter), deep walnut, or the dark band of the quality section. */
  tone: "walnut" | "deep" | "dark";
  className?: string;
  children: ReactNode;
};

/** A landing section: display heading on the left, lede on the right, then the content. */
export function Section({ id, title, lede, tone, className, children }: SectionProps) {
  return (
    <section className={cx("lp-sec", `lp-sec-${tone}`, className)} id={id} aria-labelledby={`${id}-h`}>
      <div className="wrap">
        <div className="lp-sec-head grid12">
          <h2 className="display lp-h2" id={`${id}-h`}>
            {title}
          </h2>
          {lede ? <p className="lp-lede">{lede}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** A figure in running text: bold, tabular. */
export function N({ children }: { children: ReactNode }) {
  return <b className="num">{children}</b>;
}
