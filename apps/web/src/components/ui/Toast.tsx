"use client";

import type { ReactNode } from "react";

export type ToastTone = "match" | "fail" | "info";

export type ToastProps = {
  tone?: ToastTone;
  /** Shows a close button when set. */
  onDismiss?: () => void;
  children: ReactNode;
};

const GLYPH: Record<ToastTone, ReactNode> = {
  match: (
    <svg viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="#8fd3a6" />
      <path d="M6.5 11.3l3 2.9 6-6.2" fill="none" stroke="#172a1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  fail: (
    <svg viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="#ff9c86" />
      <path d="M11 6.5v6" stroke="#3a0f07" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="15.6" r="1.2" fill="#3a0f07" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="#e6cd85" />
      <path d="M11 10v5.5" stroke="#2a1a0c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="6.8" r="1.2" fill="#2a1a0c" />
    </svg>
  ),
};

/** Confirms what happened, in the action's own words: "Receipt copied." */
export function Toast({ tone = "match", onDismiss, children }: ToastProps) {
  return (
    <div className="toast" role={tone === "fail" ? "alert" : "status"}>
      {GLYPH[tone]}
      <p>{children}</p>
      {onDismiss ? (
        <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/** Fixed corner that stacks toasts above the page. */
export function ToastRegion({ children }: { children: ReactNode }) {
  return <div className="toast-region">{children}</div>;
}
