import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { ProductCardVariantFields, useProductCardVariants } from './ProductCardVariantFields';

export interface ProductCardFlipShopProps {
  product: ProductWithCatalogueData;
  productHref: string;
  title: string;
  subtitle?: string;
  priceLabel?: ReactNode;
  image: ReactNode;
  quantity?: number;
  quantityStep?: number;
  onQtyChange?: (delta: number, step: number) => void;
  builderPreview?: boolean;
  onBuilderProductClick?: (product: ProductWithCatalogueData) => void;
}

export default function ProductCardFlipShop({
  product,
  productHref,
  title,
  subtitle,
  priceLabel,
  image,
  quantity = 0,
  quantityStep = 1,
  onQtyChange,
  builderPreview = false,
  onBuilderProductClick,
}: ProductCardFlipShopProps) {
  const [flipped, setFlipped] = useState(false);
  const { variantGroups, selections, selectOption, applySelections, orderBridge } =
    useProductCardVariants(product);
  const step = Math.max(1, quantityStep);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFlipOpen = (e: MouseEvent) => {
    stop(e);
    setFlipped(true);
  };

  const handleFlipClose = (e: MouseEvent) => {
    stop(e);
    setFlipped(false);
  };

  const handleQty = (delta: number) => {
    if (builderPreview) {
      onBuilderProductClick?.(product);
      return;
    }
    if (delta > 0 && variantGroups.length > 0 && quantity <= 0) {
      applySelections();
    }
    if (onQtyChange) {
      onQtyChange(delta, step);
      return;
    }
    orderBridge?.changeProductQty(product.id, delta, step);
  };

  const handlePlaceOrder = (e: MouseEvent) => {
    stop(e);
    if (builderPreview) {
      onBuilderProductClick?.(product);
      return;
    }
    applySelections();
    if (orderBridge) {
      if (quantity <= 0) {
        orderBridge.changeProductQty(product.id, step, step);
      }
      setFlipped(false);
      return;
    }
    window.location.assign(productHref);
  };

  const imageLink = builderPreview ? (
    <button
      type="button"
      className="website-product-card-linkwrap website-product-card-flip__image-link"
      aria-label={`View ${title}`}
      onClick={(e) => {
        stop(e);
        onBuilderProductClick?.(product);
      }}
    >
      {image}
    </button>
  ) : (
    <Link
      to={productHref}
      className="website-product-card-linkwrap website-product-card-flip__image-link"
      aria-label={`View ${title}`}
      onClick={(e) => e.stopPropagation()}
    >
      {image}
    </Link>
  );

  return (
    <div className={`website-product-card-flip${flipped ? ' is-flipped' : ''}`} onClick={stop}>
      <div className="website-product-card-flip__inner">
        <div className="website-product-card-flip__face website-product-card-flip__front">
          {imageLink}
          <div className="website-product-card-body website-product-card-body--flip-front">
            <p className="website-product-card-title">{title}</p>
            {subtitle ? <p className="website-product-card-subtitle">{subtitle}</p> : null}
            {priceLabel ? <div className="website-product-card-flip__price">{priceLabel}</div> : null}
            <button type="button" className="website-product-card-flip__open" onClick={handleFlipOpen}>
              Add to cart
            </button>
          </div>
        </div>

        <div className="website-product-card-flip__face website-product-card-flip__back">
          <div className="website-product-card-body website-product-card-body--flip-back">
            <div className="website-product-card-flip__back-head">
              <p className="website-product-card-flip__back-title">{title}</p>
              <button
                type="button"
                className="website-product-card-flip__close"
                aria-label="Back to product"
                onClick={handleFlipClose}
              >
                ×
              </button>
            </div>

            <ProductCardVariantFields
              product={product}
              selections={selections}
              onSelect={selectOption}
            />

            <div className="website-product-card-flip__qty-row">
              <span className="website-product-card-flip__qty-label">Qty</span>
              <div className="website-qty" aria-label={`Quantity for ${title}`}>
                <button type="button" className="website-qty-btn" onClick={() => handleQty(-step)}>
                  -
                </button>
                <span className="website-qty-val">{quantity}</span>
                <button type="button" className="website-qty-btn" onClick={() => handleQty(step)}>
                  +
                </button>
              </div>
            </div>

            <button type="button" className="website-product-card-flip__place" onClick={handlePlaceOrder}>
              Place order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
