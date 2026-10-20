CREATE TABLE "api_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "api_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"at" timestamp with time zone NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "ballot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"ranking" uuid[] NOT NULL,
	"receipt" text NOT NULL,
	"voter_token_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ballot_receipt_unique" UNIQUE("receipt")
);
--> statement-breakpoint
CREATE TABLE "invite_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"code" text NOT NULL,
	"used_at" timestamp with time zone,
	"ballot_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invite_code_poll_code_key" UNIQUE("poll_id","code")
);
--> statement-breakpoint
CREATE TABLE "poll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"preset_id" text NOT NULL,
	"max_ranks" integer,
	"access_mode" text NOT NULL,
	"results_visibility" text NOT NULL,
	"time_zone" text NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"closed_early_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"results_snapshot" jsonb,
	"cvr_sha256" text,
	CONSTRAINT "poll_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "poll_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "poll_option_position_key" UNIQUE("poll_id","position")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_code" ADD CONSTRAINT "invite_code_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_code" ADD CONSTRAINT "invite_code_ballot_id_ballot_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_token_user_idx" ON "api_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_event_poll_at_idx" ON "audit_event" USING btree ("poll_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "ballot_voter_token_key" ON "ballot" USING btree ("poll_id","voter_token_hash") WHERE "ballot"."voter_token_hash" is not null;--> statement-breakpoint
CREATE INDEX "ballot_poll_idx" ON "ballot" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_owner_created_idx" ON "poll" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");