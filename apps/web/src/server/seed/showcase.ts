import { resolveLocal } from "../time";
import type { SeedPoll } from "./insert";

const DAY = 86_400_000;
const daysFrom = (now: Date, days: number) => new Date(now.getTime() + days * DAY);
const repeat = (count: number, ranking: string[]) => Array.from({ length: count }, () => ranking);

/**
 * Pizza leads round 1 with 6 of 13, but Sushi's three ballots all go to Tacos,
 * who wins round 2 with 7. Tacos is also the Condorcet winner; plurality would pick Pizza.
 */
export const LUNCH_BALLOTS = [
  ...repeat(3, ["Pizza", "Tacos"]),
  ...repeat(2, ["Pizza"]),
  ...repeat(1, ["Pizza", "Sushi"]),
  ...repeat(2, ["Tacos", "Sushi"]),
  ...repeat(2, ["Tacos", "Pizza"]),
  ...repeat(3, ["Sushi", "Tacos"]),
];

/**
 * Two seats, quota 7 of 20. Ana's 10 first choices elect her in round 1 and her
 * surplus of 3 moves at 0.3 a ballot: 1.8 to Ben and 1.2 to Cleo.
 */
export const COMMITTEE_BALLOTS = [
  ...repeat(6, ["Ana", "Ben"]),
  ...repeat(4, ["Ana", "Cleo"]),
  ...repeat(3, ["Ben", "Ana"]),
  ...repeat(1, ["Ben", "Eli"]),
  ...repeat(3, ["Cleo", "Dev"]),
  ...repeat(2, ["Dev", "Cleo"]),
  ...repeat(1, ["Eli", "Ben"]),
];

export function showcasePolls(now: Date): SeedPoll[] {
  const farFuture = new Date(Date.UTC(now.getUTCFullYear() + 5, 11, 31, 17));
  return [
    {
      slug: "offsite-2026",
      owner: "ada",
      title: "Team offsite location",
      description: "Where should the spring offsite go? Rank as many cities as you like.",
      options: ["Lisbon", "Kraków", "Tallinn", "Valencia"],
      seats: 1,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "Europe/Warsaw",
      createdAt: daysFrom(now, -3),
      opensAt: daysFrom(now, -3),
      closesAt: farFuture,
      ballots: [
        ["Lisbon", "Valencia"],
        ["Kraków", "Lisbon"],
        ["Lisbon"],
        ["Tallinn", "Kraków", "Lisbon"],
        ["Valencia", "Lisbon", "Kraków"],
      ],
    },
    {
      slug: "board-2026",
      owner: "ada",
      title: "Board election 2026",
      description: "Three seats, single transferable vote. Use the invite code from your email.",
      options: ["Amara Okafor", "Bram de Vries", "Chen Wei", "Dana Kowalski", "Elif Yılmaz", "Felix Moreau"],
      seats: 3,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "codes",
      resultsVisibility: "after_close",
      timeZone: "Europe/Berlin",
      createdAt: daysFrom(now, -7),
      opensAt: daysFrom(now, -6),
      closesAt: farFuture,
      ballots: [],
      unusedCodes: 40,
    },
    {
      slug: "lunch-closed",
      owner: "ada",
      title: "Lunch, closed",
      description: "Last week's lunch vote, kept open for anyone to recount.",
      options: ["Pizza", "Tacos", "Sushi"],
      seats: 1,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "Europe/Warsaw",
      createdAt: daysFrom(now, -10),
      opensAt: daysFrom(now, -10),
      closesAt: daysFrom(now, -9),
      ballots: LUNCH_BALLOTS,
    },
    {
      slug: "launch-2027",
      owner: "ada",
      title: "Product launch vote",
      description: "Pick the code name for the January launch.",
      options: ["Aurora", "Basalt", "Cinder", "Driftwood"],
      seats: 1,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "America/New_York",
      createdAt: daysFrom(now, -1),
      opensAt: resolveLocal("2027-01-15T12:00", "America/New_York").instant,
      closesAt: resolveLocal("2027-01-22T12:00", "America/New_York").instant,
      ballots: [],
    },
    {
      slug: "committee-2026",
      owner: "ada",
      title: "Residents' committee, 2 seats",
      description: "Two seats, single transferable vote with fractional surplus transfers.",
      options: ["Ana", "Ben", "Cleo", "Dev", "Eli"],
      seats: 2,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "link",
      resultsVisibility: "live",
      timeZone: "Europe/London",
      createdAt: daysFrom(now, -20),
      opensAt: daysFrom(now, -20),
      closesAt: daysFrom(now, -13),
      ballots: COMMITTEE_BALLOTS,
    },
    {
      slug: "rival-private",
      owner: "rival",
      title: "Rival's private poll",
      options: ["North", "South", "East", "West"],
      seats: 1,
      presetId: "recount-standard",
      maxRanks: null,
      accessMode: "link",
      resultsVisibility: "owner_only",
      timeZone: "UTC",
      createdAt: daysFrom(now, -2),
      opensAt: daysFrom(now, -2),
      closesAt: farFuture,
      ballots: [["North", "East"], ["South"], ["North"], ["West", "North"]],
    },
  ];
}
