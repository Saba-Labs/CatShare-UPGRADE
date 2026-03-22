// api/subscription.ts — Pro entitlement from Supabase (user id = Supabase auth UUID)
import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUserFromRequest } from "./_supabaseAuth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authResult = await getSupabaseUserFromRequest(req.headers.authorization);
  if (!authResult.ok) {
    return res.status(401).json({ error: authResult.error });
  }
  const userId = authResult.userId;

  try {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("status, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;

    const isPro = !!data && new Date(data.expires_at) > new Date();
    return res.status(200).json({ isPro });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load subscription" });
  }
}
