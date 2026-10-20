/** Small status glyphs. Decorative: the word next to them carries the meaning. */

type IconProps = { className?: string };

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M2.5 6.3l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarnIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M6 1.5l5 9H1z" fill="currentColor" />
    </svg>
  );
}

export function CrossIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function DotIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Filled round glyphs for callouts and toasts (18px). */
export function MatchGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="8.5" fill="#2f7d4f" />
      <path d="M5 9.3l2.6 2.5L13 6.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="8.5" fill="#2c5f7c" />
      <path d="M9 8v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="5.4" r="1" fill="#fff" />
    </svg>
  );
}

export function WarnGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path d="M9 1.8l7.6 13.4H1.4z" fill="#8a5a00" />
      <path d="M9 7v4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="13.2" r="1" fill="#fff" />
    </svg>
  );
}

export function FailGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="8.5" fill="#a8321f" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" fill="currentColor" />
      <path d="M8 4.4v4.4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="1" fill="#fff" />
    </svg>
  );
}
