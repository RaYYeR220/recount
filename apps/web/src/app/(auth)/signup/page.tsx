import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { safeNext } from "@/lib/safeNext";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Create an account" };

async function SignupGate({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <SignupForm next={next} />;
}

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthCard
      title="Create your account"
      lede="Run ranked-choice polls and publish counts anyone can check. No email confirmation, no card."
      aside={
        <>
          Have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <Suspense fallback={<SignupForm next="/dashboard" />}>
        <SignupGate searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
