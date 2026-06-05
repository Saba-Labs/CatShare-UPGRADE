/**
 * MOQ (minimum order quantity) and quantity slab (tiered) pricing per catalogue row.
 */

import type { CatalogueData } from '../config/catalogueProductUtils';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { resolveListOfferEffective, type ResolvedOfferPricing } from './offerPriceUtils';

export interface QuantityPriceSlab {
  minQty: number;
  maxQty?: number;
  price: number;
}

function parsePositiveInt(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function parsePositivePrice(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Clamp MOQ for catalogue data (1 = no explicit minimum beyond qty step). */
export function normalizeMinimumOrderQuantity(raw: unknown): number {
  const n = parsePositiveInt(raw);
  if (n < 1) return 1;
  return Math.min(n, 999999);
}

/** Lowest valid order qty given MOQ and pack/step size. */
export function getEffectiveMinimumOrderQuantity(moqRaw: unknown, stepRaw: unknown): number {
  const step = normalizeOrderQuantityStep(stepRaw);
  const moq = normalizeMinimumOrderQuantity(moqRaw);
  const target = moq <= 1 ? step : moq;
  return Math.ceil(target / step) * step;
}

/** Keep in-progress rows in the editor (price may still be 0). */
export function coerceEditorQuantitySlabs(raw: unknown): QuantityPriceSlab[] {
  if (!Array.isArray(raw)) return [];
  const slabs: QuantityPriceSlab[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const minQty = parsePositiveInt(row.minQty) || 1;
    const priceRaw = parseFloat(String(row.price ?? '').trim());
    const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0;
    const maxRaw = row.maxQty;
    const maxParsed =
      maxRaw != null && String(maxRaw).trim() !== '' ? parsePositiveInt(maxRaw) : 0;
    const maxQty = maxParsed >= minQty ? maxParsed : undefined;
    slabs.push({ minQty, maxQty, price });
  }
  return slabs;
}

/** Valid slabs only — used for pricing and persistence. */
export function normalizeQuantitySlabs(raw: unknown): QuantityPriceSlab[] {
  return coerceEditorQuantitySlabs(raw)
    .filter((slab) => slab.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

export function getSlabUnitPrice(slabs: QuantityPriceSlab[], quantity: number): number | null {
  if (!slabs.length || quantity <= 0) return null;
  let match: QuantityPriceSlab | null = null;
  for (const slab of slabs) {
    if (quantity >= slab.minQty && (slab.maxQty == null || quantity <= slab.maxQty)) {
      if (!match || slab.minQty > match.minQty) {
        match = slab;
      }
    }
  }
  return match?.price ?? null;
}

export function hasQuantitySlabs(catData: CatalogueData | Record<string, unknown> | null | undefined): boolean {
  return normalizeQuantitySlabs(catData?.quantitySlabs).length > 0;
}

export function formatQuantitySlabRange(slab: QuantityPriceSlab): string {
  if (slab.maxQty != null) return `${slab.minQty}–${slab.maxQty}`;
  return `${slab.minQty}+`;
}

/**
 * Resolve unit price for a quantity. Slabs override list/offer when configured.
 * Variant fixed prices are handled by callers before invoking this.
 */
export function resolveQuantityAwarePricing(
  catData: CatalogueData | Record<string, unknown> | null | undefined,
  priceField: string,
  fallbackProduct: Record<string, unknown> | null | undefined,
  quantity: number
): ResolvedOfferPricing & { hasSlabs: boolean; slabApplied: boolean } {
  const slabs = normalizeQuantitySlabs(catData?.quantitySlabs);
  const hasSlabs = slabs.length > 0;

  if (hasSlabs && quantity > 0) {
    const slabPrice = getSlabUnitPrice(slabs, quantity);
    if (slabPrice != null) {
      return {
        listPrice: slabPrice,
        offerPrice: null,
        effectiveUnitPrice: slabPrice,
        showStrikeout: false,
        hasSlabs: true,
        slabApplied: true,
      };
    }
  }

  const base = resolveListOfferEffective(catData, priceField, fallbackProduct);

  if (hasSlabs && quantity <= 0) {
    const display = slabs[0]?.price ?? 0;
    if (display > 0) {
      return {
        ...base,
        effectiveUnitPrice: display,
        hasSlabs: true,
        slabApplied: false,
      };
    }
  }

  return { ...base, hasSlabs, slabApplied: false };
}

/** Apply +/- delta respecting pack step and MOQ. Returns 0 when removed from cart. */
export function applyQuantityDelta(
  current: number,
  delta: number,
  stepRaw: unknown,
  moqRaw: unknown
): number {
  const step = normalizeOrderQuantityStep(stepRaw);
  const minQty = getEffectiveMinimumOrderQuantity(moqRaw, step);

  if (delta > 0) {
    if (current <= 0) return minQty;
    return current + step;
  }
  if (delta < 0) {
    const next = current - step;
    if (next < minQty) return 0;
    return next;
  }
  return current;
}

/** Round manual quantity entry to valid step/MOQ; 0 clears the line. */
export function roundQuantityToRules(raw: number, stepRaw: unknown, moqRaw: unknown): number {
  if (raw <= 0) return 0;
  const step = normalizeOrderQuantityStep(stepRaw);
  const minQty = getEffectiveMinimumOrderQuantity(moqRaw, step);
  const rounded = Math.max(step, Math.round(raw / step) * step);
  if (rounded < minQty) return minQty;
  return rounded;
}

/** Variant-level slab pricing stored in `customFields.quantitySlabs`. */
export function resolveVariantQuantityAwarePricing(
  variant: { price?: number; customFields?: Record<string, unknown> } | null | undefined,
  quantity: number
): (ResolvedOfferPricing & { hasSlabs: boolean; slabApplied: boolean }) | null {
  if (!variant) return null;
  const slabs = normalizeQuantitySlabs(variant.customFields?.quantitySlabs);
  if (!slabs.length) return null;

  const fallback =
    variant.price != null && typeof variant.price === 'number' && Number.isFinite(variant.price)
      ? { price1: variant.price }
      : null;

  return resolveQuantityAwarePricing({ quantitySlabs: slabs }, 'price1', fallback, quantity);
}

/** Variant row used when resolving which slab tiers to show or price. */
export type VariantSlabContext =
  | { price?: number; customFields?: Record<string, unknown> }
  | null
  | undefined;

export function getEffectiveQuantitySlabs(
  catData: CatalogueData | Record<string, unknown> | null | undefined,
  variant?: VariantSlabContext
): QuantityPriceSlab[] {
  const variantSlabs = normalizeQuantitySlabs(variant?.customFields?.quantitySlabs);
  if (variantSlabs.length > 0) return variantSlabs;

  // Fixed variant price without slabs — catalogue slabs must not show or apply.
  if (
    variant?.price != null &&
    typeof variant.price === 'number' &&
    Number.isFinite(variant.price)
  ) {
    return [];
  }

  return normalizeQuantitySlabs(catData?.quantitySlabs);
}

export function getProductOrderQuantityRules(
  catData: CatalogueData | Record<string, unknown> | null | undefined,
  variantCustomFields?: Record<string, unknown> | null
): { step: number; moq: number; minQty: number } {
  const step = normalizeOrderQuantityStep(
    variantCustomFields?.orderQuantityStep ?? catData?.orderQuantityStep
  );
  const moq = normalizeMinimumOrderQuantity(
    variantCustomFields?.minimumOrderQuantity ?? catData?.minimumOrderQuantity
  );
  return { step, moq, minQty: getEffectiveMinimumOrderQuantity(moq, step) };
}
