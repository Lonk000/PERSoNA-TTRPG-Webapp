import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Handle CORS preflight options
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    });
  }

  try {
    const url = new URL(req.url);
    
    // Parse incoming JSON body for mutations/posts
    let body = null;
    if (req.method === "POST" || req.method === "PUT") {
      body = await req.json().catch(() => null);
    }

    // --- YOUR BACKEND LOGIC GOES HERE ---
    // (Migrated over from your previous Supabase Edge Function logic)

    return Response.json(
      { 
        message: "Successfully connected to Netlify serverless backend!",
        path: url.pathname,
        receivedData: body 
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Internal Server Error" },
      { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
};

export const config: Config = {
  path: "/api/*",
};