var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/upload-product-image.ts
var upload_product_image_exports = {};
__export(upload_product_image_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(upload_product_image_exports);
var import_client_s3 = require("@aws-sdk/client-s3");
var s3 = new import_client_s3.S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { productId, dataUrl, ext } = body;
    if (!productId || !dataUrl) {
      return { statusCode: 400, body: "Missing productId or dataUrl" };
    }
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const mime = dataUrl.match(/^data:([^;]+)/)?.[1] || "image/jpeg";
    const key = `products/${productId}.${ext || "jpg"}`;
    await s3.send(new import_client_s3.PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mime
    }));
    const url = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    return {
      statusCode: 200,
      body: JSON.stringify({ url, key })
    };
  } catch (err) {
    console.error("Upload error:", err);
    return { statusCode: 500, body: err.message };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=upload-product-image.js.map
