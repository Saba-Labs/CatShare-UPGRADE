/**
 * Supabase Edge Function: send a custom FCM notification to all registered devices.
 *
 * Invoke with POST + JSON body: { "title": "...", "body": "...", "data"?: { "key": "value" } }
 * Header: x-catshare-broadcast-secret: <BROADCAST_PUSH_SECRET>
 *
 * Secrets: BROADCAST_PUSH_SECRET, FIREBASE_SERVICE_ACCOUNT_JSON
 * Auto: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { JWT } from "npm:google-auth-library@9.14.2";

const SECRET_HEADER = "x-catshare-broadcast-secret";

const MAX_TITLE = 120;
const MAX_BODY = 800;

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

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = { type: "broadcast" };
  for (const [k, v] of Object.entries(data)) {
    if (k === "type") continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

async function sendFcmBroadcast(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
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
            channel_id: "fcm_notification_channel",
            sound: "default",
          },
        },
        data,
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
    console.error("FCM broadcast failed", res.status, t.slice(0, 500));
    return { ok: false, permanentInvalid, status: res.status, errorText: t };
  }
  return { ok: true, permanentInvalid: false };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("BROADCAST_PUSH_SECRET");
  const hdr = req.headers.get(SECRET_HEADER);
  if (!secret || secret.length < 8) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "BROADCAST_PUSH_SECRET is not set or too short (set in Supabase secrets)",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
  if (hdr !== secret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    title?: unknown;
    body?: unknown;
    data?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const title = String(body.title ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!title || !text) {
    return new Response(
      JSON.stringify({ ok: false, error: "title and body are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (title.length > MAX_TITLE || text.length > MAX_BODY) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `title max ${MAX_TITLE} chars, body max ${MAX_BODY} chars`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const extra = body.data && typeof body.data === "object" && !Array.isArray(body.data)
    ? stringifyData(body.data as Record<string, unknown>)
    : stringifyData({});

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Server misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: rows, error: qErr } = await supabase
    .from("user_push_tokens")
    .select("token");

  if (qErr) {
    console.error("user_push_tokens query:", qErr);
    return new Response(JSON.stringify({ ok: false, error: qErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tokens = [
    ...new Set(
      (rows ?? [])
        .map((r: { token?: string }) => r.token)
        .filter((t): t is string => typeof t === "string" && t.length > 0),
    ),
  ];

  if (tokens.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, failed: 0, totalTokens: 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
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

  const BATCH = 40;
  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (t) => {
        const result = await sendFcmBroadcast(t, title, text, extra, accessToken, projectId);
        return { token: t, result };
      }),
    );
    for (const row of results) {
      if (row.result.ok) sent++;
      else {
        failed++;
        if (row.result.permanentInvalid) invalidTokens.push(row.token);
      }
    }
    if (i + BATCH < tokens.length) {
      await new Promise((r) => setTimeout(r, 75));
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

  return new Response(
    JSON.stringify({
      ok: true,
      sent,
      failed,
      totalTokens: tokens.length,
      invalidTokensRemoved: invalidTokens.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
