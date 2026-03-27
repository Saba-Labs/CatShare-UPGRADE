import type { Handler } from "@netlify/functions";
import {
  isAllowedPublicImageUrl,
  serverFetchImageAsDataUrl,
} from "../../lib/publicImageProxy.js";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const url = event.queryStringParameters?.url || "";
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing url" }) };
  }

  if (!isAllowedPublicImageUrl(url)) {
    return { statusCode: 403, body: JSON.stringify({ error: "URL not allowed" }) };
  }

  try {
    const dataUrl = await serverFetchImageAsDataUrl(url);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: msg }),
    };
  }
};
