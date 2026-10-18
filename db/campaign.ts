import { getStore } from "@netlify/blobs";
import { asc, eq } from "drizzle-orm";
import { db } from "./index.js";
import { campaignState, mapPins, players, shadows, type RoamPoint } from "./schema.js";

export const CAMPAIGN_ID = "main-campaign";

export type Player = { id: string; name: string; role: string; hp: number; sp: number; initial: string; art?: string; personaArt?: string };
export type Shadow = { id: string; name: string; hp: number; threat: number; status: string; sprite?: string };
export type Pin = { id: string; x: number; y: number; label: string; tooltip: string };
export type Campaign = {
  calendar: { month: number; season: number; selectedDay: number; weekStart: number };
  players: Player[];
  shadows: Shadow[];
  battle: { background: string; objective: string; round: number };
  roam: { background: string; location: string; details: string; points: RoamPoint[] };
  map: { background: string; pins: Pin[] };
};

const defaultCampaign: Campaign = {
  calendar: { month: 0, season: 0, selectedDay: 0, weekStart: 1 },
  players: [],
  shadows: [{ id: "1", name: "Shadow Igniter", hp: 100, threat: 5, status: "Normal" }],
  battle: { background: "", objective: "Secure the corridor", round: 1 },
  roam: { background: "", location: "Central District", details: "A bustling alleyway.", points: [] },
  map: { background: "", pins: [] },
};

const int = (value: unknown, fallback: number) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback);
const num = (value: unknown, fallback: number) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const optionalStr = (value: unknown) => (typeof value === "string" && value ? value : null);
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

function stateRow(input: any) {
  const calendar = input?.calendar ?? {};
  const battle = input?.battle ?? {};
  const roam = input?.roam ?? {};
  const map = input?.map ?? {};
  return {
    month: int(calendar.month, 0),
    season: int(calendar.season, 0),
    selectedDay: int(calendar.selectedDay, 0),
    weekStart: int(calendar.weekStart, 1),
    battleBackground: str(battle.background),
    battleObjective: str(battle.objective),
    battleRound: int(battle.round, 1),
    roamBackground: str(roam.background),
    roamLocation: str(roam.location),
    roamDetails: str(roam.details),
    roamPoints: list(roam.points).map((point) => ({ title: str(point?.title), detail: str(point?.detail) })),
    mapBackground: str(map.background),
    updatedAt: new Date(),
  };
}

const shadowRows = (input: unknown) =>
  list(input).map((shadow, index) => ({
    id: str(shadow?.id) || crypto.randomUUID(),
    campaignId: CAMPAIGN_ID,
    name: str(shadow?.name),
    hp: int(shadow?.hp, 100),
    threat: int(shadow?.threat, 1),
    status: str(shadow?.status, "Normal"),
    spriteUrl: optionalStr(shadow?.sprite),
    sortOrder: index,
  }));

const pinRows = (input: unknown) =>
  list(input).map((pin, index) => ({
    id: str(pin?.id) || crypto.randomUUID(),
    campaignId: CAMPAIGN_ID,
    x: num(pin?.x, 0),
    y: num(pin?.y, 0),
    label: str(pin?.label),
    tooltip: str(pin?.tooltip),
    sortOrder: index,
  }));

const playerRows = (input: unknown) =>
  list(input).map((player, index) => ({
    id: str(player?.id) || crypto.randomUUID(),
    campaignId: CAMPAIGN_ID,
    name: str(player?.name),
    role: str(player?.role),
    hp: int(player?.hp, 0),
    sp: int(player?.sp, 0),
    initial: str(player?.initial),
    artUrl: optionalStr(player?.art),
    personaArtUrl: optionalStr(player?.personaArt),
    sortOrder: index,
  }));

// Creates the campaign on first use, importing any state previously kept in Netlify Blobs.
async function ensureCampaign() {
  const [existing] = await db.select({ id: campaignState.id }).from(campaignState).where(eq(campaignState.id, CAMPAIGN_ID));
  if (existing) return;

  let seed: any = defaultCampaign;
  try {
    const legacy = await getStore("campaign-store").get(CAMPAIGN_ID, { type: "json" });
    if (legacy) seed = legacy;
  } catch {
    // No legacy store available; start from the defaults.
  }

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(campaignState)
      .values({ id: CAMPAIGN_ID, ...stateRow(seed) })
      .onConflictDoNothing()
      .returning({ id: campaignState.id });
    if (!inserted.length) return;
    const seedPlayers = playerRows(seed.players);
    const seedShadows = shadowRows(seed.shadows);
    const seedPins = pinRows(seed.map?.pins);
    if (seedPlayers.length) await tx.insert(players).values(seedPlayers);
    if (seedShadows.length) await tx.insert(shadows).values(seedShadows);
    if (seedPins.length) await tx.insert(mapPins).values(seedPins);
  });
}

export async function loadCampaign(): Promise<Campaign> {
  await ensureCampaign();
  const [[state], playerList, shadowList, pinList] = await Promise.all([
    db.select().from(campaignState).where(eq(campaignState.id, CAMPAIGN_ID)),
    db.select().from(players).where(eq(players.campaignId, CAMPAIGN_ID)).orderBy(asc(players.sortOrder), asc(players.createdAt)),
    db.select().from(shadows).where(eq(shadows.campaignId, CAMPAIGN_ID)).orderBy(asc(shadows.sortOrder)),
    db.select().from(mapPins).where(eq(mapPins.campaignId, CAMPAIGN_ID)).orderBy(asc(mapPins.sortOrder)),
  ]);

  return {
    calendar: { month: state.month, season: state.season, selectedDay: state.selectedDay, weekStart: state.weekStart },
    players: playerList.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      hp: player.hp,
      sp: player.sp,
      initial: player.initial,
      ...(player.artUrl ? { art: player.artUrl } : {}),
      ...(player.personaArtUrl ? { personaArt: player.personaArtUrl } : {}),
    })),
    shadows: shadowList.map((shadow) => ({
      id: shadow.id,
      name: shadow.name,
      hp: shadow.hp,
      threat: shadow.threat,
      status: shadow.status,
      ...(shadow.spriteUrl ? { sprite: shadow.spriteUrl } : {}),
    })),
    battle: { background: state.battleBackground, objective: state.battleObjective, round: state.battleRound },
    roam: { background: state.roamBackground, location: state.roamLocation, details: state.roamDetails, points: state.roamPoints },
    map: { background: state.mapBackground, pins: pinList.map(({ id, x, y, label, tooltip }) => ({ id, x, y, label, tooltip })) },
  };
}

// Saves the GM-controlled scene state. Players are managed through their own endpoints
// so a GM autosave never overwrites a player's concurrent HP/SP or art changes.
export async function saveCampaignState(input: any) {
  await ensureCampaign();
  const shadowList = shadowRows(input?.shadows);
  const pinList = pinRows(input?.map?.pins);
  await db.transaction(async (tx) => {
    await tx.update(campaignState).set(stateRow(input)).where(eq(campaignState.id, CAMPAIGN_ID));
    await tx.delete(shadows).where(eq(shadows.campaignId, CAMPAIGN_ID));
    await tx.delete(mapPins).where(eq(mapPins.campaignId, CAMPAIGN_ID));
    if (shadowList.length) await tx.insert(shadows).values(shadowList);
    if (pinList.length) await tx.insert(mapPins).values(pinList);
  });
}

export async function createPlayer() {
  await ensureCampaign();
  const existing = await db.select({ id: players.id }).from(players).where(eq(players.campaignId, CAMPAIGN_ID));
  await db.insert(players).values({
    id: crypto.randomUUID(),
    campaignId: CAMPAIGN_ID,
    name: "NEW PC",
    role: "ROLE",
    hp: 100,
    sp: 50,
    initial: "N",
    sortOrder: existing.length,
  });
}

export async function updatePlayer(id: string, patch: any) {
  const changes: Partial<typeof players.$inferInsert> = {};
  if (typeof patch?.name === "string") {
    changes.name = patch.name;
    changes.initial = patch.name.trim().charAt(0).toUpperCase();
  }
  if (typeof patch?.role === "string") changes.role = patch.role;
  if (patch?.hp !== undefined) changes.hp = Math.max(0, int(patch.hp, 0));
  if (patch?.sp !== undefined) changes.sp = Math.max(0, int(patch.sp, 0));
  if (patch?.art !== undefined) changes.artUrl = optionalStr(patch.art);
  if (patch?.personaArt !== undefined) changes.personaArtUrl = optionalStr(patch.personaArt);
  if (!Object.keys(changes).length) return true;

  const updated = await db
    .update(players)
    .set(changes)
    .where(eq(players.id, id))
    .returning({ id: players.id });
  return updated.length > 0;
}

export async function deletePlayer(id: string) {
  const deleted = await db.delete(players).where(eq(players.id, id)).returning({ id: players.id });
  return deleted.length > 0;
}
