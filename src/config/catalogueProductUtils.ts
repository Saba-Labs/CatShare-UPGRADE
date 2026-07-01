/**
 * Utilities for managing per-catalogue product data
 * 
 * Products can have catalogue-specific details (price, stock, etc.)
 * while keeping image, name, and basic info common across all catalogues.
 */

import { getAllCatalogues, type Catalogue } from './catalogueConfig';
import { offerPriceFieldFor } from '../utils/offerPriceUtils';
import type { QuantityPriceSlab } from '../utils/quantityPricingUtils';
import { normalizeMinimumOrderQuantity } from '../utils/quantityPricingUtils';

/**
 * Keep `product.catalogueData[catId]` in sync with top-level **price/stock** columns (`price1`, `wholesaleStock`, …).
 * Master (`cat1`) also mirrors shared grid fields from the product top-level (`field1`…, units, badge) — legacy seller UX.
 * Other catalogues keep **per-row** `field1`…`field10` from `catalogueData[catId]` so the public store can show
 * catalogue-specific copy when the store is linked to Resell / custom ids.
 */
export function syncTopLevelFieldsIntoCatalogueData(
  product: ProductWithCatalogueData,
  catalogues: Catalogue[]
): ProductWithCatalogueData {
  if (!product || !Array.isArray(catalogues) || catalogues.length === 0) {
    return product;
  }

  const nextCd: Record<string, CatalogueData> = product.catalogueData
    ? { ...product.catalogueData }
    : {};

  for (const cat of catalogues) {
    const prev: Partial<CatalogueData> =
      nextCd[cat.id] && typeof nextCd[cat.id] === 'object' ? { ...nextCd[cat.id] } : {};

    const offerField = offerPriceFieldFor(cat.priceField);
    const priceValue = product?.[cat.priceField] || '';
    const priceUnitValue = product?.[cat.priceUnitField] || '/ piece';
    const offerValue = product?.[offerField];
    const stockValue = product?.[cat.stockField] !== false;

    const isMaster = cat.id === 'cat1';

    const base: CatalogueData = {
      ...getDefaultCatalogueData(cat.id),
      ...prev,
      enabled: prev.enabled !== undefined ? prev.enabled : cat.id === 'cat1',
      [cat.priceField]: priceValue,
      [cat.priceUnitField]: priceUnitValue,
      [offerField]:
        offerValue !== undefined && offerValue !== null ? String(offerValue) : '',
      [cat.stockField]: stockValue,
    };

    if (isMaster) {
      nextCd[cat.id] = {
        ...base,
        field1: product?.field1 || '',
        field2: product?.field2 || '',
        field3: product?.field3 || '',
        field4: product?.field4 || '',
        field5: product?.field5 || '',
        field6: product?.field6 || '',
        field7: product?.field7 || '',
        field8: product?.field8 || '',
        field9: product?.field9 || '',
        field10: product?.field10 || '',
        field1Unit: product?.field1Unit || 'None',
        field2Unit: product?.field2Unit || product?.packageUnit || 'None',
        field3Unit: product?.field3Unit || product?.ageUnit || 'None',
        field4Unit: product?.field4Unit || 'None',
        field5Unit: product?.field5Unit || 'None',
        field6Unit: product?.field6Unit || 'None',
        field7Unit: product?.field7Unit || 'None',
        field8Unit: product?.field8Unit || 'None',
        field9Unit: product?.field9Unit || 'None',
        field10Unit: product?.field10Unit || 'None',
        badge: product?.badge || '',
        orderQuantityStep: normalizeOrderQuantityStep(
          product?.orderQuantityStep ?? prev.orderQuantityStep
        ),
        minimumOrderQuantity: normalizeMinimumOrderQuantity(
          product?.minimumOrderQuantity ?? prev.minimumOrderQuantity
        ),
        stock: product?.stock !== false,
        wholesaleStock: product?.wholesaleStock !== false,
        resellStock: product?.resellStock !== false,
      };
    } else {
      // Non-master: catalogue row is source of truth — do not overwrite from top-level price/fields.
      nextCd[cat.id] = {
        ...getDefaultCatalogueData(cat.id),
        ...prev,
        enabled: prev.enabled !== undefined ? prev.enabled : false,
      };
    }
  }

  return { ...product, catalogueData: nextCd };
}

/** Clamp order step for catalogue data (1 = no restriction). */
export function normalizeOrderQuantityStep(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 999999);
}

export interface CatalogueData {
  enabled: boolean;
  field1?: string;
  field2?: string;
  field3?: string;
  field4?: string;
  field5?: string;
  field6?: string;
  field7?: string;
  field8?: string;
  field9?: string;
  field10?: string;
  price1?: string;
  price1Unit?: string;
  price2?: string;
  price2Unit?: string;
  field2Unit?: string;
  field3Unit?: string;
  field4Unit?: string;
  field5Unit?: string;
  field6Unit?: string;
  field7Unit?: string;
  field8Unit?: string;
  field9Unit?: string;
  field10Unit?: string;
  badge?: string;
  /** Order quantity must be 0 or a multiple of this (e.g. 12 = 12, 24, 36…). Default 1 = any quantity. */
  orderQuantityStep?: number;
  /** Minimum qty per line (1 = no extra minimum beyond qty step). Rounded up to step multiples. */
  minimumOrderQuantity?: number;
  /** Tiered unit prices by order quantity. When set, overrides single Price/Offer for matching qty. */
  quantitySlabs?: QuantityPriceSlab[];
  stock?: boolean;
  wholesaleStock?: boolean;
  resellStock?: boolean;
  [key: string]: any;
}

export interface ProductWithCatalogueData {
  id: string;
  name: string;
  subtitle?: string;
  /** Longer copy for the public store (product-level, not per catalogue). */
  description?: string;
  privateNotes?: string;
  imagePath?: string;
  image?: string;
  imageUrl?: string;
  imageVersion?: number;
  imageUrls?: string[];
  primaryImageIndex?: number;
  fontColor?: string;
  bgColor?: string;
  imageBgColor?: string;
  badge?: string;
  category?: string[];
  catalogueData?: Record<string, CatalogueData>;
  /** Size / colour / custom option groups (product-level). Combination details are per catalogue in `variants.combinations[].catalogueDetails`. */
  variants?: import('../utils/productVariants').ProductVariantsConfig;
  [key: string]: any;
}

/**
 * Initialize catalogue data for a product
 * Creates empty catalogue entries for all available catalogues
 */
export function initializeCatalogueData(product?: ProductWithCatalogueData): Record<string, CatalogueData> {
  const catalogues = getAllCatalogues();
  const catalogueData: Record<string, CatalogueData> = {};

  catalogues.forEach((cat) => {
    // If product already has catalogueData for this catalogue, preserve it
    const existingCatData = product?.catalogueData?.[cat.id];
    if (existingCatData) {
      catalogueData[cat.id] = { ...existingCatData };
      return;
    }

    // Dynamically get price field values based on catalogue configuration
    const priceValue = product?.[cat.priceField] || "";
    const priceUnitValue = product?.[cat.priceUnitField] || "/ piece";
    const offerField = offerPriceFieldFor(cat.priceField);
    const offerValue = product?.[offerField];
    const stockValue = product?.[cat.stockField] !== false;

    const isMaster = cat.id === "cat1";
    const common: CatalogueData = {
      enabled: cat.id === "cat1" ? true : false,
      [cat.priceField]: priceValue,
      [cat.priceUnitField]: priceUnitValue,
      [offerField]: offerValue !== undefined && offerValue !== null ? String(offerValue) : "",
      [cat.stockField]: stockValue,
    };

    if (isMaster) {
      catalogueData[cat.id] = {
        ...common,
        field1: product?.field1 || "",
        field2: product?.field2 || "",
        field3: product?.field3 || "",
        field4: product?.field4 || "",
        field5: product?.field5 || "",
        field6: product?.field6 || "",
        field7: product?.field7 || "",
        field8: product?.field8 || "",
        field9: product?.field9 || "",
        field10: product?.field10 || "",
        field2Unit: product?.field2Unit || product?.packageUnit || "None",
        field3Unit: product?.field3Unit || product?.ageUnit || "None",
        field4Unit: product?.field4Unit || "None",
        field5Unit: product?.field5Unit || "None",
        field6Unit: product?.field6Unit || "None",
        field7Unit: product?.field7Unit || "None",
        field8Unit: product?.field8Unit || "None",
        field9Unit: product?.field9Unit || "None",
        field10Unit: product?.field10Unit || "None",
        badge: product?.badge || "",
        orderQuantityStep: 1,
        minimumOrderQuantity: 1,
        quantitySlabs: [],
        stock: product?.stock !== false,
        wholesaleStock: product?.wholesaleStock !== false,
        resellStock: product?.resellStock !== false,
      };
    } else {
      catalogueData[cat.id] = {
        ...getDefaultCatalogueData(cat.id),
        ...common,
        orderQuantityStep: 1,
        minimumOrderQuantity: 1,
        quantitySlabs: [],
        stock: product?.stock !== false,
        wholesaleStock: product?.wholesaleStock !== false,
        resellStock: product?.resellStock !== false,
      };
    }
  });

  return catalogueData;
}

/**
 * Get catalogue data for a specific catalogue
 * Falls back to default values if the catalogue doesn't have specific data
 */
export function getCatalogueData(product: ProductWithCatalogueData, catalogueId: string): CatalogueData {
  if (!product.catalogueData) {
    return initializeCatalogueData(product)[catalogueId] || getDefaultCatalogueData(catalogueId);
  }

  const data = product.catalogueData[catalogueId];

  // If not found, return defaults for this catalogue
  if (!data) {
    return getDefaultCatalogueData(catalogueId);
  }

  // Ensure all required fields exist by merging with defaults
  return {
    ...getDefaultCatalogueData(catalogueId),
    ...data
  };
}

/**
 * Get default catalogue data structure
 */
export function getDefaultCatalogueData(catalogueId: string): CatalogueData {
  const catalogues = getAllCatalogues();
  const catalogue = catalogues.find(c => c.id === catalogueId);

  const defaults: CatalogueData = {
    enabled: catalogueId === 'cat1',
    field1: "",
    field2: "",
    field3: "",
    field4: "",
    field5: "",
    field6: "",
    field7: "",
    field8: "",
    field9: "",
    field10: "",
    field2Unit: "None",
    field3Unit: "None",
    field4Unit: "None",
    field5Unit: "None",
    field6Unit: "None",
    field7Unit: "None",
    field8Unit: "None",
    field9Unit: "None",
    field10Unit: "None",
    badge: "",
    orderQuantityStep: 1,
    minimumOrderQuantity: 1,
    quantitySlabs: [],
    stock: true,
    wholesaleStock: true,
    resellStock: true,
  };

  // Add dynamic price fields based on actual catalogue configuration
  if (catalogue) {
    defaults[catalogue.priceField] = "";
    defaults[catalogue.priceUnitField] = "/ piece";
    defaults[offerPriceFieldFor(catalogue.priceField)] = "";
    defaults[catalogue.stockField] = true;
  } else {
    // Fallback for legacy support (in case catalogue is deleted)
    defaults.price1 = "";
    defaults.price1Unit = "/ piece";
    defaults.price2 = "";
    defaults.price2Unit = "/ piece";
  }

  return defaults;
}

/**
 * Set catalogue data for a specific catalogue
 */
export function setCatalogueData(
  product: ProductWithCatalogueData,
  catalogueId: string,
  data: Partial<CatalogueData>
): ProductWithCatalogueData {
  if (!product.catalogueData) {
    product.catalogueData = initializeCatalogueData(product);
  }

  product.catalogueData[catalogueId] = {
    ...product.catalogueData[catalogueId],
    ...data,
  };

  return product;
}

/**
 * Check if a product is enabled for a catalogue
 */
export function isProductEnabledForCatalogue(product: ProductWithCatalogueData, catalogueId: string): boolean {
  if (!product.catalogueData) return catalogueId === 'cat1';
  return product.catalogueData[catalogueId]?.enabled || false;
}

/**
 * Guess stock field name when the visitor has no local {@link Catalogue} row for this id (e.g. public store).
 */
function inferStockFieldFromCatalogueRow(
  product: ProductWithCatalogueData,
  catalogueId: string
): string | null {
  const raw = product.catalogueData?.[catalogueId];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const stockKeys = Object.keys(r).filter((k) => /stock$/i.test(k) && typeof r[k] === 'boolean');
  if (stockKeys.length === 1) return stockKeys[0];
  if (stockKeys.length > 1) {
    const priceKeys = Object.keys(r).filter((k) => /^price\d+$/.test(k));
    for (const pk of priceKeys) {
      const candidate = `${pk}Stock`;
      if (stockKeys.includes(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * In-stock for this catalogue's stock field (same semantics as the seller grid: `p[stockField]`).
 * Used by the public store to hide out-of-stock items.
 */
export function isProductInStockForCatalogue(
  product: ProductWithCatalogueData,
  catalogueId: string,
  catalogue: Catalogue | null
): boolean {
  const catData = getCatalogueData(product, catalogueId);
  const stockField = catalogue?.stockField ?? inferStockFieldFromCatalogueRow(product, catalogueId);
  if (!stockField) return true;

  const fromCat = catData[stockField as keyof CatalogueData];
  const fromTop = (product as Record<string, unknown>)[stockField];
  // The seller UI often toggles top-level `wholesaleStock` (etc.) without rewriting
  // `catalogueData[catId]`, so merged catData can still be `true`. Treat either side as authoritative for OOS.
  if (typeof fromCat === 'boolean' && !fromCat) return false;
  if (typeof fromTop === 'boolean' && !fromTop) return false;
  return true;
}

/**
 * Enable/disable product for a catalogue
 */
export function setProductEnabledForCatalogue(
  product: ProductWithCatalogueData,
  catalogueId: string,
  enabled: boolean
): ProductWithCatalogueData {
  const catalogueData = product.catalogueData ? { ...product.catalogueData } : initializeCatalogueData(product);

  if (!catalogueData[catalogueId]) {
    catalogueData[catalogueId] = {
      ...getDefaultCatalogueData(catalogueId),
      enabled,
    };
  } else {
    // Create a new object for this catalogue to ensure React detects the change
    catalogueData[catalogueId] = {
      ...catalogueData[catalogueId],
      enabled: enabled,
    };
  }

  // Return a new product object with updated catalogueData to ensure React detects the change
  return {
    ...product,
    catalogueData: catalogueData,
  };
}

/**
 * Get all enabled catalogues for a product
 */
export function getEnabledCatalogues(product: ProductWithCatalogueData): string[] {
  if (!product.catalogueData) {
    return ['cat1'];
  }

  return Object.entries(product.catalogueData)
    .filter(([_, data]) => data.enabled)
    .map(([catId, _]) => catId);
}

/**
 * Ensure product has proper catalogue data structure
 * Used during migration from old product format
 */
export function ensureProductHasCatalogueData(product: ProductWithCatalogueData): ProductWithCatalogueData {
  if (!product.catalogueData) {
    product.catalogueData = initializeCatalogueData(product);
  }

  return product;
}

/** Deep-clone catalogueData before mutating stock so React and cloud sync see the change. */
function cloneProductForStockMutation(product: ProductWithCatalogueData): ProductWithCatalogueData {
  return {
    ...product,
    catalogueData: product.catalogueData
      ? JSON.parse(JSON.stringify(product.catalogueData))
      : undefined,
  };
}

/**
 * Set in/out stock for one catalogue on both the top-level stock column and `catalogueData[catId]`.
 * Legacy toggles only updated top-level fields; stale `catalogueData` false kept items out of stock.
 */
export function applyCatalogueStockChange(
  product: ProductWithCatalogueData,
  catalogueId: string,
  stockField: string,
  inStock: boolean
): ProductWithCatalogueData {
  const copy = cloneProductForStockMutation(product);
  copy[stockField] = inStock;
  return setCatalogueData(copy, catalogueId, { [stockField]: inStock });
}

/** Toggle stock using the same rules as the seller grid / public store visibility. */
export function toggleProductStockForCatalogue(
  product: ProductWithCatalogueData,
  catalogueId: string,
  stockField: string,
  catalogue: Catalogue | null
): ProductWithCatalogueData {
  const nextInStock = !isProductInStockForCatalogue(product, catalogueId, catalogue);
  return applyCatalogueStockChange(product, catalogueId, stockField, nextInStock);
}

/** Master toggle: apply the same in/out status to every catalogue row. */
export function applyMasterCatalogueStockChange(
  product: ProductWithCatalogueData,
  catalogues: Catalogue[],
  inStock: boolean
): ProductWithCatalogueData {
  let copy = cloneProductForStockMutation(product);
  for (const cat of catalogues) {
    copy[cat.stockField] = inStock;
    copy = setCatalogueData(copy, cat.id, { [cat.stockField]: inStock });
  }
  return copy;
}
