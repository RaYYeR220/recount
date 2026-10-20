import type { CaptionPart } from "@/lib/countScene";

/** A round caption with its headline in bold and its figures in brass. */
export function Caption({ parts }: { parts: readonly CaptionPart[] }) {
  return parts.map((part, i) =>
    part.tone === "lead" || part.tone === "strong" ? (
      <b key={i}>{part.text}</b>
    ) : part.tone === "figure" ? (
      <span key={i} className="n">
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}
