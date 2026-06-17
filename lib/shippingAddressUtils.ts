export type ShippingAddressInput = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

export type ShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
};

export function isCompleteShippingAddress(
  address: ShippingAddressInput | null | undefined
): address is ShippingAddress {
  if (!address) return false;
  const pin = String(address.pincode ?? '').replace(/\D/g, '');
  return Boolean(
    String(address.line1 ?? '').trim() &&
      String(address.city ?? '').trim() &&
      String(address.state ?? '').trim() &&
      pin.length === 6
  );
}

export function normalizeShippingAddress(
  input: ShippingAddressInput | null | undefined
): ShippingAddress | null {
  if (!input) return null;
  const normalized: ShippingAddress = {
    line1: String(input.line1 ?? '').trim(),
    city: String(input.city ?? '').trim(),
    state: String(input.state ?? '').trim(),
    pincode: String(input.pincode ?? '').replace(/\D/g, '').slice(0, 6),
    country: String(input.country ?? 'India').trim() || 'India',
  };
  const line2 = String(input.line2 ?? '').trim();
  if (line2) normalized.line2 = line2;
  return isCompleteShippingAddress(normalized) ? normalized : null;
}
