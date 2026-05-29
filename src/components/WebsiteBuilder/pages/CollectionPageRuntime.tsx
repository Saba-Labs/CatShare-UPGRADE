import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { productsInCategory } from '../../../utils/storefrontCategories';
import WebsiteBreadcrumbs from '../WebsiteBreadcrumbs';
import WebsiteProductCard from '../WebsiteProductCard';
import { useWebsiteStore } from '../WebsiteStoreContext';

interface CollectionPageRuntimeProps {
  products: ProductWithCatalogueData[];
  columns?: number;
  cardsStyle?: 'minimal' | 'boxed';
}

export default function CollectionPageRuntime({ products, columns = 4, cardsStyle = 'boxed' }: CollectionPageRuntimeProps) {
  const { basePath, collectionPath } = useWebsiteStore();
  const location = useLocation();
  const cols = Math.max(2, Math.min(4, columns));

  const categoryFilter = new URLSearchParams(location.search).get('category');
  const filteredProducts = useMemo(() => {
    if (!categoryFilter?.trim()) return products;
    return productsInCategory(products, categoryFilter.trim());
  }, [products, categoryFilter]);

  const categoryLabel = useMemo(() => {
    if (!categoryFilter?.trim()) return null;
    const match = filteredProducts.find((p) =>
      (Array.isArray(p.category) ? p.category : []).some(
        (c) => String(c).toLowerCase() === categoryFilter.trim().toLowerCase()
      )
    );
    const labels = match?.category;
    if (Array.isArray(labels)) {
      return labels.find((c) => String(c).toLowerCase() === categoryFilter.trim().toLowerCase()) || categoryFilter;
    }
    return categoryFilter;
  }, [categoryFilter, filteredProducts]);

  const pageTitle = categoryLabel ? String(categoryLabel) : 'All products';

  return (
    <main className="website-section-products">
      <WebsiteBreadcrumbs
        items={[
          { label: 'Home', to: basePath || '/' },
          ...(categoryLabel
            ? [
                { label: 'Shop', to: collectionPath },
                { label: String(categoryLabel) },
              ]
            : [{ label: 'All products' }]),
        ]}
      />
      <h1>{pageTitle}</h1>
      {filteredProducts.length === 0 ? (
        <p style={{ color: '#5f6368' }}>No products available yet.</p>
      ) : (
        <div className="website-products-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {filteredProducts.map((product) => (
            <WebsiteProductCard key={product.id} product={product} cardsStyle={cardsStyle} />
          ))}
        </div>
      )}
    </main>
  );
}
