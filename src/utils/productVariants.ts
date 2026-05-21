export const MAX_VARIANT_GROUPS = 6;
export const MAX_VARIANT_OPTIONS_PER_GROUP = 24;

export type ProductVariantGroup = {
  id: string;
  name: string;
  options: string[];
};

export type VariantCombination = {
  id: string; // generated from variant selections, e.g. "size-S|color-green"
  selections: Record<string, string>; // { sizeGroupId: "S", colorGroupId: "Green" }
  image?: string; // optional variant-specific image
  price?: number; // optional variant-specific price
  customFields?: Record<string, unknown>; // optional custom fields (SKU, stock, description, etc.)
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

  return { groups };
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

  let combinations: VariantCombination[] = [];
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

/** Get variant-specific data with fallback to base product data. */
export function getVariantCombinationData(
  product: unknown,
  selections: Record<string, string>
): VariantCombination | undefined {
  if (!product || typeof product !== "object") return undefined;

  const p = product as Record<string, unknown>;
  const variants = p.variants as Record<string, unknown> | undefined;
  if (!variants || typeof variants !== "object") return undefined;

  const combinations = Array.isArray(variants.combinations)
    ? (variants.combinations as unknown[])
    : [];

  const combinationId = generateVariantCombinationId(selections);
  for (const combo of combinations) {
    if (combo && typeof combo === "object" && (combo as Record<string, unknown>).id === combinationId) {
      return combo as VariantCombination;
    }
  }

  return undefined;
}

/** Add or update a variant combination. */
export function upsertVariantCombination(
  variants: ProductVariantsConfig,
  id: string,
  data: Partial<VariantCombination>
): ProductVariantsConfig {
  const combinations = variants.combinations ?? [];
  const index = combinations.findIndex((c) => c.id === id);

  if (index >= 0) {
    // Update existing
    combinations[index] = { ...combinations[index], ...data, id };
  } else {
    // Add new
    combinations.push({
      id,
      selections: {},
      ...data,
    });
  }

  return {
    ...variants,
    combinations,
  };
}
