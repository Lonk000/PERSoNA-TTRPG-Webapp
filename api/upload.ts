import { put } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({});
    
    const [_, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const fileArray = files.file;
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = `${Date.now()}-${file.originalFilename || "upload"}`;

    const blob = await put(fileName, fileBuffer, {
      access: "public",
      contentType: file.mimetype || "application/octet-stream",
      allowOverwrite: true,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed";
    console.error("Upload API Error:", message);
    return res.status(500).json({ error: message });
  }
}