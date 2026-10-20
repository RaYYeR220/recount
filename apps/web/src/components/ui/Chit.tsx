import { chitStyle, type ChitKey } from "@/lib/optionColour";

const SIZES = { xs: 12, sm: 14, md: 20, lg: 28, xl: 44 } as const;

export type ChitSize = keyof typeof SIZES | number;

export type ChitProps = {
  /** Option position on the ballot (0-based), or a neutral chit. */
  index: ChitKey;
  /** xs 12, sm 14 (default), md 20, lg 28, xl 44, or pixels. */
  size?: ChitSize;
  /** Accessible name. Leave it out when the option name is printed next to the chit. */
  label?: string;
  className?: string;
};

const CIRC = 2 * Math.PI * 16;

/** A ballot chit seen from above, in the option's colour. */
export function Chit({ index, size = "sm", label, className }: ChitProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  const style = chitStyle(index);
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  const seed = typeof index === "number" ? index + 1 : 0;

  let face;
  if (style.faceDown) {
    face = (
      <>
        <circle cx="22" cy="21" r="17" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.4" />
        <circle cx="22" cy="21" r="7.5" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.4" />
        {index === "exhausted" ? <path d="M15 28l14-14" stroke="rgba(255,255,255,.22)" strokeWidth="2" strokeLinecap="round" /> : null}
      </>
    );
  } else if (style.pen) {
    face = (
      <>
        <circle cx="22" cy="21" r="14" fill="none" stroke={style.ring} />
        <path d="M13 22c4-8 6 7 10 0s5 6 8-1" fill="none" stroke="rgba(40,36,90,.75)" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  } else {
    const segments = style.tier === 1 ? 10 : 6;
    const dash = (CIRC / segments) * (style.tier === 1 ? 0.32 : 0.4);
    face = (
      <>
        <circle
          cx="22"
          cy="21"
          r="16"
          fill="none"
          stroke={style.inlay}
          strokeWidth={style.tier === 1 ? 3.4 : 4.6}
          strokeDasharray={`${dash.toFixed(2)} ${(CIRC / segments - dash).toFixed(2)}`}
          transform={`rotate(${seed * 17} 22 21)`}
        />
        <circle cx="22" cy="21" r="11" fill="none" stroke="rgba(0,0,0,.25)" />
        {style.tier === 2 ? <circle cx="22" cy="21" r="8" fill="none" stroke={style.inlay} strokeWidth="1.6" /> : null}
      </>
    );
  }

  return (
    <svg
      viewBox="0 0 44 44"
      width={px}
      height={px}
      className={className ? `chit ${className}` : "chit"}
      {...a11y}
    >
      <circle cx="22" cy="23" r="20" fill={style.side} />
      <circle cx="22" cy="21" r="20" fill={style.face} />
      {face}
      <circle cx="17" cy="15" r="7" fill="rgba(255,248,230,.16)" />
      <circle cx="22" cy="21" r="19.5" fill="none" stroke="rgba(0,0,0,.25)" />
    </svg>
  );
}
