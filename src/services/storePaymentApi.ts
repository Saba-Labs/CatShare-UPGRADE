export type RazorpayCheckoutSession = {
  keyId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
};

async function apiJson(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Payment request failed');
  }
  return body;
}

export async function beginStoreRazorpayCheckout(
  orderId: string
): Promise<RazorpayCheckoutSession> {
  const body = await apiJson('/api/store-payments/razorpay/begin', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
  const checkout = body.checkout as RazorpayCheckoutSession | undefined;
  if (!checkout?.keyId || !checkout.razorpayOrderId) {
    throw new Error('Invalid payment session');
  }
  return checkout;
}

export async function confirmStoreRazorpayCheckout(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<void> {
  await apiJson('/api/store-payments/razorpay/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(script);
  });
}

export async function openStoreRazorpayCheckout(
  session: RazorpayCheckoutSession,
  storeName: string
): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) {
    throw new Error('Razorpay checkout is unavailable');
  }

  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency,
      name: storeName || 'Store',
      description: 'Order payment',
      order_id: session.razorpayOrderId,
      prefill: {
        name: session.customerName,
        contact: session.customerPhone,
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await confirmStoreRazorpayCheckout({
            orderId: session.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.open();
  });
}
