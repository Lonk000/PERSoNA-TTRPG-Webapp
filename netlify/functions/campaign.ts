import type { Config } from "@netlify/functions";
import { loadCampaign, saveCampaignState } from "../../db/campaign.js";

export default async (req: Request) => {
  try {
    if (req.method === "GET") {
      return Response.json({ campaign: await loadCampaign(), role: "gm" });
    }

    if (req.method === "PUT") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return Response.json({ error: "Invalid campaign payload." }, { status: 400 });
      await saveCampaignState(body);
      return Response.json({ success: true, campaign: await loadCampaign() });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Campaign request failed", error);
    return Response.json({ error: "Unable to reach the campaign database." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/campaign",
};
