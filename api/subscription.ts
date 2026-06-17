// api/subscription.ts — Pro entitlement: paid subscription OR 14-day trial from account creation
import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUserFromRequest } from "../lib/supabaseAuthRequest.js";
import {
  computePaidPro,
  computeTrialEndsAtIso,
  computeHasProAccess,
  isTrialPeriodActive,
  TRIAL_DAYS,
} from "../lib/subscriptionEntitlement.mjs";

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
  if (authResult.ok === false) {
    return res.status(401).json({ error: authResult.error });
  }
  const userId = authResult.userId;

  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId);
    if (authErr || !authData?.user) {
      console.error("subscription: getUserById failed", authErr);
      return res.status(500).json({ error: "Could not load user" });
    }

    const trialEndsAt = computeTrialEndsAtIso(authData.user.created_at);

    const { data: subRow, error: subErr } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr) throw subErr;

    const paidPro = computePaidPro(subRow);
    const isPro = computeHasProAccess({ paidPro, trialEndsAtIso: trialEndsAt });
    const isTrialActive = !paidPro && isTrialPeriodActive(trialEndsAt);

    return res.status(200).json({
      isPro,
      isPaidPro: paidPro,
      isTrialActive,
      trialEndsAt,
      trialDays: TRIAL_DAYS,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load subscription" });
  }
}
