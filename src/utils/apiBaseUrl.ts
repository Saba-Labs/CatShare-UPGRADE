import { Capacitor } from '@capacitor/core';

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/** Origin for CatShare `/api/*` routes (Vercel or local dev). */
export function resolveApiBaseUrl(): string {
  const backend = String(import.meta.env.VITE_BACKEND_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (backend) return backend;

  const appUrl = String(import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_WEB_BASE_URL || '')
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
