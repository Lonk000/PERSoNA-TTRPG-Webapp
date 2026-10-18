import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const store = getStore("campaign-store");
  const key = "main-campaign";

  if (req.method === "GET") {
    let campaignData = await store.get(key, { type: "json" });

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
      await store.setJSON(key, campaignData);
    }

    return new Response(JSON.stringify({ campaign: campaignData, role: "gm" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "PUT") {
    const body = await req.json();
    await store.setJSON(key, body);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};