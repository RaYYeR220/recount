import { HeaderLook } from "@/components/shell";
import { ButtonLink } from "@/components/ui/Button";
import { Chit } from "@/components/ui/Chit";
import { FailGlyph, MatchGlyph } from "@/components/ui/icons";
import type { HeroProof } from "./heroData";
import { HeroCount } from "./HeroCount";
import { getHero } from "./loaders";

function Claim({ replayHref }: { replayHref: string }) {
  return (
    <>
      <h1 id="claim" className="display hero-title">
        <span className="whitespace-nowrap">Ranked-choice</span> polls you can recount.
      </h1>
      <p className="hero-lede">
        Rank by clicking, publish the result, and hand anyone the ballots. Every count ships with its cast-vote record, a SHA-256 and a recount that
        runs in the browser.
      </p>
      <div className="hero-ctas">
        <ButtonLink href="/new" variant="ink" size="lg">
          Start a poll
        </ButtonLink>
        <ButtonLink href={replayHref} variant="quiet" size="lg">
          Recount NYC 2025
        </ButtonLink>
      </div>
    </>
  );
}

function Proof({ proof }: { proof: HeroProof }) {
  return (
    <>
      <p className="proof-org">{proof.publisher}</p>
      <p className="proof-contest">{proof.contest}</p>
      <p className="proof-big">
        <b className="num">{proof.matched}</b>{" "}
        <span>
          of <span className="num">{proof.cells}</span> figures match the certified count, replayed from{" "}
          <span className="num">{proof.ballots}</span> ballots
        </span>
      </p>
      <ul className="proof-rows">
        {proof.rows.map((row) => (
          <li key={row.label}>
            <span>
              <Chit index={row.chit} size={14} />
              {row.label}
            </span>
            <span className="num proof-figure">{row.figure}</span>
            {row.matches ? <MatchGlyph className="proof-glyph" /> : <FailGlyph className="proof-glyph" />}
            <span className="sr-only">{row.matches ? "matches the replay" : "differs from the replay"}</span>
          </li>
        ))}
      </ul>
      {proof.note ? <p className="proof-note">{proof.note}</p> : null}
    </>
  );
}

/** Above the fold: the claim, and the proof that the count behind it is real. */
export async function Hero() {
  const { table, proof } = await getHero();
  return (
    <section className="hero" aria-labelledby="claim">
      <HeaderLook look="walnut" />
      <HeroCount
        input={table}
        claim={<Claim replayHref={proof.href} />}
        proof={<Proof proof={proof} />}
        proofLabel="Proof against the certified count"
        railLabel={`Count controls, ${table.name}`}
      />
    </section>
  );
}
