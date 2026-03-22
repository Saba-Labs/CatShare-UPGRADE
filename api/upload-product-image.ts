import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSupabaseUserFromRequest } from "./_supabaseAuth";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseMultipart(buffer: Buffer, boundary: string) {
  const parts: Array<{
    name: string;
    filename: string | null;
    contentType: string | null;
    data: Buffer;
  }> = [];
  const boundaryLine = `--${boundary}`;
  const chunks = buffer.toString("binary").split(boundaryLine);
  for (const chunk of chunks) {
    if (!chunk.trim() || chunk.trim() === "--") continue;
    const headerEnd = chunk.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = chunk.slice(0, headerEnd);
    const body = chunk.slice(headerEnd + 4);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : null;
    const filename = filenameMatch ? filenameMatch[1] : null;
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : null;
    if (name) {
      parts.push({
        name,
        filename,
        contentType,
        data: Buffer.from(body.replace(/\r\n$/, ""), "binary"),
      });
    }
  }
  return parts;
}

async function readRequestBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authResult = await getSupabaseUserFromRequest(req.headers.authorization);
  if (!authResult.ok) {
    return res.status(401).json({ error: authResult.error });
  }
  const user = authResult.user;

  const buffer = await readRequestBody(req);

  const contentTypeHeader = req.headers["content-type"] || "";
  const boundaryMatch = contentTypeHeader.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    return res.status(400).json({ error: "Invalid multipart request" });
  }
  const boundary = boundaryMatch[1];
  const parts = parseMultipart(buffer, boundary);

  const productIdPart = parts.find((p) => p.name === "productId");
  const extPart = parts.find((p) => p.name === "ext");
  const filePart = parts.find((p) => p.name === "file" && p.filename);

  if (!productIdPart || !filePart) {
    return res.status(400).json({ error: "Missing productId or file" });
  }

  const productId = productIdPart.data.toString("utf8").trim();
  const ext = extPart ? extPart.data.toString("utf8").trim() : "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";

  const key = `products/${user.id}/${productId}.${safeExt}`;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return res.status(500).json({ error: "R2 configuration missing" });
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const fileContentType = filePart.contentType || "application/octet-stream";

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: filePart.data,
        ContentType: fileContentType,
      })
    );
  } catch (err) {
    console.error("R2 upload failed:", err);
    return res.status(500).json({ error: "Upload failed" });
  }

  const url = `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
  return res.status(200).json({ url, key });
}
