import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

// Serves images uploaded through /api/upload. Image files stay in Blobs; Postgres stores their URLs.
export default async (_req: Request, context: Context) => {
  const blob = await getStore("campaign-images").getWithMetadata(context.params.key, { type: "stream" });
  if (!blob) return new Response("Not found", { status: 404 });

  return new Response(blob.data, {
    headers: {
      "Content-Type": (blob.metadata?.contentType as string) || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/images/:key",
  method: "GET",
};
