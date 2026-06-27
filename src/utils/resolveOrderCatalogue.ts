import {
  getCatalogueData,
  isProductEnabledForCatalogue,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import type { Catalogue } from '../config/catalogueConfig';
import type { Order, OrderItem } from '../services/orderService';
import { resolveListOfferEffective } from './offerPriceUtils';

/**
 * Orders may not store catalogue_id. Infer from line items: every line must reference
 * a product enabled in that catalogue; tie-break with closest unit price match.
 */
export function resolveOrderCatalogueId(
  orderItems: OrderItem[],
  products: ProductWithCatalogueData[],
  catalogues: Catalogue[]
): string | null {
  const ids = orderItems.map((it) => it.productId).filter(Boolean) as string[];
  if (ids.length === 0) return null;

  const productById = new Map<string, ProductWithCatalogueData>();
  for (const p of products) {
    if (p?.id != null) productById.set(String(p.id), p);
  }

  const candidates: string[] = [];
  for (const cat of catalogues) {
    let ok = true;
    for (const pid of ids) {
      const p = productById.get(String(pid));
      if (!p || !isProductEnabledForCatalogue(p, cat.id)) {
        ok = false;
        break;
      }
    }
    if (ok) candidates.push(cat.id);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  let best = candidates[0];
  let bestScore = Infinity;
  for (const catId of candidates) {
    const cat = catalogues.find((c) => c.id === catId);
    if (!cat) continue;
    let score = 0;
    for (const it of orderItems) {
      if (!it.productId) continue;
      const p = productById.get(String(it.productId));
      if (!p) continue;
      const catData = getCatalogueData(p, catId);
      const expected = resolveListOfferEffective(
        catData,
        cat.priceField,
        p as Record<string, unknown>
      ).effectiveUnitPrice;
      score += Math.abs(expected - (it.unitPrice || 0));
    }
    if (score < bestScore) {
      bestScore = score;
      best = catId;
    }
  }
  return best;
}

export function getOrderCatalogueId(
  order: Pick<Order, 'items' | 'catalogue_id' | 'order_source' | 'store_slug'>,
  products: ProductWithCatalogueData[],
  catalogues: Catalogue[],
  storeCatalogueId?: string | null
): string | null {
  const storedId = order.catalogue_id?.trim();
  if (storedId) return storedId;
  if (order.order_source === 'store' && storeCatalogueId?.trim()) {
    return storeCatalogueId.trim();
  }
  return resolveOrderCatalogueId(order.items || [], products, catalogues);
}

export function getOrderCatalogueLabel(
  order: Pick<Order, 'items' | 'catalogue_id' | 'order_source' | 'store_slug'>,
  products: ProductWithCatalogueData[],
  catalogues: Catalogue[],
  storeCatalogueId?: string | null
): string | null {
  const catalogueId = getOrderCatalogueId(order, products, catalogues, storeCatalogueId);

  if (!catalogueId) return null;
  return catalogues.find((c) => c.id === catalogueId)?.label || catalogueId;
}
