import type { PresetId } from "../polls/schema";
import type { SeedPoll } from "./insert";
import { prng } from "./random";

export const GENERATED_POLLS = 115;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const TOPICS: Array<{ title: string; options: string[]; seats?: number }> = [
  { title: "Team lunch", options: ["Pizza", "Tacos", "Sushi", "Ramen", "Salad bar"] },
  { title: "Book club pick", options: ["Piranesi", "The Overstory", "Klara and the Sun", "Project Hail Mary"] },
  { title: "Hackathon theme", options: ["Climate", "Health", "Civic tech", "Education"] },
  { title: "Office playlist", options: ["Jazz", "Lo-fi", "Synthwave", "Classical", "Indie"] },
  { title: "Offsite activity", options: ["Escape room", "Cooking class", "Kayaking", "Board games"] },
  { title: "Release name", options: ["Aspen", "Comet", "Ember", "Juniper", "Quartz"] },
  { title: "Retro format", options: ["Start, stop, continue", "Sailboat", "Mad, sad, glad", "4Ls"] },
  { title: "Coffee beans", options: ["Ethiopia", "Colombia", "Kenya", "Guatemala"] },
  { title: "Team mascot", options: ["Otter", "Fox", "Heron", "Lynx"] },
  { title: "Movie night", options: ["Arrival", "Paddington 2", "Spirited Away", "The Martian", "Knives Out"] },
  { title: "Standup time", options: ["9:00", "9:30", "10:00", "10:30"] },
  { title: "Charity to support", options: ["Food bank", "Animal shelter", "Literacy project", "Tree planting"] },
  { title: "Holiday party venue", options: ["Rooftop bar", "Bowling alley", "Karaoke", "Restaurant"] },
  { title: "Logo direction", options: ["Wordmark", "Monogram", "Abstract mark", "Illustrated"] },
  { title: "Club president", options: ["Maya", "Jonah", "Priya", "Lucas"] },
  { title: "Park upgrade", options: ["Playground", "Dog run", "Community garden", "Basketball court"] },
  { title: "Board game night", options: ["Catan", "Wingspan", "Codenames", "Azul", "Ticket to Ride"] },
  { title: "Design system name", options: ["Atlas", "Beacon", "Canvas", "Prism"] },
  { title: "Demo day", options: ["Monday", "Wednesday", "Thursday", "Friday"] },
  { title: "Study group topic", options: ["Graphs", "Dynamic programming", "Probability", "Linear algebra"] },
  { title: "Swag item", options: ["Hoodie", "Mug", "Tote bag", "Stickers", "Socks"] },
  { title: "Garden committee", options: ["Ana", "Ben", "Chloe", "Diego", "Emma", "Farah"], seats: 2 },
  { title: "Volunteer coordinators", options: ["Grace", "Hiro", "Ines", "Jamal", "Kira"], seats: 2 },
];

const ZONES = ["Europe/Warsaw", "America/New_York", "UTC", "Asia/Tokyo", "Europe/London"];
const SINGLE_WINNER_PRESETS: PresetId[] = ["recount-standard", "nyc", "minneapolis-irv", "recount-standard"];
const STATUSES = ["open", "closed", "scheduled"] as const;
const VISIBILITY = ["live", "after_close", "owner_only"] as const;

function ballotsFor(index: number, options: string[], maxRanks: number | null): string[][] {
  const random = prng(index + 1);
  const popularity = new Map(options.map((o) => [o, random() * 3]));
  const count = 7 + ((index * 7) % 29);
  const deepest = Math.min(maxRanks ?? options.length, options.length);
  return Array.from({ length: count }, () => {
    const scored = options.map((o) => ({ o, score: popularity.get(o)! + random() * 2.5 }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 1 + Math.floor(random() * deepest)).map((s) => s.o);
  });
}

/** 115 polls spread evenly over status, preset, access mode and visibility, oldest first. */
export function generatedPolls(now: Date): SeedPoll[] {
  return Array.from({ length: GENERATED_POLLS }, (_, i): SeedPoll => {
    const topic = TOPICS[i % TOPICS.length];
    const status = STATUSES[i % 3];
    const multiSeat = topic.seats !== undefined;
    const presetId: PresetId = multiSeat ? (i % 2 === 0 ? "recount-standard" : "portland-stv") : SINGLE_WINNER_PRESETS[i % 4];
    const maxRanks = presetId === "minneapolis-irv" ? 3 : null;
    const accessMode = i % 2 === 0 ? "link" : "codes";
    const createdAt = new Date(now.getTime() - (GENERATED_POLLS + 5 - i) * 8 * HOUR);

    let opensAt = new Date(createdAt.getTime() + HOUR);
    let closesAt: Date | null = new Date(now.getTime() + (7 + (i % 30)) * DAY);
    let closedEarlyAt: Date | undefined;
    if (status === "scheduled") {
      opensAt = new Date(now.getTime() + (3 + (i % 20)) * DAY);
      closesAt = new Date(opensAt.getTime() + 7 * DAY);
    } else if (status === "closed" && i % 2 === 0) {
      closesAt = new Date(createdAt.getTime() + DAY);
    } else if (status === "closed") {
      closedEarlyAt = new Date(createdAt.getTime() + 20 * HOUR);
    } else if (i % 5 === 0) {
      closesAt = null;
    }

    return {
      slug: `ada-${String(i + 1).padStart(3, "0")}`,
      owner: "ada",
      title: `${topic.title} #${Math.floor(i / TOPICS.length) + 1}`,
      options: topic.options,
      seats: multiSeat ? 2 + (i % 2) : 1,
      presetId,
      maxRanks,
      accessMode,
      resultsVisibility: VISIBILITY[Math.floor(i / 6) % 3],
      timeZone: ZONES[i % ZONES.length],
      createdAt,
      opensAt,
      closesAt,
      closedEarlyAt,
      ballots: status === "closed" ? ballotsFor(i, topic.options, maxRanks) : [],
      unusedCodes: accessMode === "codes" ? (status === "closed" ? 3 : 12) : 0,
    };
  });
}
