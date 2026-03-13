import { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = req.body;
    const productId = formData.productId || req.query.productId;
    const ext = formData.ext || 'jpg';
    const file = req.file;

    if (!productId) {
      return res.status(400).json({ error: 'Missing productId' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Missing file' });
    }

    const key = `products/${productId}.${ext}`;
    const mime = file.mimetype || 'image/jpeg';

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: file.data,
      ContentType: mime,
    }));

    const url = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    return res.status(200).json({ url, key });
  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
};
