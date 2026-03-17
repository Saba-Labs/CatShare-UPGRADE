import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { purchaseToken, productId, userId } = req.body;
  if (!purchaseToken || !productId || !userId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Set subscription active for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        platform: "android",
        product_id: productId,
        purchase_token: purchaseToken,
        status: "active",
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed" });
  }
}