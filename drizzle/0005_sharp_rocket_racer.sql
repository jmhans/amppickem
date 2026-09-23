CREATE TABLE "amppickem"."weekly_recaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"week" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amppickem"."weekly_recaps" ADD CONSTRAINT "weekly_recaps_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "amppickem"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weekly_recaps_season_week_idx" ON "amppickem"."weekly_recaps" USING btree ("season_id","week");