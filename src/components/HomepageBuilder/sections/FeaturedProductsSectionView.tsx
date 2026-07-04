import React from 'react';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { FeaturedProductsSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import WebsiteCarousel from '../../WebsiteBuilder/WebsiteCarousel';
import WebsiteProductCard from '../../WebsiteBuilder/WebsiteProductCard';
import { resolveWebsiteSectionProductsLayout } from '../../../utils/websiteSectionProductsLayout';
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
  const layout = resolveWebsiteSectionProductsLayout({
    cardStyle: settings.cardStyle,
    displayMode: settings.displayMode,
    cardSize: settings.cardSize,
  });
  const catalogProducts = storeCtx?.products ?? [];
  const resolvedProducts = React.useMemo(() => {
    if (content.productIds.length > 0) {
      if (!storeCtx) return [];
      return content.productIds
        .map((id) => storeCtx.products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
    }
    return catalogProducts.slice(0, settings.itemsPerPage);
  }, [storeCtx, content.productIds, catalogProducts, settings.itemsPerPage]);

  const usesCatalogFallback = content.productIds.length === 0 && catalogProducts.length > 0;
  const visibleProducts = resolvedProducts.slice(0, settings.itemsPerPage);

  const renderProductCards = (products: typeof visibleProducts) =>
    products.map((product) => (
      <WebsiteProductCard
        key={product.id}
        product={product}
        cardsStyle={layout.cardsStyle}
        viewMode="grid"
        showPrice={settings.showPrice}
        showSubtitle={settings.showDescription}
        builderPreview={builderCanvas}
        onBuilderProductClick={onProductPreview}
      />
    ));

  return (
    <div className="website-section-products" style={{ background: settings.backgroundColor || 'transparent' }}>
      <h2>{settings.title}</h2>
      {resolvedProducts.length === 0 ? (
        <SectionPlaceholder
          title="Featured Products"
          icon={<IconShoppingBag size={48} />}
          description={editMode ? 'Select products in the properties panel' : 'No products in your store yet'}
          editMode={editMode}
        />
      ) : storeCtx ? (
        <>
          {layout.displayMode === 'carousel' ? (
            <WebsiteCarousel
              style={{
                ['--carousel-item-width' as string]: `minmax(${layout.carouselItemWidth}, ${layout.carouselItemWidth})`,
              }}
              prevLabel="Scroll featured products left"
              nextLabel="Scroll featured products right"
            >
              {renderProductCards(visibleProducts)}
            </WebsiteCarousel>
          ) : (
            <div className={layout.gridClassName} style={layout.gridStyle}>
              {renderProductCards(visibleProducts)}
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
          {resolvedProducts.map((product) => (
            <div
              key={product.id}
              style={{
                background: '#f9fafb',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                border: '1px solid #e5e7eb',
              }}
            >
              <IconImage size={40} style={{ marginBottom: 8, color: '#9ca3af' }} />
              <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>{product.name}</p>
              {settings.showPrice && <p style={{ margin: 0, color: '#2563eb', fontWeight: 600 }}>—</p>}
            </div>
          ))}
        </div>
      )}
      {usesCatalogFallback && editMode ? (
        <p style={{ marginTop: 12, fontSize: '0.82rem', color: '#5f6368', textAlign: 'center' }}>
          Showing products from your store. Pick specific items in the sidebar to curate this section.
        </p>
      ) : null}
    </div>
  );
}
