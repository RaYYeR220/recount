const ORIGIN = "http://recount.invalid";
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Where to go after signing in. Only a path on this site is accepted: anything
 * absolute, protocol-relative ("//evil.example"), backslashed or otherwise able to
 * leave the origin falls back to the dashboard, and so do the auth pages themselves.
 */
export function safeNext(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Browsers read "\" as "/", so "/\evil.example" would leave the site.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== ORIGIN) return fallback;
  // Dot segments collapse while parsing: "/.//evil.example" comes out as "//evil.example".
  if (url.pathname.startsWith("//")) return fallback;
  if (AUTH_PAGES.includes(url.pathname) || url.pathname.startsWith("/api/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** "/login?next=…" for a page that needs a session. */
export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
