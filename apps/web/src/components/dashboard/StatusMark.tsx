import { cx } from "@/lib/cx";
import { STATUS_LABEL } from "@/lib/pollText";
import type { PollStatus } from "@/server/polls/status";

const DOT: Record<PollStatus, string> = {
  open: "bg-match shadow-[0_0_0_3px_rgb(47_125_79/0.18)]",
  scheduled: "shadow-[inset_0_0_0_2px_var(--color-info)]",
  closed: "bg-ink-3",
};

const TEXT: Record<PollStatus, string> = {
  open: "text-match",
  scheduled: "text-info",
  closed: "text-ink-2",
};

/** A poll's status on paper: a lamp and the word, never the colour alone. */
export function StatusMark({ status, className }: { status: PollStatus; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold", TEXT[status], className)}>
      <i aria-hidden="true" className={cx("size-2 flex-none rounded-full", DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}
