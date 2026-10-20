import Link from "next/link";
import { Wordmark } from "./Wordmark";

export const REPOSITORY_URL = "https://github.com/RaYYeR220/recount";

/** Footer: product, developer, quality and data columns, then the legal line. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot">
        <div className="foot-brand">
          <Wordmark />
          <p>Ranked-choice polls and elections, counted in the open.</p>
        </div>
        <nav className="foot-cols" aria-label="Footer">
          <div>
            <h2>Product</h2>
            <Link href="/new">Start a poll</Link>
            <Link href="/elections">Elections</Link>
            <Link href="/count">Count tool</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
          <div>
            <h2>Developers</h2>
            <Link href="/developers">API</Link>
            <a href="/api/v1/openapi.json">OpenAPI JSON</a>
            <a href={REPOSITORY_URL}>Engine source</a>
          </div>
          <div>
            <h2>Quality</h2>
            <Link href="/quality">Merge gates</Link>
            <Link href="/design">Component sheet</Link>
          </div>
          <div>
            <h2>Data</h2>
            <p>Board of Elections in the City of New York; City of Minneapolis; Multnomah County; FairVote via Harvard Dataverse (CC0).</p>
          </div>
        </nav>
        <p className="foot-legal">
          Engine under the MIT licence. Election data are public records or CC0. Recount is not affiliated with any election office.
        </p>
      </div>
    </footer>
  );
}
