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
      return res.status(400).json({ error: "Campaign state not found" });
    }

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

    return res.status(405).send("Method Not Allowed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}