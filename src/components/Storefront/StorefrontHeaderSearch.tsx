import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { deriveStoreCategories } from '../../utils/storefrontCategories';
import { searchStoreCategories, searchStoreProducts } from '../../utils/storefrontHeaderSearch';
import { getWebsiteProductImageUrl } from '../../utils/websiteStorefront';
import { useWebsiteStoreOptional } from '../WebsiteBuilder/WebsiteStoreContext';
import { ProductImagePlaceholder } from './StorefrontIcons';
import './storefront-header-search.css';

interface StorefrontHeaderSearchProps {
  preview?: boolean;
  className?: string;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
  onCategoryPreview?: (category: { id: string; label: string }) => void;
}

function stopHeaderEditBubble(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.75" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16.5 16.5L20.25 20.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function StorefrontHeaderSearch({
  preview = false,
  className = '',
  onProductPreview,
  onCategoryPreview,
}: StorefrontHeaderSearchProps) {
  const storeCtx = useWebsiteStoreOptional();
  const navigate = useNavigate();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLLabelElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDrawer = className.includes('storefront-header-search--drawer');
  const [expanded, setExpanded] = useState(isDrawer);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const products = storeCtx?.products ?? [];
  const categories = useMemo(() => deriveStoreCategories(products), [products]);

  const categoryResults = useMemo(
    () => searchStoreCategories(categories, query),
    [categories, query]
  );
  const productResults = useMemo(
    () => searchStoreProducts(products, query),
    [products, query]
  );

  const hasQuery = query.trim().length > 0;
  const hasResults = categoryResults.length > 0 || productResults.length > 0;
  const showDropdown = expanded && open && hasQuery;

  const collapseSearch = useCallback(() => {
    if (isDrawer) return;
    setExpanded(false);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }, [isDrawer]);

  const expandSearch = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.min(rect.left, maxLeft),
      width,
      zIndex: 10060,
    });
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    const scrollRoot = rootRef.current?.closest('.sites-canvas-area') as HTMLElement | null;
    scrollRoot?.addEventListener('scroll', updateDropdownPosition, { passive: true });
    window.addEventListener('scroll', updateDropdownPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      scrollRoot?.removeEventListener('scroll', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition);
    };
  }, [showDropdown, updateDropdownPosition, expanded, query]);

  useEffect(() => {
    if (!showDropdown) {
      setPortalTarget(null);
      return;
    }
    setPortalTarget(document.body);
  }, [showDropdown]);

  useEffect(() => {
    if (!expanded || isDrawer) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      const dropdown = document.getElementById(listboxId);
      if (dropdown?.contains(target)) return;
      collapseSearch();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [expanded, isDrawer, collapseSearch, listboxId]);

  if (!storeCtx || products.length === 0) {
    return null;
  }

  const categoryHref = (categoryId: string) =>
    `${storeCtx.collectionPath}?category=${encodeURIComponent(categoryId)}`;

  const goToCategory = (category: { id: string; label: string }) => {
    if (preview) {
      onCategoryPreview?.(category);
      collapseSearch();
      return;
    }
    navigate(categoryHref(category.id));
    collapseSearch();
  };

  const goToProduct = (product: ProductWithCatalogueData) => {
    if (preview) {
      onProductPreview?.(product);
      collapseSearch();
      return;
    }
    navigate(storeCtx.productPath(product));
    collapseSearch();
  };

  const dropdown = showDropdown ? (
    <div
      id={listboxId}
      className="storefront-header-search__dropdown storefront-header-search__dropdown--portal"
      style={dropdownStyle}
      role="listbox"
      aria-label="Search results"
      onPointerDown={stopHeaderEditBubble}
      onMouseDown={stopHeaderEditBubble}
      onClick={stopHeaderEditBubble}
    >
      {!hasResults ? (
        <div className="storefront-header-search__empty">
          <SearchIcon className="storefront-header-search__empty-icon" />
          <p>No matching products or categories.</p>
        </div>
      ) : null}

      {categoryResults.length > 0 ? (
        <div className="storefront-header-search__group">
          <p className="storefront-header-search__group-label">Categories</p>
          <ul className="storefront-header-search__list">
            {categoryResults.map((category) => (
              <li key={category.id}>
                {preview ? (
                  <button
                    type="button"
                    className="storefront-header-search__item storefront-header-search__item--category"
                    onClick={() => goToCategory(category)}
                  >
                    <span className="storefront-header-search__category-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 7h7v7H4V7Zm9 0h7v4h-7V7Zm0 6h7v4h-7v-4ZM4 16h7v3H4v-3Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="storefront-header-search__item-label">{category.label}</span>
                    <span className="storefront-header-search__item-meta">
                      {category.count} item{category.count === 1 ? '' : 's'}
                    </span>
                  </button>
                ) : (
                  <Link
                    to={categoryHref(category.id)}
                    className="storefront-header-search__item storefront-header-search__item--category"
                    onClick={collapseSearch}
                  >
                    <span className="storefront-header-search__category-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 7h7v7H4V7Zm9 0h7v4h-7V7Zm0 6h7v4h-7v-4ZM4 16h7v3H4v-3Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="storefront-header-search__item-label">{category.label}</span>
                    <span className="storefront-header-search__item-meta">
                      {category.count} item{category.count === 1 ? '' : 's'}
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {productResults.length > 0 ? (
        <div className="storefront-header-search__group">
          <p className="storefront-header-search__group-label">Products</p>
          <ul className="storefront-header-search__list">
            {productResults.map((product) => {
              const imageUrl = getWebsiteProductImageUrl(product);
              return (
                <li key={product.id}>
                  {preview ? (
                    <button
                      type="button"
                      className="storefront-header-search__item storefront-header-search__item--product"
                      onClick={() => goToProduct(product)}
                    >
                      <span className="storefront-header-search__thumb" aria-hidden>
                        {imageUrl ? (
                          <img src={imageUrl} alt="" loading="lazy" />
                        ) : (
                          <ProductImagePlaceholder size={18} />
                        )}
                      </span>
                      <span className="storefront-header-search__item-label">{product.name}</span>
                    </button>
                  ) : (
                    <Link
                      to={storeCtx.productPath(product)}
                      className="storefront-header-search__item storefront-header-search__item--product"
                      onClick={collapseSearch}
                    >
                      <span className="storefront-header-search__thumb" aria-hidden>
                        {imageUrl ? (
                          <img src={imageUrl} alt="" loading="lazy" />
                        ) : (
                          <ProductImagePlaceholder size={18} />
                        )}
                      </span>
                      <span className="storefront-header-search__item-label">{product.name}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  ) : null;

  const isNavInline = className.includes('storefront-header-search--nav-inline');
  const showNavToggle = isNavInline && !isDrawer;
  const showBarToggle = !expanded && !isDrawer && !isNavInline;

  const searchField = (
    <label ref={fieldRef} className="storefront-header-search__field">
      <span className="storefront-header-search__icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        type="search"
        className="storefront-header-search__input"
        value={query}
        placeholder="What are you looking for?"
        aria-label="Search products and categories"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId : undefined}
        aria-autocomplete="list"
        role="combobox"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            collapseSearch();
          }
        }}
      />
      <button
        type="button"
        className="storefront-header-search__clear"
        aria-label={query ? 'Clear search' : 'Close search'}
        onClick={() => {
          if (query) {
            setQuery('');
            setOpen(false);
            inputRef.current?.focus();
            return;
          }
          collapseSearch();
        }}
      >
        <CloseIcon />
      </button>
    </label>
  );

  return (
    <div
      ref={rootRef}
      className={`storefront-header-search${expanded ? ' is-expanded' : ''}${
        showDropdown ? ' is-open' : ''
      }${className ? ` ${className}` : ''}`}
      onPointerDown={stopHeaderEditBubble}
      onMouseDown={stopHeaderEditBubble}
      onClick={stopHeaderEditBubble}
    >
      {(showBarToggle || showNavToggle) && (
        <button
          type="button"
          className={`storefront-header-search__toggle${expanded && isNavInline ? ' is-active' : ''}`}
          aria-label={expanded ? 'Close search' : 'Open search'}
          aria-expanded={expanded}
          onClick={() => {
            if (expanded) collapseSearch();
            else expandSearch();
          }}
        >
          <SearchIcon />
        </button>
      )}

      {expanded ? (
        isNavInline ? (
          <div className="storefront-header-search__panel">
            <p className="storefront-header-search__panel-title">Search</p>
            {searchField}
          </div>
        ) : (
          searchField
        )
      ) : null}

      {dropdown && portalTarget ? createPortal(dropdown, portalTarget) : null}
    </div>
  );
}
