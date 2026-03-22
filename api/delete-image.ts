import { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSupabaseUserFromRequest } from "../lib/supabaseAuthRequest.js";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──────────────────────────────────────────────────────────────
  const allowedOrigins = [
    "https://catshare.vercel.app",
    "https://catshare.app",
    "https://www.catshare.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost",
    "capacitor://localhost",
  ];
  const origin = req.headers.origin || "";
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") return res.status(405).end();

  const authResult = await getSupabaseUserFromRequest(req.headers.authorization);
  if (!authResult.ok) {
    return res.status(401).json({ error: authResult.error });
  }
  const userId = authResult.userId;

  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });

  const safeKey = String(key).replace(/^\/+/, "");
  if (safeKey.includes("..")) {
    return res.status(400).json({ error: "Invalid key" });
  }
  const allowed =
    safeKey.startsWith(`${userId}/`) ||
    safeKey.startsWith(`products/${userId}/`) ||
    safeKey.startsWith(`users/${userId}/`);
  if (!allowed) {
    return res.status(403).json({ error: "Not allowed to delete this object" });
  }

  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: safeKey,
      })
    );
    console.log(`🗑️ Deleted R2 object: ${safeKey}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to delete R2 object:", err);
    return res.status(500).json({ error: "Failed to delete image" });
  }
}
