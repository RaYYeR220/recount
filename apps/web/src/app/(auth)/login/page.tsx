import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignedInRedirect } from "@/components/auth/SignedInRedirect";

export const metadata: Metadata = { title: "Sign in" };

/** The form is in the static shell; only the check for an existing session waits on the request. */
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
      <Suspense fallback={null}>
        <SignedInRedirect searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </AuthCard>
  );
}
