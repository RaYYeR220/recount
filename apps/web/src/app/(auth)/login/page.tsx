import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/safeNext";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

/** Reads `next` and the session at request time; someone signed in already goes straight on. */
async function LoginGate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <LoginForm next={next} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="Sign in"
      lede="Your polls, their ballots and every count are where you left them."
      aside={
        <>
          New here? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      <Suspense fallback={<LoginForm next="/dashboard" />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
