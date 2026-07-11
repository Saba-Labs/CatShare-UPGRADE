import { generateVariantCombinationId } from './productVariants';

/** One order line: product + optional variant selection + quantity */
export interface OrderCartLine {
  lineId: string;
  productId: string;
  quantity: number;
  variantSelection: Record<string, string>;
}

export function newCartLineId(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function variantSelectionKey(variantSelection: Record<string, string>): string {
  if (!variantSelection || Object.keys(variantSelection).length === 0) return '';
  return generateVariantCombinationId(variantSelection);
}

export function activeCartLines(lines: OrderCartLine[]): OrderCartLine[] {
  return lines.filter((l) => l.quantity > 0);
}

export function cartLinesForProduct(lines: OrderCartLine[], productId: string): OrderCartLine[] {
  return activeCartLines(lines).filter((l) => l.productId === productId);
}

/** All lines for a product, including qty 0 placeholders opened by variant selection. */
export function allCartLinesForProduct(lines: OrderCartLine[], productId: string): OrderCartLine[] {
  return lines.filter((l) => l.productId === productId);
}

export function removeZeroQtyLinesForProduct(
  lines: OrderCartLine[],
  productId: string
): OrderCartLine[] {
  return lines.filter((l) => !(l.productId === productId && l.quantity <= 0));
}

export function findCartLineByVariant(
  lines: OrderCartLine[],
  productId: string,
  variantSelection: Record<string, string>
): OrderCartLine | undefined {
  const key = variantSelectionKey(variantSelection);
  return lines.find((l) => l.productId === productId && variantSelectionKey(l.variantSelection) === key);
}

export function getCartLineQty(
  lines: OrderCartLine[],
  productId: string,
  variantSelection: Record<string, string>
): number {
  return findCartLineByVariant(lines, productId, variantSelection)?.quantity ?? 0;
}

export function setCartLineQty(
  lines: OrderCartLine[],
  productId: string,
  variantSelection: Record<string, string>,
  quantity: number
): OrderCartLine[] {
  const key = variantSelectionKey(variantSelection);
  const filtered =
    quantity <= 0
      ? lines.filter(
          (l) => !(l.productId === productId && variantSelectionKey(l.variantSelection) === key)
        )
      : lines;

  if (quantity <= 0) return filtered;

  const existing = findCartLineByVariant(lines, productId, variantSelection);
  if (existing) {
    return filtered.map((l) =>
      l.lineId === existing.lineId
        ? { ...l, quantity, variantSelection: { ...variantSelection } }
        : l
    );
  }
  return [
    ...filtered,
    {
      lineId: newCartLineId(),
      productId,
      quantity,
      variantSelection: { ...variantSelection },
    },
  ];
}

export function setCartLineQtyById(
  lines: OrderCartLine[],
  lineId: string,
  quantity: number
): OrderCartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.lineId !== lineId);
  return lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l));
}

export function productHasCartLines(lines: OrderCartLine[], productId: string): boolean {
  return cartLinesForProduct(lines, productId).length > 0;
}

export function totalCartLineCount(lines: OrderCartLine[]): number {
  return activeCartLines(lines).length;
}

export function totalCartUnits(lines: OrderCartLine[]): number {
  return activeCartLines(lines).reduce((s, l) => s + l.quantity, 0);
}

export function otherCartLinesForProduct(
  lines: OrderCartLine[],
  productId: string,
  draftVariantSelection: Record<string, string>
): OrderCartLine[] {
  const draftKey = variantSelectionKey(draftVariantSelection);
  return cartLinesForProduct(lines, productId).filter(
    (l) => variantSelectionKey(l.variantSelection) !== draftKey
  );
}

const CART_STORAGE_PREFIX = 'catshare_order_cart_';
const LEGACY_QTY_STORAGE_PREFIX = 'catshare_order_qty_';

export function loadCartLinesFromSession(token: string): OrderCartLine[] | null {
  try {
    const raw =
      localStorage.getItem(`${CART_STORAGE_PREFIX}${token}`) ??
      sessionStorage.getItem(`${CART_STORAGE_PREFIX}${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as OrderCartLine[];
  } catch {
    return null;
  }
}

export function saveCartLinesToSession(token: string, lines: OrderCartLine[]): void {
  localStorage.setItem(`${CART_STORAGE_PREFIX}${token}`, JSON.stringify(activeCartLines(lines)));
}

/** Migrate legacy per-product qty + variant map from share-link session storage */
export function loadLegacyQtyMapFromSession(token: string): Record<string, number> | null {
  try {
    const raw =
      localStorage.getItem(`${LEGACY_QTY_STORAGE_PREFIX}${token}`) ??
      sessionStorage.getItem(`${LEGACY_QTY_STORAGE_PREFIX}${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, number>;
  } catch {
    return null;
  }
}

export function migrateLegacyCartToLines(
  qtyMap: Record<string, number>,
  variantSelections: Record<string, Record<string, string>> = {}
): OrderCartLine[] {
  const lines: OrderCartLine[] = [];
  for (const [productId, quantity] of Object.entries(qtyMap)) {
    if (quantity <= 0) continue;
    lines.push({
      lineId: newCartLineId(),
      productId,
      quantity,
      variantSelection: { ...(variantSelections[productId] ?? {}) },
    });
  }
  return lines;
}
