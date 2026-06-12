import type { Order } from '../services/orderService';
import type { ShareLinkItem } from '../services/shareLinks';
import {
  fetchShareLinkForCustomer,
  getShareLinkItemUnitPrice,
  productToShareLinkItem,
} from '../services/shareLinks';
import { getStoreBySlug, getStoreProducts } from '../services/storeService';
import { ensureCataloguesForStorefront } from '../config/catalogueConfig';

export async function loadCatalogForOrder(order: Order): Promise<ShareLinkItem[]> {
  if (order.order_source === 'store' && order.store_slug?.trim()) {
    const storeRes = await getStoreBySlug(order.store_slug.trim());
    if (!storeRes.success || !storeRes.data) return [];
    const catalogues = ensureCataloguesForStorefront(
      storeRes.data.cataloguesDefinition,
      storeRes.data.catalogueId
    );
    const prods = await getStoreProducts(storeRes.data.sellerUserId, catalogues);
    if (!prods.success || !prods.products?.length) return [];
    const catalogueId = storeRes.data.catalogueId || 'cat1';
    return prods.products.map((p) => productToShareLinkItem(p, catalogueId));
  }

  const linkToken = order.share_link_token?.trim();
  if (linkToken && linkToken !== 'manual-order') {
    const link = await fetchShareLinkForCustomer(linkToken);
    return link?.items ?? [];
  }

  return [];
}

export function parseCatalogItemPrice(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function shareLinkItemToOrderLine(
  item: ShareLinkItem,
  quantity: number,
  unitPriceOverride?: number
): import('../services/orderService').OrderItem {
  const unitPrice =
    unitPriceOverride !== undefined && Number.isFinite(unitPriceOverride)
      ? unitPriceOverride
      : getShareLinkItemUnitPrice(item, quantity);
  const rowTotal = unitPrice * quantity;
  return {
    productId: item.productId,
    name: item.name,
    quantity,
    unitPrice,
    rowTotal,
    category: (item.category || []).join(', ') || undefined,
    subtitle: item.subtitle,
    priceUnit: item.priceUnit,
    imageUrl: item.imageUrl,
    imageVersion: item.imageVersion,
    quantityStep: item.quantityStep,
  };
}

export function getCurrencySymbol(code: string): string {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return '₹';
}
