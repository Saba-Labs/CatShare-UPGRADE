export const MAX_VARIANT_GROUPS = 6;
export const MAX_VARIANT_OPTIONS_PER_GROUP = 24;

export type ProductVariantGroup = {
  id: string;
  name: string;
  options: string[];
};

export type ProductVariantsConfig = {
  groups: ProductVariantGroup[];
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
