/**
 * Server-only: validate R2 public URLs and fetch image bytes as a data URL (bypasses browser CORS).
 */

export function isAllowedPublicImageUrl(urlStr: string): boolean {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host.endsWith(".r2.dev")) return true;
  const base = process.env.R2_PUBLIC_BASE_URL || "";
  if (base) {
    try {
      const baseHost = new URL(base).hostname.toLowerCase();
      if (host === baseHost) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export async function serverFetchImageAsDataUrl(urlStr: string): Promise<string> {
  const res = await fetch(urlStr, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const rawCt = res.headers.get("content-type");
  const mime =
    rawCt?.split(";")[0]?.trim() || "image/jpeg";
  const b64 = buf.toString("base64");
  return `data:${mime};base64,${b64}`;
}
