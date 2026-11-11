import { Capacitor } from '@capacitor/core';
import { supabase, getSupabaseAccessToken } from '../supabaseClient';

const MAX_UPLOAD_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 400;

/** Coalesce concurrent uploads for the same product + asset (avoids duplicate work / races). */
const inFlightProductUploads = new Map<string, Promise<{ url: string; key: string; imageVersion?: number }>>();

async function dataUrlToUploadBlob(dataUrl: string, quality = 0.95): Promise<Blob> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');

  const mime = match[1].toLowerCase();
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const inputBlob = new Blob([bytes], { type: mime || 'application/octet-stream' });

  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return inputBlob;

  const bitmap = await createImageBitmap(inputBlob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');
  ctx.drawImage(bitmap, 0, 0);

  const jpegBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPEG'))),
      'image/jpeg',
      quality
    );
  });

  return jpegBlob;
}

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function resolveUploadApiBase(): string {
  const env = import.meta.env;
  const backend = String(env.VITE_BACKEND_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (backend) return backend;

  const appUrl = String(env.VITE_APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (appUrl) return appUrl;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!Capacitor.isNativePlatform() && !isLocalDevOrigin(origin)) {
      return origin;
    }
  }

  return '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadBlobWithPresignedUrl(
  apiBase: string,
  productId: string,
  blob: Blob,
  assetId: string
): Promise<{ url: string; key: string; imageVersion: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(Math.round(BASE_BACKOFF_MS * Math.pow(1.6, attempt - 1)));
    }

    const token = await getSupabaseAccessToken();
    if (!token) {
      lastError = new Error('Could not get session token');
      continue;
    }

    try {
      const signResponse = await fetch(`${apiBase}/api/get-upload-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, assetId, contentType: blob.type }),
      });

      if (signResponse.status === 401) {
        await supabase.auth.refreshSession();
        lastError = new Error('Upload unauthorized (401), refreshed session — retrying');
        continue;
      }

      if (!signResponse.ok) {
        const body = await signResponse.json().catch(() => ({}));
        const error = new Error(
          `Upload URL request failed (${signResponse.status}): ${body.error || signResponse.statusText}`
        );
        if (signResponse.status >= 500 || signResponse.status === 429) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const { presignedUrl, publicUrl, key } = await signResponse.json();
      if (!presignedUrl || !publicUrl || !key) {
        throw new Error('Upload URL response missing required fields');
      }

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type },
        body: blob,
      });

      if (!uploadResponse.ok) {
        const error = new Error(`R2 upload failed (${uploadResponse.status}): ${uploadResponse.statusText}`);
        if (uploadResponse.status >= 500 || uploadResponse.status === 429 || uploadResponse.status === 403) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const imageVersion = Date.now();
      return { url: `${publicUrl}?v=${imageVersion}`, key, imageVersion };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === 'TypeError' && /fetch|network|failed/i.test(err.message)) {
        lastError = err;
        continue;
      }
      if (attempt === MAX_UPLOAD_ATTEMPTS - 1) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('Upload failed after retries');
}

function newUploadAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function uploadProductImageToR2(options: {
  productId: string;
  dataUrl: string;
  /** Unique per file; omit to generate (recommended). */
  assetId?: string;
}): Promise<{ url: string; key: string; imageVersion?: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const uid = session.user.id;
  const choice = localStorage.getItem(`offlineSyncChoice::${uid}`);
  if (choice && choice !== 'sync') {
    throw new Error('Cloud sync is disabled (local-only mode).');
  }

  const base = resolveUploadApiBase();
  if (!base) {
    throw new Error(
      'Missing VITE_BACKEND_URL (or VITE_APP_URL). Set it to your deployed API origin (e.g. https://your-app.vercel.app), rebuild, then run npx cap sync for Android.'
    );
  }

  const assetId = (options.assetId && String(options.assetId).trim()) || newUploadAssetId();
  const flightKey = `${options.productId}:${assetId}`;
  const existing = inFlightProductUploads.get(flightKey);
  if (existing) return existing;

  const promise = (async () => {
    const blob = await dataUrlToUploadBlob(options.dataUrl);
    return uploadBlobWithPresignedUrl(base, options.productId, blob, assetId);
  })();

  inFlightProductUploads.set(flightKey, promise);
  promise.finally(() => {
    if (inFlightProductUploads.get(flightKey) === promise) {
      inFlightProductUploads.delete(flightKey);
    }
  });

  return promise;
}
