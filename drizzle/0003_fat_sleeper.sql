CREATE TABLE "amppickem"."week_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"week" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_data" text NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "week_templates_season_week_uniq" UNIQUE("season_id","week")
);
--> statement-breakpoint
ALTER TABLE "amppickem"."week_templates" ADD CONSTRAINT "week_templates_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "amppickem"."seasons"("id") ON DELETE cascade ON UPDATE no action;