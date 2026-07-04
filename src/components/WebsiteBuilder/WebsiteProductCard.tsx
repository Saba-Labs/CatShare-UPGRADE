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

    if (resolvedStyle === 'catalog') {
      return (
        <>
          <div className="website-product-card-body website-product-card-body--catalog">
            <p className="website-product-card-title">{product.name}</p>
            {priceLabel ? (
              <div className="website-product-card-catalog-meta">
                <p className="website-product-card-price">{priceLabel}</p>
                <span className="website-product-card-catalog-wish" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 20.5 10.55 19.1C5.4 14.55 2 11.55 2 7.75 2 4.85 4.25 2.75 7.1 2.75c1.65 0 3.25.8 4.25 2.05C12.35 3.55 13.95 2.75 15.6 2.75 18.45 2.75 20.7 4.85 20.7 7.75c0 3.8-3.4 6.8-8.55 11.35L12 20.5Z" />
                  </svg>
                </span>
              </div>
            ) : null}
          </div>
          <div className="website-product-card-catalog-action">
            <span className="website-product-card-catalog-action__add">Add to cart</span>
            <span className="website-product-card-catalog-action__divider" aria-hidden="true" />
            <span className="website-product-card-catalog-action__link" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </>
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
    ) : resolvedStyle === 'catalog' ? (
      <>
        {imageBlock}
        {renderBody()}
      </>
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
