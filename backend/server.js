import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import admin from "firebase-admin";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { google } from "googleapis";

dotenv.config();

const app = express();
const upload = multer(); // memory storage
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const PRO_PRODUCT_IDS = new Set(["catshare_pro_monthly", "catshare_pro_yearly"]);

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

function computeIsPro(row) {
  if (!row) return false;
  if (row.status !== "active") return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
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

/**
 * Get current subscription entitlement for the logged-in Firebase user.
 * Returns: { isPro, subscription }
 */
app.get("/subscription", requireFirebaseUser, async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: "No Firebase UID" });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      isPro: computeIsPro(data),
      subscription: data || null,
    });
  } catch (err) {
    console.error("❌ /subscription failed:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed" });
  }
});

/**
 * Verify Android subscription purchase with Google Play Developer API.
 * Body: { packageName, subscriptionId, purchaseToken }
 *
 * Requires backend env:
 * - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 */
app.post("/iap/android/receipt", requireFirebaseUser, async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: "No Firebase UID" });

    const { packageName, subscriptionId, purchaseToken } = req.body || {};
    if (!packageName || !subscriptionId || !purchaseToken) {
      return res.status(400).json({ error: "Missing packageName/subscriptionId/purchaseToken" });
    }
    if (!PRO_PRODUCT_IDS.has(subscriptionId)) {
      return res.status(400).json({ error: "Unknown subscriptionId" });
    }

    const svcJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!svcJson) return res.status(501).json({ error: "Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" });

    const creds = JSON.parse(svcJson);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const client = await auth.getClient();
    const androidpublisher = google.androidpublisher({ version: "v3", auth: client });

    const resp = await androidpublisher.purchases.subscriptionsv2.get({
      packageName,
      token: purchaseToken,
    });

    const sub = resp.data;
    const lineItems = sub?.lineItems || [];
    const activeLine = lineItems.find((li) => li.productId === subscriptionId) || lineItems[0];

    const expiryTime = activeLine?.expiryTime || null;
    const expiresAt = expiryTime ? new Date(expiryTime).toISOString() : null;
    const isActive = expiryTime ? new Date(expiryTime).getTime() > Date.now() : false;

    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("user_subscriptions")
      .upsert({
        user_id: uid,
        platform: "android",
        product_id: subscriptionId,
        status: isActive ? "active" : "expired",
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ isPro: isActive, expiresAt });
  } catch (err) {
    console.error("❌ Android receipt verify failed:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Verify failed" });
  }
});

/**
 * Verify iOS auto-renewable subscription via Apple's verifyReceipt endpoint.
 * Body: { receiptDataBase64 }
 *
 * Requires backend env:
 * - APPLE_SHARED_SECRET
 */
app.post("/iap/ios/receipt", requireFirebaseUser, async (req, res) => {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: "No Firebase UID" });

    const { receiptDataBase64 } = req.body || {};
    if (!receiptDataBase64) return res.status(400).json({ error: "Missing receiptDataBase64" });

    const secret = process.env.APPLE_SHARED_SECRET;
    if (!secret) return res.status(501).json({ error: "Missing APPLE_SHARED_SECRET" });

    const payload = {
      "receipt-data": receiptDataBase64,
      password: secret,
      "exclude-old-transactions": true,
    };

    const appleResp = await fetch("https://buy.itunes.apple.com/verifyReceipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = await appleResp.json();
    if (data?.status === 21007) {
      const sandboxResp = await fetch("https://sandbox.itunes.apple.com/verifyReceipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await sandboxResp.json();
    }

    if (data?.status !== 0) {
      return res.status(400).json({ error: `Apple verifyReceipt failed: status=${data?.status}` });
    }

    const latest = data?.latest_receipt_info || [];
    const relevant = latest.filter((r) => PRO_PRODUCT_IDS.has(r.product_id));
    const chosen = relevant.sort((a, b) => Number(b.expires_date_ms || 0) - Number(a.expires_date_ms || 0))[0];
    if (!chosen) return res.status(400).json({ error: "No matching subscription in receipt" });

    const expiresMs = Number(chosen.expires_date_ms || 0);
    const isActive = expiresMs > Date.now();
    const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;

    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("user_subscriptions")
      .upsert({
        user_id: uid,
        platform: "ios",
        product_id: chosen.product_id,
        status: isActive ? "active" : "expired",
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ isPro: isActive, expiresAt });
  } catch (err) {
    console.error("❌ iOS receipt verify failed:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Verify failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy running at http://localhost:${PORT}`);
});
