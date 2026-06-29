/** Build a UPI deep link (works on many Android UPI apps). */
export function buildUpiPaymentUrl(params: {
  vpa: string;
  payeeName?: string;
  amount: number;
  transactionNote?: string;
}): string {
  const vpa = params.vpa.trim();
  const query = new URLSearchParams();
  query.set('pa', vpa);
  if (params.payeeName?.trim()) query.set('pn', params.payeeName.trim());
  if (Number.isFinite(params.amount) && params.amount > 0) {
    query.set('am', params.amount.toFixed(2));
  }
  query.set('cu', 'INR');
  if (params.transactionNote?.trim()) {
    query.set('tn', params.transactionNote.trim().slice(0, 80));
  }
  return `upi://pay?${query.toString()}`;
}

export function normalizeUpiId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUpiId(vpa: string): boolean {
  const normalized = normalizeUpiId(vpa);
  if (!normalized) return false;
  return /^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i.test(normalized);
}
