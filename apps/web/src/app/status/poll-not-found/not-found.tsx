import type { Metadata } from "next";
import { NotFoundPoll } from "@/components/NotFoundPoll";

export const metadata: Metadata = { title: "Poll not found" };

export default function PollNotFound() {
  return <NotFoundPoll />;
}
