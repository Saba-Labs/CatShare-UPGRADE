/**
 * Shared CORS for Vercel /api routes (browser + Capacitor WebView cross-origin calls).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Origins allowed to call CatShare APIs from the app WebView or web */
export const API_ALLOWED_ORIGINS = [
  "https://catshare.vercel.app",
  "https://catshare.app",
  "https://www.catshare.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];

/**
 * Apply CORS headers. Returns true if OPTIONS preflight was answered (stop handler).
 */
export function applyApiCors(
  req: VercelRequest,
  res: VercelResponse,
  methods = "POST, OPTIONS"
): boolean {
  const origin = (req.headers.origin as string) || "";
  if (API_ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}
