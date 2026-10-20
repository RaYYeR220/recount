import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type CodeLanguage = "json" | "shell" | "text";

export type CodeBlockProps = {
  code: string;
  language?: CodeLanguage;
  /** Accessible name, e.g. "Example request". */
  label?: string;
  className?: string;
};

const TOKEN: Record<Exclude<CodeLanguage, "text">, RegExp> = {
  // keys, strings, numbers and literals
  json: /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g,
  // comments, quoted strings
  shell: /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'[^']*')/g,
};

function highlight(code: string, language: CodeLanguage): ReactNode[] {
  if (language === "text") return [code];
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN[language])) {
    const at = m.index;
    if (at > last) out.push(code.slice(last, at));
    if (language === "json") {
      const [whole, str, colon, num, lit] = m;
      if (str !== undefined) {
        out.push(
          <span key={at} className={colon ? "tok-key" : "tok-str"}>
            {str}
          </span>,
        );
        if (colon) out.push(colon);
      } else {
        out.push(
          <span key={at} className="tok-num">
            {num ?? lit ?? whole}
          </span>,
        );
      }
    } else {
      const [whole, comment] = m;
      out.push(
        <span key={at} className={comment ? "tok-comment" : "tok-str"}>
          {whole}
        </span>,
      );
    }
    last = at + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

/** Monospaced code on walnut with light highlighting for JSON and shell. */
export function CodeBlock({ code, language = "text", label, className }: CodeBlockProps) {
  return (
    <pre className={cx("codeblock", className)} aria-label={label} tabIndex={0}>
      <code>{highlight(code, language)}</code>
    </pre>
  );
}

/** Inline code inside running text. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cx("code-inline", className)}>{children}</code>;
}

/** A key on the keyboard. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
