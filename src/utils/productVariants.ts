export const MAX_VARIANT_GROUPS = 6;
export const MAX_VARIANT_OPTIONS_PER_GROUP = 24;

export type ProductVariantGroup = {
  id: string;
  name: string;
  options: string[];
};

/** Per-catalogue fields for a variant combination (price, image, MOQ, slabs, stock, etc.). */
export type VariantCombinationDetails = {
  image?: string;
  price?: number;
  /** Legacy in/out when catalogue has no warehouse room (default in stock when unset). */
  inStock?: boolean;
  customFields?: Record<string, unknown>;
};

export type VariantCombination = {
  id: string; // generated from variant selections, e.g. "size-S|color-green"
  selections: Record<string, string>; // { sizeGroupId: "S", colorGroupId: "Green" }
  /** @deprecated Legacy shared details — fallback when catalogueDetails[catId] is absent */
  image?: string;
  price?: number;
  inStock?: boolean;
  customFields?: Record<string, unknown>;
  /** Per-catalogue variant details */
  catalogueDetails?: Record<string, VariantCombinationDetails>;
};

export type ResolvedVariantCombination = VariantCombinationDetails & {
  id: string;
  selections: Record<string, string>;
};

export type ProductVariantsConfig = {
  groups: ProductVariantGroup[];
  combinations?: VariantCombination[];
};

function newVariantGroupId(): string {
  return `vg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanOption(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function cleanGroupName(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s.length > 0 ? s.slice(0, 48) : "";
}

function hasNonemptyDetails(details: VariantCombinationDetails | undefined): boolean {
  if (!details) return false;
  if (details.inStock === false) return true;
  if (details.image) return true;
  if (details.price != null && Number.isFinite(details.price)) return true;
  const cf = details.customFields;
  if (!cf || typeof cf !== 'object') return false;
  return Object.values(cf).some((v) => v !== undefined && v !== null && v !== '');
}

function legacyDetailsFromCombo(combo: VariantCombination): VariantCombinationDetails | undefined {
  if (
    combo.image === undefined &&
    combo.price === undefined &&
    combo.inStock === undefined &&
    (!combo.customFields || Object.keys(combo.customFields).length === 0)
  ) {
    return undefined;
  }
  return {
    image: combo.image,
    price: combo.price,
    inStock: combo.inStock,
    customFields: combo.customFields,
  };
}

/** Resolve per-catalogue (or legacy) details for one combination row. */
export function extractVariantCombinationDetails(
  combo: VariantCombination,
  catalogueId?: string | null
): VariantCombinationDetails | undefined {
  if (catalogueId && combo.catalogueDetails?.[catalogueId]) {
    return combo.catalogueDetails[catalogueId];
  }

  const legacy = legacyDetailsFromCombo(combo);
  if (legacy) return legacy;

  if (!catalogueId && combo.catalogueDetails) {
    for (const details of Object.values(combo.catalogueDetails)) {
      if (hasNonemptyDetails(details)) return details;
    }
  }

  return undefined;
}

export function hasVariantCombinationDetailsForCatalogue(
  combo: VariantCombination,
  catalogueId: string
): boolean {
  return hasNonemptyDetails(extractVariantCombinationDetails(combo, catalogueId));
}

export function countConfiguredCombinationsForCatalogue(
  combinations: VariantCombination[],
  catalogueId: string
): number {
  return combinations.filter((c) => hasVariantCombinationDetailsForCatalogue(c, catalogueId)).length;
}

/** Normalize persisted `variants` / legacy shapes into a stable config. */
export function normalizeProductVariants(raw: unknown): ProductVariantsConfig {
  if (!raw || typeof raw !== "object") return { groups: [] };

  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.groups)
    ? obj.groups
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];

  const groups: ProductVariantGroup[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const g = entry as Record<string, unknown>;
    const name = cleanGroupName(g.name ?? g.label ?? g.title);
    const rawOptions = Array.isArray(g.options)
      ? g.options
      : typeof g.options === "string"
        ? String(g.options).split(/[,;|]/)
        : [];
    const options: string[] = [];
    const seen = new Set<string>();
    for (const opt of rawOptions) {
      const cleaned = cleanOption(opt);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(cleaned.slice(0, 64));
      if (options.length >= MAX_VARIANT_OPTIONS_PER_GROUP) break;
    }
    if (!name || options.length === 0) continue;
    groups.push({
      id:
        typeof g.id === "string" && g.id.trim()
          ? g.id.trim()
          : newVariantGroupId(),
      name,
      options,
    });
    if (groups.length >= MAX_VARIANT_GROUPS) break;
  }

  const combinations = Array.isArray(obj.combinations)
    ? (obj.combinations as VariantCombination[])
    : undefined;

  return { groups, ...(combinations ? { combinations } : {}) };
}

export function getProductVariantGroups(product: unknown): ProductVariantGroup[] {
  if (!product || typeof product !== "object") return [];
  const p = product as Record<string, unknown>;
  if (p.variants) return normalizeProductVariants(p.variants).groups;
  if (p.variantGroups) return normalizeProductVariants({ groups: p.variantGroups }).groups;
  return [];
}

export function hasProductVariants(product: unknown): boolean {
  return getProductVariantGroups(product).length > 0;
}

export function formatVariantOptions(options: string[]): string {
  return options.join(" · ");
}

/** Single-line summary for order rows / WhatsApp. */
export function formatVariantSelectionSummary(
  groups: ProductVariantGroup[],
  selection: Record<string, string> | undefined
): string {
  if (!groups.length || !selection) return "";
  const parts: string[] = [];
  for (const g of groups) {
    const chosen = selection[g.id];
    if (chosen) parts.push(`${g.name}: ${chosen}`);
  }
  return parts.join("; ");
}

/** Reverse of formatVariantSelectionSummary for edit-order variant pickers. */
export function parseVariantSummaryToSelection(
  groups: ProductVariantGroup[],
  summary?: string | null
): Record<string, string> {
  if (!groups.length || !summary?.trim()) return {};
  const selection: Record<string, string> = {};
  for (const part of summary.split(";")) {
    const trimmed = part.trim();
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const name = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    const group = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (group && value) selection[group.id] = value;
  }
  return selection;
}

export function createEmptyVariantGroup(presetName = ""): ProductVariantGroup {
  return {
    id: newVariantGroupId(),
    name: presetName,
    options: [""],
  };
}

export function pruneVariantGroupsForSave(
  groups: ProductVariantGroup[]
): ProductVariantsConfig {
  return normalizeProductVariants({ groups });
}

/** True when every group has a chosen option (for order validation). */
export function isVariantSelectionComplete(
  groups: ProductVariantGroup[],
  selection: Record<string, string> | undefined
): boolean {
  if (!groups.length) return true;
  if (!selection) return false;
  return groups.every((g) => {
    const chosen = selection[g.id];
    return Boolean(chosen && g.options.includes(chosen));
  });
}

/** Generate a stable ID from variant selections. */
export function generateVariantCombinationId(selections: Record<string, string>): string {
  const entries = Object.entries(selections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return entries.join("|");
}

/** Generate all possible variant combinations (Cartesian product). */
export function getAllVariantCombinations(groups: ProductVariantGroup[]): VariantCombination[] {
  if (groups.length === 0) return [];

  const combinations: VariantCombination[] = [];
  let currentSelections: Record<string, string> = {};

  function recurse(groupIndex: number) {
    if (groupIndex >= groups.length) {
      combinations.push({
        id: generateVariantCombinationId(currentSelections),
        selections: { ...currentSelections },
      });
      return;
    }

    const group = groups[groupIndex];
    for (const option of group.options) {
      currentSelections[group.id] = option;
      recurse(groupIndex + 1);
    }
    delete currentSelections[group.id];
  }

  recurse(0);
  return combinations;
}

/** Get variant-specific data for a catalogue (with legacy fallback). */
export function getVariantCombinationData(
  product: unknown,
  selections: Record<string, string>,
  catalogueId?: string | null
): ResolvedVariantCombination | undefined {
  if (!product || typeof product !== "object") return undefined;

  const p = product as Record<string, unknown>;
  const variants = p.variants as Record<string, unknown> | undefined;
  if (!variants || typeof variants !== "object") return undefined;

  const combinations = Array.isArray(variants.combinations)
    ? (variants.combinations as unknown[])
    : [];

  const combinationId = generateVariantCombinationId(selections);
  for (const combo of combinations) {
    if (!combo || typeof combo !== "object") continue;
    const row = combo as VariantCombination;
    if (row.id !== combinationId) continue;

    const details = extractVariantCombinationDetails(row, catalogueId);
    return {
      id: row.id,
      selections: row.selections,
      ...(details ?? {}),
    };
  }

  return undefined;
}

/** Add or update per-catalogue details for a variant combination. */
export function upsertVariantCombination(
  variants: ProductVariantsConfig,
  id: string,
  catalogueId: string,
  data: Partial<VariantCombinationDetails>,
  selections?: Record<string, string>
): ProductVariantsConfig {
  const combinations = [...(variants.combinations ?? [])];
  const index = combinations.findIndex((c) => c.id === id);

  if (index >= 0) {
    const existing = combinations[index];
    const prevCat = existing.catalogueDetails?.[catalogueId] ?? {};
    const nextCat: VariantCombinationDetails = {
      ...prevCat,
      ...data,
      customFields: {
        ...(prevCat.customFields ?? {}),
        ...(data.customFields ?? {}),
      },
    };
    combinations[index] = {
      ...existing,
      catalogueDetails: {
        ...(existing.catalogueDetails ?? {}),
        [catalogueId]: nextCat,
      },
    };
  } else {
    combinations.push({
      id,
      selections: selections ?? {},
      catalogueDetails: {
        [catalogueId]: {
          ...data,
          customFields: data.customFields ?? {},
        },
      },
    });
  }

  return {
    ...variants,
    combinations,
  };
}

/** Remove per-catalogue details for one combination. */
export function deleteVariantCombinationCatalogueDetails(
  variants: ProductVariantsConfig,
  id: string,
  catalogueId: string
): ProductVariantsConfig {
  const combinations = (variants.combinations ?? []).map((combo) => {
    if (combo.id !== id) return combo;
    if (!combo.catalogueDetails?.[catalogueId]) return combo;
    const nextDetails = { ...combo.catalogueDetails };
    delete nextDetails[catalogueId];
    return {
      ...combo,
      catalogueDetails: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
    };
  });

  const pruned = combinations.filter((combo) => {
    if (hasNonemptyDetails(legacyDetailsFromCombo(combo))) return true;
    if (combo.catalogueDetails && Object.values(combo.catalogueDetails).some(hasNonemptyDetails)) {
      return true;
    }
    return false;
  });

  return {
    ...variants,
    combinations: pruned,
  };
}

/** Per-catalogue legacy in/out for one variant line (falls back to product-level stock). */
export function getVariantLegacyInStock(
  product: unknown,
  catalogueId: string,
  variantCombinationId: string,
  productLevelInStock = true
): boolean {
  if (!product || typeof product !== 'object') return productLevelInStock;

  const p = product as Record<string, unknown>;
  const variants = p.variants as Record<string, unknown> | undefined;
  if (!variants || typeof variants !== 'object') return productLevelInStock;

  const combinations = Array.isArray(variants.combinations)
    ? (variants.combinations as VariantCombination[])
    : [];

  const combo = combinations.find((c) => c.id === variantCombinationId);
  if (!combo) return productLevelInStock;

  const details = extractVariantCombinationDetails(combo, catalogueId);
  if (details?.inStock === false) return false;
  if (details?.inStock === true) return true;
  return productLevelInStock;
}
