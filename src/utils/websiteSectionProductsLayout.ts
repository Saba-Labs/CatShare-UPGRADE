import type { CSSProperties } from 'react';
import type { ProductCardStyle } from './productCardStyles';
import {
  coerceProductSectionDisplayMode,
  getProductCardStyleGridColumns,
  normalizeProductCardStyle,
  productCardStyleForcesGridLayout,
  type LegacyProductSectionDisplayMode,
  type ProductSectionDisplayMode,
} from './productCardStyles';

const CARD_MIN_WIDTH: Record<'sm' | 'md' | 'lg', number> = { sm: 140, md: 190, lg: 240 };

export interface WebsiteSectionProductsLayout {
  cardsStyle: ProductCardStyle;
  displayMode: ProductSectionDisplayMode;
  carouselItemWidth: string;
  gridClassName: string;
  gridStyle: CSSProperties;
}

export function resolveWebsiteSectionProductsLayout(options: {
  cardStyle?: ProductCardStyle | string | null;
  displayMode?: LegacyProductSectionDisplayMode;
  cardSize?: 'sm' | 'md' | 'lg';
  columns?: number | null;
}): WebsiteSectionProductsLayout {
  const cardsStyle = normalizeProductCardStyle(options.cardStyle);
  const cardSize = options.cardSize || 'md';
  const cardMinWidth = CARD_MIN_WIDTH[cardSize];
  const carouselItemWidth = `${cardMinWidth}px`;
  const displayMode = coerceProductSectionDisplayMode(cardsStyle, options.displayMode);

  if (displayMode === 'carousel') {
    return {
      cardsStyle,
      displayMode,
      carouselItemWidth,
      gridClassName: 'website-products-grid',
      gridStyle: { ['--products-col-min' as string]: carouselItemWidth },
    };
  }

  const usesFixedGrid = productCardStyleForcesGridLayout(cardsStyle);
  const isCatalog = cardsStyle === 'catalog';
  const gridClassName = [
    'website-products-grid',
    usesFixedGrid ? 'website-products-grid--order-form website-products-grid--fixed-cols' : '',
    isCatalog ? 'website-products-grid--catalog' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const gridStyle: CSSProperties = usesFixedGrid
    ? { ['--catalog-grid-columns' as string]: getProductCardStyleGridColumns(cardsStyle, options.columns) }
    : { ['--products-col-min' as string]: carouselItemWidth };

  return {
    cardsStyle,
    displayMode,
    carouselItemWidth,
    gridClassName,
    gridStyle,
  };
}
