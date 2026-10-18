// Route API requests directly to Netlify Functions (/api mapped via netlify.toml)
const API_BASE = "/api";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

// Simple local/custom auth helpers (if your Netlify function handles signup/signin)
export async function signUp(email: string, password: string) {
  return request("/signup", { 
    method: "POST", 
    body: JSON.stringify({ email, password }) 
  });
}

export async function signIn(email: string, password: string) {
  return request("/signin", { 
    method: "POST", 
    body: JSON.stringify({ email, password }) 
  });
}

// Campaign & Player endpoints (Postgres-backed via Netlify Database).
// Saving the campaign persists scene state, shadows and map pins; players are written through their own endpoints.
export const getCampaign = () => request("/campaign");
export const saveCampaign = (campaign: unknown) => request("/campaign", { method: "PUT", body: JSON.stringify(campaign) });
export const patchPlayer = (id: string, patch: unknown) => request(`/players/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const addPlayer = () => request("/players", { method: "POST" });
export const removePlayer = (id: string) => request(`/players/${id}`, { method: "DELETE" });

export async function uploadImage(file: File, scope: "gm" | "player") {
  const form = new FormData();
  form.append("file", file);
  form.append("scope", scope);
  return request("/upload", { method: "POST", body: form });
}