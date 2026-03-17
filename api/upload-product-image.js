import crypto from 'crypto';
import admin from 'firebase-admin';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import busboy from 'busboy';

// Initialize Firebase Admin once
let firebaseApp = null;

function initFirebaseAdmin() {
  if (firebaseApp) return;
  if (admin.apps.length > 0) {
    firebaseApp = admin.app();
    return;
  }

  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svcJson) {
    const serviceAccount = JSON.parse(svcJson);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 env vars: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getPublicBaseUrl() {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    throw new Error('Missing R2_PUBLIC_BASE_URL');
  }
  return base.replace(/\/+$/, '');
}

async function verifyFirebaseToken(authHeader) {
  initFirebaseAdmin();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Missing Authorization: Bearer <FirebaseIdToken>');
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded;
  } catch (err) {
    console.error('❌ Firebase token verify failed:', err?.message || err);
    throw new Error('Invalid Firebase ID token');
  }
}

function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    });

    const fields = {};
    let fileBuffer = null;
    let fileInfo = null;

    bb.on('file', (fieldname, file, info) => {
      const chunks = [];
      file.on('data', (data) => {
        chunks.push(data);
      });
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        fileInfo = {
          filename: info.filename,
          encoding: info.encoding,
          mimeType: info.mimeType,
        };
      });
    });

    bb.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    bb.on('close', () => {
      resolve({ fields, file: fileBuffer, fileInfo });
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization || '';
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const decoded = await verifyFirebaseToken(authHeader);
    const uid = decoded?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'No Firebase UID' });
    }

    // Parse multipart form data
    const { fields, file, fileInfo } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ error: 'Missing file' });
    }

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      return res.status(500).json({ error: 'Missing R2_BUCKET_NAME' });
    }

    const productId = (fields.productId || '').toString().trim();
    if (!productId) {
      return res.status(400).json({ error: 'Missing productId' });
    }

    // Standardize: store exactly ONE product source image per product (JPEG only)
    // Deterministic key ensures overwrites instead of creating duplicates.
    const key = `users/${uid}/products/${productId}/source.jpg`;
    const mime = 'image/jpeg';

    // Upload to Cloudflare R2
    const r2 = getR2Client();
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: mime,
        // We overwrite the same key on edits, so do not use immutable caching.
        CacheControl: 'public, max-age=0, must-revalidate',
      })
    );

    const publicBase = getPublicBaseUrl();
    const url = `${publicBase}/${key}`;

    return res.status(200).json({ url, key });
  } catch (err) {
    console.error('❌ Upload failed:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}
