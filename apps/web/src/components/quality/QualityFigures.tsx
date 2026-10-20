import Link from "next/link";
import type { QualityReport } from "@/lib/quality/report";

const ran = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** The three headline figures from the engine's test run at build time. */
export function QualityFigures({ quality }: { quality: QualityReport }) {
  const { engine, rctabFixtures: f, replays: r } = quality;
  const near = r.divergent.filter((d) => d.mismatches !== null);
  return (
    <section className="q-figures" aria-label="Measured when this site was built">
      <div className="paper q-figure">
        <p>
          <b className="num">{engine.tests}</b> engine tests
        </p>
        <small>
          {engine.passed} passing{engine.failed > 0 ? `, ${engine.failed} failing` : ""}: unit, property, RCTab conformance and certified replays.
          Run {ran(quality.ranAt)}.
        </small>
      </div>
      <div className="paper q-figure">
        <p>
          <b className="num">
            {f.passed} of {f.total}
          </b>{" "}
          RCTab rules fixtures
        </p>
        <small>RCTab&apos;s own test contests, each counted by the engine and compared with RCTab&apos;s report field for field.</small>
      </div>
      <div className="paper q-figure">
        <p>
          <b className="num">{r.exact}</b> elections match the official count exactly
        </p>
        <small>
          Of {r.total} replayed from their ballots.
          {near.length > 0 ? ` The other ${near.length} use FairVote's copy of the ballots and differ in ${near.map((d) => d.mismatches).join(" and ")} figures. ` : " "}
          <Link href="/elections">See every replay</Link>.
        </small>
      </div>
    </section>
  );
}
