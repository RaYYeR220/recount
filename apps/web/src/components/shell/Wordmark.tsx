import Link from "next/link";

/** Three stacked chits and the name; links home. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={className ? `wordmark ${className}` : "wordmark"} aria-label="Recount home">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <ellipse cx="14" cy="21" rx="11" ry="5" fill="#8e2f14" />
        <ellipse cx="14" cy="19.2" rx="11" ry="5" fill="#e4512c" />
        <ellipse cx="14" cy="13.6" rx="11" ry="5" fill="#00507a" />
        <ellipse cx="14" cy="11.8" rx="11" ry="5" fill="#0083c4" />
        <ellipse cx="14" cy="6.6" rx="11" ry="5" fill="#7a5600" />
        <ellipse cx="14" cy="4.8" rx="11" ry="5" fill="#c28700" />
      </svg>
      Recount
    </Link>
  );
}
