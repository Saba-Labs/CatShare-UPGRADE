import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiCors } from "../lib/apiCors.js";
import {
  isAllowedPublicImageUrl,
  serverFetchImageAsDataUrl,
} from "../lib/publicImageProxy.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiCors(req, res, "GET, OPTIONS")) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = req.query.url;
  const url =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url" });
  }

  if (!isAllowedPublicImageUrl(url)) {
    return res.status(403).json({ error: "URL not allowed" });
  }

  try {
    const dataUrl = await serverFetchImageAsDataUrl(url);
    return res.status(200).json({ dataUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: msg });
  }
}
