import { Chit } from "@/components/ui/Chit";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { isTrailing } from "@/lib/countStory";
import { formatVotes, placesOf, toUnits } from "@/lib/votes";
import { chitOf, type CountView } from "./model";

const SHOWN = 10;

type Item = {
  key: string;
  round: number;
  from: string;
  kind: "surplus" | "eliminated" | "set aside";
  to: Array<{ target: string; amount: string }>;
};

function itemsOf(view: Pick<CountView, "rounds" | "seats">): Item[] {
  const { rounds, seats } = view;
  return rounds.flatMap((r, i) =>
    r.transfers
      .map((t): Item => {
        const surplus = r.elected.includes(t.from);
        const setAside = surplus && isTrailing(rounds, i + 1, seats);
        return {
          key: `${r.round}-${t.from}`,
          round: r.round,
          from: t.from,
          kind: setAside ? "set aside" : surplus ? "surplus" : "eliminated",
          to: Object.entries(t.to)
            .filter(([target, amount]) => target !== "residualSurplus" && toUnits(amount, placesOf(amount)) > 0n)
            .map(([target, amount]) => ({ target, amount })),
        };
      })
      .filter((item) => item.to.length > 0),
  );
}

function TransferItem({ item, view }: { item: Item; view: Pick<CountView, "options" | "writeIns"> }) {
  return (
    <li>
      <span className="when">After round {item.round}</span>
      <div className="what">
        <b>{item.from}</b> {item.kind === "set aside" ? "surplus, set aside: every seat is filled" : item.kind}
        {item.kind === "set aside" ? null : (
          <div className="flows">
            {item.to.map(({ target, amount }) => (
              <span key={target} className="flow-chip">
                <Chit index={target === "exhausted" ? "inactive" : chitOf(target, view)} size={14} />
                {target === "exhausted" ? "Inactive" : target} +{formatVotes(amount)}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** Votes leaving each eliminated or elected option, and where they went. */
export function TransferList({ view, id = "transfers-h" }: { view: Pick<CountView, "rounds" | "seats" | "options" | "writeIns">; id?: string }) {
  const items = itemsOf(view);
  const shown = items.length > SHOWN + 2 ? items.slice(0, SHOWN) : items;
  const rest = items.slice(shown.length);
  return (
    <Paper as="section" aria-labelledby={id}>
      <PanelHeader id={id} title="Transfers" description="Votes leaving each eliminated or elected option, and where they went." />
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing moved: the count was decided on first choices.</p>
      ) : (
        <>
          <ol className="transfers">
            {shown.map((item) => (
              <TransferItem key={item.key} item={item} view={view} />
            ))}
          </ol>
          {rest.length > 0 ? (
            <details className="more-transfers">
              <summary>Show the other {rest.length} transfers</summary>
              <ol className="transfers" start={shown.length + 1}>
                {rest.map((item) => (
                  <TransferItem key={item.key} item={item} view={view} />
                ))}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </Paper>
  );
}
