import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CountTable } from "@/components/table";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Chit,
  Code,
  CodeBlock,
  EmptyState,
  Field,
  Felt,
  Input,
  Kbd,
  Ledger,
  PanelHeader,
  Paper,
  RadioCard,
  Select,
  Stepper,
  TabLinks,
  Tabs,
  Textarea,
} from "@/components/ui";
import { cx } from "@/lib/cx";
import { CHIT_HUES, CHIT_PALETTE_SIZE, NEUTRAL_LABELS, type NeutralChit } from "@/lib/optionColour";
import { formatVotes } from "@/lib/votes";
import { committee, lunch } from "./data";
import { ToastDemo } from "./ToastDemo";

export const metadata: Metadata = {
  title: "Component sheet",
  description: "Recount's materials, type, chits and controls, with a live count table of a real STV poll.",
};

const MATERIALS = [
  ["walnut 950", "#160e08"],
  ["walnut 900", "#21150c"],
  ["walnut 800", "#3a2618"],
  ["walnut 700", "#4e3523"],
  ["walnut 600", "#5d4029"],
  ["walnut 400", "#8a6544"],
  ["felt 900", "#172a1f"],
  ["felt 700", "#2f4a3a"],
  ["felt 500", "#4b6d58"],
  ["paper", "#f3efe6"],
  ["paper 2", "#ebe5d8"],
  ["paper 3", "#ddd4c2"],
  ["ink", "#1d1a16"],
  ["ink 2", "#4b443b"],
  ["ink 3", "#6b6256"],
  ["gilt 300", "#e6cd85"],
  ["gilt 500", "#c9a14a"],
  ["gilt 700", "#8c6a24"],
] as const;

const NEUTRALS: NeutralChit[] = ["writein", "inactive", "exhausted"];

function Block({ id, title, hint, span, children, tone = "paper" }: { id: string; title: string; hint: ReactNode; span: string; children: ReactNode; tone?: "paper" | "walnut" | "felt" }) {
  const heading = (
    <>
      <h2 id={id} className={cx("title text-xl", tone !== "paper" && "text-cream")}>
        {title}
      </h2>
      <p className={cx("mb-[18px] mt-1 text-sm", tone === "paper" ? "text-ink-3" : "text-cream-2")}>{hint}</p>
    </>
  );
  const cls = cx("col-span-12", span, "min-w-0");
  if (tone === "felt")
    return (
      <Felt as="section" aria-labelledby={id} className={cx(cls, "px-4 py-5 sm:px-7 sm:py-6")}>
        {heading}
        {children}
      </Felt>
    );
  if (tone === "walnut")
    return (
      <section aria-labelledby={id} className={cx(cls, "rounded-card bg-walnut-800 px-4 py-5 shadow-[inset_0_0_0_1px_var(--color-hair)] sm:px-[26px] sm:py-6")}>
        {heading}
        {children}
      </section>
    );
  return (
    <Paper as="section" aria-labelledby={id} padded={false} className={cx(cls, "px-4 py-5 sm:px-[26px] sm:py-6")}>
      {heading}
      {children}
    </Paper>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export default function DesignPage() {
  const lunchRounds = lunch.results.rounds;
  return (
    <div className="wrap page">
      <h1 className="display page-title">Component sheet</h1>
      <p className="page-desc">
        Walnut is the table, felt is where counting happens, paper is for documents, brass is for controls and proof, chits are ballots. The count
        tables and the ledger are counted by the engine from the showcase polls&apos; ballots while this page is built.
      </p>

      <div className="mt-8 grid grid-cols-12 gap-[var(--gutter)]">
        <Block id="h-count" title="The count table" hint={<>The residents&apos; committee poll: 20 ballots, two seats, single transferable vote. Ana&apos;s surplus moves on as slivers; round 6 is the extra round RCTab reports after the seats fill.</>} span="" tone="walnut">
          <CountTable scene={committee.scene} title="Residents' committee, 2 seats: the count, round by round" />
        </Block>

        <Block id="h-count-irv" title="One winner, instant runoff" hint="The lunch poll: Pizza leads round 1, but Sushi's three ballots all go to Tacos." span="" tone="walnut">
          <CountTable scene={lunch.scene} title="Lunch: the count, round by round" />
        </Block>

        <Block id="h-colour" title="Materials" hint="Grounds and inks. Text on walnut uses cream; text on paper uses ink." span="lg:col-span-7">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
            {MATERIALS.map(([name, hex]) => (
              <div key={name} className="grid gap-1.5 text-[11.5px]">
                <i className="block h-11 rounded-[10px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]" style={{ background: hex }} />
                <b className="font-bold">{name}</b>
                <span className="mono text-ink-3">{hex}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block id="h-status" title="Status" hint="Reserved for state. Always with an icon and a word." span="lg:col-span-5" tone="walnut">
          <Row className="mb-4">
            <Badge tone="match" onDark>
              Matches
            </Badge>
            <Badge tone="warn" onDark>
              Within 1 vote
            </Badge>
            <Badge tone="fail" onDark>
              Mismatch
            </Badge>
            <Badge tone="neutral" onDark>
              Closed
            </Badge>
          </Row>
          <Row className="rounded-[14px] bg-paper p-3.5">
            <Badge tone="match">Matches the official count</Badge>
            <Badge tone="warn">Within 18 votes</Badge>
            <Badge tone="fail">Does not match</Badge>
            <Badge tone="info">Scheduled</Badge>
            <Badge tone="neutral">Closed</Badge>
            <Badge tone="gilt">Winner</Badge>
          </Row>
        </Block>

        <Block
          id="h-chits"
          title={`Chits: one per option, in a fixed order, up to ${CHIT_PALETTE_SIZE}`}
          hint="Ten validated hues. Options 11–20 add a spotted edge, 21–30 a ringed face. The option name always travels with the chit."
          span=""
          tone="felt"
        >
          <ol className="grid grid-cols-5 gap-x-2 gap-y-3 sm:grid-cols-10">
            {Array.from({ length: CHIT_PALETTE_SIZE }, (_, i) => (
              <li key={i} className="grid justify-items-center gap-1 text-center text-[11.5px] font-bold text-cream-2">
                <Chit index={i} size="xl" />
                <span>
                  {i + 1}
                  {i < CHIT_HUES.length ? ` ${CHIT_HUES[i]!.name}` : null}
                </span>
              </li>
            ))}
          </ol>
          <ul className="mt-6 flex flex-wrap gap-6 border-t border-hair pt-5">
            {NEUTRALS.map((key) => (
              <li key={key} className="flex items-center gap-2.5 text-sm font-bold text-cream-2">
                <Chit index={key} size="lg" />
                {NEUTRAL_LABELS[key]}
              </li>
            ))}
          </ul>
        </Block>

        <Block id="h-type" title="Type" hint="Clash Display for display, Atkinson Hyperlegible Next for everything you read or operate, Atkinson Hyperlegible Mono for receipts, hashes and code." span="lg:col-span-7">
          <dl className="grid gap-3.5">
            {(
              [
                ["72 / display", <span key="d" className="display text-[clamp(48px,6vw,72px)] leading-[0.95]">Recount</span>],
                ["48 / h1", <span key="h" className="display text-[clamp(32px,4vw,48px)]">Every result is recountable</span>],
                ["24 / title", <span key="t" className="title text-xl">Round by round</span>],
                ["18 / lede", <span key="l" className="text-md">Rank by clicking, publish the result, and hand anyone the ballots.</span>],
                ["16 / body", <span key="b">{`${lunch.results.totalBallots} ballots counted; ${lunch.results.winners[0]} wins in round ${lunchRounds.length}.`}</span>],
                ["14 / ui", <span key="u" className="text-sm">Showing 1–20 of 120 polls</span>],
                ["mono", <span key="m" className="mono text-xl">tfzp-5fy8-yewp</span>],
              ] as const
            ).map(([size, sample]) => (
              <div key={size} className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-4 border-b border-paper-3 pb-3">
                <dt className="mono text-xs text-ink-3">{size}</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">{sample}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block id="h-radii" title="Radii and fittings" hint="One wide named scale. Brass lamps and plates are the only raised controls." span="lg:col-span-5">
          <div className="flex flex-wrap items-end gap-4">
            {(
              [
                ["slip 8", "rounded-slip", "w-24"],
                ["card 18", "rounded-card", "w-24"],
                ["tray 28", "rounded-tray", "w-24"],
                ["board 40", "rounded-board", "w-[120px]"],
                ["chip 999", "rounded-chip", "w-16"],
              ] as const
            ).map(([label, radius, width]) => (
              <div key={label} className="grid justify-items-center gap-1.5 text-xs text-ink-2">
                <i className={cx("block h-16 bg-felt-700 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]", radius, width)} />
                {label}
              </div>
            ))}
          </div>
          <Row className="mt-[22px] rounded-[14px] bg-[#1f140b] p-4">
            <span className="flex gap-4" aria-hidden="true">
              <span className="ct-lamp" data-done="true">
                <span className="ct-lamp-n">1</span>
              </span>
              <span className="ct-lamp" data-lit="true">
                <span className="ct-lamp-n">2</span>
              </span>
              <span className="ct-lamp">
                <span className="ct-lamp-n">3</span>
              </span>
            </span>
            <span className="plaque plaque-demo" data-state="elected">
              <span className="pl-top">
                <span className="pl-name">Tacos</span>
                <span className="pl-badge">Winner</span>
              </span>
              <span className="pl-count">{formatVotes(lunchRounds[1]!.tally.Tacos!)}</span>
            </span>
          </Row>
        </Block>

        <Block id="h-buttons" title="Buttons" hint="Ink for the main action on paper, brass for the main action on walnut, one of them per view." span="lg:col-span-6">
          <Row className="mb-3.5">
            <Button>Cast ballot</Button>
            <Button variant="brass">Next round</Button>
            <Button variant="line">Move up</Button>
            <Button variant="quiet">Check your ballot</Button>
          </Row>
          <Row className="mb-3.5">
            <Button size="sm">Small</Button>
            <Button>Medium</Button>
            <Button size="lg">Large</Button>
            <ButtonLink href="/design#h-buttons" variant="line" size="sm">
              A link
            </ButtonLink>
          </Row>
          <Row>
            <Button variant="danger">Delete poll</Button>
            <Button disabled>Review ballot</Button>
            <Button variant="line" disabled>
              Move up
            </Button>
          </Row>
        </Block>

        <Block id="h-buttons-walnut" title="On walnut" hint="The same set where the table is the ground." span="lg:col-span-6" tone="walnut">
          <Row className="mb-3.5">
            <Button variant="brass" size="lg">
              Start a poll
            </Button>
            <Button variant="line">Sign in</Button>
            <Button variant="quiet">Recount NYC 2025</Button>
          </Row>
          <Tabs
            label="Example"
            tone="dark"
            tabs={[
              { id: "request", label: "Request", panel: <CodeBlock language="shell" label="Example request" code={`curl -X POST "$RECOUNT_URL/api/v1/tabulate" \\\n  -H "Content-Type: application/json" -d @lunch.json`} /> },
              { id: "response", label: "Response", panel: <CodeBlock language="json" label="Example response" code={JSON.stringify({ winners: lunch.results.winners, rounds: lunchRounds.map((r) => ({ round: r.round, tally: r.tally })) }, null, 2)} /> },
            ]}
          />
        </Block>

        <Block id="h-fields" title="Fields" hint="Labels above, hints below, errors say what to do. Dates are text in YYYY-MM-DD HH:mm with a native zone select." span="lg:col-span-7">
          <div className="grid gap-[18px] sm:grid-cols-2">
            <Field id="demo-title" label="Poll title" hint="Voters see this at the top of the ballot.">
              <Input defaultValue="Team offsite location" />
            </Field>
            <Field id="demo-code" label="Invite code" error="That code isn't valid for this poll.">
              <Input mono defaultValue="WRONG-CODE-0000" />
            </Field>
            <Field id="demo-zone" label="Time zone" hint="Defaults to your browser's zone.">
              <Select defaultValue="America/New_York">
                <option>America/New_York</option>
                <option>Europe/Warsaw</option>
                <option>UTC</option>
              </Select>
            </Field>
            <Field id="demo-opens" label="Opens" hint="Format YYYY-MM-DD HH:mm, 24-hour.">
              <Input mono defaultValue="2027-03-14 02:30" />
            </Field>
            <Field id="demo-desc" label="Description" optional className="sm:col-span-2">
              <Textarea defaultValue="Where should the spring offsite go? Rank as many cities as you like." />
            </Field>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="label mb-2.5">Opening</legend>
              <RadioCard name="demo-open" id="demo-open-now" value="now" title="As soon as the poll is created" description="Voters can use the link straight away." />
              <RadioCard name="demo-open" id="demo-open-later" value="later" defaultChecked title="At a set time" description="Before then, the link shows when voting starts." />
            </fieldset>
            <Callout tone="warn" className="sm:col-span-2">
              2:30 AM doesn&apos;t exist on March 14, 2027 in America/New_York (clocks jump forward). We&apos;ll open the poll at 3:30 AM.
            </Callout>
          </div>
        </Block>

        <Block id="h-tabs" title="Tabs and filters" hint="Tabs switch views of the same thing; links filter a list in the URL; a native select filters too." span="lg:col-span-5">
          <TabLinks
            label="Poll status"
            items={[
              { href: "/design#h-tabs", label: "All", count: 120, current: true },
              { href: "/design?status=open#h-tabs", label: "Open", count: 41 },
              { href: "/design?status=scheduled#h-tabs", label: "Scheduled", count: 39 },
              { href: "/design?status=closed#h-tabs", label: "Closed", count: 40 },
            ]}
          />
          <Field id="demo-status" label="Status" className="mt-[18px]">
            <Select defaultValue="all">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="scheduled">Scheduled</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
          <p className="mt-4 text-sm font-bold">Showing 1–20 of 120 polls</p>
          <p className="mt-4 text-sm text-ink-2">
            Inline code reads <Code>?format=rctab</Code>; keys read <Kbd>←</Kbd> <Kbd>→</Kbd>.
          </p>
        </Block>

        <Block id="h-table" title="Ledger" hint="A heavy rule under the header, hairlines between rows, figures right-aligned in tabular numerals." span="lg:col-span-8">
          <Ledger caption="Lunch poll, votes per option in each round" captionHidden>
            <thead>
              <tr>
                <th scope="col">Option</th>
                {lunchRounds.map((r) => (
                  <th key={r.round} scope="col" className="num">
                    Round {r.round}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lunch.results.candidates.map((option, i) => (
                <tr key={option} className={lunch.results.winners.includes(option) ? "win" : undefined}>
                  <th scope="row">
                    <span className="inline-flex items-center gap-2">
                      <Chit index={i} />
                      {option}
                    </span>
                  </th>
                  {lunchRounds.map((r) => (
                    <td key={r.round} className={cx("num", r.tally[option] === undefined && "out")}>
                      {r.tally[option] === undefined ? "Eliminated" : formatVotes(r.tally[option]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Ledger>
        </Block>

        <Block id="h-toast" title="Toasts" hint="Confirm what happened in the action's own words." span="lg:col-span-4" tone="walnut">
          <ToastDemo />
        </Block>

        <Block id="h-steps" title="Steps" hint="Brass lamps for a flow: the wizard spreads them on a track, the ballot keeps them compact." span="lg:col-span-6">
          <div className="rounded-[14px] bg-walnut-800 px-4 pb-4 pt-5">
            <Stepper
              label="New poll steps"
              current={4}
              steps={[
                { label: "Options", href: "/design#h-steps" },
                { label: "Method and seats", href: "/design#h-steps" },
                { label: "Rules", href: "/design#h-steps" },
                { label: "Access and results", href: "/design#h-steps" },
                { label: "Schedule" },
                { label: "Review" },
              ]}
            />
          </div>
          <div className="mt-3 rounded-[14px] bg-walnut-800 px-4 py-4">
            <Stepper label="Voting steps" variant="inline" current={1} steps={[{ label: "Rank" }, { label: "Review" }, { label: "Receipt" }]} />
          </div>
        </Block>

        <Block id="h-empty" title="Empty state" hint="An empty tray and the next step, never a mood." span="lg:col-span-6">
          <EmptyState
            title="No polls yet"
            description="Create one, share the link, and the count happens here when it closes."
            action={
              <ButtonLink href="/new" variant="ink">
                Start a poll
              </ButtonLink>
            }
          />
        </Block>

        <Block id="h-callouts" title="Callouts" hint="Inline, next to the thing they are about." span="">
          <PanelHeader level={3} title="Recount" description="The same panel heading the results page uses." />
          <div className="grid gap-2.5 md:grid-cols-2">
            <Callout tone="match">Recount matches: same winner, same {lunchRounds.length} rounds.</Callout>
            <Callout tone="info">Results are hidden until this poll closes.</Callout>
            <Callout tone="warn">1:30 AM happens twice on November 7, 2027 in America/New_York. We&apos;ll use the first one (EDT).</Callout>
            <Callout tone="fail">Recount does not match the published result.</Callout>
          </div>
        </Block>
      </div>
    </div>
  );
}
