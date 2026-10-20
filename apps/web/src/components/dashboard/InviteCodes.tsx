import type { ManageState } from "@/app/dashboard/p/[slug]/actions";
import { CopyButton } from "@/components/CopyButton";
import { Badge, PanelHeader, Paper } from "@/components/ui";
import { plural } from "@/lib/pollText";
import { GenerateCodesForm } from "./GenerateCodesForm";

export type InviteCodesProps = {
  codes: Array<{ code: string; usedAt: Date | null }>;
  /** Null once the poll has closed: no more codes. */
  generate: ((prev: ManageState, form: FormData) => Promise<ManageState>) | null;
  max: number;
};

/** Generate codes, see each one used or unused, copy the unused ones to hand out. */
export function InviteCodes({ codes, generate, max }: InviteCodesProps) {
  const used = codes.filter((c) => c.usedAt).length;
  const unused = codes.filter((c) => !c.usedAt).map((c) => c.code);
  return (
    <Paper as="section" aria-labelledby="codes-title">
      <PanelHeader id="codes-title" title="Invite codes" description={codes.length ? `${plural(codes.length, "code")}, ${used.toLocaleString("en-US")} used` : "None yet"} />
      <div className="grid gap-5">
        {generate ? <GenerateCodesForm action={generate} max={max} /> : <p className="text-sm text-ink-3">The poll has closed, so no more codes can be added.</p>}
        {codes.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-3">Each code works once. Send one to each voter with the poll link.</p>
              {unused.length ? (
                <CopyButton text={unused.join("\n")} done={`${plural(unused.length, "unused code")} copied.`} size="sm">
                  Copy unused codes
                </CopyButton>
              ) : null}
            </div>
            <ol aria-label="Invite codes" className="m-0 grid max-h-[22rem] list-none grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-x-4 overflow-y-auto rounded-field p-0 shadow-[inset_0_0_0_1px_var(--color-paper-3)]">
              {codes.map((c, i) => (
                <li key={c.code} className="flex items-center justify-between gap-3 border-b border-paper-3 px-3.5 py-2">
                  <span className="flex items-baseline gap-2.5">
                    <span className="num w-7 text-right text-xs text-ink-3">{i + 1}.</span>
                    <span className="mono text-[15px] font-semibold tracking-[0.04em] text-ink">{c.code}</span>
                  </span>
                  {c.usedAt ? (
                    <Badge tone="neutral">Used</Badge>
                  ) : (
                    <Badge tone="match" icon={false}>
                      Unused
                    </Badge>
                  )}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </Paper>
  );
}
