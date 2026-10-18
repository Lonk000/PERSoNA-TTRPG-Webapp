import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../utils/supabase/info";

export const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
const base = `https://${projectId}.supabase.co/functions/v1/make-server-d290f444`;

async function request(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export async function signUp(email: string, password: string) {
  await request("/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

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
