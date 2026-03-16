import { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)),
  });
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const idToken = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });

  try {
    await r2.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    }));
    console.log(`🗑️ Deleted R2 object: ${key}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to delete R2 object:", err);
    return res.status(500).json({ error: "Failed to delete image" });
  }
}