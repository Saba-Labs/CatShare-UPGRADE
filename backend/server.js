import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import admin from "firebase-admin";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const app = express();
const upload = multer(); // memory storage
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------- Firebase Admin (verify ID tokens) ----------
function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  // Preferred: provide a full service account JSON string in env
  // FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    const serviceAccount = JSON.parse(svcJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  // Fallback: use GOOGLE_APPLICATION_CREDENTIALS or default credentials
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

async function requireFirebaseUser(req, res, next) {
  try {
    initFirebaseAdmin();
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <FirebaseIdToken>" });
    }

    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebaseUser = decoded; // { uid, ... }
    return next();
  } catch (err) {
    console.error("❌ Firebase token verify failed:", err?.message || err);
    return res.status(401).json({ error: "Invalid Firebase ID token" });
  }
}

// ---------- Cloudflare R2 (S3 compatible) ----------
function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 env vars: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getPublicBaseUrl() {
  // Use a custom domain if you have one (recommended), e.g. https://cdn.yoursite.com
  // Otherwise you can use an R2 public bucket URL if configured.
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    throw new Error("Missing R2_PUBLIC_BASE_URL (e.g. https://cdn.example.com)");
  }
  return base.replace(/\/+$/, "");
}

app.post("/remove-bg", upload.single("image_file"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("image_file", req.file.buffer, {
      filename: "image.png",
    });
    formData.append("crop", "true"); // optional
    formData.append("bg_color", "none"); // or white like "#ffffff"

    const result = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: {
        "x-api-key": process.env.PHOTOROOM_API_KEY,
      },
      body: formData,
    });

    if (!result.ok) {
      const errorText = await result.text();
      return res.status(result.status).send(errorText);
    }

    const arrayBuffer = await result.arrayBuffer();
    res.set("Content-Type", "image/png");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PhotoRoom API failed" });
  }
});

/**
 * Upload a product image to Cloudflare R2.
 * - Auth: Firebase ID token (Authorization: Bearer <token>)
 * - Body: multipart/form-data with:
 *   - file: image binary (png/jpg/webp)
 *   - productId: string
 *   - ext: optional (png/jpg/webp) for naming; inferred if missing
 *
 * Returns: { url, key }
 */
app.post("/upload-product-image", requireFirebaseUser, upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Missing file" });
    }

    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: "No Firebase UID" });

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      return res.status(500).json({ error: "Missing R2_BUCKET_NAME" });
    }

    const productId = (req.body?.productId || "").toString().trim();
    if (!productId) return res.status(400).json({ error: "Missing productId" });

    const mime = req.file.mimetype || "application/octet-stream";
    const providedExt = (req.body?.ext || "").toString().trim().toLowerCase();
    const ext =
      providedExt ||
      (mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "bin");

    const hash = crypto.createHash("sha1").update(req.file.buffer).digest("hex").slice(0, 12);
    const key = `users/${uid}/products/${productId}/source_${hash}.${ext}`;

    const r2 = getR2Client();
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: mime,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicBase = getPublicBaseUrl();
    const url = `${publicBase}/${key}`;

    return res.json({ url, key });
  } catch (err) {
    console.error("❌ R2 upload failed:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Upload failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy running at http://localhost:${PORT}`);
});
