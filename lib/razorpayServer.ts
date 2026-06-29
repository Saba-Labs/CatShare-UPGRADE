import { createHmac } from 'crypto';

type RazorpayAccountProfile = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  keyMode?: 'test' | 'live';
};

function razorpayKeyMode(keyId: string): 'test' | 'live' {
  return keyId.trim().startsWith('rzp_live_') ? 'live' : 'test';
}

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

function razorpayErrorMessage(
  body: Record<string, unknown>,
  status: number,
  fallback: string
): string {
  const apiMsg = String(
    (body.error as { description?: string } | undefined)?.description ??
      body.error_description ??
      body.description ??
      ''
  ).trim();

  if (status === 401) {
    return 'Invalid Razorpay Key ID or Key Secret. Use Test mode keys from the Razorpay dashboard.';
  }

  return apiMsg || fallback;
}

/** Validate standard merchant API keys (test or live). */
export async function fetchRazorpayAccountProfile(
  keyId: string,
  keySecret: string
): Promise<RazorpayAccountProfile> {
  const response = await fetch(`${RAZORPAY_API_BASE}/v1/orders?count=1`, {
    method: 'GET',
    headers: {
      Authorization: basicAuthHeader(keyId, keySecret),
    },
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new RazorpayApiError(
      razorpayErrorMessage(body, response.status, 'Razorpay authentication failed'),
      response.status
    );
  }

  // Standard merchant keys do not expose account profile via API; key id is enough for display.
  const mode = razorpayKeyMode(keyId);
  return {
    id: keyId.trim(),
    name: mode === 'live' ? 'Razorpay (Live)' : 'Razorpay (Test)',
    keyMode: mode,
  };
}

export type RazorpayCreateOrderResult = {
  id: string;
  amount: number;
  currency: string;
};

export async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  input: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }
): Promise<RazorpayCreateOrderResult> {
  const response = await fetch(`${RAZORPAY_API_BASE}/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(keyId, keySecret),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new RazorpayApiError(
      razorpayErrorMessage(body, response.status, 'Could not create Razorpay order'),
      response.status
    );
  }

  return {
    id: String(body.id ?? ''),
    amount: Number(body.amount ?? input.amountPaise),
    currency: String(body.currency ?? input.currency),
  };
}

export function verifyRazorpayPaymentSignature(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = createHmac('sha256', keySecret).update(payload).digest('hex');
  return expected === razorpaySignature;
}
