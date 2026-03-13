import { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { IncomingForm } from 'formidable';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = new IncomingForm();
    const [fields, files] = await form.parse(req);

    const productId = Array.isArray(fields.productId) ? fields.productId[0] : fields.productId;
    const ext = Array.isArray(fields.ext) ? fields.ext[0] : fields.ext;
    const fileArray = files.file;
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    if (!productId) {
      return res.status(400).json({ error: 'Missing productId' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Missing file' });
    }

    const key = `products/${productId}.${ext || 'jpg'}`;
    const mime = file.mimetype || 'image/jpeg';

    // Read file from disk
    const fs = await import('fs').then(m => m.promises);
    const fileBuffer = await fs.readFile(file.filepath);

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: fileBuffer,
      ContentType: mime,
    }));

    const url = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    return res.status(200).json({ url, key });
  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
};
