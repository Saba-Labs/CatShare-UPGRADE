/**
 * Browser: call same-origin API to load R2 images when direct fetch/CORS fails.
 */

export function isPublicR2ImageUrlForProxy(urlStr: string): boolean {
  try {
    const u = new URL(urlStr.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".r2.dev")) return true;
    const base = import.meta.env.VITE_R2_PUBLIC_BASE_URL || "";
    if (base) {
      const baseHost = new URL(base).hostname.toLowerCase();
      if (host === baseHost) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * GET /api/fetch-public-image?url=encodeURIComponent(https://...)
 */
export async function fetchPublicImageProxyAsDataUrl(url: string): Promise<string> {
  const qs = new URLSearchParams({ url: url.trim() });
  const endpoint = new URL(
    `/api/fetch-public-image?${qs.toString()}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  const res = await fetch(endpoint.toString(), {
    method: "GET",
    credentials: "omit",
    mode: "cors",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Proxy HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const raw = await res.text();
  if (!ct.includes("application/json")) {
    const hint =
      raw.trimStart().startsWith("<!DOCTYPE") || raw.trimStart().startsWith("<html")
        ? " Got HTML instead of JSON — Vite dev must expose GET /api/fetch-public-image (see vite.config)."
        : "";
    throw new Error(`Proxy returned non-JSON (${ct || "no content-type"}).${hint}`);
  }
  let j: { dataUrl?: string; error?: string };
  try {
    j = JSON.parse(raw) as { dataUrl?: string; error?: string };
  } catch {
    throw new Error("Proxy: response was not valid JSON.");
  }
  if (typeof j.dataUrl === "string" && j.dataUrl.startsWith("data:")) {
    return j.dataUrl;
  }
  throw new Error(j.error || "proxy: invalid response");
}
