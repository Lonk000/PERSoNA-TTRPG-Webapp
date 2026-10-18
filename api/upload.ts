import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
  }

  const store = getStore("campaign-images");
  const fileName = `${Date.now()}-${file.name}`;
  
  // Save the binary file directly to blobs
  await store.set(fileName, file);

  // Return a URL pointing to your function or asset retrieval route
  const url = `/api/images/${fileName}`;

  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" }
  });
};