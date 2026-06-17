type RazorpayAccountProfile = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export class RazorpayApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RazorpayApiError';
    this.status = status;
  }
}

const RAZORPAY_API_BASE =
  String(process.env.RAZORPAY_API_BASE_URL || '').trim() || 'https://api.razorpay.com';

function basicAuthHeader(keyId: string, keySecret: string): string {
  const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return `Basic ${token}`;
}

export async function fetchRazorpayAccountProfile(
  keyId: string,
  keySecret: string
): Promise<RazorpayAccountProfile> {
  const response = await fetch(`${RAZORPAY_API_BASE}/v1/accounts`, {
    method: 'GET',
    headers: {
      Authorization: basicAuthHeader(keyId, keySecret),
    },
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const msg = String(
      (body.error as { description?: string } | undefined)?.description ??
        body.error_description ??
        body.description ??
        'Razorpay authentication failed'
    );
    throw new RazorpayApiError(msg, response.status);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return {};
  }
  return (items[0] ?? {}) as RazorpayAccountProfile;
}
