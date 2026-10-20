import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { NextField } from "@/components/auth/NextField";

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
      <SignupForm>
        <NextField searchParams={searchParams} />
      </SignupForm>
    </AuthCard>
  );
}
