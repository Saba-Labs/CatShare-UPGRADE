import type { WebsiteSiteSettings } from '../../types/homepage';
import type { StorePublic } from '../../services/storeService';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import StorefrontFooter from '../Storefront/StorefrontFooter';

interface WebsiteFooterProps {
  siteSettings: WebsiteSiteSettings;
  previewMode?: boolean;
  store?: StorePublic | null;
  products?: ProductWithCatalogueData[];
  categoryCount?: number;
}

/** Global storefront footer — matches OrderForm / classic store layout. */
export default function WebsiteFooter({
  siteSettings,
  previewMode,
  store,
  products,
  categoryCount,
}: WebsiteFooterProps) {
  return (
    <StorefrontFooter
      siteSettings={siteSettings}
      previewMode={previewMode}
      store={store}
      products={products}
      categoryCount={categoryCount}
    />
  );
}
