/**
 * Shiprocket REST API client (server-only).
 * Docs: https://apidocs.shiprocket.in/
 */
const BASE_URL =
  String(process.env.SHIPROCKET_API_BASE_URL || '').trim() ||
  'https://apiv2.shiprocket.in';

export class ShiprocketApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ShiprocketApiError';
    this.status = status;
  }
}

export type ShiprocketAuthResult = {
  token: string;
  companyId: string | number | null;
  expiresAt: string;
};

export type ShiprocketPickupLocation = {
  id: number;
  pickup_location: string;
  address: string;
  address_2?: string;
  city: string;
  state: string;
  pin_code: string;
  phone?: string;
  email?: string;
};

export type ShiprocketCreateOrderResult = {
  orderId: number;
  shipmentId: number;
  status: string;
};

export type ShiprocketAssignAwbResult = {
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
};

function parseJsonMessage(body: Record<string, unknown>): string {
  const msg =
    body.message ??
    body.error ??
    body.errors ??
    body.status_message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  return 'Shiprocket request failed';
}

async function shiprocketFetch<T>(
  path: string,
  init: RequestInit & { token?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) {
    headers.Authorization = `Bearer ${init.token}`;
  }

  const { token: _token, ...rest } = init;
  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new ShiprocketApiError(parseJsonMessage(body), res.status);
  }

  return body as T;
}

export async function shiprocketLogin(
  email: string,
  password: string
): Promise<ShiprocketAuthResult> {
  const body = await shiprocketFetch<Record<string, unknown>>(
    '/v1/external/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    }
  );

  const token = String(body.token ?? '');
  if (!token) {
    throw new ShiprocketApiError('Shiprocket did not return an auth token');
  }

  const companyId =
    body.company_id ?? body.companyId ?? body.id ?? body.user_id ?? null;

  return {
    token,
    companyId: companyId as string | number | null,
    expiresAt: new Date(Date.now() + 240 * 60 * 60 * 1000).toISOString(),
  };
}

export async function fetchShiprocketPickupLocations(
  token: string
): Promise<ShiprocketPickupLocation[]> {
  const body = await shiprocketFetch<Record<string, unknown>>(
    '/v1/external/settings/company/pickup',
    { method: 'GET', token }
  );

  const data = body.data;
  if (data && typeof data === 'object') {
    const shipping = (data as Record<string, unknown>).shipping_address;
    if (Array.isArray(shipping)) {
      return shipping as ShiprocketPickupLocation[];
    }
  }
  if (Array.isArray(body.shipping_address)) {
    return body.shipping_address as ShiprocketPickupLocation[];
  }
  if (Array.isArray(body.data)) {
    return body.data as ShiprocketPickupLocation[];
  }
  return [];
}

export function formatPickupAddress(loc: ShiprocketPickupLocation): string {
  const parts = [
    loc.address,
    loc.address_2,
    loc.city,
    loc.state,
    loc.pin_code,
  ].filter(Boolean);
  return parts.join(', ');
}

export type ShiprocketOrderInput = {
  orderId: string;
  orderDate: string;
  pickupLocation: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  billingCountry?: string;
  paymentMethod: 'COD' | 'Prepaid';
  subTotal: number;
  items: Array<{
    name: string;
    sku: string;
    units: number;
    sellingPrice: number;
  }>;
  weightKg?: number;
};

export async function createShiprocketAdhocOrder(
  token: string,
  input: ShiprocketOrderInput
): Promise<ShiprocketCreateOrderResult> {
  const body = await shiprocketFetch<Record<string, unknown>>(
    '/v1/external/orders/create/adhoc',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        order_id: input.orderId,
        order_date: input.orderDate,
        pickup_location: input.pickupLocation,
        billing_customer_name: input.customerName,
        billing_last_name: '',
        billing_address: input.billingAddress,
        billing_city: input.billingCity,
        billing_pincode: input.billingPincode,
        billing_state: input.billingState,
        billing_country: input.billingCountry ?? 'India',
        billing_email: input.customerEmail ?? '',
        billing_phone: input.customerPhone,
        shipping_is_billing: true,
        order_items: input.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.units,
          selling_price: item.sellingPrice,
          discount: 0,
          tax: 0,
          hsn: 0,
        })),
        payment_method: input.paymentMethod,
        sub_total: input.subTotal,
        length: 10,
        breadth: 10,
        height: 10,
        weight: input.weightKg ?? 0.5,
      }),
    }
  );

  const payload = (body.payload ?? body) as Record<string, unknown>;
  const shipmentId = Number(payload.shipment_id ?? payload.shipmentId ?? 0);
  const orderId = Number(payload.order_id ?? payload.orderId ?? 0);

  if (!shipmentId) {
    throw new ShiprocketApiError('Shiprocket did not return a shipment id');
  }

  return {
    orderId,
    shipmentId,
    status: String(payload.status ?? body.status ?? 'NEW'),
  };
}

export async function assignShiprocketAwb(
  token: string,
  shipmentId: number
): Promise<ShiprocketAssignAwbResult> {
  const body = await shiprocketFetch<Record<string, unknown>>(
    '/v1/external/courier/assign/awb',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ shipment_id: shipmentId }),
    }
  );

  const response = (body.response ?? body) as Record<string, unknown>;
  const data = (response.data ?? response) as Record<string, unknown>;

  return {
    awbCode: data.awb_code != null ? String(data.awb_code) : null,
    courierName: data.courier_name != null ? String(data.courier_name) : null,
    trackingUrl:
      data.awb_assign_error == null && data.awb_code
        ? `https://shiprocket.co/tracking/${data.awb_code}`
        : null,
  };
}

/** Cancel shipments by AWB before dispatch (Shiprocket API). */
export async function cancelShiprocketShipmentAwbs(
  token: string,
  awbs: string[]
): Promise<void> {
  const cleaned = awbs.map((a) => a.trim()).filter(Boolean);
  if (!cleaned.length) {
    throw new ShiprocketApiError('AWB is required to cancel shipment');
  }

  await shiprocketFetch<Record<string, unknown>>(
    '/v1/external/orders/cancel/shipment/awbs',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ awbs: cleaned }),
    }
  );
}

/** Cancel Shiprocket orders by internal order id (before shipping). */
export async function cancelShiprocketOrders(
  token: string,
  orderIds: number[]
): Promise<void> {
  const ids = orderIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) {
    throw new ShiprocketApiError('Shiprocket order id is required to cancel');
  }

  await shiprocketFetch<Record<string, unknown>>('/v1/external/orders/cancel', {
    method: 'POST',
    token,
    body: JSON.stringify({ ids }),
  });
}
