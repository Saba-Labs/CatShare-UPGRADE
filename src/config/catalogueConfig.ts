/**
 * Catalogue Management System
 *
 * Supports dynamic creation of multiple catalogues (originally Wholesale and Resell)
 * Each catalogue has its own pricing fields and stock status field
 *
 * Backward Compatibility:
 * - Old products with price1/price2 and wholesaleStock/resellStock are automatically
 *   mapped to default catalogues "Catalogue 1" and "Catalogue 2"
 * - Existing backups and data remain unchanged and work seamlessly
 */

import { getPersistedAuthUserId } from '../utils/authUserId';
import { getStorageKey } from '../utils/safeStorage';

export interface Catalogue {
  id: string; // unique identifier (e.g., "cat1", "cat2", "custom1")
  label: string; // Display name (e.g., "Catalogue 1", "Catalogue 2", "Distributor")
  priceField: string; // Price field key (e.g., "price1", "price2", "price3")
  priceUnitField: string; // Unit field (e.g., "price1Unit", "price2Unit")
  stockField: string; // Stock field (e.g., "wholesaleStock", "resellStock", "distributorStock")
  folder: string; // Folder name for rendered images (e.g., "Wholesale", "Resell")
  order: number; // Display order in tabs
  createdAt: number;
  isDefault?: boolean; // True for default catalogues (can't be deleted)
  heroImage?: string; // Hero image URL or base64 data
  description?: string; // Catalogue description
  /** Inventory room this catalogue sells from (warehouse model) */
  inventoryId?: string | null;
}

export interface CataloguesDefinition {
  version: number;
  catalogues: Catalogue[];
  lastUpdated: number;
}

// Default catalogues - now only Master catalogue
// Old Wholesale/Resell catalogues are auto-created on restore if legacy data exists
export const DEFAULT_CATALOGUES: Catalogue[] = [
  {
    id: "cat1",
    label: "Master",
    priceField: "price1",
    priceUnitField: "price1Unit",
    stockField: "wholesaleStock",
    folder: "Master",
    order: 1,
    createdAt: Date.now(),
    isDefault: true,
    heroImage: "",
    description: "",
  },
];

/** Legacy second catalogue (Wholesale / Resell split). Used when storefront `catalogueId` is cat2 but cloud definition is missing. */
export const LEGACY_RESELL_CATALOGUE: Catalogue = {
  id: "cat2",
  label: "Resell",
  priceField: "price2",
  priceUnitField: "price2Unit",
  stockField: "resellStock",
  folder: "Resell",
  order: 2,
  createdAt: Date.now(),
  isDefault: false,
  heroImage: "",
  description: "",
};

/**
 * Public storefront: ensure we have a {@link Catalogue} row for `store.catalogueId` so `priceField` / stock / sync match the linked catalogue.
 * When cloud `cataloguesDefinition` is empty or RLS-blocked, guests only had DEFAULT (cat1) — Resell/cat2 stores showed wrong prices and fields.
 */
export function ensureCataloguesForStorefront(
  catalogues: Catalogue[] | null | undefined,
  storeCatalogueId: string | undefined | null
): Catalogue[] {
  const cid = String(storeCatalogueId ?? "").trim();
  let list =
    Array.isArray(catalogues) && catalogues.length > 0 ? [...catalogues] : [...DEFAULT_CATALOGUES];
  if (!cid || list.some((c) => c.id === cid)) return list;
  if (cid === "cat2") {
    list.push({ ...LEGACY_RESELL_CATALOGUE, createdAt: Date.now() });
    return list;
  }
  /** Never infer `price${n}` from ids like `cat1769532482549` — that produced bogus `price176953…` columns. */
  return list;
}

/**
 * When `cataloguesDefinition` has no row for a custom catalogue id, infer `priceField` / `stockField` from
 * `product.catalogueData[catalogueId]` (e.g. `price3`, `price3Stock`) so the storefront matches Supabase JSON.
 */
export function inferCatalogueStubFromRowData(
  catalogueId: string,
  row: Record<string, unknown> | null | undefined
): Catalogue | null {
  const cid = String(catalogueId ?? "").trim();
  if (!cid || !row || typeof row !== "object") return null;

  const priceIndices: number[] = [];
  for (const k of Object.keys(row)) {
    const m = /^price(\d+)$/.exec(k);
    if (m) priceIndices.push(parseInt(m[1], 10));
  }
  const unique = [...new Set(priceIndices)]
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 99)
    .sort((a, b) => a - b);
  if (unique.length === 0) return null;

  let chosen = unique[0];
  for (const n of unique) {
    const raw = row[`price${n}`];
    const num = parseFloat(String(raw ?? "").trim());
    if (Number.isFinite(num) && num > 0) {
      chosen = n;
      break;
    }
  }
  if (parseFloat(String(row[`price${chosen}`] ?? "").trim()) <= 0) {
    for (let i = unique.length - 1; i >= 0; i--) {
      const n = unique[i];
      const raw = row[`price${n}`];
      if (raw != null && String(raw).trim() !== "") {
        chosen = n;
        break;
      }
    }
  }

  const stockKey = `price${chosen}Stock`;
  const stockField = Object.prototype.hasOwnProperty.call(row, stockKey)
    ? stockKey
    : "wholesaleStock";

  return {
    id: cid,
    label: "Catalogue",
    priceField: `price${chosen}`,
    priceUnitField: `price${chosen}Unit`,
    stockField,
    folder: cid,
    order: chosen,
    createdAt: Date.now(),
    isDefault: false,
    heroImage: "",
    description: "",
  };
}

/**
 * Repair shapes that omit `catalogues` (e.g. { "0": cat, "1": cat, lastUpdated }) from bad sync/serialization.
 */
function normalizeCataloguesDefinition(raw: unknown): CataloguesDefinition {
  if (raw == null || typeof raw !== 'object') {
    return { version: 1, catalogues: [...DEFAULT_CATALOGUES], lastUpdated: Date.now() };
  }
  if (Array.isArray(raw)) {
    const catalogues = raw.length > 0 ? (raw as Catalogue[]) : [...DEFAULT_CATALOGUES];
    return { version: 1, catalogues, lastUpdated: Date.now() };
  }
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.catalogues)) {
    const catalogues =
      o.catalogues.length > 0 ? (o.catalogues as Catalogue[]) : [...DEFAULT_CATALOGUES];
    return {
      version: typeof o.version === 'number' ? o.version : 1,
      catalogues,
      lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : Date.now(),
    };
  }
  const numericKeys = Object.keys(o)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  const fromNumeric = numericKeys
    .map((k) => o[k])
    .filter((x) => x != null && typeof x === 'object');
  if (fromNumeric.length > 0) {
    return {
      version: typeof o.version === 'number' ? o.version : 1,
      catalogues: fromNumeric as Catalogue[],
      lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : Date.now(),
    };
  }
  return { version: 1, catalogues: [...DEFAULT_CATALOGUES], lastUpdated: Date.now() };
}

/**
 * Extract a usable catalogue list from cloud JSON (`user_settings` or `catalogues_definition.data`).
 * Returns null if nothing usable — do not substitute defaults (public storefront must not invent cat1-only).
 */
export function tryExtractCataloguesArray(raw: unknown): Catalogue[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? (raw as Catalogue[]) : null;
  }
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.catalogues) && o.catalogues.length > 0) {
    return o.catalogues as Catalogue[];
  }
  const numericKeys = Object.keys(o)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  const fromNumeric = numericKeys
    .map((k) => o[k])
    .filter((x) => x != null && typeof x === 'object');
  if (fromNumeric.length > 0) {
    return fromNumeric as Catalogue[];
  }
  return null;
}

/**
 * Merge user_settings and managed catalogue lists for public storefront.
 * Managed `catalogues_definition` wins for warehouse fields (`inventoryId`) when present.
 */
export function mergeStorefrontCatalogueDefinitions(
  fromUserSettings: Catalogue[] | null | undefined,
  fromManaged: Catalogue[] | null | undefined
): Catalogue[] | null {
  const settings = fromUserSettings ?? [];
  const managed = fromManaged ?? [];
  if (settings.length === 0 && managed.length === 0) return null;
  if (settings.length === 0) return managed;
  if (managed.length === 0) return settings;

  const managedById = new Map(managed.map((c) => [c.id, c]));
  const merged = settings.map((c) => {
    const m = managedById.get(c.id);
    if (!m) return c;
    const inventoryId = m.inventoryId?.trim() || c.inventoryId?.trim() || null;
    if (inventoryId && inventoryId !== c.inventoryId) {
      return { ...c, inventoryId };
    }
    if (m.inventoryId && !c.inventoryId) {
      return { ...c, inventoryId: m.inventoryId };
    }
    return c;
  });
  for (const m of managed) {
    if (!merged.some((c) => c.id === m.id)) merged.push(m);
  }
  return merged;
}

/**
 * Get current catalogues definition from localStorage
 * Falls back to defaults if not found (first time setup)
 * @param userId - Optional user ID for keyed storage
 */
export function getCataloguesDefinition(userId?: string): CataloguesDefinition {
  try {
    // Determine storage key
    let storageKey = "cataloguesDefinition";
    if (userId) {
      storageKey = getStorageKey("cataloguesDefinition", userId);
    } else {
      const authUserId = getPersistedAuthUserId();
      if (authUserId) {
        storageKey = getStorageKey("cataloguesDefinition", authUserId);
      }
    }

    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as CataloguesDefinition;
      const normalized = normalizeCataloguesDefinition(parsed);
      const hadValidCataloguesArray =
        parsed != null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Array.isArray((parsed as { catalogues?: unknown }).catalogues);
      if (!hadValidCataloguesArray) {
        const effectiveUserId = userId || getPersistedAuthUserId() || '';
        if (effectiveUserId) {
          setCataloguesDefinition(normalized, effectiveUserId);
        } else {
          try {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          } catch {
            /* ignore */
          }
        }
      }
      return normalized;
    }
  } catch (err) {
    console.warn("Failed to parse cataloguesDefinition:", err);
  }

  // Return default catalogues on first load
  return {
    version: 1,
    catalogues: DEFAULT_CATALOGUES,
    lastUpdated: Date.now(),
  };
}

/**
 * Save catalogues definition to localStorage
 * @param definition - The catalogue definition to save
 * @param userId - Optional user ID for keyed storage
 */
export function setCataloguesDefinition(definition: CataloguesDefinition, userId?: string): void {
  try {
    const updated = {
      ...definition,
      lastUpdated: Date.now(),
    };

    // Determine storage key
    const effectiveUserId = userId || getPersistedAuthUserId() || '';
    const storageKey = effectiveUserId ? getStorageKey("cataloguesDefinition", effectiveUserId) : "cataloguesDefinition";

    localStorage.setItem(storageKey, JSON.stringify(updated));

    // Dispatch event to notify all listening components to refresh their catalogue state
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("catalogues-changed", {
        detail: { action: "update", catalogues: updated.catalogues }
      }));
    }
  } catch (err) {
    console.error("Failed to save cataloguesDefinition:", err);
  }
}

/**
 * Get all catalogues (sorted by order)
 * @param userId - Optional user ID for keyed storage
 */
export function getAllCatalogues(userId?: string): Catalogue[] {
  const definition = getCataloguesDefinition(userId);
  return [...definition.catalogues].sort((a, b) => a.order - b.order);
}

/**
 * Get a specific catalogue by ID
 * @param id - Catalogue ID
 * @param userId - Optional user ID for keyed storage
 */
export function getCatalogueById(id: string, userId?: string): Catalogue | undefined {
  const definition = getCataloguesDefinition(userId);
  return definition.catalogues.find((c) => c.id === id);
}

/**
 * Get catalogue by folder name (for backward compatibility)
 * e.g., "Wholesale" -> cat1, "Resell" -> cat2
 * @param folder - Folder name
 * @param userId - Optional user ID for keyed storage
 */
export function getCatalogueByFolder(folder: string, userId?: string): Catalogue | undefined {
  const definition = getCataloguesDefinition(userId);
  return definition.catalogues.find((c) => c.folder === folder);
}

/**
 * Add a new catalogue
 * Returns the created catalogue or null if failed
 * @param label - Catalogue label
 * @param options - Optional catalogue options
 * @param userId - Optional user ID for keyed storage
 */
export function addCatalogue(
  label: string,
  options?: Partial<Omit<Catalogue, "id" | "createdAt">>,
  userId?: string
): Catalogue | null {
  const definition = getCataloguesDefinition(userId);

  // Generate unique ID
  const id = `cat${Date.now()}`;

  // Auto-generate unique price field name if not provided
  let priceFieldNum = definition.catalogues.length + 1;
  let priceField = options?.priceField || `price${priceFieldNum}`;

  // Ensure the generated priceField is truly unique
  while (definition.catalogues.some(c => c.priceField === priceField)) {
    priceFieldNum++;
    priceField = `price${priceFieldNum}`;
  }

  const priceUnitField = options?.priceUnitField || `${priceField}Unit`;
  const stockField = options?.stockField || `${priceField}Stock`;
  const folder = options?.folder || `Catalogue${priceFieldNum}`;

  const newCatalogue: Catalogue = {
    id,
    label,
    priceField,
    priceUnitField,
    stockField,
    folder,
    order: Math.max(...definition.catalogues.map((c) => c.order)) + 1,
    createdAt: Date.now(),
    ...options,
  };

  definition.catalogues.push(newCatalogue);
  setCataloguesDefinition(definition, userId);

  return newCatalogue;
}

/**
 * Update an existing catalogue
 * @param id - Catalogue ID
 * @param updates - Updates to apply
 * @param userId - Optional user ID for keyed storage
 */
export function updateCatalogue(
  id: string,
  updates: Partial<Catalogue>,
  userId?: string
): Catalogue | null {
  const definition = getCataloguesDefinition(userId);
  const index = definition.catalogues.findIndex((c) => c.id === id);

  if (index === -1) {
    console.error(`Catalogue ${id} not found`);
    return null;
  }

  definition.catalogues[index] = {
    ...definition.catalogues[index],
    ...updates,
    id, // Prevent ID changes
    createdAt: definition.catalogues[index].createdAt, // Prevent timestamp changes
  };

  setCataloguesDefinition(definition, userId);
  return definition.catalogues[index];
}

/**
 * Delete a catalogue (cannot delete default catalogues)
 * @param id - Catalogue ID
 * @param userId - Optional user ID for keyed storage
 */
export function deleteCatalogue(id: string, userId?: string): boolean {
  const definition = getCataloguesDefinition(userId);
  const catalogue = definition.catalogues.find((c) => c.id === id);

  if (!catalogue) {
    console.error(`Catalogue ${id} not found`);
    return false;
  }

  if (catalogue.isDefault) {
    console.error(`Cannot delete default catalogue: ${id}`);
    return false;
  }

  definition.catalogues = definition.catalogues.filter((c) => c.id !== id);
  setCataloguesDefinition(definition, userId);

  return true;
}

/**
 * Reorder catalogues (for tab arrangement)
 * Pass array of catalogue IDs in desired order
 * @param ids - Array of catalogue IDs in desired order
 * @param userId - Optional user ID for keyed storage
 */
export function reorderCatalogues(ids: string[], userId?: string): boolean {
  const definition = getCataloguesDefinition(userId);

  // Validate all IDs exist
  if (!ids.every((id) => definition.catalogues.some((c) => c.id === id))) {
    console.error("One or more catalogue IDs not found");
    return false;
  }

  // Update order
  definition.catalogues = definition.catalogues.map((c) => ({
    ...c,
    order: ids.indexOf(c.id),
  }));

  setCataloguesDefinition(definition, userId);
  return true;
}

/**
 * Reset to default catalogues
 * (Use with caution - this discards any custom catalogues)
 * @param userId - Optional user ID for keyed storage
 */
export function resetToDefaultCatalogues(userId?: string): void {
  const definition: CataloguesDefinition = {
    version: 1,
    catalogues: DEFAULT_CATALOGUES,
    lastUpdated: Date.now(),
  };
  setCataloguesDefinition(definition, userId);
}

/**
 * Check if old data exists (products with price1/price2)
 * Used for migration warnings
 */
export function hasLegacyProducts(): boolean {
  try {
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    return products.some(
      (p: any) =>
        p.price1 !== undefined ||
        p.price2 !== undefined ||
        p.wholesaleStock !== undefined ||
        p.resellStock !== undefined
    );
  } catch {
    return false;
  }
}

/**
 * Check if products have resell/catalogue 2 data
 * Used during restore to auto-create legacy Resell catalogue if needed
 * @param products Array of products to check
 * @returns true if any product has resellStock or price2 data
 */
export function hasLegacyResellData(products: any[]): boolean {
  return products.some(
    (p: any) =>
      (p.resellStock !== undefined && p.resellStock !== null) ||
      (p.price2 !== undefined && p.price2 !== null) ||
      (p.catalogueData?.cat2 !== undefined && p.catalogueData?.cat2 !== null) ||
      (p.catalogueData?.cat2?.enabled === true)
  );
}

/**
 * Auto-create legacy Resell catalogue if restoring old backup with resell data
 * This ensures backward compatibility without affecting data
 */
export function createLegacyResellCatalogueIfNeeded(products: any[]): void {
  // Check if Resell catalogue or price2 field already exists
  const definition = getCataloguesDefinition();
  const hasResellCatalogue = definition.catalogues.some((c) => c.id === "cat2");
  const hasPrice2Field = definition.catalogues.some((c) => c.priceField === "price2");

  if (hasResellCatalogue || hasPrice2Field) {
    console.log("ℹ️ Legacy Resell catalogue or price2 field already exists, skipping auto-creation");
    return; // Already exists, nothing to do
  }

  // Check if there's actual resell data in the products
  if (!hasLegacyResellData(products)) {
    return; // No resell data, no need to create
  }

  definition.catalogues.push({ ...LEGACY_RESELL_CATALOGUE, createdAt: Date.now() });
  setCataloguesDefinition(definition);

  console.log(
    "✅ Auto-created legacy Resell catalogue for backward compatibility with restored backup"
  );
}
