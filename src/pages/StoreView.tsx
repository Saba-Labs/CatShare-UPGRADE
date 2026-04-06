import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStoreBySlug } from '../services/storeService';
import { isProductEnabledForCatalogue, getCatalogueData, normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { getAllCatalogues } from '../config/catalogueConfig';
import { createOrder, type OrderItem } from '../services/orderService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import { businessProfileFromUserSettings, type BusinessProfile, EMPTY_BUSINESS_PROFILE } from '../config/businessProfile';
import './OrderForm.css';

type Step = 'products' | 'customer' | 'review';

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function ImgIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function getOrderUnitLabel(priceUnit: string | undefined): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') {
    return 'units';
  }
  const cleaned = String(priceUnit)
    .replace(/^\s*\/\s*/i, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return 'units';
  if (cleaned === 'piece' || cleaned === 'pieces' || cleaned === 'pc') return 'pieces';
  return cleaned;
}

function formatStoreMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatLineCalculationDetail(quantity: number, price: number, priceUnit: string | undefined, symbol: string): string | null {
  if (quantity <= 0 || !Number.isFinite(price)) return null;
  return `${quantity} ${getOrderUnitLabel(priceUnit)} × ${formatStoreMoney(price, symbol)}`;
}

function isPublicHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getProductCategories(product: ProductWithCatalogueData): string[] {
  return Array.from(
    new Set(
      (product.category || [])
        .map((category) => String(category).trim())
        .filter(Boolean)
    )
  );
}

function getProductSearchText(product: ProductWithCatalogueData): string {
  const extraFields = Array.from({ length: 10 }, (_, index) => {
    const fieldNumber = index + 1;
    const row = product as unknown as Record<string, string | undefined>;
    return [
      row[`field${fieldNumber}`],
      row[`field${fieldNumber}Label`],
      row[`field${fieldNumber}Unit`],
    ]
      .filter(Boolean)
      .join(' ');
  });

  return [product.name, product.subtitle, ...(product.category || []), ...extraFields]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getFieldLabelAndUnitSuffix(
  product: ProductWithCatalogueData,
  n: number
): { label: string; unitSuffix: string } {
  const row = product as unknown as Record<string, string | undefined>;
  const explicitUnit = row[`field${n}Unit`];
  const rawLabel = row[`field${n}Label`];
  if (explicitUnit != null && String(explicitUnit).trim() !== '') {
    return { label: (rawLabel || `Field ${n}`).trim(), unitSuffix: String(explicitUnit).trim() };
  }
  if (rawLabel) {
    const match = rawLabel.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (match) return { label: match[1].trim(), unitSuffix: match[2].trim() };
    return { label: rawLabel.trim(), unitSuffix: '' };
  }
  return { label: `Field ${n}`, unitSuffix: '' };
}

function QtyControl({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (delta: number) => void;
}) {
  const normalizedStep = normalizeOrderQuantityStep(step);
  return (
    <div className="of-qty">
      <button type="button" className="of-qty-btn" onClick={() => onChange(-normalizedStep)}>−</button>
      <span className="of-qty-val">{value}</span>
      <button type="button" className="of-qty-btn" onClick={() => onChange(normalizedStep)}>+</button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1.5px solid #e2e8f0',
        display: 'flex',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <div className="of-skeleton" style={{ width: 100, minHeight: 100, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="of-skeleton" style={{ height: 14, width: '65%', borderRadius: 6 }} />
        <div className="of-skeleton" style={{ height: 11, width: '45%', borderRadius: 6 }} />
        <div className="of-skeleton" style={{ height: 22, width: '30%', borderRadius: 6, marginTop: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="of-skeleton" style={{ height: 32, width: 100, borderRadius: 100 }} />
          <div className="of-skeleton" style={{ height: 22, width: 60, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

export default function StoreView() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<Step>('products');
  const [store, setStore] = useState<any>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE);
  const [allProducts, setAllProducts] = useState<ProductWithCatalogueData[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [drawerProduct, setDrawerProduct] = useState<ProductWithCatalogueData | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadStore = async () => {
      if (!slug) {
        setStoreError('Store slug not found');
        setStoreLoading(false);
        return;
      }

      setStoreLoading(true);
      const result = await getStoreBySlug(slug);

      if (!result.success || !result.data) {
        setStoreError(result.error || 'Store not found');
      } else {
        setStore(result.data);
      }

      setStoreLoading(false);
    };

    loadStore();
  }, [slug]);

  useEffect(() => {
    const loadStoreProducts = async () => {
      if (!store?.sellerUserId) return;

      setProductsLoading(true);
      try {
        const client = getSupabaseClient();
        const { data: products, error } = await client
          .from('products')
          .select('*')
          .eq('user_id', store.sellerUserId)
          .order('position', { ascending: true });

        if (error) {
          console.error('Error fetching products:', error);
          setAllProducts([]);
        } else if (products) {
          const transformed = products.map((p: any) => ({
            id: p.product_id,
            name: p.name,
            subtitle: p.data?.subtitle || '',
            category: p.data?.category || [],
            image: p.data?.image,
            imageUrl: p.data?.image,
            ...p.data,
          }));
          setAllProducts(transformed);
        }
      } catch (err) {
        console.error('Exception loading products:', err);
        setAllProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };

    loadStoreProducts();
  }, [store?.sellerUserId]);

  // Load business profile for the seller
  useEffect(() => {
    const loadBusinessProfile = async () => {
      if (!store?.sellerUserId) return;

      try {
        const client = getSupabaseClient();
        const { data: userSettings, error } = await client
          .from('user_settings')
          .select('data')
          .eq('user_id', store.sellerUserId)
          .single();

        if (error) {
          console.error('Error fetching business profile:', error);
          setBusinessProfile(EMPTY_BUSINESS_PROFILE);
        } else if (userSettings) {
          const profile = businessProfileFromUserSettings(userSettings);
          setBusinessProfile(profile);
        }
      } catch (err) {
        console.error('Exception loading business profile:', err);
        setBusinessProfile(EMPTY_BUSINESS_PROFILE);
      }
    };

    loadBusinessProfile();
  }, [store?.sellerUserId]);

  const catalogues = useMemo(() => getAllCatalogues(null), []);

  const currencySymbol = useMemo(
    () => getSymbolForCurrencyCode(store?.sellerCurrencyCode || 'INR'),
    [store?.sellerCurrencyCode]
  );

  const catalogue = useMemo(
    () => catalogues.find((item) => item.id === store?.catalogueId) || null,
    [catalogues, store?.catalogueId]
  );

  const storeProducts = useMemo(() => {
    if (!store?.catalogueId) return [];
    return allProducts.filter((product) => isProductEnabledForCatalogue(product, store.catalogueId));
  }, [store, allProducts]);

  const availableCategories = useMemo(() => {
    const categories = storeProducts.flatMap((product) => getProductCategories(product));
    return Array.from(new Set(categories));
  }, [storeProducts]);

  const hasUncategorizedItems = useMemo(
    () => storeProducts.some((product) => getProductCategories(product).length === 0),
    [storeProducts]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return storeProducts.filter((product) => {
      const matchesSearch = !query || getProductSearchText(product).includes(query);
      const categories = getProductCategories(product);
      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized' ? categories.length === 0 : categories.includes(selectedCategory));
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, storeProducts]);

  const orderSummary = useMemo(() => {
    if (!store || !catalogue) return { items: [], total: 0, count: 0 };

    const items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      rowTotal: number;
      category: string | undefined;
      priceUnit: string | undefined;
      imageUrl: string | undefined;
      quantityStep: number | undefined;
      subtitle: string | undefined;
    }> = [];
    let total = 0;
    let count = 0;

    selectedProducts.forEach((quantity, productId) => {
      const product = allProducts.find((item) => item.id === productId);
      if (!product) return;
      const catData = getCatalogueData(product, store.catalogueId);
      const unitPrice = parseFloat(catData[catalogue.priceField] || '0') || 0;
      const rowTotal = unitPrice * quantity;
      const priceUnit = catData[catalogue.priceUnitField];
      items.push({
        productId,
        name: product.name,
        quantity,
        unitPrice,
        rowTotal,
        category: product.category?.[0],
        priceUnit,
        imageUrl: product.image || product.imageUrl,
        quantityStep: catData.orderQuantityStep,
        subtitle: product.subtitle,
      });
      total += rowTotal;
      count += quantity;
    });

    return { items, total, count };
  }, [selectedProducts, store, catalogue, allProducts]);

  const selectedProductCount = useMemo(
    () => Array.from(selectedProducts.values()).filter((quantity) => quantity > 0).length,
    [selectedProducts]
  );

  const changeQty = (productId: string, delta: number, step: number) => {
    const normalizedStep = normalizeOrderQuantityStep(step);
    const current = selectedProducts.get(productId) || 0;
    const next = Math.max(0, current + delta);
    const rounded = Math.round(next / normalizedStep) * normalizedStep;
    const newSelected = new Map(selectedProducts);
    if (rounded <= 0) {
      newSelected.delete(productId);
    } else {
      newSelected.set(productId, rounded);
    }
    setSelectedProducts(newSelected);
  };

  const handleContinueToCustomer = () => {
    if (selectedProducts.size === 0) {
      alert('Please add at least one product');
      return;
    }
    setStep('customer');
  };

  const handleBack = useCallback(() => {
    if (drawerProduct) {
      setDrawerProduct(null);
      return;
    }
    if (step === 'review') {
      setStep('customer');
      return;
    }
    if (step === 'customer') {
      setStep('products');
      return;
    }
    window.history.back();
  }, [drawerProduct, step]);

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!store) {
      alert('Store information not available');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = [];

      if (catalogue) {
        selectedProducts.forEach((quantity, productId) => {
          const product = allProducts.find((item) => item.id === productId);
          if (product) {
            const catData = getCatalogueData(product, store.catalogueId);
            const unitPrice = parseFloat(catData[catalogue.priceField] || '0') || 0;
            const rowTotal = unitPrice * quantity;

            orderItems.push({
              productId,
              name: product.name,
              quantity,
              unitPrice,
              rowTotal,
              category: product.category?.[0],
              subtitle: product.subtitle,
              priceUnit: catData[catalogue.priceUnitField],
              imageUrl: product.image || product.imageUrl,
              quantityStep: catData.orderQuantityStep,
            });
          }
        });
      }

      if (orderItems.length === 0) {
        alert('No products selected');
        setIsSubmitting(false);
        return;
      }

      setSupabaseRlsUserId(store.sellerUserId);

      const { error } = await createOrder(
        store.sellerUserId,
        '',
        customerName.trim(),
        orderItems,
        orderSummary.total,
        store.sellerCurrencyCode || 'INR',
        customerWhatsapp.trim() || undefined,
        'store'
      );

      if (error) {
        console.error('Error creating order:', error);
        alert('Failed to save order. Please try again.');
      } else {
        alert('Order placed successfully! The seller will contact you soon.');
        navigate('/');
      }
    } catch (err) {
      console.error('Error placing order:', err);
      alert('Error placing order. Please try again.');
    } finally {
      setSupabaseRlsUserId(null);
      setIsSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (step === 'products') {
      handleContinueToCustomer();
      return;
    }
    if (step === 'customer') {
      if (!customerName.trim()) {
        alert('Please enter your name');
        return;
      }
      setStep('review');
      return;
    }
    void handlePlaceOrder();
  };

  const primaryButtonLabel =
    step === 'products'
      ? 'Continue'
      : step === 'customer'
        ? 'Review Order'
        : isSubmitting
          ? 'Placing Order…'
          : 'Place Order';

  const primaryButtonDisabled =
    step === 'products' ? selectedProductCount === 0 : step === 'customer' ? !customerName.trim() : isSubmitting;

  const storeDisplayName = businessProfile.businessName || (store?.storeSlug
    ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1)
    : 'Store');

  if (storeLoading) {
    return (
      <div className="of-bg">
        <div className="of-page">
          <div className="of-header">
            <div className="of-header-inner">
              <div className="of-store-row">
                <div className="of-store-icon">
                  <StoreIcon />
                </div>
                <div>
                  <div className="of-skeleton" style={{ height: 14, width: 120, borderRadius: 6 }} />
                  <div className="of-skeleton" style={{ height: 10, width: 80, borderRadius: 6, marginTop: 5 }} />
                </div>
              </div>
              <div className="of-skeleton" style={{ height: 38, width: 110, borderRadius: 100 }} />
            </div>
          </div>
          <div style={{ padding: '12px 12px 0' }}>
            <div className="of-skeleton" style={{ height: 11, width: 80, borderRadius: 6, margin: '16px 8px 10px' }} />
          </div>
          <div className="of-skeleton-wrap">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="of-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: '#fff',
            borderRadius: 24,
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            fontFamily: 'var(--font)',
          }}
        >
          <div style={{ height: 6, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
          <div style={{ padding: '36px 32px 32px', textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 32,
              }}
            >
              ⚠️
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 10 }}>
              Store unavailable
            </div>
            <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 28 }}>
              {storeError || 'Store not found'}
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#16a34a',
                color: '#fff',
                padding: '13px 20px',
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                fontFamily: 'var(--font)',
              }}
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="of-bg">
      <div className="of-page">
        <div className="of-header">
          <div className="of-header-inner">
            <div className="of-store-row" style={{ minWidth: 0, flex: 1 }}>
              <div className="of-store-icon">
                {store?.sellerLogoUrl && !logoFailed && isPublicHttpUrl(store.sellerLogoUrl) ? (
                  <img
                    src={store.sellerLogoUrl}
                    alt=""
                    className="of-store-logo-img"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <StoreIcon />
                )}
              </div>
              <div className="of-store-meta" style={{ minWidth: 0 }}>
                <div className="of-store-name">{storeDisplayName}</div>
                <div className="of-store-sub">
                  {businessProfile.about ? businessProfile.about : (step === 'products'
                    ? 'Shop Now'
                    : step === 'customer'
                      ? 'Your details'
                      : 'Review your order')}
                </div>
              </div>
            </div>
            <button className="of-confirm-btn" onClick={handlePrimaryAction} disabled={primaryButtonDisabled}>
              <span className="btn-label">{primaryButtonLabel}</span>
            </button>
          </div>
        </div>

        {step === 'products' && (
          <>
            <div className="of-toolbar">
              <div className="of-section-head">
                {searchQuery.trim() || selectedCategory !== 'all'
                  ? `${filteredProducts.length} of ${storeProducts.length} item${storeProducts.length === 1 ? '' : 's'} shown`
                  : `${storeProducts.length} item${storeProducts.length === 1 ? '' : 's'} available`}
              </div>

              {storeProducts.length > 0 && (
                <div className="of-search">
                  <span className="of-search-icon" aria-hidden="true">⌕</span>
                  <input
                    type="text"
                    className="of-search-input"
                    placeholder="Search items"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search items"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="of-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              {availableCategories.length > 0 && (
                <div className="of-category-filters" role="tablist" aria-label="Filter by category">
                  <button
                    type="button"
                    className={`of-category-chip${selectedCategory === 'all' ? ' is-active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    All
                  </button>
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`of-category-chip${selectedCategory === category ? ' is-active' : ''}`}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                  {hasUncategorizedItems && (
                    <button
                      type="button"
                      className={`of-category-chip${selectedCategory === 'uncategorized' ? ' is-active' : ''}`}
                      onClick={() => setSelectedCategory('uncategorized')}
                    >
                      Uncategorized
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="of-items">
              {productsLoading && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}

              {!productsLoading && storeProducts.length === 0 && (
                <div className="of-empty">
                  <strong>No items in this store</strong>
                  Products will appear here when the seller adds them.
                </div>
              )}

              {!productsLoading && storeProducts.length > 0 && filteredProducts.length === 0 && (
                <div className="of-empty">
                  <strong>No matching items</strong>
                  Try a different name or category.
                </div>
              )}

              {!productsLoading && filteredProducts.map((product) => {
                const quantity = selectedProducts.get(product.id) || 0;
                const isSelected = quantity > 0;
                const catData = catalogue ? getCatalogueData(product, store.catalogueId) : null;
                const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;
                const priceUnit = catalogue && catData ? catData[catalogue.priceUnitField] : undefined;
                const quantityStep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
                const lineTotal = price * quantity;
                const lineCalcDetail = quantity > 0 ? formatLineCalculationDetail(quantity, price, priceUnit, currencySymbol) : null;

                return (
                  <div key={product.id} className={`of-item-card${isSelected ? ' is-selected' : ''}`}>
                    <div className="of-img-wrap" onClick={() => setDrawerProduct(product)}>
                      {isPublicHttpUrl(product.image || product.imageUrl) ? (
                        <img src={String(product.image || product.imageUrl)} alt={product.name} className="of-img" />
                      ) : (
                        <div className="of-img-ph"><ImgIcon /></div>
                      )}
                      {isSelected && <div className="of-selected-badge">✓ Added</div>}
                    </div>

                    <div className="of-item-body">
                      <div className="of-item-top">
                        <div className="of-item-text">
                          <div className="of-item-title-line">
                            <span className="of-item-name">{product.name}</span>
                            {product.subtitle ? (
                              <span className="of-item-subtitle-inline">({product.subtitle})</span>
                            ) : null}
                          </div>
                          <div className="of-item-price-row">
                            {price > 0 && (
                              <div className="of-price-tag">
                                {formatStoreMoney(price, currencySymbol)}
                                {priceUnit ? ` / ${getOrderUnitLabel(priceUnit)}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="of-item-bottom">
                        <div className="of-item-qty-cluster">
                          <div className="of-qty-inline-row">
                            <QtyControl
                              value={quantity}
                              step={quantityStep}
                              onChange={(delta) => changeQty(product.id, delta, quantityStep)}
                            />
                            {quantityStep > 1 ? (
                              <div className="of-step-hint of-step-hint--next-to-qty">
                                <AlertIcon />
                                Pack of {quantityStep}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <button type="button" className="of-view-btn" onClick={() => setDrawerProduct(product)}>
                          Details ›
                        </button>
                      </div>

                      {isSelected && (
                        <div className="of-line-total-below" aria-live="polite">
                          <span className="of-subtotal-label">subtotal</span>
                          <span className="of-line-sep" aria-hidden>·</span>
                          {lineCalcDetail ? (
                            <>
                              <span className="of-line-calc" title={lineCalcDetail}>{lineCalcDetail}</span>
                              <span className="of-line-sep" aria-hidden>·</span>
                            </>
                          ) : null}
                          <span className="of-line-total-val">{formatStoreMoney(lineTotal, currencySymbol)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="of-footer">
              <div className="of-footer-app-row">
                <span className="of-footer-link" style={{ cursor: 'default', textDecoration: 'none' }}>
                  Ready to place an order?
                </span>
              </div>
              <p className="of-footer-desc">
                Add the products you want, then continue to enter your details and submit the order.
              </p>
            </div>
          </>
        )}

        {step === 'customer' && (
          <>
            <div className="of-toolbar">
              <div className="of-section-head">Customer details</div>
            </div>
            <div style={{ padding: '0 12px' }}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1.5px solid #e2e8f0',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    style={{
                      width: '100%',
                      minHeight: 44,
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 12,
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: 14,
                      fontFamily: 'var(--font)',
                      padding: '0 14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="e.g. +91 98xxxxxxxx"
                    style={{
                      width: '100%',
                      minHeight: 44,
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 12,
                      background: '#fff',
                      color: '#0f172a',
                      fontSize: 14,
                      fontFamily: 'var(--font)',
                      padding: '0 14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div
                  style={{
                    padding: 16,
                    background: '#f0fdf4',
                    borderRadius: 14,
                    border: '1.5px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
                      Order total
                    </div>
                    <div style={{ fontSize: 13.5, color: '#166534', lineHeight: 1.5 }}>
                      {selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#14532d', letterSpacing: '-0.5px' }}>
                    {formatStoreMoney(orderSummary.total, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="of-toolbar">
              <div className="of-section-head">Review your order</div>
            </div>
            <div className="of-items">
              {orderSummary.items.map((item) => {
                const lineCalcDetail = formatLineCalculationDetail(item.quantity, item.unitPrice, item.priceUnit, currencySymbol);
                return (
                  <div key={item.productId} className="of-item-card is-selected">
                    <div className="of-img-wrap">
                      {isPublicHttpUrl(item.imageUrl) ? (
                        <img src={item.imageUrl} alt={item.name} className="of-img" />
                      ) : (
                        <div className="of-img-ph"><ImgIcon /></div>
                      )}
                    </div>
                    <div className="of-item-body">
                      <div className="of-item-top">
                        <div className="of-item-text">
                          <div className="of-item-title-line">
                            <span className="of-item-name">{item.name}</span>
                            {item.subtitle ? <span className="of-item-subtitle-inline">({item.subtitle})</span> : null}
                          </div>
                          <div className="of-item-price-row">
                            <div className="of-price-tag">
                              {formatStoreMoney(item.unitPrice, currencySymbol)}
                              {item.priceUnit ? ` / ${getOrderUnitLabel(item.priceUnit)}` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="of-line-total-below">
                        <span className="of-subtotal-label">subtotal</span>
                        <span className="of-line-sep" aria-hidden>·</span>
                        {lineCalcDetail ? (
                          <>
                            <span className="of-line-calc">{lineCalcDetail}</span>
                            <span className="of-line-sep" aria-hidden>·</span>
                          </>
                        ) : null}
                        <span className="of-line-total-val">{formatStoreMoney(item.rowTotal, currencySymbol)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1.5px solid #e2e8f0',
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Customer details
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{customerName}</div>
                {customerWhatsapp && (
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{customerWhatsapp}</div>
                )}
              </div>

              <div
                style={{
                  padding: 16,
                  background: '#0f172a',
                  borderRadius: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Total amount</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                    {formatStoreMoney(orderSummary.total, currencySymbol)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('products')}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    background: '#1e293b',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  Edit Items
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {step === 'products' && selectedProductCount > 0 && (
        <div className="of-summary">
          <div className="of-summary-card" onClick={handleContinueToCustomer}>
            <div className="of-summary-left">
              <span className="of-summary-count">
                {selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected
              </span>
              <span className="of-summary-total">{formatStoreMoney(orderSummary.total, currencySymbol)}</span>
            </div>
            <button type="button" className="of-summary-cta" onClick={handleContinueToCustomer}>
              Continue
            </button>
          </div>
        </div>
      )}

      {(step === 'customer' || step === 'review') && (
        <div className="of-summary">
          <div className="of-summary-card">
            <div className="of-summary-left">
              <span className="of-summary-count">
                {selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected
              </span>
              <span className="of-summary-total">{formatStoreMoney(orderSummary.total, currencySymbol)}</span>
            </div>
            <button
              type="button"
              className="of-summary-cta"
              onClick={handlePrimaryAction}
              disabled={primaryButtonDisabled}
            >
              {primaryButtonLabel}
            </button>
          </div>
        </div>
      )}

      {drawerProduct && (() => {
        const catData = catalogue ? getCatalogueData(drawerProduct, store.catalogueId) : null;
        const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;
        const priceUnit = catalogue && catData ? catData[catalogue.priceUnitField] : undefined;
        const quantityStep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
        const quantity = selectedProducts.get(drawerProduct.id) || 0;
        const lineTotal = price * quantity;
        const drawerCalcDetail = quantity > 0 ? formatLineCalculationDetail(quantity, price, priceUnit, currencySymbol) : null;
        const fields = Array.from({ length: 10 }, (_, index) => index + 1)
          .map((n) => {
            const value = (drawerProduct as Record<string, unknown>)[`field${n}`];
            if (value === undefined || value === null || String(value).trim() === '') return null;
            const { label, unitSuffix } = getFieldLabelAndUnitSuffix(drawerProduct, n);
            return { label, value: unitSuffix ? `${String(value)} ${unitSuffix}` : String(value) };
          })
          .filter(Boolean) as Array<{ label: string; value: string }>;

        return (
          <div
            ref={overlayRef}
            className="of-overlay"
            onClick={(e) => {
              if (e.target === overlayRef.current) {
                setDrawerProduct(null);
              }
            }}
          >
            <div className="of-drawer">
              <div className="of-drawer-handle" />
              <div className="of-drawer-img-wrap">
                {isPublicHttpUrl(drawerProduct.image || drawerProduct.imageUrl) ? (
                  <img src={String(drawerProduct.image || drawerProduct.imageUrl)} alt={drawerProduct.name} className="of-drawer-img" />
                ) : (
                  <div className="of-drawer-img-ph"><ImgIcon size={48} /></div>
                )}
                <button type="button" className="of-drawer-close" onClick={() => setDrawerProduct(null)}>✕</button>
              </div>

              <div className="of-drawer-body">
                <div className="of-drawer-name">{drawerProduct.name}</div>
                {drawerProduct.subtitle && <div className="of-drawer-sub">({drawerProduct.subtitle})</div>}

                {getProductCategories(drawerProduct).length > 0 && (
                  <div className="of-category-row">
                    {getProductCategories(drawerProduct).map((category) => (
                      <span key={category} className="of-category-pill">{category}</span>
                    ))}
                  </div>
                )}

                {price > 0 && (
                  <div className="of-drawer-price-row" style={{ marginTop: 14 }}>
                    <div className="of-drawer-price">
                      {formatStoreMoney(price, currencySymbol)}
                      {priceUnit ? ` / ${getOrderUnitLabel(priceUnit)}` : ''}
                    </div>
                  </div>
                )}

                {fields.length > 0 && (
                  <div className="of-detail-table">
                    {fields.map((field) => (
                      <div key={`${field.label}-${field.value}`} className="of-detail-row">
                        <span className="of-detail-label">{field.label}</span>
                        <span className="of-detail-val">{field.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="of-drawer-qty-section">
                  <div className="of-drawer-qty-label">Quantity</div>
                  <div className="of-drawer-qty-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <QtyControl
                        value={quantity}
                        step={quantityStep}
                        onChange={(delta) => changeQty(drawerProduct.id, delta, quantityStep)}
                      />
                      {quantityStep > 1 ? (
                        <div className="of-step-hint">
                          <AlertIcon />
                          Pack of {quantityStep}
                        </div>
                      ) : null}
                    </div>
                    <div className="of-drawer-line-total-wrap">
                      {drawerCalcDetail ? <div className="of-drawer-line-calc">{drawerCalcDetail}</div> : null}
                      <span className="of-drawer-line-total">{formatStoreMoney(lineTotal, currencySymbol)}</span>
                    </div>
                  </div>
                  <button type="button" className="of-drawer-done" onClick={() => setDrawerProduct(null)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
