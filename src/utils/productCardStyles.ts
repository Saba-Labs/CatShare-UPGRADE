import type { ProductImageRatio } from '../types/storeBehaviorSettings';

export type ProductCardStyle =
  | 'boxed'
  | 'minimal'
  | 'boutique'
  | 'quick-shop'
  | 'flip-shop'
  | 'elevated'
  | 'overlay'
  | 'catalog';

export type ProductListViewMode = 'list' | 'grid';

export type ProductSectionDisplayMode = 'grid' | 'carousel';

export interface ProductCardStyleCapabilities {
  label: string;
  /** Shown in the card-style dropdown and under the selected style. */
  summary: string;
  supportsListView: boolean;
  supportsGridView: boolean;
  /** Locks grid column count (e.g. editorial catalog). */
  fixedGridColumns?: 2 | 3 | 4;
  /** Controls whether image ratio appears in the sidebar for this style. */
  imageRatioMode: 'all' | 'hidden' | 'portrait-only';
  defaultViewMode: ProductListViewMode;
}

export const PRODUCT_CARD_STYLE_META: Record<ProductCardStyle, ProductCardStyleCapabilities> = {
  boxed: {
    label: 'Boxed',
    summary: 'List or grid. Image, title, price, and quantity controls.',
    supportsListView: true,
    supportsGridView: true,
    imageRatioMode: 'all',
    defaultViewMode: 'list',
  },
  minimal: {
    label: 'Minimal',
    summary: 'List or grid. Price-first layout with a light image frame.',
    supportsListView: true,
    supportsGridView: true,
    imageRatioMode: 'all',
    defaultViewMode: 'grid',
  },
  boutique: {
    label: 'Boutique',
    summary: 'List or grid. Soft card with brand line and “View product” link.',
    supportsListView: true,
    supportsGridView: true,
    imageRatioMode: 'all',
    defaultViewMode: 'grid',
  },
  'quick-shop': {
    label: 'Quick shop',
    summary: 'List or grid. Variant picker and add-to-cart on each card.',
    supportsListView: true,
    supportsGridView: true,
    imageRatioMode: 'all',
    defaultViewMode: 'grid',
  },
  'flip-shop': {
    label: 'Flip shop',
    summary: 'Grid only. Tap the card to flip and add to cart.',
    supportsListView: false,
    supportsGridView: true,
    imageRatioMode: 'all',
    defaultViewMode: 'grid',
  },
  elevated: {
    label: 'Elevated',
    summary: 'List or grid. Inset image with a lifted shadow card.',
    supportsListView: true,
    supportsGridView: true,
    imageRatioMode: 'all',
    defaultViewMode: 'grid',
  },
  overlay: {
    label: 'Image overlay',
    summary: 'Grid only. Name and price sit on the product photo.',
    supportsListView: false,
    supportsGridView: true,
    imageRatioMode: 'portrait-only',
    defaultViewMode: 'grid',
  },
  catalog: {
    label: 'Editorial catalog',
    summary: 'Grid only. Three-column bordered tiles with an add-to-cart bar.',
    supportsListView: false,
    supportsGridView: true,
    fixedGridColumns: 3,
    imageRatioMode: 'portrait-only',
    defaultViewMode: 'grid',
  },
};

export const PRODUCT_CARD_STYLE_OPTIONS: { value: ProductCardStyle; label: string; hint?: string }[] =
  (Object.entries(PRODUCT_CARD_STYLE_META) as [ProductCardStyle, ProductCardStyleCapabilities][]).map(
    ([value, meta]) => ({
      value,
      label: meta.label,
      hint: meta.supportsListView ? 'List + grid' : 'Grid only',
    })
  );

const VALID_STYLES = new Set<string>(PRODUCT_CARD_STYLE_OPTIONS.map((o) => o.value));

const LEGACY_STYLE_MAP: Record<string, ProductCardStyle> = {
  horizontal: 'boutique',
  outline: 'boutique',
  compact: 'minimal',
  rounded: 'minimal',
};

export function normalizeProductCardStyle(style?: string | null): ProductCardStyle {
  if (style && VALID_STYLES.has(style)) return style as ProductCardStyle;
  if (style && LEGACY_STYLE_MAP[style]) return LEGACY_STYLE_MAP[style];
  return 'boxed';
}

export function getProductCardStyleMeta(style?: string | null): ProductCardStyleCapabilities {
  return PRODUCT_CARD_STYLE_META[normalizeProductCardStyle(style)];
}

export function productCardStyleForcesGridLayout(style?: string | null): boolean {
  return !getProductCardStyleMeta(style).supportsListView;
}

/** Grid-only specialty card styles (catalog, overlay, flip shop) need a fixed grid — not a carousel track. */
export function productCardStyleSupportsCarousel(style?: string | null): boolean {
  return !productCardStyleForcesGridLayout(style);
}

export type LegacyProductSectionDisplayMode = ProductSectionDisplayMode | 'list' | 'slider';

export function coerceProductSectionDisplayMode(
  style: ProductCardStyle | string | null | undefined,
  displayMode: LegacyProductSectionDisplayMode | undefined
): ProductSectionDisplayMode {
  const requested =
    displayMode === 'carousel' || displayMode === 'list' || displayMode === 'slider' ? 'carousel' : 'grid';
  if (requested === 'carousel' && !productCardStyleSupportsCarousel(style)) return 'grid';
  return requested;
}

export function coerceProductListViewMode(
  style: ProductCardStyle | string | null | undefined,
  viewMode: ProductListViewMode | undefined
): ProductListViewMode {
  const meta = getProductCardStyleMeta(style);
  if (!meta.supportsListView) return 'grid';
  return viewMode === 'grid' ? 'grid' : 'list';
}

export function getProductCardStyleGridColumns(
  style: ProductCardStyle | string | null | undefined,
  columns?: number | null
): 2 | 3 | 4 {
  const meta = getProductCardStyleMeta(style);
  if (meta.fixedGridColumns) return meta.fixedGridColumns;
  return Math.min(4, Math.max(2, Number(columns) || 4)) as 2 | 3 | 4;
}

export function productCardStyleShowsImageRatio(style?: string | null): boolean {
  return getProductCardStyleMeta(style).imageRatioMode !== 'hidden';
}

export function productCardStyleImageRatioOptions(
  style?: string | null
): { value: ProductImageRatio; label: string }[] {
  const all = [
    { value: 'square' as const, label: 'Square' },
    { value: 'portrait' as const, label: 'Portrait' },
    { value: 'landscape' as const, label: 'Landscape' },
  ];
  if (getProductCardStyleMeta(style).imageRatioMode === 'portrait-only') {
    return all.filter((opt) => opt.value !== 'landscape');
  }
  return all;
}

export interface ProductCardStyleLayoutPatch {
  viewMode?: ProductListViewMode;
  productImageRatio?: ProductImageRatio;
  columns?: 2 | 3 | 4;
  displayMode?: ProductSectionDisplayMode;
}

/** Apply layout defaults when the user picks a different card style. */
export function patchesWhenProductCardStyleChanges(
  nextStyle: ProductCardStyle,
  current: {
    viewMode?: ProductListViewMode;
    productImageRatio?: ProductImageRatio;
    columns?: number;
    displayMode?: LegacyProductSectionDisplayMode;
  }
): ProductCardStyleLayoutPatch {
  const meta = PRODUCT_CARD_STYLE_META[nextStyle];
  const patch: ProductCardStyleLayoutPatch = {};

  if (!meta.supportsListView && (current.viewMode ?? 'list') === 'list') {
    patch.viewMode = 'grid';
  }

  if (!productCardStyleSupportsCarousel(nextStyle)) {
    const requested =
      current.displayMode === 'carousel' ||
      current.displayMode === 'list' ||
      current.displayMode === 'slider'
        ? 'carousel'
        : 'grid';
    if (requested === 'carousel') {
      patch.displayMode = 'grid';
    }
  }

  if (meta.imageRatioMode === 'portrait-only' && current.productImageRatio === 'landscape') {
    patch.productImageRatio = 'portrait';
  }

  if (meta.fixedGridColumns && Number(current.columns) !== meta.fixedGridColumns) {
    patch.columns = meta.fixedGridColumns;
  }

  return patch;
}
