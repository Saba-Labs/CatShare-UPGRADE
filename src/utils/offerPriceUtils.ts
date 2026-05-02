/**
 * Optional per-catalogue offer (sale) price, stored as `{priceField}Offer` (e.g. price1Offer).
 * List/MRP stays in `priceField`; when offer is set and lower, UI shows offer prominently + struck list.
 */

import type { CatalogueData } from '../config/catalogueProductUtils';

/** e.g. price1 → price1Offer */
export function offerPriceFieldFor(priceField: string): string {
  return `${priceField}Offer`;
}

/** Catalogue list price keys (`price1` … `price10`) or offer keys (`price1Offer` …). */
export function isCataloguePriceOrOfferFieldName(name: string): boolean {
  return /^price\d+$/.test(name) || /^price\d+Offer$/.test(name);
}

/**
 * Allow digits and at most one `.` for decimal entry (strips letters/symbols; paste-safe).
 */
export function sanitizeDecimalPriceInput(raw: string): string {
  let out = '';
  let hasDot = false;
  for (const c of raw) {
    if (c >= '0' && c <= '9') {
      out += c;
      continue;
    }
    if (c === '.' && !hasDot) {
      out += c;
      hasDot = true;
    }
  }
  return out;
}

/**
 * Inline validation for Create Product: Offer must be strictly lower than Price when both are set.
 * Returns `null` when valid or when Offer is empty.
 */
export function getOfferVersusPriceValidationError(priceRaw: unknown, offerRaw: unknown): string | null {
  const offerTrim = String(offerRaw ?? '').trim();
  if (!offerTrim) return null;
  const o = parseFloat(offerTrim);
  if (!Number.isFinite(o)) return null;
  const p = parseFloat(String(priceRaw ?? '').trim());
  if (!Number.isFinite(p) || p <= 0) {
    return 'Set a valid Price before adding an Offer.';
  }
  if (o >= p) {
    return 'Offer must be lower than Price.';
  }
  return null;
}

/**
 * Struck-through list/MRP next to an offer: 25% smaller, 25% lower opacity than full strength.
 * Merge with `marginLeft` / `className` where needed.
 */
export const STRUCK_LIST_PRICE_STYLE: {
  textDecoration: 'line-through';
  fontSize: string;
  opacity: number;
} = {
  textDecoration: 'line-through',
  fontSize: '0.75em',
  opacity: 0.75,
};

export function parsePositiveNumber(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Prefer catalogue row; if list/offer missing or zero, use top-level product fields (sync/legacy). */
function pickPriceRaw(
  catData: Record<string, unknown> | null | undefined,
  field: string,
  fallback: Record<string, unknown> | null | undefined
): unknown {
  const a = catData?.[field];
  const b = fallback?.[field];
  if (parsePositiveNumber(a) > 0) return a;
  if (parsePositiveNumber(b) > 0) return b;
  return a ?? b ?? '';
}

export interface ResolvedOfferPricing {
  /** Original / list price from the catalogue price field */
  listPrice: number;
  /** Sale price when valid offer exists */
  offerPrice: number | null;
  /** Unit price for orders and totals */
  effectiveUnitPrice: number;
  /** Show struck-through list + emphasized offer */
  showStrikeout: boolean;
}

/**
 * Resolve list vs offer for a catalogue row. Offer must be > 0 and < list to activate sale display.
 */
export function resolveListOfferEffective(
  catData: CatalogueData | Record<string, unknown> | null | undefined,
  priceField: string,
  fallbackProduct?: Record<string, unknown> | null
): ResolvedOfferPricing {
  const offerField = offerPriceFieldFor(priceField);
  const cd = catData as Record<string, unknown> | undefined;
  const rawList = pickPriceRaw(cd, priceField, fallbackProduct ?? undefined);
  const rawOffer = pickPriceRaw(cd, offerField, fallbackProduct ?? undefined);

  const listPrice = parsePositiveNumber(rawList);
  const offerNum = parsePositiveNumber(rawOffer);

  const showStrikeout = listPrice > 0 && offerNum > 0 && offerNum < listPrice;
  const effectiveUnitPrice = showStrikeout ? offerNum : listPrice > 0 ? listPrice : offerNum;

  return {
    listPrice,
    offerPrice: showStrikeout ? offerNum : null,
    effectiveUnitPrice,
    showStrikeout,
  };
}
