import { kv } from "@vercel/kv";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const KEY = "main-campaign";

  try {
    if (req.method === "GET") {
      let campaignData = await kv.get(KEY);

      // Fallback default campaign data if none exists yet
      if (!campaignData) {
        campaignData = {
          calendar: { month: 0, season: 0, selectedDay: 0, weekStart: 1 },
          players: [],
          shadows: [
            { id: "1", name: "Shadow Igniter", hp: 100, threat: 5, status: "Normal" }
          ],
          battle: { background: "", objective: "Secure the corridor", round: 1 },
          roam: { background: "", location: "Central District", details: "A bustling alleyway.", points: [] },
          map: { background: "", pins: [] }
        };
        await kv.set(KEY, campaignData);
      }

      return res.status(200).json({ campaign: campaignData, role: "gm" });
    }

    if (req.method === "PUT") {
      await kv.set(KEY, req.body);
      return res.status(200).json({ success: true });
    }

    return res.status(405).send("Method Not Allowed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: message });
  }
}