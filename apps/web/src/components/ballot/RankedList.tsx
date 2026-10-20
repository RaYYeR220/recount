import { Chit } from "@/components/ui";
import { cx } from "@/lib/cx";

/** A ranking read back in order, "1. Lisbon", "2. Valencia": review, receipt and verify. */
export function RankedList({ ranking, className }: { ranking: Array<{ label: string; index: number }>; className?: string }) {
  return (
    <ol className={cx("m-0 grid w-full max-w-[520px] list-none gap-2 p-0", className)}>
      {ranking.map((option, i) => (
        <li
          key={`${i}-${option.label}`}
          className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-3 rounded-[14px] bg-well px-3.5 py-3 text-left text-md font-bold text-ink shadow-[inset_0_0_0_1px_var(--color-paper-4)]"
        >
          <Chit index={option.index} size="sm" />
          <span className="[overflow-wrap:anywhere]">
            {i + 1}. {option.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
