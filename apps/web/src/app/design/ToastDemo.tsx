"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, type ToastTone } from "@/components/ui/Toast";

const TOASTS: Array<{ id: string; tone: ToastTone; text: string }> = [
  { id: "created", tone: "match", text: "Poll created. The link is ready to share." },
  { id: "used", tone: "fail", text: "This code has already been used." },
  { id: "copied", tone: "info", text: "Receipt copied." },
];

/** The toasts, dismissable, with a way to bring them back. */
export function ToastDemo() {
  const [shown, setShown] = useState(TOASTS.map((t) => t.id));
  return (
    <div className="grid gap-3">
      {TOASTS.filter((t) => shown.includes(t.id)).map((t) => (
        <Toast key={t.id} tone={t.tone} onDismiss={() => setShown((s) => s.filter((id) => id !== t.id))}>
          {t.text}
        </Toast>
      ))}
      {shown.length < TOASTS.length ? (
        <Button variant="line" size="sm" className="justify-self-start" onClick={() => setShown(TOASTS.map((t) => t.id))}>
          Show them again
        </Button>
      ) : null}
    </div>
  );
}
