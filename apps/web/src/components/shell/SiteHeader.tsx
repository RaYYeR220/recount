import { Suspense } from "react";
import { Disclosure } from "./Disclosure";
import { HeaderAccount, MenuAccount } from "./HeaderAccount";
import { NavLinks, PlainNavLinks } from "./NavLinks";
import { PRIMARY_NAV } from "./nav";
import { Wordmark } from "./Wordmark";

/**
 * The site header: wordmark, primary nav, and the account corner. A dark bar by
 * default; a page that renders <HeaderLook look="walnut" /> gets it laid over the
 * walnut instead (the landing). The account corner reads the session, so it streams
 * in behind a fallback of the same size.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-bar">
        <Wordmark />
        <nav className="site-nav" aria-label="Primary">
          <Suspense fallback={<PlainNavLinks items={PRIMARY_NAV} />}>
            <NavLinks items={PRIMARY_NAV} />
          </Suspense>
        </nav>
        <div className="site-account">
          <Suspense fallback={<span className="block h-9" aria-hidden="true" />}>
            <HeaderAccount />
          </Suspense>
        </div>
        <Disclosure className="menu menu-burger" summaryLabel="Menu" summary={<span className="burger-lines" aria-hidden="true" />}>
          <div className="menu-sheet">
            <nav aria-label="Sections">
              <PlainNavLinks items={PRIMARY_NAV} className="menu-item" />
            </nav>
            <Suspense fallback={null}>
              <MenuAccount />
            </Suspense>
          </div>
        </Disclosure>
      </div>
    </header>
  );
}

/**
 * Lays the header over the walnut instead of the dark bar. Render it anywhere in a
 * page; the header picks it up with :has(), no JavaScript.
 */
export function HeaderLook({ look }: { look: "walnut" }) {
  return <span hidden data-header-look={look} />;
}
