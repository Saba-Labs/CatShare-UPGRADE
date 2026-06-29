import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getCatalogueData,
  isProductInStockForCatalogue,
  normalizeOrderQuantityStep,
  type ProductWithCatalogueData,
} from '../../../config/catalogueProductUtils';
import type { DefaultSorting, ProductImageRatio } from '../../../types/storeBehaviorSettings';
import { productsInCategory } from '../../../utils/storefrontCategories';
import { productImageAspectRatio, sortStorefrontProducts } from '../../../utils/storefrontBehavior';
import {
  formatStorePrice,
  getWebsiteProductImageUrl,
} from '../../../utils/websiteStorefront';
import { ProductImagePlaceholder } from '../../Storefront/StorefrontIcons';
import { getStorefrontPriceAndUnit, unitLabel } from '../../Storefront/storefrontOrderHelpers';
import { getProductVariantGroups } from '../../../utils/productVariants';
import { useWebsiteOrderBridge } from '../WebsiteOrderBridge';
import WebsiteBreadcrumbs from '../WebsiteBreadcrumbs';
import { useWebsiteStore } from '../WebsiteStoreContext';
import '../website-runtime.css';

interface CollectionPageRuntimeProps {
  products: ProductWithCatalogueData[];
  columns?: number;
  cardsStyle?: 'minimal' | 'boxed';
  /** When true, hides breadcrumbs and uses optional section title (homepage block). */
  embedded?: boolean;
  sectionTitle?: string;
  showSearch?: boolean;
  showCategoryFilters?: boolean;
  showSort?: boolean;
  viewMode?: 'list' | 'grid';
  productImageRatio?: ProductImageRatio;
  showPrice?: boolean;
  showAvailability?: boolean;
  defaultSorting?: DefaultSorting;
  /** Builder canvas: open in-editor product preview instead of navigating away. */
  builderPreview?: boolean;
  onBuilderProductClick?: (product: ProductWithCatalogueData) => void;
}

export default function CollectionPageRuntime({
  products,
  columns = 4,
  cardsStyle = 'boxed',
  embedded = false,
  sectionTitle,
  showSearch = true,
  showCategoryFilters = true,
  showSort = true,
  viewMode,
  productImageRatio = 'square',
  showPrice = true,
  showAvailability = true,
  defaultSorting = 'newest',
  builderPreview = false,
  onBuilderProductClick,
}: CollectionPageRuntimeProps) {
  const { basePath, collectionPath, productPath, store } = useWebsiteStore();
  const orderBridge = useWebsiteOrderBridge();
  const location = useLocation();
  const isListView = embedded ? (viewMode ?? 'list') === 'list' : store.viewMode === 'list';
  const imageAspect = productImageAspectRatio(productImageRatio);
  void columns;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc'>('default');

  const categoryFilter = new URLSearchParams(location.search).get('category');
  const [selectedCategory, setSelectedCategory] = useState(categoryFilter?.trim() || 'all');
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const availableCategories = useMemo(() => {
    const all = products.flatMap((product) =>
      (Array.isArray(product.category) ? product.category : [])
        .map((category) => String(category).trim())
        .filter(Boolean)
    );
    return Array.from(new Set(all));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const byCategory =
      selectedCategory === 'all'
        ? products
        : productsInCategory(products, selectedCategory);
    if (!normalizedQuery) return byCategory;
    return byCategory.filter((product) =>
      [product.name, product.subtitle, ...(Array.isArray(product.category) ? product.category : [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [products, selectedCategory, normalizedQuery]);

  const sortedProducts = useMemo(() => {
    if (sortBy === 'default') {
      if (embedded) {
        return sortStorefrontProducts(
          filteredProducts,
          defaultSorting,
          store.catalogueId,
          orderBridge?.catalogue ?? null
        );
      }
      return filteredProducts;
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
    const match = products.find((p) =>
      (Array.isArray(p.category) ? p.category : []).some(
        (c) => String(c).toLowerCase() === selectedCategory.toLowerCase()
      )
    );
    const labels = match?.category;
    if (Array.isArray(labels)) {
      return labels.find((c) => String(c).toLowerCase() === selectedCategory.toLowerCase()) || selectedCategory;
    }
    return selectedCategory;
  }, [selectedCategory, products]);

  const pageTitle = embedded
    ? (sectionTitle?.trim() || 'Products')
    : categoryLabel
      ? String(categoryLabel)
      : 'All products';

  return (
    <main
      className={`website-section-products website-section-products--order-form${embedded ? ' website-section-products--embedded' : ''}`}
    >
      <div className="website-of-panel">
        {!embedded ? (
          <WebsiteBreadcrumbs
            items={[
              { label: 'Home', to: basePath || '/' },
              ...(categoryLabel
                ? [
                    { label: 'Shop', to: collectionPath },
                    { label: String(categoryLabel) },
                  ]
                : [{ label: 'All products' }]),
            ]}
          />
        ) : null}
        {!embedded || sectionTitle?.trim() ? (
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
          {showSearch || showSort ? (
          <div className="website-of-search-row">
            {showSearch ? (
            <div className="website-of-search">
              <span className="website-of-search-icon" aria-hidden>
                ⌕
              </span>
              <input
                type="text"
                className="website-of-search-input"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search products"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="website-of-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
            ) : null}
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
          </div>
          ) : null}
          {showCategoryFilters && availableCategories.length > 0 ? (
            <div className="website-of-category-filters" role="tablist" aria-label="Filter by category">
              <button
                type="button"
                className={`website-of-category-chip${selectedCategory === 'all' ? ' is-active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`website-of-category-chip${selectedCategory === category ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {sortedProducts.length === 0 ? (
        <p style={{ color: '#5f6368' }}>No products available yet.</p>
      ) : (
        <div
          className={
            isListView
              ? 'website-products-list website-products-list--order-form'
              : 'website-products-grid website-products-grid--order-form'
          }
        >
          {sortedProducts.map((product) => (
            <CollectionProductCard
              key={product.id}
              product={product}
              cardsStyle={cardsStyle}
              listView={isListView}
              href={productPath(product)}
              catalogue={orderBridge?.catalogue ?? null}
              quantity={orderBridge?.getProductQty(product.id) ?? 0}
              quantityStep={normalizeOrderQuantityStep(getCatalogueData(product, store.catalogueId)?.orderQuantityStep)}
              onQtyChange={(delta, step) => orderBridge?.changeProductQty(product.id, delta, step)}
              builderPreview={builderPreview}
              onBuilderProductClick={onBuilderProductClick}
              imageAspect={embedded ? imageAspect : '1 / 1'}
              showPrice={embedded ? showPrice : true}
              showAvailability={embedded ? showAvailability : false}
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
  cardsStyle: 'minimal' | 'boxed';
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

  return (
    <article
      className={`website-product-card website-product-card-${cardsStyle} ${
        listView ? 'website-product-card-list' : 'website-product-card-grid'
      }${builderPreview ? ' website-product-card--builder' : ''}`}
    >
      <ProductNav className="website-product-card-linkwrap">
        <div
          className="website-product-card-img"
          style={{ aspectRatio: imageAspect }}
        >
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
      <div className="website-product-card-body">
        <ProductNav className="website-product-card-title-link">
          <p className="website-product-card-title">{product.name}</p>
        </ProductNav>
        {product.subtitle ? <p className="website-product-card-subtitle">{product.subtitle}</p> : null}
        {showPrice && Number.isFinite(price) && price > 0 ? (
          <p className="website-product-card-price">
            {formatStorePrice(price, store.sellerCurrencyCode)}
            {priceUnit ? <span className="website-product-card-price-unit">/{unitLabel(priceUnit)}</span> : null}
          </p>
        ) : null}
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
        {clampedStep > 1 ? (
          <div className="website-product-card-pack-row">
            <span className="website-pack-hint">Pack of {clampedStep}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
