import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import ProductVariantsDisplay from '../../ProductVariantsDisplay';
import { getProductVariantGroups } from '../../../utils/productVariants';
import {
  buildWhatsAppProductLink,
  formatStorePrice,
  getWebsiteProductImageUrl,
  getWebsiteProductPrice,
} from '../../../utils/websiteStorefront';
import { useWebsiteStore } from '../WebsiteStoreContext';
import WebsiteBreadcrumbs from '../WebsiteBreadcrumbs';

interface ProductPageRuntimeProps {
  product: ProductWithCatalogueData | null;
}

export default function ProductPageRuntime({ product }: ProductPageRuntimeProps) {
  const { basePath, store, collectionPath } = useWebsiteStore();
  const siteName = store.sellerBusinessName || store.storeSlug;

  if (!product) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        <WebsiteBreadcrumbs
          items={[
            { label: 'Home', to: basePath || '/' },
            { label: 'Products', to: collectionPath },
            { label: 'Not found' },
          ]}
        />
        <p>Product not found.</p>
      </main>
    );
  }

  const variantGroups = getProductVariantGroups(product);
  const img = getWebsiteProductImageUrl(product);
  const price = getWebsiteProductPrice(product, store.catalogueId);
  const whatsapp = store.whatsapp?.trim();

  return (
    <main>
      <WebsiteBreadcrumbs
        items={[
          { label: 'Home', to: basePath || '/' },
          { label: 'Shop', to: collectionPath },
          { label: product.name },
        ]}
      />
      <div className="website-product-page">
        <div className="website-product-gallery">
          {img ? <img src={img} alt={product.name} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>📦</div>}
        </div>
        <div className="website-product-info">
          <h1>{product.name}</h1>
          {product.subtitle ? <p style={{ marginBottom: 10, opacity: 0.75 }}>{product.subtitle}</p> : null}
          {price != null && (
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a73e8', margin: '12px 0' }}>
              {formatStorePrice(price, store.sellerCurrencyCode)}
            </p>
          )}
          {variantGroups.length > 0 ? <ProductVariantsDisplay groups={variantGroups} mode="readonly" /> : null}
          {product.description ? <p style={{ marginTop: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{product.description}</p> : null}
          {whatsapp && (
            <a
              className="website-product-cta"
              href={buildWhatsAppProductLink(whatsapp, product.name, siteName)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Order on WhatsApp
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
