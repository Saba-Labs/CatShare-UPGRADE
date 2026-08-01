import React from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { ProductGridSection } from '../../../types/homepage';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import WebsiteCarousel from '../../WebsiteBuilder/WebsiteCarousel';
import WebsiteProductCard from '../../WebsiteBuilder/WebsiteProductCard';
import { resolveWebsiteSectionProductsLayout } from '../../../utils/websiteSectionProductsLayout';
import { IconImage } from '../../Storefront/StorefrontIcons';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
import { sortStorefrontProducts } from '../../../utils/storefrontBehavior';

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
  const layout = resolveWebsiteSectionProductsLayout({
    cardStyle: settings.cardStyle,
    displayMode: settings.displayMode,
    cardSize: settings.cardSize,
    columns: settings.columns,
  });
  const source =
    content.productSource ||
    (content.productIds?.length ? 'specific' : content.categoryId ? 'category' : 'all');

  const displayProducts = useMemo(() => {
    if (!storeCtx) return [];
    if (source === 'category' && content.categoryId) {
      const catId = String(content.categoryId).toLowerCase();
      return storeCtx.products.filter((p) => {
        const cats = Array.isArray(p.category) ? p.category : p.category ? [String(p.category)] : [];
        return cats.some((c) => String(c).toLowerCase() === catId);
      });
    }
    if (source === 'specific') {
      return (content.productIds || [])
        .map((id) => storeCtx.products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
    }
    return storeCtx.products;
  }, [storeCtx, source, content.categoryId, content.productIds]);
  const sortedProducts = useMemo(
    () =>
      storeCtx
        ? sortStorefrontProducts(
            displayProducts,
            settings.sortBy === 'default' ? 'newest' : settings.sortBy,
            storeCtx.store.catalogueId,
            null
          )
        : [],
    [displayProducts, settings.sortBy, storeCtx]
  );
  const limited = sortedProducts.slice(0, settings.itemsToShow);

  const renderProductCards = (products: typeof limited) =>
    products.map((product) => (
      <WebsiteProductCard
        key={product.id}
        product={product}
        cardsStyle={layout.cardsStyle}
        viewMode="grid"
        builderPreview={builderCanvas}
        onBuilderProductClick={onProductPreview}
      />
    ));

  return (
    <div className="website-section-products" style={{ background: settings.backgroundColor || 'transparent' }}>
      <h2>{settings.title}</h2>

      {storeCtx && limited.length > 0 ? (
        <>
          {layout.displayMode === 'carousel' ? (
            <WebsiteCarousel
              style={{
                ['--carousel-item-width' as string]: `minmax(${layout.carouselItemWidth}, ${layout.carouselItemWidth})`,
              }}
              prevLabel="Scroll products left"
              nextLabel="Scroll products right"
            >
              {renderProductCards(limited)}
            </WebsiteCarousel>
          ) : (
            <div className={layout.gridClassName} style={layout.gridStyle}>
              {renderProductCards(limited)}
            </div>
          )}
          {limited.length < sortedProducts.length && (
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#5f6368' }}>
              Showing {limited.length} of {sortedProducts.length} products
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
            layout.displayMode === 'carousel'
              ? {
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridAutoColumns: layout.carouselItemWidth,
                  gap: '12px',
                  overflowX: 'auto',
                }
              : {
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${layout.carouselItemWidth}, 1fr))`,
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
