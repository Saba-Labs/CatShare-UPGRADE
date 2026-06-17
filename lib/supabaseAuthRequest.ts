/**
 * Verify Supabase JWT from Authorization: Bearer <access_token>
 * Server-only — used by Vercel /api routes. Lives outside /api so the bundler inlines it.
 */
type SupabaseAuthUser = {
  id: string;
  created_at: string;
  email?: string;
  [key: string]: unknown;
};

export type SupabaseAuthResult =
  | { ok: true; user: SupabaseAuthUser; userId: string }
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

  const authUrl = `${url.replace(/\/+$/, "")}/auth/v1/user`;
  const response = await fetch(authUrl, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const user = (await response.json()) as SupabaseAuthUser | null;
  if (!user?.id) {
    return { ok: false, error: "Invalid or expired token" };
  }

  return { ok: true, user, userId: user.id };
}
