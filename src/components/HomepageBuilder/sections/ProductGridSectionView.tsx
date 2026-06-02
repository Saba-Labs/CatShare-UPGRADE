import React from 'react';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { ProductGridSection } from '../../../types/homepage';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import WebsiteProductCard from '../../WebsiteBuilder/WebsiteProductCard';
import { IconImage } from '../../Storefront/StorefrontIcons';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';

interface ProductGridSectionViewProps {
  section: ProductGridSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
}

export default function ProductGridSectionView({
  section,
  editMode,
  builderCanvas = false,
  onProductPreview,
}: ProductGridSectionViewProps) {
  const { settings, content } = section;
  const storeCtx = useWebsiteStoreOptional();
  const displayMode = settings.displayMode === 'carousel' || settings.displayMode === 'list' ? 'carousel' : 'grid';
  const cardsStyle = settings.cardStyle || 'boxed';
  const resolvedCardSize = settings.cardSize || 'md';
  const cardMinWidthMap: Record<'sm' | 'md' | 'lg', number> = { sm: 140, md: 190, lg: 240 };
  const cardMinWidth = cardMinWidthMap[resolvedCardSize];
  const carouselItemWidth = `${cardMinWidth}px`;
  // Keep "grid" truly grid-like: cards wrap to next line on smaller widths.
  const gridMinCardWidth = `${cardMinWidth}px`;
  const carouselRef = React.useRef<HTMLDivElement | null>(null);

  const scrollCarousel = (direction: -1 | 1) => {
    const node = carouselRef.current;
    if (!node) return;
    const step = cardMinWidth + 12;
    node.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  const source =
    content.productSource ||
    (content.productIds?.length ? 'specific' : content.categoryId ? 'category' : 'all');

  let displayProducts = storeCtx?.products || [];
  if (storeCtx && source === 'category' && content.categoryId) {
    const catId = String(content.categoryId).toLowerCase();
    displayProducts = displayProducts.filter((p) => {
      const cats = Array.isArray(p.category) ? p.category : p.category ? [String(p.category)] : [];
      return cats.some((c) => String(c).toLowerCase() === catId);
    });
  }
  if (storeCtx && source === 'specific') {
    displayProducts = (content.productIds || [])
      .map((id) => storeCtx.products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }
  const limited = displayProducts.slice(0, settings.itemsToShow);

  return (
    <div className="website-section-products" style={{ background: settings.backgroundColor || 'transparent' }}>
      {settings.showSearch && editMode && (
        <input
          type="text"
          placeholder="Search (preview only in live store)"
          className="panel-input"
          style={{ marginBottom: 16 }}
          disabled
        />
      )}

      <h2>{settings.title}</h2>

      {storeCtx && limited.length > 0 ? (
        <>
          {displayMode === 'carousel' ? (
            <div className="website-products-carousel-wrap">
              <button
                type="button"
                className="website-products-carousel-nav"
                aria-label="Scroll products left"
                onClick={() => scrollCarousel(-1)}
              >
                <span className="website-carousel-chevron website-carousel-chevron--left" aria-hidden />
              </button>
              <div
                ref={carouselRef}
                className="website-products-carousel"
                style={{ gridAutoColumns: `minmax(${carouselItemWidth}, ${carouselItemWidth})` }}
              >
                {limited.map((product) => (
                  <WebsiteProductCard
                    key={product.id}
                    product={product}
                    cardsStyle={cardsStyle}
                    viewMode="grid"
                    builderPreview={builderCanvas}
                    onBuilderProductClick={onProductPreview}
                  />
                ))}
              </div>
              <button
                type="button"
                className="website-products-carousel-nav"
                aria-label="Scroll products right"
                onClick={() => scrollCarousel(1)}
              >
                <span className="website-carousel-chevron website-carousel-chevron--right" aria-hidden />
              </button>
            </div>
          ) : (
            <div
              className="website-products-grid"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${gridMinCardWidth}, 1fr))` }}
            >
              {limited.map((product) => (
                <WebsiteProductCard
                  key={product.id}
                  product={product}
                  cardsStyle={cardsStyle}
                  viewMode="grid"
                  builderPreview={builderCanvas}
                  onBuilderProductClick={onProductPreview}
                />
              ))}
            </div>
          )}
          {limited.length < displayProducts.length && (
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#5f6368' }}>
              Showing {limited.length} of {displayProducts.length} products
            </p>
          )}
          <p style={{ marginTop: 16, textAlign: 'center' }}>
            {builderCanvas ? (
              <span className={`${SITES_THEME_BUTTON_CLASS} website-view-all-btn`} aria-disabled>
                View all
              </span>
            ) : (
              <Link to={storeCtx.collectionPath} className={`${SITES_THEME_BUTTON_CLASS} website-view-all-btn`}>
                View all
              </Link>
            )}
          </p>
        </>
      ) : (
        <div
          style={
            displayMode === 'carousel'
              ? {
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridAutoColumns: carouselItemWidth,
                  gap: '12px',
                  overflowX: 'auto',
                }
              : {
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${gridMinCardWidth}, 1fr))`,
                  gap: '16px',
                }
          }
        >
          {Array(Math.min(settings.itemsToShow, 8))
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                }}
              >
                <IconImage size={40} style={{ marginBottom: 8, color: '#9ca3af' }} />
                <p style={{ margin: '0 0 6px 0', fontWeight: 500, fontSize: '0.875rem' }}>
                  {editMode ? 'Products appear on live store' : `Product ${i + 1}`}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
