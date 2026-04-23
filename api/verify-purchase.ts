/// <reference types="node" />
import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const androidPublisher = google.androidpublisher("v3");

async function getGoogleAuthClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!),
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return auth.getClient();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { purchaseToken, productId, userId } = req.body;
  if (!purchaseToken || !productId || !userId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // ✅ Verify purchase with Google Play
    const auth = await getGoogleAuthClient();
    const response = await (androidPublisher.purchases.subscriptions.get as any)({
      auth,
      packageName: process.env.ANDROID_PACKAGE_NAME!,
      subscriptionId: productId,
      token: purchaseToken,
    });

    const subscription = response.data;
    if (!subscription) {
      return res.status(400).json({ error: "Subscription details not found" });
    }

    // ✅ Check if payment is valid (paymentState 1 = received, 2 = free trial)
    if (
      subscription.paymentState !== undefined &&
      subscription.paymentState !== 1 &&
      subscription.paymentState !== 2
    ) {
      return res.status(400).json({ error: "Payment not completed" });
    }

    // ✅ Use real expiry from Google Play
    if (!subscription.expiryTimeMillis) {
      return res.status(400).json({ error: "Missing subscription expiry from Google Play" });
    }
    const expiresAt = new Date(Number(subscription.expiryTimeMillis));

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
    return res.status(500).json({ error: "Failed to verify purchase" });
  }
}