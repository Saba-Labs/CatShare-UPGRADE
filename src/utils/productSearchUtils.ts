import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import {
  formatVariantSelectionSummary,
  getAllVariantCombinations,
  getProductVariantGroups,
} from './productVariants';

function includesQuery(value: unknown, q: string): boolean {
  if (value == null) return false;
  const text = String(value).trim().toLowerCase();
  return text.length > 0 && text.includes(q);
}

function pushString(values: string[], value: unknown) {
  if (value == null) return;
  const text = String(value).trim();
  if (text) values.push(text);
}

/** Collect searchable text from a catalogue product (name, subtitle, fields, variants, etc.). */
export function getProductSearchHaystack(product: ProductWithCatalogueData): string[] {
  const values: string[] = [];

  pushString(values, product.name);
  pushString(values, product.subtitle);
  pushString(values, product.badge);
  pushString(values, product.privateNotes);
  pushString(values, product.id);

  if (Array.isArray(product.category)) {
    for (const category of product.category) pushString(values, category);
  }

  for (let i = 1; i <= 10; i++) {
    pushString(values, product[`field${i}`]);
    pushString(values, product[`field${i}Label`]);
    pushString(values, product[`field${i}Unit`]);
  }

  if (product.catalogueData && typeof product.catalogueData === 'object') {
    for (const row of Object.values(product.catalogueData)) {
      if (!row || typeof row !== 'object') continue;
      for (let i = 1; i <= 10; i++) {
        pushString(values, row[`field${i}`]);
        pushString(values, row[`field${i}Label`]);
        pushString(values, row[`field${i}Unit`]);
      }
      pushString(values, row.badge);
      pushString(values, row.price1);
      pushString(values, row.price2);
      pushString(values, row.price1Unit);
      pushString(values, row.price2Unit);
    }
  }

  const groups = getProductVariantGroups(product);
  for (const group of groups) {
    pushString(values, group.name);
    for (const option of group.options) pushString(values, option);
  }

  const combinations = getAllVariantCombinations(groups);
  for (const combo of combinations) {
    pushString(values, formatVariantSelectionSummary(groups, combo.selections));
  }

  return values;
}

export function productMatchesSearchQuery(
  product: ProductWithCatalogueData,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return getProductSearchHaystack(product).some((value) => includesQuery(value, q));
}
