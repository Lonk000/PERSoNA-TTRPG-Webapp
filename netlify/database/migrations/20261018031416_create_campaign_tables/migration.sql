CREATE TABLE "campaign_state" (
	"id" text PRIMARY KEY,
	"month" integer DEFAULT 0 NOT NULL,
	"season" integer DEFAULT 0 NOT NULL,
	"selected_day" integer DEFAULT 0 NOT NULL,
	"week_start" integer DEFAULT 1 NOT NULL,
	"battle_background" text DEFAULT '' NOT NULL,
	"battle_objective" text DEFAULT '' NOT NULL,
	"battle_round" integer DEFAULT 1 NOT NULL,
	"roam_background" text DEFAULT '' NOT NULL,
	"roam_location" text DEFAULT '' NOT NULL,
	"roam_details" text DEFAULT '' NOT NULL,
	"roam_points" jsonb DEFAULT '[]' NOT NULL,
	"map_background" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_pins" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"tooltip" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"hp" integer DEFAULT 0 NOT NULL,
	"sp" integer DEFAULT 0 NOT NULL,
	"initial" text DEFAULT '' NOT NULL,
	"art_url" text,
	"persona_art_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shadows" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"hp" integer DEFAULT 100 NOT NULL,
	"threat" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'Normal' NOT NULL,
	"sprite_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_pins" ADD CONSTRAINT "map_pins_campaign_id_campaign_state_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign_state"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_campaign_id_campaign_state_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign_state"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shadows" ADD CONSTRAINT "shadows_campaign_id_campaign_state_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign_state"("id") ON DELETE CASCADE;