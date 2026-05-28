import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import {
  formatStorePrice,
  getWebsiteProductImageUrl,
  getWebsiteProductPrice,
} from '../../utils/websiteStorefront';
import { useWebsiteStore } from './WebsiteStoreContext';

interface WebsiteProductCardProps {
  product: ProductWithCatalogueData;
}

export default function WebsiteProductCard({ product }: WebsiteProductCardProps) {
  const { productPath, store } = useWebsiteStore();
  const img = getWebsiteProductImageUrl(product);
  const price = getWebsiteProductPrice(product, store.catalogueId);

  return (
    <Link to={productPath(product)} className="website-product-card">
      <div className="website-product-card-img">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <span style={{ padding: 24, display: 'block', textAlign: 'center' }}>📦</span>}
      </div>
      <div className="website-product-card-body">
        <p className="website-product-card-title">{product.name}</p>
        {product.subtitle && <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>{product.subtitle}</p>}
        {price != null && <p className="website-product-card-price">{formatStorePrice(price, store.sellerCurrencyCode)}</p>}
      </div>
    </Link>
  );
}
