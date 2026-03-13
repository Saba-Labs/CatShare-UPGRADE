import { Handler } from '@netlify/functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { productId, dataUrl, ext } = body;

    if (!productId || !dataUrl) {
      return { statusCode: 400, body: 'Missing productId or dataUrl' };
    }

    // Convert base64 to buffer
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const mime = dataUrl.match(/^data:([^;]+)/)?.[1] || 'image/jpeg';
    const key = `products/${productId}.${ext || 'jpg'}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mime,
    }));

    const url = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    return {
      statusCode: 200,
      body: JSON.stringify({ url, key }),
    };
  } catch (err: any) {
    console.error('Upload error:', err);
    return { statusCode: 500, body: err.message };
  }
};