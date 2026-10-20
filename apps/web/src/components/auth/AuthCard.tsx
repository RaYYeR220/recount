import type { ReactNode } from "react";
import { Paper } from "@/components/ui";

export type AuthCardProps = {
  title: string;
  lede: ReactNode;
  /** The line under the card: the other way in. */
  aside: ReactNode;
  children: ReactNode;
};

/** A single paper slip on the walnut, for signing in and signing up. */
export function AuthCard({ title, lede, aside, children }: AuthCardProps) {
  return (
    <div className="wrap page grid justify-items-center pt-[clamp(32px,7vh,88px)]">
      <Paper as="section" frame aria-labelledby="auth-title" padded={false} className="w-full max-w-[30rem] px-5 pb-8 pt-7 shadow-lid sm:px-10 sm:pb-10 sm:pt-9">
        <h1 id="auth-title" className="display text-[clamp(2rem,4vw,2.625rem)] text-ink">
          {title}
        </h1>
        <p className="mt-2.5 text-ink-2">{lede}</p>
        <div className="mt-7">{children}</div>
      </Paper>
      <p className="mt-6 text-center text-sm text-cream-2 [&_a]:font-bold [&_a]:text-cream [&_a]:underline [&_a]:underline-offset-4">{aside}</p>
    </div>
  );
}
