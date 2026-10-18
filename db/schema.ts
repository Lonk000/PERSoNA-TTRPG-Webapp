import { doublePrecision, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type RoamPoint = { title: string; detail: string };

// One row per campaign: calendar, encounter, free-roam and map scene settings.
export const campaignState = pgTable("campaign_state", {
  id: text().primaryKey(),
  month: integer().notNull().default(0),
  season: integer().notNull().default(0),
  selectedDay: integer("selected_day").notNull().default(0),
  weekStart: integer("week_start").notNull().default(1),
  battleBackground: text("battle_background").notNull().default(""),
  battleObjective: text("battle_objective").notNull().default(""),
  battleRound: integer("battle_round").notNull().default(1),
  roamBackground: text("roam_background").notNull().default(""),
  roamLocation: text("roam_location").notNull().default(""),
  roamDetails: text("roam_details").notNull().default(""),
  roamPoints: jsonb("roam_points").$type<RoamPoint[]>().notNull().default([]),
  mapBackground: text("map_background").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: text().primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaignState.id, { onDelete: "cascade" }),
  name: text().notNull().default(""),
  role: text().notNull().default(""),
  hp: integer().notNull().default(0),
  sp: integer().notNull().default(0),
  initial: text().notNull().default(""),
  artUrl: text("art_url"),
  personaArtUrl: text("persona_art_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shadows = pgTable("shadows", {
  id: text().primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaignState.id, { onDelete: "cascade" }),
  name: text().notNull().default(""),
  hp: integer().notNull().default(100),
  threat: integer().notNull().default(1),
  status: text().notNull().default("Normal"),
  spriteUrl: text("sprite_url"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const mapPins = pgTable("map_pins", {
  id: text().primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaignState.id, { onDelete: "cascade" }),
  x: doublePrecision().notNull(),
  y: doublePrecision().notNull(),
  label: text().notNull().default(""),
  tooltip: text().notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});
