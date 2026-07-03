import { type MouseEvent } from 'react';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { ProductCardVariantFields, useProductCardVariants } from './ProductCardVariantFields';

interface ProductCardVariantPickerProps {
  product: ProductWithCatalogueData;
  productHref: string;
  builderPreview?: boolean;
  onBuilderProductClick?: (product: ProductWithCatalogueData) => void;
}

export default function ProductCardVariantPicker({
  product,
  productHref,
  builderPreview = false,
  onBuilderProductClick,
}: ProductCardVariantPickerProps) {
  const { selections, selectOption, applySelections, orderBridge } = useProductCardVariants(product);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAdd = (e: MouseEvent) => {
    stop(e);
    if (builderPreview) {
      onBuilderProductClick?.(product);
      return;
    }
    applySelections();
    if (orderBridge) {
      orderBridge.changeProductQty(product.id, 1, 1);
      return;
    }
    window.location.assign(productHref);
  };

  return (
    <div className="website-product-card-variant-picker" onClick={stop}>
      <ProductCardVariantFields product={product} selections={selections} onSelect={selectOption} />
      <button type="button" className="website-product-card-variant-picker__add" onClick={handleAdd}>
        Add to cart
      </button>
    </div>
  );
}
