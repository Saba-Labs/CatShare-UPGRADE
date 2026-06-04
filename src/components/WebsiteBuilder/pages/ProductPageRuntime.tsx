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
import WebsiteCarousel from '../WebsiteCarousel';
import WebsiteProductCard from '../WebsiteProductCard';
import '../../Storefront/store-product-order-page.css';
import '../../ProductVariantsDisplay.css';

interface ProductPageRuntimeProps {
  product: ProductWithCatalogueData | null;
  template?: WebsiteProductTemplate;
  /** Homepage editor: non-navigating preview with close instead of checkout flow */
  previewMode?: boolean;
  onPreviewClose?: () => void;
}

export default function ProductPageRuntime({
  product,
  template,
  previewMode = false,
  onPreviewClose,
}: ProductPageRuntimeProps) {
  const { basePath, collectionPath, store, products } = useWebsiteStore();
  const orderBridge = useWebsiteOrderBridge();
  const navigate = useNavigate();

  const layoutVariant = template?.layoutVariant || 'minimal';
  const imageLook = template?.imageLook || 'clean';
  const fieldsInBox = template?.fieldsInBox !== false;
  const fieldsStriped = template?.fieldsLook === 'striped';
  const suggestedLayout = template?.suggestedProductsLayout || 'cards';
  const suggestedCount = Math.max(2, Math.min(12, template?.suggestedProductsCount || 4));

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
    if (previewMode) {
      onPreviewClose?.();
      return;
    }
    const groups = getProductVariantGroups(product);
    if (groups.length > 0 && !isVariantSelectionComplete(groups, variantSelection)) {
      return;
    }
    if (quantity <= 0) {
      orderBridge.changeProductQty(product.id, qstep, qstep);
    }
    navigate(collectionPath);
  };

  const breadcrumbItems = previewMode
    ? [{ label: 'Home' }, { label: 'Shop' }, { label: product.name }]
    : [
        { label: 'Home', to: basePath || '/' },
        { label: 'Shop', to: collectionPath },
        { label: product.name },
      ];

  const suggestedProducts = (products || []).filter((p) => p.id !== product.id).slice(0, suggestedCount);

  return (
    <main
      className={`website-product-runtime wp-${layoutVariant} wp-image-${imageLook} wp-fields-${fieldsInBox ? 'boxed' : 'open'}${fieldsStriped ? ' wp-fields-striped' : ''}`}
    >
      <WebsiteBreadcrumbs items={breadcrumbItems} />
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
        orderCtaLabel="Place order"
        ctaStyle="solid"
        showQuantitySelector
      />
      {template?.showRecommendations && suggestedProducts.length > 0 ? (
        <section className="website-product-recommendations">
          <h2>You may also like</h2>
          {suggestedLayout === 'carousel' ? (
            <WebsiteCarousel
              className="website-suggested-carousel-wrap"
              trackClassName="website-suggested-carousel"
              prevLabel="Previous suggested products"
              nextLabel="Next suggested products"
            >
              {suggestedProducts.map((p) => (
                <WebsiteProductCard
                  key={p.id}
                  product={p}
                  cardsStyle="minimal"
                  viewMode="grid"
                />
              ))}
            </WebsiteCarousel>
          ) : (
            <div className={suggestedLayout === 'list' ? 'website-suggested-list' : 'website-suggested-grid'}>
              {suggestedProducts.map((p) => (
                <WebsiteProductCard
                  key={p.id}
                  product={p}
                  cardsStyle={suggestedLayout === 'cards' ? 'boxed' : 'minimal'}
                  viewMode={suggestedLayout === 'list' ? 'list' : 'grid'}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
