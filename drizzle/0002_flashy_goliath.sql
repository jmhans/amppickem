CREATE TABLE "amppickem"."payout_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"percentage" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payout_tiers_season_rank_uniq" UNIQUE("season_id","rank")
);
--> statement-breakpoint
ALTER TABLE "amppickem"."seasons" ADD COLUMN "entry_fee" real DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "amppickem"."seasons" ADD COLUMN "weekly_pot_per_week" real DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "amppickem"."seasons" ADD COLUMN "lost_picks_prize_amount" real DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "amppickem"."payout_tiers" ADD CONSTRAINT "payout_tiers_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "amppickem"."seasons"("id") ON DELETE cascade ON UPDATE no action;