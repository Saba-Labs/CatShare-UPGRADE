import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { applyApiCors } from "../lib/apiCors.js";
import { getSupabaseUserFromRequest } from "../lib/supabaseAuthRequest.js";

const URL_EXPIRY_SECONDS = 120;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authResult = await getSupabaseUserFromRequest(req.headers.authorization);
  if (authResult.ok === false) return res.status(401).json({ error: authResult.error });

  const body = req.body as { productId?: unknown; assetId?: unknown; contentType?: unknown };
  const productId = typeof body?.productId === "string"
    ? body.productId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128)
    : "";
  const assetId = typeof body?.assetId === "string"
    ? body.assetId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
    : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";

  if (!productId || !assetId || !IMAGE_TYPES.has(contentType)) {
    return res.status(400).json({ error: "Valid productId, assetId, and image contentType are required" });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return res.status(500).json({ error: "R2 configuration missing" });
  }

  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  const key = `products/${authResult.userId}/${productId}/${assetId}.${extension}`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const presignedUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: URL_EXPIRY_SECONDS }
    );
    const publicBase = publicBaseUrl.replace(/\/$/, "");
    return res.status(200).json({
      presignedUrl,
      key,
      publicUrl: `${publicBase}/${key}`,
    });
  } catch (error) {
    console.error("Failed to generate product image upload URL:", error);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
}
