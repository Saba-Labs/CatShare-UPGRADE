export type ProductCardStyle =
  | 'boxed'
  | 'minimal'
  | 'boutique'
  | 'quick-shop'
  | 'flip-shop'
  | 'elevated'
  | 'overlay';

export const PRODUCT_CARD_STYLE_OPTIONS: { value: ProductCardStyle; label: string }[] = [
  { value: 'boxed', label: 'Boxed' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'quick-shop', label: 'Quick shop' },
  { value: 'flip-shop', label: 'Flip shop' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'overlay', label: 'Image overlay' },
];

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
