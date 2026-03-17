import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

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
    return res.status(500).json({ isPro: false });
  }
}
