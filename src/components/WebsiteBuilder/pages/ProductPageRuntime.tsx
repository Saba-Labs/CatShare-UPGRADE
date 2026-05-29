import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import type { WebsiteProductTemplate } from '../../../types/homepage';
import { getProductVariantGroups, isVariantSelectionComplete } from '../../../utils/productVariants';
import { getCatalogueData, normalizeOrderQuantityStep } from '../../../config/catalogueProductUtils';
import StoreProductOrderPanel from '../../Storefront/StoreProductOrderPanel';
import { useWebsiteOrderBridge } from '../WebsiteOrderBridge';
import { useWebsiteStore } from '../WebsiteStoreContext';
import WebsiteBreadcrumbs from '../WebsiteBreadcrumbs';
import '../../Storefront/store-product-order-page.css';

interface ProductPageRuntimeProps {
  product: ProductWithCatalogueData | null;
  template?: WebsiteProductTemplate;
}

export default function ProductPageRuntime({ product, template }: ProductPageRuntimeProps) {
  const { basePath, collectionPath, store } = useWebsiteStore();
  const orderBridge = useWebsiteOrderBridge();
  const navigate = useNavigate();

  const layoutVariant = template?.layoutVariant || 'minimal';

  const variantGroups = useMemo(() => (product ? getProductVariantGroups(product) : []), [product]);

  useEffect(() => {
    if (!product || !orderBridge || variantGroups.length === 0) return;
    const existing = orderBridge.getVariantSelection(product.id);
    if (Object.keys(existing).length > 0) return;
    for (const group of variantGroups) {
      if (group.options[0]) {
        orderBridge.setVariantSelection(product.id, group.id, group.options[0]);
      }
    }
  }, [product, orderBridge, variantGroups]);

  if (!product) {
    return (
      <main className="website-product-runtime">
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

  if (!orderBridge) {
    return (
      <main className="website-product-runtime">
        <p>Unable to load ordering. Please refresh the page.</p>
      </main>
    );
  }

  const quantity = orderBridge.getProductQty(product.id);
  const variantSelection = orderBridge.getVariantSelection(product.id);
  const catData = store.catalogueId ? getCatalogueData(product, store.catalogueId) : null;
  const qstep = normalizeOrderQuantityStep(catData?.orderQuantityStep);

  const handleDone = () => {
    const groups = getProductVariantGroups(product);
    if (groups.length > 0 && !isVariantSelectionComplete(groups, variantSelection)) {
      return;
    }
    if (quantity <= 0) {
      orderBridge.changeProductQty(product.id, qstep, qstep);
    }
    navigate(collectionPath);
  };

  return (
    <main className={`website-product-runtime wp-${layoutVariant}`}>
      <WebsiteBreadcrumbs
        items={[
          { label: 'Home', to: basePath || '/' },
          { label: 'Shop', to: collectionPath },
          { label: product.name },
        ]}
      />
      <StoreProductOrderPanel
        product={product}
        store={store}
        currencySymbol={orderBridge.currencySymbol}
        catalogue={orderBridge.catalogue}
        sellerFieldsDefinition={orderBridge.sellerFieldsDefinition}
        quantity={quantity}
        variantSelection={variantSelection}
        variantError={orderBridge.hasVariantError(product.id)}
        onVariantSelect={(groupId, option) => orderBridge.setVariantSelection(product.id, groupId, option)}
        onQtyChange={(delta) => orderBridge.changeProductQty(product.id, delta, qstep)}
        onDone={handleDone}
        layout="page"
        layoutVariant={layoutVariant}
      />
    </main>
  );
}
