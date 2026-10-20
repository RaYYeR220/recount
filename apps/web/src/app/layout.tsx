import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell";
import { fontVariables } from "@/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Recount", template: "%s · Recount" },
  description: "Ranked-choice polls you can recount. Run a poll, publish the result, and hand anyone the ballots, the hash and a recount that runs in the browser.",
};

export const viewport: Viewport = {
  themeColor: "#21150c",
  colorScheme: "dark",
};

/**
 * Every page renders inside <main id="main">, between the header and the footer;
 * pages bring their own container (`wrap page` for app screens).
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
