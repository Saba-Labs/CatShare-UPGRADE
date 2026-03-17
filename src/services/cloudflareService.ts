// src/services/cloudflareService.ts
// Handles image uploads to Cloudflare R2 via presigned URLs from the Vercel API

import { getAuth } from "firebase/auth";

const API_BASE = import.meta.env.VITE_APP_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  success: boolean;
  publicUrl?: string;
  key?: string;
  error?: string;
}

// ─── Core upload function ─────────────────────────────────────────────────────

/**
 * Upload a base64 image to Cloudflare R2.
 *
 * Steps:
 *  1. Get a Firebase ID token for the current user
 *  2. POST to /api/get-upload-url to get a presigned PUT URL
 *  3. PUT the image blob directly to R2
 *  4. Return the public URL to store in Supabase
 *
 * @param base64    Raw base64 string (no data URI prefix)
 * @param filename  e.g. "product_1773471251627_Master.png"
 * @param folder    e.g. "Master" — matches the catalogue folder name
 * @param mimeType  Defaults to "image/png"
 */
export async function uploadImageToR2(
  base64: string,
  filename: string,
  folder: string,
  mimeType: "image/png" | "image/jpeg" = "image/png"
): Promise<UploadResult> {
  try {
    // ── Step 1: Get Firebase ID token ──────────────────────────────────────
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.error("❌ R2 upload aborted: no authenticated user");
      return { success: false, error: "User not authenticated" };
    }

    // If user chose local-only, block cloud uploads until they opt in.
    const choice = localStorage.getItem(`offlineSyncChoice::${user.uid}`);
    if (choice && choice !== 'sync') {
      return { success: false, error: "Cloud sync is disabled (local-only mode)." };
    }

    const idToken = await user.getIdToken();

    // ── Step 2: Request presigned URL from Vercel API ──────────────────────
    console.log(`☁️  Requesting presigned URL for: ${folder}/${filename}`);

    const urlResponse = await fetch(`${API_BASE}/api/get-upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ filename, folder, contentType: mimeType }),
    });

    if (!urlResponse.ok) {
      const errorData = await urlResponse.json().catch(() => ({}));
      console.error("❌ Failed to get presigned URL:", urlResponse.status, errorData);
      return {
        success: false,
        error: `Presigned URL request failed: ${urlResponse.status} ${errorData.error || ""}`,
      };
    }

    const { presignedUrl, publicUrl, key } = await urlResponse.json();
    console.log(`✅ Got presigned URL. Key: ${key}`);

    // ── Step 3: PUT image blob directly to R2 ──────────────────────────────
    const blob = base64ToBlob(base64, mimeType);
    console.log(`📤 Uploading ${(blob.size / 1024).toFixed(1)}KB to R2...`);

    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": mimeType },
    });

    if (!uploadResponse.ok) {
      console.error("❌ R2 PUT failed:", uploadResponse.status, uploadResponse.statusText);
      return {
        success: false,
        error: `R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
      };
    }

    console.log(`✅ Successfully uploaded to R2: ${publicUrl}`);
    return { success: true, publicUrl, key };
  } catch (err: any) {
    console.error("❌ uploadImageToR2 threw:", err?.message || err);
    return { success: false, error: err?.message || "Unknown upload error" };
  }
}

// ─── Helper: strip data URI prefix if present ────────────────────────────────

/**
 * Accepts either a raw base64 string or a data URI like "data:image/png;base64,..."
 * Returns just the raw base64 part.
 */
export function stripDataUriPrefix(base64OrDataUri: string): string {
  if (base64OrDataUri.startsWith("data:")) {
    return base64OrDataUri.split(",")[1];
  }
  return base64OrDataUri;
}

// ─── Helper: base64 → Blob ────────────────────────────────────────────────────

function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = stripDataUriPrefix(base64);
  const byteChars = atob(clean);
  const byteArrays: BlobPart[] = [];

  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: mimeType });
}

// ─── Delete image from R2 ─────────────────────────────────────────────────────

/**
 * Delete an image from Cloudflare R2.
 *
 * @param imageUrl The public URL of the image to delete
 * @returns Promise with success/error status for proper error handling
 */
export async function deleteImageFromR2(imageUrl: string): Promise<UploadResult> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    if (!imageUrl) {
      return { success: false, error: "No image URL provided" };
    }

    // Extract the object key from a public URL (works even if base URL changes)
    let key = "";
    try {
      const u = new URL(imageUrl);
      key = decodeURIComponent(u.pathname || "").replace(/^\/+/, "");
    } catch {
      // Fallback for non-standard URLs
      const baseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL || "";
      key = imageUrl.replace(`${baseUrl}/`, "").replace(/^\/+/, "");
    }

    if (!key) {
      console.warn("⚠️ Could not extract R2 key from URL:", imageUrl);
      return { success: false, error: "Could not extract image key from URL" };
    }

    // Backwards-compat cleanup: older versions used png; current uses deterministic jpg.
    const candidateKeys = Array.from(
      new Set([
        key,
        key.endsWith(".png") ? key.slice(0, -4) + ".jpg" : "",
        key.endsWith(".png") ? key.slice(0, -4) + ".jpeg" : "",
        key.endsWith(".jpg") ? key.slice(0, -4) + ".png" : "",
        key.endsWith(".jpeg") ? key.slice(0, -5) + ".png" : "",
      ].filter(Boolean))
    );

    const idToken = await user.getIdToken();
    for (const k of candidateKeys) {
      const response = await fetch(`${API_BASE}/api/delete-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ key: k }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ R2 deletion failed:", response.status, errorData);
        return {
          success: false,
          error: `R2 deletion failed: ${response.status} ${errorData.error || response.statusText}`,
        };
      }
    }

    console.log(`🗑️ Deleted R2 image(s):`, candidateKeys);
    return { success: true };
  } catch (err: any) {
    console.error("❌ deleteImageFromR2 threw:", err?.message || err);
    return { success: false, error: err?.message || "Unknown deletion error" };
  }
}
