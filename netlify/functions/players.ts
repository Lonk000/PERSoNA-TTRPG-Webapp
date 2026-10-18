import type { Config, Context } from "@netlify/functions";
import { createPlayer, deletePlayer, loadCampaign, updatePlayer } from "../../db/campaign.js";

export default async (req: Request, context: Context) => {
  const { id } = context.params;

  try {
    if (!id && req.method === "POST") {
      await createPlayer();
      return Response.json({ campaign: await loadCampaign() }, { status: 201 });
    }

    if (id && req.method === "PATCH") {
      const patch = await req.json().catch(() => null);
      if (!patch || typeof patch !== "object") return Response.json({ error: "Invalid player payload." }, { status: 400 });
      if (!(await updatePlayer(id, patch))) return Response.json({ error: "Player not found." }, { status: 404 });
      return Response.json({ campaign: await loadCampaign() });
    }

    if (id && req.method === "DELETE") {
      if (!(await deletePlayer(id))) return Response.json({ error: "Player not found." }, { status: 404 });
      return Response.json({ campaign: await loadCampaign() });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Player request failed", error);
    return Response.json({ error: "Unable to reach the campaign database." }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/players", "/api/players/:id"],
};
