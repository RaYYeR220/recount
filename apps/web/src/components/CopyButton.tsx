"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Toast, ToastRegion, type ButtonSize, type ButtonVariant } from "@/components/ui";

export type CopyButtonProps = {
  text: string;
  /** The toast after copying, in the action's words: "Receipt copied." */
  done: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

const TOAST_MS = 3200;

/** Copies text to the clipboard and says so in a toast. */
export function CopyButton({ text, done, variant = "line", size, className, children }: CopyButtonProps) {
  const [toast, setToast] = useState<{ tone: "match" | "fail"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: "match", text: done });
    } catch {
      setToast({ tone: "fail", text: "Couldn't reach the clipboard. Select the text and copy it instead." });
    }
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={copy}>
        {children}
      </Button>
      {toast ? (
        <ToastRegion>
          <Toast tone={toast.tone} onDismiss={() => setToast(null)}>
            {toast.text}
          </Toast>
        </ToastRegion>
      ) : null}
    </>
  );
}
