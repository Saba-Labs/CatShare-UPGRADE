import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getCatalogueData,
  isProductInStockForCatalogue,
  normalizeOrderQuantityStep,
  type ProductWithCatalogueData,
} from '../../../config/catalogueProductUtils';
import type { DefaultSorting, ProductImageRatio } from '../../../types/storeBehaviorSettings';
import { normalizeProductCategories } from '../../../utils/productCategoryUtils';
import {
  productsInCategory,
  resolveStoreCategoryParam,
  storeCategoriesMatch,
} from '../../../utils/storefrontCategories';
import { productImageAspectRatio, sortStorefrontProducts } from '../../../utils/storefrontBehavior';
import {
  formatStorePrice,
  getWebsiteProductImageUrl,
} from '../../../utils/websiteStorefront';
import { ProductImagePlaceholder } from '../../Storefront/StorefrontIcons';
import { getStorefrontPriceAndUnit, unitLabel } from '../../Storefront/storefrontOrderHelpers';
import { getProductVariantGroups } from '../../../utils/productVariants';
import { useWebsiteOrderBridge } from '../WebsiteOrderBridge';
import ProductCardVariantPicker from '../ProductCardVariantPicker';
import ProductCardFlipShop from '../ProductCardFlipShop';
import { useWebsiteStore } from '../WebsiteStoreContext';
import {
  getProductCardStyleGridColumns,
  normalizeProductCardStyle,
  productCardStyleForcesGridLayout,
  type ProductCardStyle,
} from '../../../utils/productCardStyles';
import '../website-runtime.css';

interface CollectionPageRuntimeProps {
  products: ProductWithCatalogueData[];
  productsLoading?: boolean;
  columns?: number;
  cardsStyle?: ProductCardStyle | string;
  /** When true, hides breadcrumbs and uses optional section title (homepage block). */
  embedded?: boolean;
  sectionTitle?: string;
  showCategoryFilters?: boolean;
  /** Limits the category chips shown by embedded product lists. Empty means all categories. */
  categoryIds?: string[];
  showSort?: boolean;
  viewMode?: 'list' | 'grid';
  productImageRatio?: ProductImageRatio;
  showPrice?: boolean;
  showAvailability?: boolean;
  defaultSorting?: DefaultSorting;
  /** Builder canvas: open in-editor product preview instead of navigating away. */
  builderPreview?: boolean;
  onBuilderProductClick?: (product: ProductWithCatalogueData) => void;
  /** Builder category page preview: fixed category (ignores URL). */
  previewCategoryId?: string;
  onPreviewCategoryChange?: (categoryId: string) => void;
}

export default function CollectionPageRuntime({
  products,
  productsLoading = false,
  columns = 4,
  cardsStyle = 'boxed',
  embedded = false,
  sectionTitle,
  showCategoryFilters = true,
  categoryIds,
  showSort = true,
  viewMode,
  productImageRatio = 'square',
  showPrice = true,
  showAvailability = true,
  defaultSorting = 'newest',
  builderPreview = false,
  onBuilderProductClick,
  previewCategoryId,
  onPreviewCategoryChange,
}: CollectionPageRuntimeProps) {
  const { productPath, store } = useWebsiteStore();
  const orderBridge = useWebsiteOrderBridge();
  const location = useLocation();
  const navigate = useNavigate();
  const isListView = embedded
    ? (viewMode ?? 'list') === 'list'
    : viewMode != null
      ? viewMode === 'list'
      : store.viewMode === 'list';
  const resolvedCardsStyle = normalizeProductCardStyle(cardsStyle);
  const gridCardLayout = productCardStyleForcesGridLayout(resolvedCardsStyle);
  const productsUseListLayout = isListView && !gridCardLayout;
  const imageAspect = productImageAspectRatio(productImageRatio);
  const gridColumnCount = getProductCardStyleGridColumns(resolvedCardsStyle, columns);
  const catalogProductLayout = resolvedCardsStyle === 'catalog';
  const [sortBy, setSortBy] = useState<'default' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc'>('default');
  const [embeddedCategory, setEmbeddedCategory] = useState<string | null>(null);
  const initialCategoryParam = new URLSearchParams(location.search).get('category');
  const categoryParam =
    previewCategoryId ??
    (embedded && embeddedCategory !== null
      ? embeddedCategory === 'all'
        ? null
        : embeddedCategory
      : initialCategoryParam);

  const scopedProducts = useMemo(() => {
    const selectedIds = new Set((categoryIds ?? []).map((id) => id.toLowerCase()));
    if (selectedIds.size === 0) return products;
    return products.filter((product) =>
      normalizeProductCategories(product.category).some((category) => selectedIds.has(category.toLowerCase()))
    );
  }, [products, categoryIds]);

  const availableCategories = useMemo(() => {
    const all = scopedProducts.flatMap((product) => normalizeProductCategories(product.category));
    return Array.from(new Set(all));
  }, [scopedProducts]);

  const selectedCategory = useMemo(() => {
    const resolved = resolveStoreCategoryParam(categoryParam, availableCategories);
    return resolved === 'all' || availableCategories.some((category) => storeCategoriesMatch(category, resolved))
      ? resolved
      : 'all';
  }, [categoryParam, availableCategories]);

  const setCategoryFilter = (category: string) => {
    if (builderPreview && onPreviewCategoryChange) {
      onPreviewCategoryChange(category === 'all' ? '' : category);
      return;
    }
    if (embedded) {
      setEmbeddedCategory(category);
      return;
    }
    const nextParams = new URLSearchParams(location.search);
    if (category === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', category);
    }
    const nextSearch = nextParams.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' });
  };

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return scopedProducts;
    return productsInCategory(scopedProducts, selectedCategory);
  }, [scopedProducts, selectedCategory]);

  const sortedProducts = useMemo(() => {
    if (sortBy === 'default') {
      return sortStorefrontProducts(
        filteredProducts,
        defaultSorting,
        store.catalogueId,
        orderBridge?.catalogue ?? null
      );
    }
    const catalogue = orderBridge?.catalogue ?? null;
    const withPrice = (product: ProductWithCatalogueData) =>
      getStorefrontPriceAndUnit(getCatalogueData(product, store.catalogueId), catalogue, product).price;
    const next = [...filteredProducts];
    next.sort((a, b) => {
      if (sortBy === 'price-low') return withPrice(a) - withPrice(b);
      if (sortBy === 'price-high') return withPrice(b) - withPrice(a);
      if (sortBy === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'name-desc') return String(b.name || '').localeCompare(String(a.name || ''));
      return 0;
    });
    return next;
  }, [
    filteredProducts,
    orderBridge?.catalogue,
    sortBy,
    store.catalogueId,
    embedded,
    defaultSorting,
  ]);

  const categoryLabel = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return null;
    const match = scopedProducts.find((p) =>
      normalizeProductCategories(p.category).some(
        (c) => c.toLowerCase() === selectedCategory.toLowerCase()
      )
    );
    const labels = match?.category;
    if (Array.isArray(labels)) {
      return labels.find((c) => String(c).toLowerCase() === selectedCategory.toLowerCase()) || selectedCategory;
    }
    return selectedCategory;
  }, [selectedCategory, scopedProducts]);

  const pageTitle = embedded
    ? (sectionTitle?.trim() || categoryLabel || 'Products')
    : categoryLabel
      ? String(categoryLabel)
      : 'All products';

  return (
    <main
      className={`website-section-products website-section-products--order-form${embedded ? ' website-section-products--embedded' : ''}`}
    >
      <div className="website-of-panel">
        {!embedded || sectionTitle?.trim() || categoryLabel ? (
          embedded ? (
            <h2 className="website-section-products__title">{pageTitle}</h2>
          ) : (
            <h1>{pageTitle}</h1>
          )
        ) : null}
        <div className="website-of-toolbar">
          <div className="website-of-count">
            {sortedProducts.length} item{sortedProducts.length === 1 ? '' : 's'}
          </div>
          {showSort ? (
            <select
              className="website-of-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'default' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc')}
              aria-label="Sort products"
            >
              <option value="default">Sort: Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          ) : null}
          {showCategoryFilters && availableCategories.length > 0 ? (
            <div className="website-of-category-filters" role="tablist" aria-label="Filter by category">
              <button
                type="button"
                className={`website-of-category-chip${selectedCategory === 'all' ? ' is-active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                All
              </button>
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`website-of-category-chip${storeCategoriesMatch(selectedCategory, category) ? ' is-active' : ''}`}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {productsLoading && sortedProducts.length === 0 ? null : sortedProducts.length === 0 ? (
        <p style={{ color: '#5f6368' }}>No products available yet.</p>
      ) : (
        <div
          className={
            productsUseListLayout
              ? 'website-products-list website-products-list--order-form'
              : `website-products-grid website-products-grid--order-form website-products-grid--fixed-cols${
                  catalogProductLayout ? ' website-products-grid--catalog' : ''
                }`
          }
          style={
            productsUseListLayout
              ? undefined
              : ({ ['--catalog-grid-columns' as string]: gridColumnCount } as CSSProperties)
          }
        >
          {sortedProducts.map((product) => (
            <CollectionProductCard
              key={product.id}
              product={product}
              cardsStyle={resolvedCardsStyle}
              listView={isListView && !gridCardLayout}
              href={productPath(product)}
              catalogue={orderBridge?.catalogue ?? null}
              quantity={orderBridge?.getProductQty(product.id) ?? 0}
              quantityStep={normalizeOrderQuantityStep(getCatalogueData(product, store.catalogueId)?.orderQuantityStep)}
              onQtyChange={(delta, step) => orderBridge?.changeProductQty(product.id, delta, step)}
              builderPreview={builderPreview}
              onBuilderProductClick={onBuilderProductClick}
              imageAspect={imageAspect}
              showPrice={showPrice}
              showAvailability={showAvailability}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function CollectionProductCard({
  product,
  cardsStyle,
  listView,
  href,
  catalogue,
  quantity,
  quantityStep,
  onQtyChange,
  builderPreview = false,
  onBuilderProductClick,
  imageAspect = '1 / 1',
  showPrice = true,
  showAvailability = false,
}: {
  product: ProductWithCatalogueData;
  cardsStyle: ProductCardStyle;
  listView: boolean;
  href: string;
  catalogue: import('../../../config/catalogueConfig').Catalogue | null;
  quantity: number;
  quantityStep: number;
  onQtyChange: (delta: number, step: number) => void;
  builderPreview?: boolean;
  onBuilderProductClick?: (product: ProductWithCatalogueData) => void;
  imageAspect?: string;
  showPrice?: boolean;
  showAvailability?: boolean;
}) {
  const { store } = useWebsiteStore();
  const navigate = useNavigate();
  const img = getWebsiteProductImageUrl(product);
  const catData = getCatalogueData(product, store.catalogueId);
  const { price, priceUnit } = getStorefrontPriceAndUnit(catData, catalogue, product);
  const clampedStep = normalizeOrderQuantityStep(quantityStep);
  const variantGroups = getProductVariantGroups(product);
  const inStock = isProductInStockForCatalogue(product, store.catalogueId, catalogue ?? undefined);
  const resolvedStyle = normalizeProductCardStyle(cardsStyle);
  const isBoutique = resolvedStyle === 'boutique';
  const isQuickShop = resolvedStyle === 'quick-shop';
  const isFlipShop = resolvedStyle === 'flip-shop';
  const isCatalog = resolvedStyle === 'catalog';
  const brandLabel = product.subtitle?.trim() || store.sellerBusinessName?.trim() || undefined;

  const openInBuilder = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onBuilderProductClick?.(product);
  };

  const ProductNav = ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => {
    if (builderPreview) {
      return (
        <button type="button" className={className} onClick={openInBuilder}>
          {children}
        </button>
      );
    }
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  };

  const handleQtyChange = (delta: number) => {
    if (delta > 0 && variantGroups.length > 0 && quantity <= 0) {
      if (builderPreview) {
        onBuilderProductClick?.(product);
        return;
      }
      navigate(href);
      return;
    }
    onQtyChange(delta, clampedStep);
  };

  const orderRow = (
    <div className="website-product-card-order-row">
      <div className="website-qty" aria-label={`Quantity for ${product.name}`}>
        <button
          type="button"
          className="website-qty-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleQtyChange(-clampedStep);
          }}
        >
          -
        </button>
        <span className="website-qty-val">{quantity}</span>
        <button
          type="button"
          className="website-qty-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleQtyChange(clampedStep);
          }}
        >
          +
        </button>
      </div>
      <ProductNav className="website-product-card-details-link">Details</ProductNav>
    </div>
  );

  const packRow =
    clampedStep > 1 ? (
      <div className="website-product-card-pack-row">
        <span className="website-pack-hint">Pack of {clampedStep}</span>
      </div>
    ) : null;

  const detailsBody = (
    <div
      className={`website-product-card-body${
        isQuickShop ? ' website-product-card-body--quick' : isBoutique ? ' website-product-card-body--boutique' : ''
      }`}
    >
      {isQuickShop && !listView ? (
        <div className="website-product-card-quick-head">
          <ProductNav className="website-product-card-title-link">
            <p className="website-product-card-title">{product.name}</p>
          </ProductNav>
          {showPrice && Number.isFinite(price) && price > 0 ? (
            <p className="website-product-card-price">
              {formatStorePrice(price, store.sellerCurrencyCode)}
              {priceUnit ? <span className="website-product-card-price-unit">/{unitLabel(priceUnit)}</span> : null}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <ProductNav className="website-product-card-title-link">
            <p className="website-product-card-title">{product.name}</p>
          </ProductNav>
          {isBoutique && brandLabel && !listView ? (
            <p className="website-product-card-brand">{brandLabel}</p>
          ) : product.subtitle ? (
            <p className="website-product-card-subtitle">{product.subtitle}</p>
          ) : null}
          {showPrice && Number.isFinite(price) && price > 0 ? (
            <p className="website-product-card-price">
              {formatStorePrice(price, store.sellerCurrencyCode)}
              {priceUnit ? <span className="website-product-card-price-unit">/{unitLabel(priceUnit)}</span> : null}
            </p>
          ) : null}
        </>
      )}
      {!listView && isBoutique ? (
        <ProductNav className="website-product-card-cta-wrap">
          <span className="website-product-card-cta website-product-card-cta--boutique">View product</span>
        </ProductNav>
      ) : !listView && isQuickShop ? (
        <ProductCardVariantPicker
          product={product}
          productHref={href}
          builderPreview={builderPreview}
          onBuilderProductClick={onBuilderProductClick}
        />
      ) : listView && isQuickShop ? (
        <ProductCardVariantPicker
          product={product}
          productHref={href}
          builderPreview={builderPreview}
          onBuilderProductClick={onBuilderProductClick}
        />
      ) : (
        <>
          {orderRow}
          {packRow}
        </>
      )}
    </div>
  );

  const flipImageBlock = (
    <div className="website-product-card-img" style={{ aspectRatio: imageAspect }}>
      {img ? (
        <img src={img} alt={product.name} loading="lazy" />
      ) : (
        <ProductImagePlaceholder size={40} className="website-product-card-ph" />
      )}
      {showAvailability && !inStock ? (
        <span className="website-product-card-oos">Out of stock</span>
      ) : null}
    </div>
  );

  if (!listView && isFlipShop) {
    return (
      <article
        className={`website-product-card website-product-card-flip-shop website-product-card-grid${
          builderPreview ? ' website-product-card--builder' : ''
        }`}
      >
        <ProductCardFlipShop
          product={product}
          productHref={href}
          title={product.name}
          subtitle={product.subtitle}
          priceLabel={
            showPrice && Number.isFinite(price) && price > 0 ? (
              <p className="website-product-card-price">
                {formatStorePrice(price, store.sellerCurrencyCode)}
                {priceUnit ? (
                  <span className="website-product-card-price-unit">/{unitLabel(priceUnit)}</span>
                ) : null}
              </p>
            ) : null
          }
          image={flipImageBlock}
          quantity={quantity}
          quantityStep={clampedStep}
          onQtyChange={onQtyChange}
          builderPreview={builderPreview}
          onBuilderProductClick={onBuilderProductClick}
        />
      </article>
    );
  }

  const openProductPage = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (builderPreview) {
      onBuilderProductClick?.(product);
      return;
    }
    navigate(href);
  };

  const handleCatalogAdd = openProductPage;

  const catalogUnavailable = showAvailability && !inStock;

  if (!listView && isCatalog) {
    return (
      <article
        className={`website-product-card website-product-card-catalog website-product-card-grid${
          builderPreview ? ' website-product-card--builder' : ''
        }${catalogUnavailable ? ' website-product-card-catalog--unavailable' : ''}`}
      >
        <ProductNav className="website-product-card-linkwrap">
          <div className="website-product-card-img">
            {img ? (
              <img src={img} alt={product.name} loading="lazy" />
            ) : (
              <ProductImagePlaceholder size={40} className="website-product-card-ph" />
            )}
            {catalogUnavailable ? (
              <span className="website-product-card-oos">Out of stock</span>
            ) : null}
          </div>
        </ProductNav>
        <div className="website-product-card-body website-product-card-body--catalog">
          <ProductNav className="website-product-card-title-link">
            <p className="website-product-card-title">{product.name}</p>
          </ProductNav>
          {showPrice && Number.isFinite(price) && price > 0 ? (
            <div className="website-product-card-catalog-meta">
              <p className="website-product-card-price">
                {formatStorePrice(price, store.sellerCurrencyCode)}
                {priceUnit ? (
                  <span className="website-product-card-price-unit">/{unitLabel(priceUnit)}</span>
                ) : null}
              </p>
              <span className="website-product-card-catalog-wish" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 20.5 10.55 19.1C5.4 14.55 2 11.55 2 7.75 2 4.85 4.25 2.75 7.1 2.75c1.65 0 3.25.8 4.25 2.05C12.35 3.55 13.95 2.75 15.6 2.75 18.45 2.75 20.7 4.85 20.7 7.75c0 3.8-3.4 6.8-8.55 11.35L12 20.5Z" />
                </svg>
              </span>
            </div>
          ) : null}
        </div>
        <div className="website-product-card-catalog-action">
          <button
            type="button"
            className="website-product-card-catalog-action__add"
            disabled={catalogUnavailable}
            onClick={handleCatalogAdd}
          >
            {catalogUnavailable ? 'Out of stock' : 'Add to cart'}
          </button>
          <span className="website-product-card-catalog-action__divider" aria-hidden="true" />
          <ProductNav className="website-product-card-catalog-action__link" aria-label={`View ${product.name}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ProductNav>
        </div>
      </article>
    );
  }

  const imageBlock = (
    <ProductNav className="website-product-card-linkwrap">
      <div className="website-product-card-img" style={{ aspectRatio: imageAspect }}>
        {img ? (
          <img src={img} alt={product.name} loading="lazy" />
        ) : (
          <ProductImagePlaceholder size={40} className="website-product-card-ph" />
        )}
        {showAvailability && !inStock ? (
          <span className="website-product-card-oos">Out of stock</span>
        ) : null}
      </div>
    </ProductNav>
  );

  return (
    <article
      className={`website-product-card website-product-card-${resolvedStyle} ${
        listView ? 'website-product-card-list' : 'website-product-card-grid'
      }${builderPreview ? ' website-product-card--builder' : ''}`}
    >
      {listView ? (
        <div className="website-product-card-list-inner">
          <ProductNav className="website-product-card-linkwrap website-product-card-list-media">
            <div className="website-product-card-img" style={{ aspectRatio: imageAspect }}>
              {img ? (
                <img src={img} alt={product.name} loading="lazy" />
              ) : (
                <ProductImagePlaceholder size={40} className="website-product-card-ph" />
              )}
              {showAvailability && !inStock ? (
                <span className="website-product-card-oos">Out of stock</span>
              ) : null}
            </div>
          </ProductNav>
          {detailsBody}
        </div>
      ) : resolvedStyle === 'overlay' ? (
        <div className="website-product-card-media-stack" style={{ aspectRatio: imageAspect }}>
          {imageBlock}
          {detailsBody}
        </div>
      ) : (
        <>
          {imageBlock}
          {detailsBody}
        </>
      )}
    </article>
  );
}
