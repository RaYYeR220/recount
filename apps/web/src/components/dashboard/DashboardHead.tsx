import { ButtonLink } from "@/components/ui";

/** "Your polls", the tally line under it, and the way to start a new one. */
export function DashboardHead({ summary }: { summary: string | null }) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 className="display page-title">Your polls</h1>
        <p className="mt-1.5 min-h-6 text-cream-2">{summary}</p>
      </div>
      <ButtonLink href="/new" variant="brass" size="lg">
        Start a poll
      </ButtonLink>
    </div>
  );
}
