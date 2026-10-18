import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Only image uploads are supported" }, { status: 400 });
  }

  const store = getStore("campaign-images");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;

  // Save the binary file to Blobs; its URL is what gets stored in Postgres.
  await store.set(fileName, file, { metadata: { contentType: file.type } });

  return Response.json({ url: `/api/images/${fileName}` });
};

export const config: Config = {
  path: "/api/upload",
};
