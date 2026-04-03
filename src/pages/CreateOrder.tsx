import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createOrderDirectly, type OrderItem } from '../services/orderService';
import { getAllCatalogues } from '../config/catalogueConfig';
import { isProductEnabledForCatalogue, getCatalogueData } from '../config/catalogueProductUtils';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import type { Catalogue } from '../config/catalogueConfig';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';

type Step = 'catalogue' | 'products' | 'customer' | 'review';

// Icons
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
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

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// Helper function to get unit label
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

// Design tokens
const FONT = "'DM Sans', system-ui, sans-serif";
const COLORS = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  border: '#E8E8ED',
  text: '#1C1C1E',
  muted: '#6E6E73',
  subtle: '#AEAEB2',
  green: '#16A34A',
  greenLight: '#F0FDF4',
};

// Row divider
const Divider = () => (
  <div style={{ height: 1, background: '#F2F2F7', margin: '0 0' }} />
);

// Product image thumbnail
function ProductThumb({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = React.useState(false);
  const valid = url && /^https?:\/\//i.test(url) && !failed;
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
      overflow: 'hidden', background: '#F2F2F7',
      border: `1px solid ${COLORS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {valid ? (
        <img src={url} alt={name} onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
        </svg>
      )}
    </div>
  );
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('catalogue');
  const [selectedCatalogueId, setSelectedCatalogueId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const catalogues = useMemo(() => getAllCatalogues(user?.uid), [user?.uid]);
  const products = useMemo(
    () => safeGetFromStorage(user?.uid ? getStorageKey('products', user.uid) : '', []) as ProductWithCatalogueData[],
    [user?.uid]
  );
  const imageMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(p => {
      const imgSrc = (p.image && typeof p.image === 'string') ? p.image :
                     (p.imageUrl && typeof p.imageUrl === 'string') ? p.imageUrl :
                     null;
      if (imgSrc) {
        map[p.id] = imgSrc;
      }
    });
    return map;
  }, [products]);

  // Get products for selected catalogue
  const catalogueProducts = useMemo(() => {
    if (!selectedCatalogueId) return [];
    return products.filter(p => isProductEnabledForCatalogue(p, selectedCatalogueId));
  }, [products, selectedCatalogueId]);

  // Get all categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    catalogueProducts.forEach(p => {
      if (p.category && Array.isArray(p.category)) {
        p.category.forEach(c => {
          if (c) cats.add(c);
        });
      }
    });
    return Array.from(cats).sort();
  }, [catalogueProducts]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    let result = catalogueProducts;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(p => 
        selectedCategory === 'uncategorized' 
          ? !p.category || p.category.length === 0
          : p.category?.includes(selectedCategory)
      );
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.category?.some((c: string) => c?.toLowerCase().includes(q))
      );
    }

    return result;
  }, [catalogueProducts, searchQuery, selectedCategory]);

  // Calculate order totals
  const orderSummary = useMemo(() => {
    if (!selectedCatalogueId) return { items: [], total: 0, count: 0 };
    
    const catalogue = catalogues.find(c => c.id === selectedCatalogueId);
    if (!catalogue) return { items: [], total: 0, count: 0 };

    const items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      rowTotal: number;
      category?: string;
      imageUrl?: string;
      priceUnit?: string;
      subtitle?: string;
    }> = [];

    let total = 0;
    let count = 0;

    selectedProducts.forEach((quantity, productId) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        const catData = getCatalogueData(product, selectedCatalogueId);
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
          imageUrl: product.image,
          priceUnit,
          subtitle: product.subtitle,
        });
        
        total += rowTotal;
        count += quantity;
      }
    });

    return { items, total, count };
  }, [selectedCatalogueId, selectedProducts, products, catalogues]);

  const handleSelectCatalogue = (catId: string) => {
    setSelectedCatalogueId(catId);
    setSelectedProducts(new Map());
    setSearchQuery('');
    setSelectedCategory('all');
    setStep('products');
  };

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
      showToast('Please add at least one product to the order', 'error');
      return;
    }
    setStep('customer');
  };

  const handleContinueToReview = () => {
    if (!customerName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    setStep('review');
  };

  const handleCreateOrder = async () => {
    if (!user?.uid || !selectedCatalogueId) return;

    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = orderSummary.items.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        rowTotal: item.rowTotal,
        category: item.category,
        imageUrl: item.imageUrl,
      }));

      const { error } = await createOrderDirectly(
        user.uid,
        customerName.trim(),
        orderItems,
        orderSummary.total,
        'INR',
        customerWhatsapp.trim() || undefined,
        selectedCatalogueId
      );

      if (error) {
        showToast('Failed to create order', 'error');
        return;
      }

      showToast('Order created successfully', 'success');
      navigate('/orders');
    } catch (err) {
      showToast('Error creating order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackStep = () => {
    if (step === 'products') setStep('catalogue');
    else if (step === 'customer') setStep('products');
    else if (step === 'review') setStep('customer');
  };

  const handleClose = () => {
    if (step === 'catalogue') {
      navigate('/orders');
    } else {
      handleBackStep();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#F8FAFC',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus { outline: none; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto 0', height: 40, background: '#0F172A', zIndex: 50 }} />

      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 40,
        zIndex: 40,
        background: '#fff',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
            }}
          >
            <IconArrowLeft />
          </button>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#0F172A',
            margin: 0,
          }}>
            {step === 'catalogue' && 'Select Catalogue'}
            {step === 'products' && 'Choose Products'}
            {step === 'customer' && 'Customer Details'}
            {step === 'review' && 'Review Order'}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginTop: 40,
      }}>
        {/* Step: Catalogue Selection */}
        {step === 'catalogue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
            {catalogues.map((cat) => {
              const productCount = products.filter(p => isProductEnabledForCatalogue(p, cat.id)).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCatalogue(cat.id)}
                  style={{
                    padding: '14px 16px',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 12,
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      {productCount} product{productCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <IconChevronRight />
                </button>
              );
            })}
          </div>
        )}

        {/* Step: Product Selection */}
        {step === 'products' && (
          <div>
            {/* Summary Section */}
            {orderSummary.items.length > 0 && (
              <div style={{
                background: '#fff',
                borderBottom: '1px solid #E2E8F0',
                padding: '16px',
                position: 'sticky',
                top: 0,
                zIndex: 30,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 4,
                    }}>
                      Order Summary
                    </div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#64748B',
                    }}>
                      {orderSummary.count} {orderSummary.count === 1 ? 'item' : 'items'} selected
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 4,
                    }}>
                      Total
                    </div>
                    <div style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: '#166534',
                    }}>
                      ₹{orderSummary.total.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #E2E8F0',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: '#94A3B8',
              }}>
                {filteredProducts.length} of {catalogueProducts.length} product{catalogueProducts.length !== 1 ? 's' : ''} shown
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    border: '1.5px solid #D1D5DB',
                    borderRadius: 12,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    background: '#fff',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#16A34A';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                }}>
                  <IconSearch />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9CA3AF',
                      fontSize: 18,
                      padding: 0,
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Category Chips */}
              {allCategories.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    style={{
                      border: `1px solid ${selectedCategory === 'all' ? '#16A34A' : '#E2E8F0'}`,
                      background: selectedCategory === 'all' ? '#DCFCE7' : '#fff',
                      color: selectedCategory === 'all' ? '#166534' : '#94A3B8',
                      borderRadius: 999,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    All
                  </button>
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        border: `1px solid ${selectedCategory === cat ? '#16A34A' : '#E2E8F0'}`,
                        background: selectedCategory === cat ? '#DCFCE7' : '#fff',
                        color: selectedCategory === cat ? '#166534' : '#94A3B8',
                        borderRadius: 999,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products List */}
            <div style={{
              padding: '0 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              {filteredProducts.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 24px',
                  color: '#64748B',
                  marginTop: 20,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {searchQuery ? 'No products found' : 'No products in this catalogue'}
                  </div>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const quantity = selectedProducts.get(product.id) || 0;
                  const catalogue = catalogues.find(c => c.id === selectedCatalogueId);
                  const catData = catalogue ? getCatalogueData(product, selectedCatalogueId!) : null;
                  const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;
                  const priceUnit = catalogue && catData ? catData[catalogue.priceUnitField] : undefined;
                  const productImage = imageMap[product.id] || product.image;
                  const hasImage = productImage && (productImage.startsWith('data:') || /^https?:\/\//i.test(productImage));
                  const isSelected = quantity > 0;
                  const lineTotal = price * quantity;

                  return (
                    <div
                      key={product.id}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        border: isSelected ? '1.5px solid #16A34A' : '1.5px solid #E2E8F0',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'stretch',
                        transition: 'all 0.2s',
                        marginBottom: 8,
                        boxShadow: isSelected ? '0 0 0 2px rgba(22,163,74,0.12), 0 1px 4px rgba(0,0,0,0.04)' : '0 1px 4px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0';
                        }
                      }}
                    >
                      {/* Image */}
                      <div style={{
                        width: 100,
                        minWidth: 100,
                        minHeight: 100,
                        overflow: 'hidden',
                        background: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        flexShrink: 0,
                      }}>
                        {hasImage ? (
                          <img src={productImage} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                          </svg>
                        )}
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            background: '#16A34A',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.4px',
                            textTransform: 'uppercase',
                            padding: '3px 7px',
                            borderRadius: 100,
                          }}>
                            ✓ Added
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div style={{
                        flex: 1,
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                      }}>
                        {/* Left Column - Product Info and Quantity */}
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minWidth: 0,
                        }}>
                          {/* Product Info */}
                          <div>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'baseline',
                              gap: '4px 8px',
                              lineHeight: 1.3,
                              marginBottom: 4,
                            }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                                {product.name}
                              </span>
                              {product.subtitle && (
                                <span style={{ fontSize: 12, fontWeight: 400, color: '#64748B' }}>
                                  ({product.subtitle})
                                </span>
                              )}
                            </div>

                            {/* Categories */}
                            {product.category && product.category.length > 0 && (
                              <div style={{
                                display: 'flex',
                                gap: 6,
                                flexWrap: 'wrap',
                                marginTop: 4,
                                marginBottom: 4,
                              }}>
                                {product.category.map((cat) => (
                                  <span
                                    key={cat}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      borderRadius: 999,
                                      padding: '3px 8px',
                                      background: '#F1F5F9',
                                      color: '#475569',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Price */}
                            {price > 0 && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
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

                          {/* Quantity Control */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0,
                            background: '#F1F5F9',
                            borderRadius: 6,
                            border: '1.5px solid #E2E8F0',
                            width: 'fit-content',
                          }}>
                            <button
                              onClick={() => handleUpdateQuantity(product.id, quantity - 1)}
                              style={{
                                width: 32,
                                height: 32,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: quantity === 0 ? '#CBD5E1' : '#374151',
                                fontFamily: 'inherit',
                                transition: 'color 0.15s',
                              }}
                              disabled={quantity === 0}
                            >
                              <IconMinus />
                            </button>
                            <span style={{
                              minWidth: 32,
                              textAlign: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              color: quantity === 0 ? '#94A3B8' : '#0F172A',
                            }}>
                              {quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(product.id, quantity + 1)}
                              style={{
                                width: 32,
                                height: 32,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#374151',
                                fontFamily: 'inherit',
                                transition: 'color 0.15s',
                              }}
                            >
                              <IconPlus />
                            </button>
                          </div>
                        </div>

                        {/* Right Column - Subtotal (Centered) */}
                        <div style={{
                          fontSize: 12,
                          color: '#64748B',
                          fontWeight: 500,
                          textAlign: 'right',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          minWidth: 120,
                          visibility: isSelected ? 'visible' : 'hidden',
                          flexShrink: 0,
                          justifyContent: 'center',
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                            Subtotal
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>
                            {quantity} {getOrderUnitLabel(priceUnit)} × ₹{price.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>
                            ₹{lineTotal.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Step: Customer Details */}
        {step === 'customer' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#0F172A',
                marginBottom: 8,
              }}>
                Customer Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563EB';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D1D5DB';
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#0F172A',
                marginBottom: 8,
              }}>
                WhatsApp Number <span style={{ color: '#64748B' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={customerWhatsapp}
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563EB';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#D1D5DB';
                }}
              />
            </div>

            {/* Order Summary Preview */}
            <div style={{
              background: COLORS.surface,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '4px 16px' }}>
                {orderSummary.items.map((item, i) => {
                  const lineTotal = item.rowTotal;
                  const hasCost = item.unitPrice !== undefined && item.unitPrice > 0;
                  return (
                    <div key={item.productId}>
                      {i > 0 && <Divider />}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', gap: 12 }}>
                        <ProductThumb url={item.imageUrl} name={item.name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 2, fontFamily: FONT }}>
                            {item.name}
                          </div>
                          {item.subtitle && (
                            <div style={{ fontSize: 11, color: COLORS.subtle, fontFamily: FONT }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          {hasCost && (
                            <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: FONT }}>
                              {item.quantity} {getOrderUnitLabel(item.priceUnit)} × ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {hasCost && lineTotal > 0 && (
                            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>
                              ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Total row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 0 10px', marginTop: 4,
                  borderTop: `2px solid ${COLORS.border}`,
                  fontFamily: FONT,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted }}>Order Total</span>
                  <span style={{ fontSize: 20, fontWeight: 600, color: COLORS.green, letterSpacing: '-0.4px' }}>
                    ₹{orderSummary.total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Review Order */}
        {step === 'review' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Customer Info */}
            <div style={{
              padding: 12,
              background: '#F8FAFC',
              borderRadius: 10,
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
                Customer Details
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                {customerName}
              </div>
              {customerWhatsapp && (
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                  📱 {customerWhatsapp}
                </div>
              )}
            </div>

            {/* Order Items */}
            <div style={{
              padding: 12,
              background: '#F8FAFC',
              borderRadius: 10,
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 10 }}>
                Order Items
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orderSummary.items.map((item) => (
                  <div key={item.productId} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #E2E8F0',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>
                      ₹{item.rowTotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div style={{
              padding: 12,
              background: '#DCFCE7',
              borderRadius: 10,
              border: '1px solid #86EFAC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>
                Total Amount
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                ₹{orderSummary.total.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: '16px',
        borderTop: '1px solid #E2E8F0',
        display: 'flex',
        gap: 10,
        background: '#fff',
      }}>
        {step !== 'catalogue' && (
          <button
            onClick={handleBackStep}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1.5px solid #E2E8F0',
              borderRadius: 8,
              background: '#fff',
              color: '#0F172A',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1';
              (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
              (e.currentTarget as HTMLButtonElement).style.background = '#fff';
            }}
          >
            Back
          </button>
        )}

        <button
          onClick={() => {
            if (step === 'catalogue') {
              handleClose();
            } else if (step === 'products') {
              handleContinueToCustomer();
            } else if (step === 'customer') {
              handleContinueToReview();
            } else if (step === 'review') {
              handleCreateOrder();
            }
          }}
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderRadius: 8,
            background: isSubmitting ? '#9CA3AF' : '#2563EB',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
            opacity: isSubmitting ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) {
              (e.currentTarget as HTMLButtonElement).style.background = '#2563EB';
            }
          }}
        >
          {isSubmitting ? 'Creating...' : step === 'review' ? 'Create Order' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
