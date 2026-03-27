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
  const j = (await res.json()) as { dataUrl?: string; error?: string };
  if (typeof j.dataUrl === "string" && j.dataUrl.startsWith("data:")) {
    return j.dataUrl;
  }
  throw new Error(j.error || "proxy: invalid response");
}
