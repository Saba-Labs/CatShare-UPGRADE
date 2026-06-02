import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import {
  formatStorePrice,
  getWebsiteProductImageUrl,
  getWebsiteProductPrice,
} from '../../utils/websiteStorefront';
import { ProductImagePlaceholder } from '../Storefront/StorefrontIcons';
import { useWebsiteStore } from './WebsiteStoreContext';

interface WebsiteProductCardProps {
  product: ProductWithCatalogueData;
  cardsStyle?: 'minimal' | 'boxed';
  viewMode?: 'grid' | 'list';
  showPrice?: boolean;
  showSubtitle?: boolean;
  /** Builder canvas: open in-editor preview instead of navigating to the live store route */
  builderPreview?: boolean;
  onBuilderProductClick?: (product: ProductWithCatalogueData) => void;
}

export default function WebsiteProductCard({
  product,
  cardsStyle = 'boxed',
  viewMode = 'grid',
  showPrice = true,
  showSubtitle = true,
  builderPreview = false,
  onBuilderProductClick,
}: WebsiteProductCardProps) {
  const { productPath, store } = useWebsiteStore();
  const img = getWebsiteProductImageUrl(product);
  const price = getWebsiteProductPrice(product, store.catalogueId);

  const className = `website-product-card website-product-card-${cardsStyle} website-product-card-${viewMode}${
    builderPreview ? ' website-product-card--builder' : ''
  }`;

  const body = (
    <>
      <div className="website-product-card-img">
        {img ? (
          <img src={img} alt={product.name} loading="lazy" />
        ) : (
          <ProductImagePlaceholder size={40} className="website-product-card-ph" />
        )}
      </div>
      <div className="website-product-card-body">
        <p className="website-product-card-title">{product.name}</p>
        {showSubtitle && product.subtitle && <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>{product.subtitle}</p>}
        {showPrice && price != null && <p className="website-product-card-price">{formatStorePrice(price, store.sellerCurrencyCode)}</p>}
      </div>
    </>
  );

  if (builderPreview) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onBuilderProductClick?.(product);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onBuilderProductClick?.(product);
          }
        }}
        title="Edit product page layout"
      >
        {body}
      </div>
    );
  }

  return (
    <Link to={productPath(product)} className={className}>
      {body}
    </Link>
  );
}
