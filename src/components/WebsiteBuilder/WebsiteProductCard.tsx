import { type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import type { StoreProductNavState } from '../../utils/websiteStorefront';
import {
  formatStorePrice,
  getWebsiteProductImageUrl,
  getWebsiteProductPrice,
} from '../../utils/websiteStorefront';
import { ProductImagePlaceholder } from '../Storefront/StorefrontIcons';
import { useWebsiteStore } from './WebsiteStoreContext';
import ProductCardVariantPicker from './ProductCardVariantPicker';
import ProductCardFlipShop from './ProductCardFlipShop';
import { useWebsiteOrderBridge } from './WebsiteOrderBridge';
import { normalizeProductCardStyle, type ProductCardStyle } from '../../utils/productCardStyles';

interface WebsiteProductCardProps {
  product: ProductWithCatalogueData;
  cardsStyle?: ProductCardStyle | string;
  viewMode?: 'grid' | 'list';
  showPrice?: boolean;
  showSubtitle?: boolean;
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
  const resolvedStyle = normalizeProductCardStyle(cardsStyle);
  const href = productPath(product);
  const orderBridge = useWebsiteOrderBridge();
  const cartQty = orderBridge?.getProductQty(product.id) ?? 0;
  const brandLabel = product.subtitle?.trim() || store.sellerBusinessName?.trim() || undefined;
  const priceLabel = showPrice && price != null ? formatStorePrice(price, store.sellerCurrencyCode) : null;

  const className = `website-product-card website-product-card-${resolvedStyle} website-product-card-${viewMode}${
    builderPreview ? ' website-product-card--builder' : ''
  }`;

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const imageBlock = (
    <div className="website-product-card-img">
      {img ? (
        <img src={img} alt={product.name} loading="lazy" />
      ) : (
        <ProductImagePlaceholder size={40} className="website-product-card-ph" />
      )}
    </div>
  );

  const renderBody = () => {
    if (resolvedStyle === 'minimal') {
      return (
        <div className="website-product-card-body website-product-card-body--minimal">
          {priceLabel ? <p className="website-product-card-price website-product-card-price--lead">{priceLabel}</p> : null}
          <p className="website-product-card-title">{product.name}</p>
          {showSubtitle && product.subtitle ? (
            <p className="website-product-card-subtitle">{product.subtitle}</p>
          ) : null}
        </div>
      );
    }

    if (resolvedStyle === 'boutique') {
      return (
        <div className="website-product-card-body website-product-card-body--boutique">
          <p className="website-product-card-title">{product.name}</p>
          {brandLabel ? <p className="website-product-card-brand">{brandLabel}</p> : null}
          {priceLabel ? <p className="website-product-card-price">{priceLabel}</p> : null}
          {builderPreview ? (
            <button
              type="button"
              className="website-product-card-cta website-product-card-cta--boutique"
              onClick={(e) => {
                stop(e);
                onBuilderProductClick?.(product);
              }}
            >
              View product
            </button>
          ) : (
            <span className="website-product-card-cta website-product-card-cta--boutique">View product</span>
          )}
        </div>
      );
    }

    if (resolvedStyle === 'quick-shop') {
      return (
        <div className="website-product-card-body website-product-card-body--quick">
          <div className="website-product-card-quick-head">
            <p className="website-product-card-title">{product.name}</p>
            {priceLabel ? <p className="website-product-card-price">{priceLabel}</p> : null}
          </div>
          <ProductCardVariantPicker
            product={product}
            productHref={href}
            builderPreview={builderPreview}
            onBuilderProductClick={onBuilderProductClick}
          />
        </div>
      );
    }

    if (resolvedStyle === 'overlay') {
      return (
        <div className="website-product-card-body">
          <p className="website-product-card-title">{product.name}</p>
          {showSubtitle && product.subtitle ? (
            <p className="website-product-card-subtitle">{product.subtitle}</p>
          ) : null}
          {priceLabel ? (
            <p className="website-product-card-price website-product-card-price--overlay">{priceLabel}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="website-product-card-body">
        <p className="website-product-card-title">{product.name}</p>
        {showSubtitle && product.subtitle ? (
          <p className="website-product-card-subtitle">{product.subtitle}</p>
        ) : null}
        {priceLabel ? <p className="website-product-card-price">{priceLabel}</p> : null}
      </div>
    );
  };

  const cardFace =
    resolvedStyle === 'overlay' ? (
      <div className="website-product-card-media-stack">
        {imageBlock}
        {renderBody()}
      </div>
    ) : (
      <>
        {imageBlock}
        {renderBody()}
      </>
    );

  if (resolvedStyle === 'flip-shop') {
    return (
      <div className={className}>
        <ProductCardFlipShop
          product={product}
          productHref={href}
          title={product.name}
          subtitle={showSubtitle ? product.subtitle : undefined}
          priceLabel={
            priceLabel ? <p className="website-product-card-price">{priceLabel}</p> : null
          }
          image={imageBlock}
          quantity={cartQty}
          quantityStep={1}
          builderPreview={builderPreview}
          onBuilderProductClick={onBuilderProductClick}
        />
      </div>
    );
  }

  if (builderPreview) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={className}
        onClick={(e) => {
          if (resolvedStyle === 'quick-shop') return;
          e.preventDefault();
          e.stopPropagation();
          onBuilderProductClick?.(product);
        }}
        onKeyDown={(e) => {
          if (resolvedStyle === 'quick-shop') return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onBuilderProductClick?.(product);
          }
        }}
        title="Edit product page layout"
      >
        {cardFace}
      </div>
    );
  }

  if (resolvedStyle === 'quick-shop') {
    return <div className={className}>{cardFace}</div>;
  }

  return (
    <Link
      to={href}
      state={{ storeProductId: product.id } satisfies StoreProductNavState}
      className={className}
    >
      {cardFace}
    </Link>
  );
}
