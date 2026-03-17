import { auth } from '../config/firebaseConfig';

async function dataUrlToJpegBlob(dataUrl: string, quality = 0.88): Promise<Blob> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');

  // Decode into a Blob first
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const inputBlob = new Blob([bytes], { type: mime || 'application/octet-stream' });

  // Convert to JPEG via canvas to guarantee a single format
  const bitmap = await createImageBitmap(inputBlob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');
  ctx.drawImage(bitmap, 0, 0);

  const jpegBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPEG'))),
      'image/jpeg',
      quality
    );
  });

  return jpegBlob;
}

export async function uploadProductImageToR2(options: {
  productId: string;
  dataUrl: string; // e.g. data:image/png;base64,...
}): Promise<{ url: string; key: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  // If user chose local-only, block cloud uploads until they opt in.
  const choice = localStorage.getItem(`offlineSyncChoice::${user.uid}`);
  if (choice && choice !== 'sync') {
    throw new Error('Cloud sync is disabled (local-only mode).');
  }

  const idToken = await user.getIdToken();
  const baseUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';
  const endpoint = baseUrl ? `${baseUrl}/api/upload-product-image` : '/api/upload-product-image';

  const blob = await dataUrlToJpegBlob(options.dataUrl, 0.88);

  const form = new FormData();
  form.append('productId', options.productId);
  // ext is ignored by backend (it always writes source.jpg), but we send consistent metadata
  form.append('ext', 'jpg');
  form.append('file', blob, `product-${options.productId}.jpg`);

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
