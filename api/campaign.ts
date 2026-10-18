import { put, list } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PATHNAME = "campaign.json";

const defaultCampaign = {
  calendar: { month: 0, season: 0, selectedDay: 0, weekStart: 1 },
  players: [],
  shadows: [
    { id: "1", name: "Shadow Igniter", hp: 100, threat: 5, status: "Normal" }
  ],
  battle: { background: "", objective: "Secure the corridor", round: 1 },
  roam: { background: "", location: "Central District", details: "A bustling alleyway.", points: [] },
  map: { background: "", pins: [] }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      let campaignData = null;

      try {
        // List blobs to see if campaign.json already exists
        const { blobs } = await list({ prefix: PATHNAME });
        const existingBlob = blobs.find((b) => b.pathname === PATHNAME);

        if (existingBlob) {
          // Fetch raw JSON bypassing CDN cache
          const response = await fetch(`${existingBlob.url}?t=${Date.now()}`, {
            headers: { "Cache-Control": "no-cache" },
          });
          if (response.ok) {
            campaignData = await response.json();
          }
        }
      } catch (e) {
        console.error("Error reading blob:", e);
      }

      // If no file exists or read failed, write default campaign state
      if (!campaignData) {
        campaignData = defaultCampaign;
        await put(PATHNAME, JSON.stringify(defaultCampaign), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        });
      }

      return res.status(200).json({ campaign: campaignData, role: "gm" });
    }

    if (req.method === "PUT") {
      const payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

      await put(PATHNAME, payload, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).send("Method Not Allowed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Campaign API Error:", message);
    return res.status(500).json({ error: message });
  }
}