import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "brass" | "ink" | "line" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  /** brass: main action on walnut; ink: main action on paper; line, quiet, danger. Default ink. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export type ButtonLinkProps = Common &
  Omit<ComponentProps<typeof Link>, "className" | "children"> & {
    /** Render a plain <a>: files, API routes and other sites. External http(s) links get one anyway. */
    native?: boolean;
  };

export function buttonClass(variant: ButtonVariant = "ink", size: ButtonSize = "md", className?: string): string {
  return cx("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, className);
}

/** A <button>. `type` defaults to "button" so it never submits a form by accident. */
export function Button({ variant, size, className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

const LINK_ONLY = new Set(["prefetch", "replace", "scroll", "shallow", "passHref", "legacyBehavior", "locale", "onNavigate", "as"]);

function anchorProps(props: Record<string, unknown>): ComponentProps<"a"> {
  return Object.fromEntries(Object.entries(props).filter(([key]) => !LINK_ONLY.has(key))) as ComponentProps<"a">;
}

/** The same look on a link. Internal paths go through next/link. */
export function ButtonLink({ variant, size, className, native, href, children, ...rest }: ButtonLinkProps) {
  const cls = buttonClass(variant, size, className);
  const raw = typeof href === "string" ? href : null;
  if (raw !== null && (native || /^(https?:|mailto:)/.test(raw))) {
    return (
      <a href={raw} className={cls} {...anchorProps(rest)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
