import { HeaderLook } from "@/components/shell";
import { ButtonLink } from "@/components/ui/Button";

export default function Home() {
  return (
    <section className="ground-walnut pb-24 pt-[120px] max-[900px]:pt-[88px]" aria-labelledby="claim">
      <HeaderLook look="walnut" />
      <div className="wrap">
        <div className="paper max-w-[54rem] px-6 pb-10 pt-8 shadow-lid sm:px-11 sm:pb-12 sm:pt-10">
          <h1 id="claim" className="display text-[clamp(2.375rem,4.45vw,4.125rem)] text-balance text-ink">
            Ranked-choice polls you can recount.
          </h1>
          <p className="mt-[18px] max-w-[46ch] text-md text-ink-2">
            Rank by clicking, publish the result, and hand anyone the ballots. Every count ships with its cast-vote record, a SHA-256 and a recount
            that runs in the browser.
          </p>
          <div className="mt-[26px] flex flex-wrap items-center gap-x-[22px] gap-y-3.5">
            <ButtonLink href="/new" variant="ink" size="lg">
              Start a poll
            </ButtonLink>
            <ButtonLink href="/elections" variant="quiet">
              Browse the election replays
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
