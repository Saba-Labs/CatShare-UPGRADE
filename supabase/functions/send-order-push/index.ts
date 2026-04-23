/**
 * Supabase Edge Function: on new order (via Database Webhook), send FCM to seller devices.
 *
 * Secrets: FIREBASE_SERVICE_ACCOUNT_JSON, ORDER_PUSH_WEBHOOK_SECRET
 * Auto: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { JWT } from "npm:google-auth-library@9.14.2";

const WEBHOOK_SECRET_HEADER = "x-catshare-secret";

async function getFcmAccessToken(
  serviceAccount: Record<string, unknown>,
): Promise<{ token: string; projectId: string }> {
  const email = String(serviceAccount.client_email ?? "");
  const key = String(serviceAccount.private_key ?? "");
  const projectId = String(serviceAccount.project_id ?? "");
  if (!email || !key || !projectId) {
    throw new Error("Invalid service account JSON (client_email, private_key, project_id)");
  }
  const client = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const access = await client.getAccessToken();
  if (!access.token) throw new Error("Failed to get FCM access token");
  return { token: access.token, projectId };
}

async function sendFcmToDevice(
  fcmToken: string,
  title: string,
  body: string,
  orderId: string,
  accessToken: string,
  projectId: string,
): Promise<{ ok: boolean; permanentInvalid: boolean; status?: number; errorText?: string }> {
  const url =
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "catshare_new_orders",
            sound: "default",
          },
        },
        data: {
          type: "new_order",
          orderId: String(orderId),
        },
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    const lower = t.toLowerCase();
    const permanentInvalid =
      lower.includes("unregistered") ||
      lower.includes("requested entity was not found") ||
      lower.includes("invalid registration token") ||
      (res.status === 404 && lower.includes("not_found"));
    console.error("FCM send failed", res.status, t.slice(0, 500));
    return { ok: false, permanentInvalid, status: res.status, errorText: t };
  }
  return { ok: true, permanentInvalid: false };
}

function shouldNotify(orderSource: unknown): boolean {
  return String(orderSource ?? "") !== "manual";
}

function formatBody(record: Record<string, unknown>): string {
  const name = String(record.customer_name ?? "Customer").trim() || "Customer";
  const amt = record.total_amount;
  const currency = String(record.currency_code ?? "INR");
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  if (amt != null && Number.isFinite(Number(amt))) {
    const n = Number(amt).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${name} · ${sym}${n}`;
  }
  const items = record.items;
  const n = Array.isArray(items) ? items.length : 0;
  return `${name} · ${n} item${n === 1 ? "" : "s"}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("ORDER_PUSH_WEBHOOK_SECRET");
  const hdr = req.headers.get(WEBHOOK_SECRET_HEADER);
  if (!secret || hdr !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { type?: string; record?: Record<string, unknown>; table?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (payload.table && payload.table !== "orders") {
    return new Response(JSON.stringify({ ok: true, skipped: "wrong_table" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = payload.record;
  if (!record || typeof record !== "object") {
    return new Response(JSON.stringify({ ok: false, error: "no_record" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!shouldNotify(record.order_source)) {
    return new Response(JSON.stringify({ ok: true, skipped: "manual" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const sellerId = String(record.seller_user_id ?? "").trim();
  if (!sellerId) {
    return new Response(JSON.stringify({ ok: false, error: "no_seller" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: rows, error: qErr } = await supabase
    .from("user_push_tokens")
    .select("token")
    .eq("user_id", sellerId);

  if (qErr) {
    console.error("user_push_tokens query:", qErr);
    return new Response(JSON.stringify({ ok: false, error: qErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tokens = [...new Set((rows ?? [])
    .map((r: { token?: string }) => r.token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  )];

  if (tokens.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!saRaw) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing FIREBASE_SERVICE_ACCOUNT_JSON" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let accessToken: string;
  let projectId: string;
  try {
    const sa = JSON.parse(saRaw) as Record<string, unknown>;
    const out = await getFcmAccessToken(sa);
    accessToken = out.token;
    projectId = out.projectId;
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const title = "New order received";
  const body = formatBody(record);
  const orderId = String(record.id ?? "");

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  for (const t of tokens) {
    const result = await sendFcmToDevice(
      t,
      title,
      body,
      orderId,
      accessToken,
      projectId,
    );
    if (result.ok) sent++;
    else {
      failed++;
      if (result.permanentInvalid) invalidTokens.push(t);
    }
  }

  if (invalidTokens.length > 0) {
    const { error: cleanupErr } = await supabase
      .from("user_push_tokens")
      .delete()
      .in("token", invalidTokens);
    if (cleanupErr) {
      console.error("Failed to cleanup invalid push tokens:", cleanupErr.message);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    sent,
    failed,
    total: tokens.length,
    invalidTokensRemoved: invalidTokens.length,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
