import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const poll = pgTable(
  "poll",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    seats: integer("seats").notNull().default(1),
    presetId: text("preset_id").notNull(),
    maxRanks: integer("max_ranks"),
    accessMode: text("access_mode", { enum: ["link", "codes"] }).notNull(),
    resultsVisibility: text("results_visibility", {
      enum: ["live", "after_close", "owner_only"],
    }).notNull(),
    timeZone: text("time_zone").notNull(),
    opensAt: instant("opens_at"),
    closesAt: instant("closes_at"),
    closedEarlyAt: instant("closed_early_at"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    resultsSnapshot: jsonb("results_snapshot"),
    cvrSha256: text("cvr_sha256"),
  },
  (t) => [index("poll_owner_created_idx").on(t.ownerId, t.createdAt.desc())],
);

export const pollOption = pgTable(
  "poll_option",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [unique("poll_option_position_key").on(t.pollId, t.position)],
);

export const ballot = pgTable(
  "ballot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    ranking: uuid("ranking").array().notNull(),
    receipt: text("receipt").notNull().unique(),
    voterTokenHash: text("voter_token_hash"),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("ballot_voter_token_key")
      .on(t.pollId, t.voterTokenHash)
      .where(sql`${t.voterTokenHash} is not null`),
    index("ballot_poll_idx").on(t.pollId),
  ],
);

export const inviteCode = pgTable(
  "invite_code",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    usedAt: instant("used_at"),
    ballotId: uuid("ballot_id").references(() => ballot.id, { onDelete: "set null" }),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [unique("invite_code_poll_code_key").on(t.pollId, t.code)],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id").notNull(),
    type: text("type").notNull(),
    actorId: text("actor_id"),
    at: instant("at").notNull(),
    detail: jsonb("detail"),
  },
  (t) => [index("audit_event_poll_at_idx").on(t.pollId, t.at)],
);

export const apiToken = pgTable(
  "api_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: instant("created_at").notNull(),
    lastUsedAt: instant("last_used_at"),
  },
  (t) => [index("api_token_user_idx").on(t.userId)],
);

export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  windowStart: instant("window_start").notNull(),
  count: integer("count").notNull(),
});
