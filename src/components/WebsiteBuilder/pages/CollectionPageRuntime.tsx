import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import WebsiteBreadcrumbs from '../WebsiteBreadcrumbs';
import WebsiteProductCard from '../WebsiteProductCard';
import { useWebsiteStore } from '../WebsiteStoreContext';

interface CollectionPageRuntimeProps {
  products: ProductWithCatalogueData[];
  columns?: number;
}

export default function CollectionPageRuntime({ products, columns = 4 }: CollectionPageRuntimeProps) {
  const { basePath } = useWebsiteStore();
  const cols = Math.max(2, Math.min(4, columns));

  return (
    <main className="website-section-products">
      <WebsiteBreadcrumbs items={[{ label: 'Home', to: basePath || '/' }, { label: 'All products' }]} />
      <h1>All products</h1>
      {products.length === 0 ? (
        <p style={{ color: '#5f6368' }}>No products available yet.</p>
      ) : (
        <div className="website-products-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {products.map((product) => (
            <WebsiteProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
