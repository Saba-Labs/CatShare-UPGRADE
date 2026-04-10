import { Capacitor } from '@capacitor/core';
import { supabase, getSupabaseAccessToken } from '../supabaseClient';

const MAX_UPLOAD_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 400;

/** Coalesce concurrent uploads for the same product (avoids duplicate work / races). */
const inFlightProductUploads = new Map<string, Promise<{ url: string; key: string }>>();

async function dataUrlToJpegBlob(dataUrl: string, quality = 0.88): Promise<Blob> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');

  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const inputBlob = new Blob([bytes], { type: mime || 'application/octet-stream' });

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

function buildFormData(productId: string, blob: Blob): FormData {
  const form = new FormData();
  form.append('productId', productId);
  form.append('ext', 'jpg');
  form.append('file', blob, `product-${productId}.jpg`);
  return form;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Upload with retries: cold starts, transient 5xx/429, expired tokens, flaky networks.
 * FormData is rebuilt each attempt (body is consumed by fetch).
 */
async function postUploadWithRetries(
  endpoint: string,
  productId: string,
  blob: Blob
): Promise<{ url: string; key: string; imageVersion?: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(Math.round(BASE_BACKOFF_MS * Math.pow(1.6, attempt - 1)));
    }

    let token = await getSupabaseAccessToken();
    if (!token) {
      lastError = new Error('Could not get session token');
      continue;
    }

    const form = buildFormData(productId, blob);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (resp.ok) {
        const json = await resp.json();
        if (json?.url && json?.key) {
          const imageVersion =
            typeof json.imageVersion === 'number' && Number.isFinite(json.imageVersion)
              ? json.imageVersion
              : undefined;
          return { url: json.url, key: json.key, imageVersion };
        }
        lastError = new Error('Upload response missing url/key');
        continue;
      }

      const text = await resp.text().catch(() => '');

      if (resp.status === 401) {
        await supabase.auth.refreshSession();
        lastError = new Error(`Upload unauthorized (401), refreshed session — retrying`);
        continue;
      }

      if (resp.status >= 500 || resp.status === 429) {
        lastError = new Error(`Upload failed (${resp.status}): ${text || resp.statusText}`);
        continue;
      }

      throw new Error(`Upload failed (${resp.status}): ${text || resp.statusText}`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
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

export async function uploadProductImageToR2(options: {
  productId: string;
  dataUrl: string;
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
  const endpoint = `${base}/api/upload-product-image`;

  const existing = inFlightProductUploads.get(options.productId);
  if (existing) return existing;

  const promise = (async () => {
    const blob = await dataUrlToJpegBlob(options.dataUrl, 0.88);
    return postUploadWithRetries(endpoint, options.productId, blob);
  })();

  inFlightProductUploads.set(options.productId, promise);
  promise.finally(() => {
    if (inFlightProductUploads.get(options.productId) === promise) {
      inFlightProductUploads.delete(options.productId);
    }
  });

  return promise;
}
