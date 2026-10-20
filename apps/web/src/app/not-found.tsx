import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusPage
      title={"This page doesn't exist."}
      description="The address may be mistyped, or the page has moved. Everything public starts from the home page or the election replays."
      actions={
        <>
          <ButtonLink href="/" variant="brass" size="lg">
            Go home
          </ButtonLink>
          <ButtonLink href="/elections" variant="line" size="lg">
            Browse elections
          </ButtonLink>
        </>
      }
      footnote={
        <>
          Have a poll link? Check it against the one you were sent, or <Link href="/dashboard">open your polls</Link>.
        </>
      }
    />
  );
}
