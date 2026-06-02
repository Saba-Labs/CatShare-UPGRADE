import React from 'react';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { FeaturedProductsSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import WebsiteProductCard from '../../WebsiteBuilder/WebsiteProductCard';
import { IconImage, IconShoppingBag } from '../../Storefront/StorefrontIcons';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';

interface FeaturedProductsSectionViewProps {
  section: FeaturedProductsSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
}

export default function FeaturedProductsSectionView({
  section,
  editMode,
  builderCanvas = false,
  onProductPreview,
}: FeaturedProductsSectionViewProps) {
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

  const resolvedProducts = storeCtx
    ? content.productIds
        .map((id) => storeCtx.products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
    : [];

  return (
    <div className="website-section-products" style={{ background: settings.backgroundColor || 'transparent' }}>
      <h2>{settings.title}</h2>
      {content.productIds.length === 0 ? (
        <SectionPlaceholder
          title="Featured Products"
          icon={<IconShoppingBag size={48} />}
          description={editMode ? 'Select products in the properties panel' : 'No products selected'}
          editMode={editMode}
        />
      ) : storeCtx && resolvedProducts.length > 0 ? (
        <>
          {displayMode === 'carousel' ? (
            <div className="website-products-carousel-wrap">
              <button
                type="button"
                className="website-products-carousel-nav"
                aria-label="Scroll featured products left"
                onClick={() => scrollCarousel(-1)}
              >
                <span className="website-carousel-chevron website-carousel-chevron--left" aria-hidden />
              </button>
              <div
                ref={carouselRef}
                className="website-products-carousel"
                style={{ gridAutoColumns: `minmax(${carouselItemWidth}, ${carouselItemWidth})` }}
              >
                {resolvedProducts.slice(0, settings.itemsPerPage).map((product) => (
                  <WebsiteProductCard
                    key={product.id}
                    product={product}
                    cardsStyle={cardsStyle}
                    viewMode="grid"
                    showPrice={settings.showPrice}
                    showSubtitle={settings.showDescription}
                    builderPreview={builderCanvas}
                    onBuilderProductClick={onProductPreview}
                  />
                ))}
              </div>
              <button
                type="button"
                className="website-products-carousel-nav"
                aria-label="Scroll featured products right"
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
              {resolvedProducts.slice(0, settings.itemsPerPage).map((product) => (
                <WebsiteProductCard
                  key={product.id}
                  product={product}
                  cardsStyle={cardsStyle}
                  viewMode="grid"
                  showPrice={settings.showPrice}
                  showSubtitle={settings.showDescription}
                  builderPreview={builderCanvas}
                  onBuilderProductClick={onProductPreview}
                />
              ))}
            </div>
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
          {Array(Math.min(settings.itemsPerPage, content.productIds.length))
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                }}
              >
                <IconImage size={40} style={{ marginBottom: 8, color: '#9ca3af' }} />
                <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Product {i + 1}</p>
                {settings.showPrice && <p style={{ margin: 0, color: '#2563eb', fontWeight: 600 }}>—</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
