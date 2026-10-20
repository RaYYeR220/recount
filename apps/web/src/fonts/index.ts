import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import localFont from "next/font/local";

/**
 * Clash Display (Fontshare, ITF Free Font License, see ClashDisplay-LICENSE.txt), served
 * from our own origin. The licence forbids sharing the files through a repository, so
 * scripts/fetch-fonts.mjs downloads them before dev and build.
 */
export const clashDisplay = localFont({
  src: [
    { path: "./ClashDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "./ClashDisplay-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-clash-face",
  display: "swap",
  fallback: ["Atkinson Hyperlegible Next", "system-ui", "sans-serif"],
});

export const atkinsonNext = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson-face",
  display: "swap",
  // next/font has no metrics to size a fallback for this family; system-ui is close.
  adjustFontFallback: false,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson-mono-face",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Cascadia Mono", "monospace"],
});

/** Class names that define the three --font-*-face variables; put them on <html>. */
export const fontVariables = [clashDisplay.variable, atkinsonNext.variable, atkinsonMono.variable].join(" ");
