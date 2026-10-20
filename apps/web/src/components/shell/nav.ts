/** Primary navigation, the same for everyone. "Polls" joins it when signed in. */
export const PRIMARY_NAV = [
  { href: "/elections", label: "Elections" },
  { href: "/count", label: "Count" },
  { href: "/developers", label: "Developers" },
  { href: "/quality", label: "Quality" },
] as const;

export const POLLS_NAV = { href: "/dashboard", label: "Polls" } as const;

/** True when `pathname` is `href` or a page under it. */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
