"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/StatusPage";
import { Button } from "@/components/ui/Button";
import { fontVariables } from "@/fonts";
import "./globals.css";

/** Replaces the root layout when the layout itself fails, so it brings its own document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={fontVariables}>
      <body>
        <title>Something went wrong · Recount</title>
        <main id="main">
          <StatusPage
            title="Recount couldn't load this page."
            description="Something failed before the page could be drawn. Try again; if it keeps happening, come back in a few minutes."
            actions={
              <>
                <Button variant="brass" size="lg" onClick={() => retry()}>
                  Try again
                </Button>
                {/* A full page load, not a client navigation: the app shell itself failed. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="btn btn-line btn-lg">
                  Go home
                </a>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
