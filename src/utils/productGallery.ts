/**
 * Product gallery video URLs (shown in store alongside images; not used as primary/list image).
 */

import { isEmbeddableUrl, normalizeEmbedUrl, normalizeGalleryEmbedUrl } from './embedUrl';

export const MAX_PRODUCT_VIDEOS = 3;

const HTTPS_URL = /^https?:\/\//i;
const NATIVE_VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

export function isNativeVideoUrl(url: string): boolean {
  return NATIVE_VIDEO_EXT.test(String(url || '').trim());
}

export function isValidProductVideoUrl(input: string): boolean {
  const trimmed = String(input || '').trim();
  if (!trimmed) return false;
  try {
    const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (!HTTPS_URL.test(parsed.href)) return false;
    if (isNativeVideoUrl(trimmed)) return true;
    return isEmbeddableUrl(trimmed);
  } catch {
    return false;
  }
}

/** Ordered gallery video URLs (https only), max {@link MAX_PRODUCT_VIDEOS}. */
export function getProductVideoUrls(
  product: { videoUrls?: unknown } | null | undefined
): string[] {
  if (!product || typeof product !== 'object') return [];
  const raw = (product as { videoUrls?: unknown }).videoUrls;
  if (!Array.isArray(raw)) return [];
  return normalizeProductVideoUrls(raw.map((u) => String(u ?? '')));
}

export function normalizeProductVideoUrls(urls: string[]): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed || !isValidProductVideoUrl(trimmed)) continue;
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    if (!out.includes(normalized)) out.push(normalized);
    if (out.length >= MAX_PRODUCT_VIDEOS) break;
  }
  return out;
}

/** Use swipe gallery when there are multiple slides or video-only gallery. */
export function shouldUseProductMediaGallery(imageCount: number, videoCount: number): boolean {
  if (imageCount + videoCount > 1) return true;
  return videoCount > 0 && imageCount === 0;
}

export function getVideoPlaybackInfo(url: string): { src: string; native: boolean } {
  const trimmed = String(url || '').trim();
  const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  if (isNativeVideoUrl(trimmed)) {
    return { src: withScheme, native: true };
  }
  return { src: normalizeGalleryEmbedUrl(trimmed), native: false };
}

export function videoHostLabel(url: string): string {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('vimeo')) return 'Vimeo';
    if (isNativeVideoUrl(url)) return 'Video file';
    return host || 'Video';
  } catch {
    return 'Video';
  }
}
