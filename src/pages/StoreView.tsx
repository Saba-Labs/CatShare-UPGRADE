import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStoreBySlug } from '../services/storeService';
import { isProductEnabledForCatalogue, getCatalogueData, normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { getAllCatalogues } from '../config/catalogueConfig';
import { createOrder, type OrderItem } from '../services/orderService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';

type Step = 'products' | 'customer' | 'review';

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function getOrderUnitLabel(priceUnit: string | undefined): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') {
    return 'unit';
  }
  const cleaned = String(priceUnit)
    .replace(/^\s*\/\s*/i, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return 'unit';
  if (cleaned === 'piece' || cleaned === 'pieces' || cleaned === 'pc') return 'piece';
  return cleaned;
}

function QtyStepper({ value, step, onChange }: { value: number; step: number; onChange: (n: number) => void }) {
  const normalizedStep = normalizeOrderQuantityStep(step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F2F2F7', borderRadius: 6, border: '1.5px solid #E2E8F0', width: 'fit-content' }}>
      <button
        onClick={() => onChange(Math.max(0, value - normalizedStep))}
        style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: value <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: value <= 0 ? '#CBD5E1' : '#0F172A' }}
        disabled={value <= 0}
      >
        <IconMinus />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value > 0 ? String(value) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          if (!digits) {
            onChange(0);
          } else {
            const num = parseInt(digits, 10);
            const rounded = Math.max(0, Math.round(num / normalizedStep) * normalizedStep);
            onChange(rounded);
          }
        }}
        style={{
          width: 40,
          border: 'none',
          background: 'transparent',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: value === 0 ? '#94A3B8' : '#0F172A',
          fontFamily: 'inherit',
          padding: 0,
          outline: 'none',
        }}
      />
      <button
        onClick={() => onChange(value + normalizedStep)}
        style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A' }}
      >
        <IconPlus />
      </button>
    </div>
  );
}

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

export default function StoreView() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<Step>('products');
  const [store, setStore] = useState<any>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<ProductWithCatalogueData[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Fetch store on mount
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

  // Fetch products for the store from Supabase
  useEffect(() => {
    const loadStoreProducts = async () => {
      if (!store?.sellerUserId) return;
      
      setProductsLoading(true);
      try {
        const client = getSupabaseClient();
        
        // Fetch products for this seller
        const { data: products, error } = await client
          .from('products')
          .select('*')
          .eq('user_id', store.sellerUserId)
          .order('position', { ascending: true });
        
        if (error) {
          console.error('Error fetching products:', error);
          setAllProducts([]);
        } else if (products) {
          // Transform products to match ProductWithCatalogueData type
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
  
  // Get all catalogues
  const catalogues = useMemo(() => getAllCatalogues(null), []);
  
  // Filter products for this store's catalogue
  const storeProducts = useMemo(() => {
    if (!store?.catalogueId) return [];
    return allProducts.filter(p => isProductEnabledForCatalogue(p, store.catalogueId));
  }, [store, allProducts]);
  
  // Calculate order totals
  const orderSummary = useMemo(() => {
    if (!store) return { items: [], total: 0, count: 0 };
    
    const catalogue = catalogues.find(c => c.id === store.catalogueId);
    if (!catalogue) return { items: [], total: 0, count: 0 };
    
    const items: any[] = [];
    let total = 0;
    let count = 0;
    
    selectedProducts.forEach((quantity, productId) => {
      const product = allProducts.find(p => p.id === productId);
      if (product) {
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
        });
        
        total += rowTotal;
        count += quantity;
      }
    });
    
    return { items, total, count };
  }, [selectedProducts, store, catalogues, allProducts]);
  
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    const newSelected = new Map(selectedProducts);
    if (quantity <= 0) {
      newSelected.delete(productId);
    } else {
      newSelected.set(productId, quantity);
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
  
  const handleBack = () => {
    if (step !== 'products') {
      setStep('products');
    } else {
      window.history.back();
    }
  };

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
      // Build order items from selectedProducts
      const orderItems: OrderItem[] = [];
      const catalogue = catalogues.find(c => c.id === store.catalogueId);

      if (catalogue) {
        selectedProducts.forEach((quantity, productId) => {
          const product = allProducts.find(p => p.id === productId);
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

      // Save order to Supabase
      setSupabaseRlsUserId(store.sellerUserId);

      const { error } = await createOrder(
        store.sellerUserId,
        '', // No share_link_token for store orders
        customerName.trim(),
        orderItems,
        orderSummary.total,
        store.sellerCurrencyCode || 'INR',
        customerWhatsapp.trim() || undefined
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
  
  if (storeLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ color: '#94A3B8', fontSize: 13, marginTop: 12 }}>Loading store…</span>
      </div>
    );
  }
  
  if (storeError || !store) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>
          {storeError || 'Store not found'}
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#3B82F6',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Go Home
        </button>
      </div>
    );
  }
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#F8FAFC',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto 0', height: 40, background: '#0F172A', zIndex: 50 }} />
      
      {/* Business Header */}
      <div style={{
        position: 'sticky',
        top: 40,
        zIndex: 40,
        background: '#fff',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
              fontSize: 20,
            }}
          >
            ←
          </button>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            color: '#fff',
          }}>
            {store?.sellerLogoUrl && !logoFailed ? (
              <img
                src={store.sellerLogoUrl}
                alt="Store Logo"
                onError={() => setLogoFailed(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <StoreIcon />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
              {store?.storeSlug ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1) : 'Store'}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: 500 }}>
              {step === 'products' && storeProducts.length > 0 && `${storeProducts.length} products`}
              {step === 'products' && storeProducts.length === 0 && 'No products'}
              {step === 'customer' && 'Your Details'}
              {step === 'review' && 'Review Order'}
            </div>
          </div>
        </div>
        {step === 'products' && selectedProducts.size > 0 && (
          <div style={{
            background: '#16A34A',
            color: '#fff',
            borderRadius: 100,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
          }}>
            {selectedProducts.size} items
          </div>
        )}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: 40, paddingBottom: 80 }}>
        {step === 'products' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {productsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: '#64748B' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Loading products...</div>
              </div>
            ) : storeProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: '#64748B' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No products in this store</div>
              </div>
            ) : (
              storeProducts.map(product => {
                const quantity = selectedProducts.get(product.id) || 0;
                const catalogue = catalogues.find(c => c.id === store.catalogueId);
                const catData = catalogue ? getCatalogueData(product, store.catalogueId) : null;
                const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;
                const priceUnit = catalogue && catData ? catData[catalogue.priceUnitField] : undefined;
                const quantityStep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
                const isSelected = quantity > 0;
                const lineTotal = price * quantity;
                
                return (
                  <div
                    key={product.id}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      border: isSelected ? '1.5px solid #16A34A' : '1.5px solid #E2E8F0',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        background: '#F1F5F9',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {product.image && /^https?:\/\//i.test(String(product.image)) ? (
                          <img src={String(product.image)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                          {product.name}
                        </div>
                        {product.subtitle && (
                          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                            {product.subtitle}
                          </div>
                        )}
                        {price > 0 && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: '#DCFCE7',
                            borderRadius: 6,
                            padding: '2px 7px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#166534',
                          }}>
                            ₹{price.toLocaleString('en-IN')} / {getOrderUnitLabel(priceUnit)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <QtyStepper
                      value={quantity}
                      step={quantityStep}
                      onChange={(qty) => handleUpdateQuantity(product.id, qty)}
                    />
                    
                    {quantity > 0 && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 6,
                        fontSize: 12,
                        color: '#64748B',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>
                          {quantity} {getOrderUnitLabel(priceUnit)} × ₹{price.toLocaleString('en-IN')}
                        </span>
                        <span style={{ color: '#CBD5E1', fontSize: 11 }}>·</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>
                          ₹{lineTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        
        {step === 'customer' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
                Your Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
                WhatsApp Number <span style={{ color: '#64748B' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={customerWhatsapp}
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                placeholder="e.g. +91 98xxxxxxxx"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            {/* Order Summary */}
            <div style={{
              padding: 12,
              background: '#DCFCE7',
              borderRadius: 10,
              border: '1px solid #86EFAC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>Order Total</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                ₹{orderSummary.total.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}
        
        {step === 'review' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>Your Details</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{customerName}</div>
              {customerWhatsapp && <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>📱 {customerWhatsapp}</div>}
            </div>
            
            <div style={{ padding: 12, background: '#DCFCE7', borderRadius: 10, border: '1px solid #86EFAC', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>Total Amount</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                ₹{orderSummary.total.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Actions */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        background: '#fff',
        borderTop: '1px solid #E2E8F0',
        display: 'flex',
        gap: 10,
        zIndex: 30,
      }}>
        {step === 'products' && (
          <button
            onClick={handleContinueToCustomer}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#2563EB',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Continue ({orderSummary.count} items)
          </button>
        )}
        
        {step === 'customer' && (
          <button
            onClick={() => setStep('review')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#2563EB',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Review Order
          </button>
        )}
        
        {step === 'review' && (
          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#16A34A',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Placing Order…' : 'Place Order'}
          </button>
        )}
      </div>
    </div>
  );
}
