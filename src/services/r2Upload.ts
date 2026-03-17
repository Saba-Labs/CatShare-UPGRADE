import { auth } from '../config/firebaseConfig';

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'bin';
  return { blob, mime, ext };
}

export async function uploadProductImageToR2(options: {
  productId: string;
  dataUrl: string; // e.g. data:image/png;base64,...
}): Promise<{ url: string; key: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();
  const baseUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';
  const endpoint = baseUrl ? `${baseUrl}/api/upload-product-image` : '/api/upload-product-image';

  const { blob, ext } = dataUrlToBlob(options.dataUrl);

  const form = new FormData();
  form.append('productId', options.productId);
  form.append('ext', ext);
  form.append('file', blob, `product-${options.productId}.${ext}`);

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Upload failed (${resp.status}): ${text || resp.statusText}`);
  }

  const json = await resp.json();
  if (!json?.url || !json?.key) throw new Error('Upload response missing url/key');
  return { url: json.url, key: json.key };
}
