ALTER TABLE "amppickem"."games" ADD COLUMN "live_spread" real;--> statement-breakpoint
ALTER TABLE "amppickem"."games" ADD COLUMN "live_over_under" real;--> statement-breakpoint
ALTER TABLE "amppickem"."games" ADD COLUMN "live_spread_home_odds" integer;--> statement-breakpoint
ALTER TABLE "amppickem"."games" ADD COLUMN "live_spread_away_odds" integer;--> statement-breakpoint
ALTER TABLE "amppickem"."games" ADD COLUMN "live_over_odds" integer;--> statement-breakpoint
ALTER TABLE "amppickem"."games" ADD COLUMN "live_under_odds" integer;