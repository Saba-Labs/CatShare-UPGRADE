/**
 * Verify Supabase JWT from Authorization: Bearer <access_token>
 * Server-only — used by Vercel /api routes. Lives outside /api so the bundler inlines it.
 */
import { createClient, User } from "@supabase/supabase-js";

export type SupabaseAuthResult =
  | { ok: true; user: User; userId: string }
  | { ok: false; error: string };

export async function getSupabaseUserFromRequest(
  authHeader: string | undefined
): Promise<SupabaseAuthResult> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or malformed Authorization header" };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, error: "Missing token" };
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return { ok: false, error: "Server configuration error" };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, error: "Invalid or expired token" };
  }
  return { ok: true, user: data.user, userId: data.user.id };
}
