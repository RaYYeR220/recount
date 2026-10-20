import { Audit } from "@/components/landing/Audit";
import { CountLesson } from "@/components/landing/CountLesson";
import { Developers } from "@/components/landing/Developers";
import { Hero } from "@/components/landing/Hero";
import { Replays } from "@/components/landing/Replays";
import { RunPoll } from "@/components/landing/RunPoll";
import { Tests } from "@/components/landing/Tests";

/** Every figure on this page is counted by the engine while the page is built. */
export default function Home() {
  return (
    <>
      <Hero />
      <CountLesson />
      <RunPoll />
      <Audit />
      <Replays />
      <Tests />
      <Developers />
    </>
  );
}
