CREATE SCHEMA "amppickem";
--> statement-breakpoint
CREATE TABLE "amppickem"."games" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"week" integer NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"spread" real,
	"over_under" real,
	"lines_locked_at" timestamp,
	"home_score" integer,
	"away_score" integer,
	"status" text,
	"is_final" boolean DEFAULT false NOT NULL,
	"espn_game_id" text,
	"game_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_espn_game_id_unique" UNIQUE("espn_game_id")
);
--> statement-breakpoint
CREATE TABLE "amppickem"."participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"auth0_id" text,
	"hide_picks_until_lock" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amppickem"."picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"week" integer NOT NULL,
	"pick_type" text NOT NULL,
	"selection" text NOT NULL,
	"line_at_pick" real,
	"slot" integer,
	"result" text DEFAULT 'pending' NOT NULL,
	"graded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "picks_participant_game_type_uniq" UNIQUE("participant_id","game_id","pick_type")
);
--> statement-breakpoint
CREATE TABLE "amppickem"."seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"picks_per_week" integer DEFAULT 6 NOT NULL,
	"first_week" integer DEFAULT 1 NOT NULL,
	"last_week" integer DEFAULT 18 NOT NULL,
	"line_lock_day_of_week" integer DEFAULT 2 NOT NULL,
	"line_lock_hour" integer DEFAULT 7 NOT NULL,
	"line_lock_timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_year_unique" UNIQUE("year")
);
--> statement-breakpoint
CREATE TABLE "amppickem"."system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "amppickem"."games" ADD CONSTRAINT "games_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "amppickem"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amppickem"."picks" ADD CONSTRAINT "picks_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "amppickem"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amppickem"."picks" ADD CONSTRAINT "picks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "amppickem"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amppickem"."picks" ADD CONSTRAINT "picks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "amppickem"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_season_week_idx" ON "amppickem"."games" USING btree ("season_id","week");--> statement-breakpoint
CREATE INDEX "participants_auth0_id_idx" ON "amppickem"."participants" USING btree ("auth0_id");--> statement-breakpoint
CREATE INDEX "picks_participant_season_idx" ON "amppickem"."picks" USING btree ("participant_id","season_id");--> statement-breakpoint
CREATE INDEX "picks_season_week_idx" ON "amppickem"."picks" USING btree ("season_id","week");--> statement-breakpoint
CREATE INDEX "picks_game_idx" ON "amppickem"."picks" USING btree ("game_id");