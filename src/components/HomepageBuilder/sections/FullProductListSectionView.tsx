import type { FullProductListSection } from '../../../types/homepage';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import CollectionPageRuntime from '../../WebsiteBuilder/pages/CollectionPageRuntime';
import { coerceProductListViewMode, normalizeProductCardStyle } from '../../../utils/productCardStyles';

interface FullProductListSectionViewProps {
  section: FullProductListSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
}

export default function FullProductListSectionView({
  section,
  editMode = false,
  builderCanvas = false,
  onProductPreview,
}: FullProductListSectionViewProps) {
  const { settings } = section;
  const storeCtx = useWebsiteStoreOptional();

  if (!storeCtx) {
    if (editMode) {
      return (
        <div
          className="website-section-products website-section-products--embedded"
          style={{
            background: settings.backgroundColor || 'transparent',
            padding: '24px 16px',
            border: '1px dashed #cbd5e1',
            borderRadius: 12,
          }}
        >
          <h2 className="website-section-products__title">
            {settings.title?.trim() || 'Full product list'}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Complete catalog with categories and quantity controls — same as the classic default store.
          </p>
        </div>
      );
    }

    return (
      <div className="website-section-products" style={{ padding: 16 }}>
        <p style={{ color: '#64748b', margin: 0 }}>Product list unavailable.</p>
      </div>
    );
  }

  return (
    <div style={{ background: settings.backgroundColor || 'transparent' }}>
      <CollectionPageRuntime
        products={storeCtx.products}
        productsLoading={storeCtx.productsLoading}
        embedded
        sectionTitle={settings.title}
        showCategoryFilters={settings.showCategoryFilters ?? true}
        showSort={settings.showSort ?? true}
        viewMode={coerceProductListViewMode(settings.cardStyle, settings.viewMode ?? 'list')}
        cardsStyle={normalizeProductCardStyle(settings.cardStyle)}
        productImageRatio={settings.productImageRatio ?? 'square'}
        showPrice={settings.showPrice ?? true}
        showAvailability={settings.showAvailability ?? true}
        defaultSorting={settings.defaultSorting ?? 'newest'}
        builderPreview={builderCanvas}
        onBuilderProductClick={onProductPreview}
      />
    </div>
  );
}
