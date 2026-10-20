import Link from "next/link";
import { ButtonLink, buttonClass } from "@/components/ui";
import { cx } from "@/lib/cx";
import { pageItems } from "@/lib/pager";

export type PagerProps = {
  page: number;
  pageCount: number;
  /** The URL of a page, keeping the search and filter. */
  hrefFor: (page: number) => string;
};

function Step({ page, label, hrefFor, enabled }: { page: number; label: string; hrefFor: PagerProps["hrefFor"]; enabled: boolean }) {
  if (!enabled) {
    return (
      <span aria-disabled="true" className={buttonClass("line", "sm")}>
        {label}
      </span>
    );
  }
  return (
    <ButtonLink href={hrefFor(page)} variant="line" size="sm" rel={label.startsWith("Next") ? "next" : "prev"}>
      {label}
    </ButtonLink>
  );
}

/** Previous, numbered pages, next. Plain links, so every page has its own URL. */
export function Pager({ page, pageCount, hrefFor }: PagerProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 max-[640px]:justify-center">
      <Step page={page - 1} label="Previous page" hrefFor={hrefFor} enabled={page > 1} />
      <ol className="flex flex-wrap gap-1 max-[640px]:order-first max-[640px]:w-full max-[640px]:justify-center">
        {pageItems(page, pageCount).map((item, i) =>
          item === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="grid h-9 min-w-6 place-items-center text-ink-3">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cx(
                  "grid h-9 min-w-9 place-items-center rounded-chip px-2 text-[13.5px] font-bold no-underline",
                  item === page ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>
      <Step page={page + 1} label="Next page" hrefFor={hrefFor} enabled={page < pageCount} />
    </nav>
  );
}
