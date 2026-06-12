/**
 * Normalize product.category to string[] (Edit Product / storefront format).
 * Handles legacy comma-separated strings and arrays containing combined strings.
 */
export function normalizeProductCategories(value: unknown): string[] {
  if (value == null) return [];

  const parts: string[] = [];

  const pushPart = (raw: string) => {
    const s = raw.trim();
    if (!s) return;
    if (s.includes(',')) {
      for (const piece of s.split(',')) {
        const t = piece.trim();
        if (t) parts.push(t);
      }
    } else {
      parts.push(s);
    }
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      pushPart(String(item ?? ''));
    }
  } else if (typeof value === 'string') {
    pushPart(value);
  }

  return Array.from(new Set(parts));
}

/** True when product has categoryName (exact match, case-sensitive like Edit Product). */
export function productHasCategory(product: { category?: unknown }, categoryName: string): boolean {
  return normalizeProductCategories(product.category).includes(categoryName);
}

/** Toggle one category on a product; returns new category string[]. */
export function toggleProductCategory(
  current: unknown,
  categoryName: string
): string[] {
  const list = normalizeProductCategories(current);
  if (list.includes(categoryName)) {
    return list.filter((c) => c !== categoryName);
  }
  return [...list, categoryName];
}

/** Remove one category label from a product's category list. */
export function removeProductCategory(current: unknown, categoryName: string): string[] {
  return normalizeProductCategories(current).filter((c) => c !== categoryName);
}

/** Rename one category label on a product's category list. */
export function renameProductCategory(
  current: unknown,
  oldName: string,
  newName: string
): string[] {
  return normalizeProductCategories(current).map((c) => (c === oldName ? newName : c));
}

/**
 * Storefront filter pills: seller's official list (order preserved), only categories
 * that at least one product has. Orphan labels on products (e.g. deleted categories) are omitted.
 */
export function buildStorefrontCategoryFilterList(
  officialCategories: string[] | undefined | null,
  products: { category?: unknown }[]
): string[] {
  const productCats = new Set<string>();
  for (const p of products) {
    for (const c of normalizeProductCategories(p.category)) {
      productCats.add(c);
    }
  }

  if (officialCategories && officialCategories.length > 0) {
    return officialCategories.filter((c) => productCats.has(c));
  }

  return Array.from(productCats).sort((a, b) => a.localeCompare(b));
}
