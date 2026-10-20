"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent } from "./nav";

export type NavLinkItem = { readonly href: string; readonly label: string };

/** Links that mark the current section with aria-current. Render inside <Suspense>. */
export function NavLinks({ items, className }: { items: readonly NavLinkItem[]; className?: string }) {
  const pathname = usePathname();
  return items.map((item) => (
    <Link key={item.href} href={item.href} className={className} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
      {item.label}
    </Link>
  ));
}

/** The same links before the path is known (prerendered shell). Identical layout. */
export function PlainNavLinks({ items, className }: { items: readonly NavLinkItem[]; className?: string }) {
  return items.map((item) => (
    <Link key={item.href} href={item.href} className={className}>
      {item.label}
    </Link>
  ));
}
