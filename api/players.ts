import { put, list } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PATHNAME = "campaign.json";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { blobs } = await list({ prefix: PATHNAME });
    const existingBlob = blobs.find((b) => b.pathname === PATHNAME);
    let campaignData: any = null;

    if (existingBlob) {
      const response = await fetch(`${existingBlob.url}?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (response.ok) campaignData = await response.json();
    }

    if (!campaignData) {
      campaignData = { players: [], calendar: {}, shadows: [], battle: {}, roam: {}, map: {} };
    }

    // 1. ADD NEW PLAYER (POST)
    if (req.method === "POST") {
      const newPlayer = {
        id: crypto.randomUUID(),
        name: `PC ${campaignData.players.length + 1}`,
        role: "Attacker",
        hp: 100,
        sp: 50,
        initial: "P",
        art: "",
        personaArt: ""
      };
      campaignData.players.push(newPlayer);

      await put(PATHNAME, JSON.stringify(campaignData), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return res.status(200).json({ campaign: campaignData, player: newPlayer });
    }

    // 2. UPDATE / PATCH PLAYER (PUT or PATCH)
    if (req.method === "PUT" || req.method === "PATCH") {
      const { id, ...patch } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: "Missing player ID for update" });
      }

      campaignData.players = campaignData.players.map((p: any) => 
        p.id === id ? { ...p, ...patch } : p
      );

      await put(PATHNAME, JSON.stringify(campaignData), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return res.status(200).json({ success: true, campaign: campaignData });
    }

    // 3. REMOVE PLAYER (DELETE)
    if (req.method === "DELETE") {
      const { id } = req.body || req.query || {};

      if (!id) {
        return res.status(400).json({ error: "Missing player ID for deletion" });
      }

      campaignData.players = campaignData.players.filter((p: any) => p.id !== id);

      await put(PATHNAME, JSON.stringify(campaignData), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return res.status(200).json({ success: true, campaign: campaignData });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}