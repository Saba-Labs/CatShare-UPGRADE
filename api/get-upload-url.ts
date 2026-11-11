// api/get-upload-url.ts
// Vercel serverless function — generates a presigned PUT URL for Cloudflare R2
// Place this file at: /api/get-upload-url.ts in your project root

import { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSupabaseUserFromRequest } from "../lib/supabaseAuthRequest.js";
import { applyApiCors } from "../lib/apiCors.js";

// ─── R2 S3-compatible client ──────────────────────────────────────────────────
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// ─── Constants ────────────────────────────────────────────────────────────────
const BUCKET = process.env.R2_BUCKET_NAME!;
const URL_EXPIRY_SECONDS = 120; // presigned URL valid for 2 minutes
const MAX_FILENAME_LENGTH = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── 1. Verify Supabase access token ───────────────────────────────────────
  const authResult = await getSupabaseUserFromRequest(req.headers.authorization);
  if (authResult.ok === false) {
    return res.status(401).json({ error: authResult.error });
  }
  const uid = authResult.userId;

  // ── 2. Validate request body ─────────────────────────────────────────────
  const body = req.body as {
    filename?: unknown;
    folder?: unknown;
    productId?: unknown;
    assetId?: unknown;
    contentType?: unknown;
  };
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  let key: string;
  let mime: string;

  if (body?.productId !== undefined || body?.assetId !== undefined) {
    const productId = typeof body.productId === "string"
      ? body.productId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128)
      : "";
    const assetId = typeof body.assetId === "string"
      ? body.assetId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
      : "";
    const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (!productId || !assetId || !imageTypes.has(contentType)) {
      return res.status(400).json({ error: "Valid productId, assetId, and image contentType are required" });
    }

    const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
    key = `products/${uid}/${productId}/${assetId}.${extension}`;
    mime = contentType;
  } else {
    const { filename, folder } = body;
    if (typeof filename !== "string" || typeof folder !== "string" || !filename || !folder) {
      return res.status(400).json({ error: "filename and folder are required" });
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 64);
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, MAX_FILENAME_LENGTH);
    mime = contentType === "image/jpeg" ? "image/jpeg" : "image/png";
    key = `${uid}/${safeFolder}/${safeFilename}`;
  }

  // ── 3. Generate presigned PUT URL ────────────────────────────────────────
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mime,
    });

    const presignedUrl = await getSignedUrl(r2, command, {
      expiresIn: URL_EXPIRY_SECONDS,
    });

    // The public URL your app will store in Supabase after upload
    const publicUrl = `${String(process.env.R2_PUBLIC_BASE_URL).replace(/\/$/, "")}/${key}`;

    return res.status(200).json({ presignedUrl, publicUrl, key });
  } catch (err) {
    console.error("Failed to generate presigned URL:", err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
}
