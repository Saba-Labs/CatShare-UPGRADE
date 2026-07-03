import { useMemo, useState, type MouseEvent } from 'react';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { getProductVariantGroups } from '../../utils/productVariants';
import { useWebsiteOrderBridge } from './WebsiteOrderBridge';

export function useProductCardVariants(product: ProductWithCatalogueData) {
  const orderBridge = useWebsiteOrderBridge();
  const variantGroups = useMemo(() => getProductVariantGroups(product), [product]);
  const bridgeSelection = orderBridge?.getVariantSelection(product.id) ?? {};

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of variantGroups) {
      initial[group.id] = bridgeSelection[group.id] || group.options[0] || '';
    }
    return initial;
  });

  const selectOption = (groupId: string, option: string) => {
    setSelections((prev) => ({ ...prev, [groupId]: option }));
    orderBridge?.setVariantSelection(product.id, groupId, option);
  };

  const applySelections = () => {
    for (const group of variantGroups) {
      const option = selections[group.id];
      if (option) orderBridge?.setVariantSelection(product.id, group.id, option);
    }
  };

  return { variantGroups, selections, selectOption, applySelections, orderBridge };
}

interface ProductCardVariantFieldsProps {
  product: ProductWithCatalogueData;
  selections: Record<string, string>;
  onSelect: (groupId: string, option: string) => void;
  className?: string;
}

export function ProductCardVariantFields({
  product,
  selections,
  onSelect,
  className = '',
}: ProductCardVariantFieldsProps) {
  const variantGroups = useMemo(() => getProductVariantGroups(product), [product]);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (variantGroups.length === 0) return null;

  return (
    <div className={`website-product-card-variant-fields ${className}`.trim()} onClick={stop}>
      {variantGroups.map((group) => (
        <div key={group.id} className="website-product-card-variant-group">
          <span className="website-product-card-variant-group__label">{group.name}</span>
          <div className="website-product-card-variant-pills" role="listbox" aria-label={group.name}>
            {group.options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selections[group.id] === option}
                className={`website-product-card-variant-pill${
                  selections[group.id] === option ? ' is-selected' : ''
                }`}
                onClick={(e) => {
                  stop(e);
                  onSelect(group.id, option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
