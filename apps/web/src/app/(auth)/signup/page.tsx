import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { SignedInRedirect } from "@/components/auth/SignedInRedirect";

export const metadata: Metadata = { title: "Create an account" };

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
      <Suspense fallback={null}>
        <SignedInRedirect searchParams={searchParams} />
      </Suspense>
      <SignupForm />
    </AuthCard>
  );
}
