import { put, head } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PATHNAME = "campaign.json";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      let campaignData = null;

      try {
        // Fetch metadata to check if the JSON blob exists
        const blobMeta = await head(PATHNAME);
        
        if (blobMeta?.url) {
          // Fetch raw JSON bypassing browser/CDN cache
          const response = await fetch(`${blobMeta.url}?t=${Date.now()}`, {
            headers: { "Cache-Control": "no-cache" },
          });
          campaignData = await response.json();
        }
      } catch {
        // Blob does not exist yet; will fall back to initial default state below
      }

      // Default fallback campaign state if blob hasn't been created
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

        // Write default state blob
        await put(PATHNAME, JSON.stringify(campaignData), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        });
      }

      return res.status(200).json({ campaign: campaignData, role: "gm" });
    }

    if (req.method === "PUT") {
      const payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

      // Overwrite the campaign.json blob
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
    return res.status(500).json({ error: message });
  }
}