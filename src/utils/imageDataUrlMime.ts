/**
 * Correct data:image/...;base64 prefixes for bytes read from disk or mis-labeled data URLs.
 * R2 often serves JPEG while the canonical path is still product-<id>.png.
 */

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export function guessMimeFromFilePath(path: string): ImageMime | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

/**
 * Inspect the first decoded bytes of base64 payload (raw file bytes).
 */
export function guessMimeFromBase64Payload(b64: string): ImageMime | null {
  const clean = b64.replace(/\s/g, '');
  if (clean.length < 16) return null;
  try {
    const raw = atob(clean.slice(0, 48));
    const u = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i);
    if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return 'image/jpeg';
    if (u.length >= 8 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return 'image/png';
    if (
      u.length >= 12 &&
      u[0] === 0x52 &&
      u[1] === 0x49 &&
      u[2] === 0x46 &&
      u[3] === 0x46 &&
      u[8] === 0x57 &&
      u[9] === 0x45 &&
      u[10] === 0x42 &&
      u[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    return null;
  }
  return null;
}

export function buildDataUrlFromDiskBase64(b64: string, path: string): string {
  const fromMagic = guessMimeFromBase64Payload(b64);
  const fromPath = guessMimeFromFilePath(path);
  const mime: ImageMime = fromMagic || fromPath || 'image/png';
  return `data:${mime};base64,${b64}`;
}

/**
 * Fix data URLs where the header says PNG but the payload is JPEG/WebP (common after caching JPG to a .png path).
 */
export function normalizeExistingDataUrlMime(dataUrl: string): string {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return dataUrl;
  const header = dataUrl.slice(0, comma).toLowerCase();
  const payload = dataUrl.slice(comma + 1);
  const magicMime = guessMimeFromBase64Payload(payload);
  if (!magicMime) return dataUrl;

  const saysPng = header.includes('image/png');
  const saysJpeg = header.includes('image/jpeg') || header.includes('image/jpg');
  const saysWebp = header.includes('image/webp');

  if (saysPng && magicMime === 'image/jpeg') return `data:image/jpeg;base64,${payload}`;
  if (saysPng && magicMime === 'image/webp') return `data:image/webp;base64,${payload}`;
  if ((saysJpeg || saysWebp) && magicMime === 'image/png') return `data:image/png;base64,${payload}`;
  if (saysJpeg && magicMime === 'image/webp') return `data:image/webp;base64,${payload}`;
  if (saysWebp && magicMime === 'image/jpeg') return `data:image/jpeg;base64,${payload}`;

  return dataUrl;
}
