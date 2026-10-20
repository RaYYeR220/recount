import type { Metadata } from "next";
import { CountTool } from "@/components/count/CountTool";
import "@/styles/results.css";

export const metadata: Metadata = {
  title: "Count ranked ballots",
  description: "Paste ranked ballots, pick New York City, Minneapolis, Portland or Alaska rules, and count them round by round in your browser.",
};

export default function CountPage() {
  return (
    <div className="wrap page">
      <h1 className="display page-title">Count ranked ballots</h1>
      <p className="page-desc mb-8">
        Paste ballots, pick a city&apos;s rules and count them round by round, with the same engine that reproduces certified results. The same ballots can
        elect different people under different rules; the overvote example shows how.
      </p>
      <CountTool />
    </div>
  );
}
