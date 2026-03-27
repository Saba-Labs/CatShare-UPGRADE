/**
 * Load remote image bytes as a data URL.
 * - Web: uses fetch (R2 should send CORS for your origin when using browser builds).
 * - Native: @capacitor-community/http (bypasses WebView CORS for https://localhost → R2).
 *
 * Native plugins may return `data` as a raw base64 string, a full data: URL, or (rarely) an object.
 */

import { Capacitor } from '@capacitor/core';
import { Http } from '@capacitor-community/http';
import {
  fetchPublicImageProxyAsDataUrl,
  isPublicR2ImageUrlForProxy,
} from './publicImageProxyClient';

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function guessMimeFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('.png')) return 'image/png';
  if (u.includes('.webp')) return 'image/webp';
  if (u.includes('.gif')) return 'image/gif';
  if (u.includes('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function pickContentType(headers: Record<string, string>, url: string): string {
  const h = headers || {};
  const raw =
    h['content-type'] ||
    h['Content-Type'] ||
    h['Content-type'] ||
    '';
  const mime = typeof raw === 'string' ? raw.split(';')[0].trim() : '';
  return mime || guessMimeFromUrl(url);
}

/**
 * Turn native Http `data` field into a full data:image/...;base64,... URL.
 */
function toDataUrlFromNativeBody(data: unknown, contentType: string): string {
  if (data == null) {
    throw new Error('Native HTTP: empty body');
  }

  if (typeof data === 'string') {
    const s = data.trim();
    if (s.length === 0) throw new Error('Native HTTP: empty string body');
    if (s.startsWith('data:')) return s;
    return `data:${contentType};base64,${s}`;
  }

  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const nested =
      (typeof o.data === 'string' && o.data) ||
      (typeof o.base64 === 'string' && o.base64) ||
      (typeof o.value === 'string' && o.value) ||
      '';
    if (nested) {
      const s = nested.trim();
      if (s.startsWith('data:')) return s;
      if (s.length > 0) return `data:${contentType};base64,${s}`;
    }
  }

  throw new Error('Native HTTP: unrecognized response body type');
}

async function httpGetImageAsDataUrl(url: string): Promise<string> {
  const res = await Http.request({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    // Android @capacitor-community/http: omitting params yields null in setUrlParams → NPE.
    params: {},
    connectTimeout: 60000,
    readTimeout: 60000,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }

  const ct = pickContentType(res.headers || {}, url);
  return toDataUrlFromNativeBody(res.data, ct);
}

/**
 * Fetch an image URL and return a data:image/...;base64,... string.
 * Retries once on native after a short delay (transient bridge / network flakes).
 */
export async function fetchUrlAsDataUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error('fetchUrlAsDataUrl: invalid URL');
  }

  if (Capacitor.getPlatform() === 'web') {
    try {
      const response = await fetch(trimmed, {
        credentials: 'omit',
        mode: 'cors',
        referrerPolicy: 'no-referrer',
        cache: 'force-cache',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      return readBlobAsDataUrl(blob);
    } catch (fetchErr) {
      if (isPublicR2ImageUrlForProxy(trimmed)) {
        try {
          return await fetchPublicImageProxyAsDataUrl(trimmed);
        } catch (proxyErr) {
          console.warn('fetchUrlAsDataUrl: same-origin proxy failed', proxyErr);
        }
      }
      // Raw fetch often fails on R2 when CORS is tight; <img crossOrigin> + same fetch→blob
      // fallback in loadImage() sometimes still succeeds (matches on-screen thumbnails).
      console.warn('fetchUrlAsDataUrl: direct fetch failed, trying loadImage + canvas', fetchErr);
      const { loadImage } = await import('./canvasRenderer');
      const img = await loadImage(trimmed);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        throw new Error('Image has zero dimensions');
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }

  const tryOnce = () => httpGetImageAsDataUrl(trimmed);

  try {
    return await tryOnce();
  } catch (first) {
    console.warn('⚠️ fetchUrlAsDataUrl native first attempt failed:', first);
    await new Promise((r) => setTimeout(r, 400));
    return await tryOnce();
  }
}
