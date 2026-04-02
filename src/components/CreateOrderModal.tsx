import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createOrderDirectly, type OrderItem } from '../services/orderService';
import { getAllCatalogues } from '../config/catalogueConfig';
import { isProductEnabledForCatalogue, getCatalogueData } from '../config/catalogueProductUtils';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import type { Catalogue } from '../config/catalogueConfig';

type Step = 'catalogue' | 'products' | 'customer' | 'review';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: ProductWithCatalogueData[];
}

// Icons
function IconX({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

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

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
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

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
  products,
}: CreateOrderModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('catalogue');
  const [selectedCatalogueId, setSelectedCatalogueId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const catalogues = getAllCatalogues();

  // Get products for selected catalogue
  const catalogueProducts = useMemo(() => {
    if (!selectedCatalogueId) return [];
    return products.filter(p => isProductEnabledForCatalogue(p, selectedCatalogueId));
  }, [products, selectedCatalogueId]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return catalogueProducts;
    const q = searchQuery.toLowerCase();
    return catalogueProducts.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.category?.some((c: string) => c?.toLowerCase().includes(q))
    );
  }, [catalogueProducts, searchQuery]);

  // Calculate order totals
  const orderSummary = useMemo(() => {
    if (!selectedCatalogueId) return { items: [], total: 0 };
    
    const catalogue = catalogues.find(c => c.id === selectedCatalogueId);
    if (!catalogue) return { items: [], total: 0 };

    const items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      rowTotal: number;
      category?: string;
      imageUrl?: string;
    }> = [];

    let total = 0;

    selectedProducts.forEach((quantity, productId) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        const catData = getCatalogueData(product, selectedCatalogueId);
        const unitPrice = parseFloat(catData[catalogue.priceField] || '0') || 0;
        const rowTotal = unitPrice * quantity;
        
        items.push({
          productId,
          name: product.name,
          quantity,
          unitPrice,
          rowTotal,
          category: product.category?.[0],
          imageUrl: product.image,
        });
        
        total += rowTotal;
      }
    });

    return { items, total };
  }, [selectedCatalogueId, selectedProducts, products, catalogues]);

  const handleSelectCatalogue = (catId: string) => {
    setSelectedCatalogueId(catId);
    setSelectedProducts(new Map());
    setSearchQuery('');
    setStep('products');
  };

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Map(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.set(productId, 1);
    }
    setSelectedProducts(newSelected);
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
      showToast('Please select at least one product', 'error');
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
      onSuccess();
      handleClose();
    } catch (err) {
      showToast('Error creating order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('catalogue');
    setSelectedCatalogueId(null);
    setSelectedProducts(new Map());
    setCustomerName('');
    setCustomerWhatsapp('');
    setSearchQuery('');
    onClose();
  };

  const handleBackStep = () => {
    if (step === 'products') setStep('catalogue');
    else if (step === 'customer') setStep('products');
    else if (step === 'review') setStep('customer');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'flex-end',
      overflow: 'hidden',
    }} onClick={handleClose}>
      {/* Modal Content */}
      <div
        style={{
          width: '100%',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '16px 16px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {step !== 'catalogue' && (
              <button
                onClick={handleBackStep}
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
            )}
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
            <IconX />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}>
          {/* Step: Catalogue Selection */}
          {step === 'catalogue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    border: '1px solid #D1D5DB',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2563EB';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                }}>
                  <IconSearch />
                </div>
              </div>

              {/* Products List */}
              {filteredProducts.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 24px',
                  color: '#64748B',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {searchQuery ? 'No products found' : 'No products in this catalogue'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredProducts.map((product) => {
                    const isSelected = selectedProducts.has(product.id);
                    const quantity = selectedProducts.get(product.id) || 0;
                    const catalogue = catalogues.find(c => c.id === selectedCatalogueId);
                    const catData = catalogue ? getCatalogueData(product, selectedCatalogueId!) : null;
                    const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;

                    return (
                      <div
                        key={product.id}
                        style={{
                          padding: '12px',
                          border: isSelected ? '1.5px solid #2563EB' : '1.5px solid #E2E8F0',
                          borderRadius: 10,
                          background: isSelected ? '#EFF6FF' : '#fff',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12 }}>
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleProduct(product.id)}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              border: isSelected ? 'none' : '1.5px solid #D1D5DB',
                              background: isSelected ? '#2563EB' : '#fff',
                              color: '#fff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontFamily: 'inherit',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isSelected && <IconCheck />}
                          </button>

                          {/* Product Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                              {product.name}
                            </div>
                            {product.category && (
                              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                                {product.category[0]}
                              </div>
                            )}
                            {price > 0 && (
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginTop: 4 }}>
                                ₹{price.toLocaleString('en-IN')}
                              </div>
                            )}
                          </div>

                          {/* Quantity Controls */}
                          {isSelected && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0,
                              background: '#F1F5F9',
                              borderRadius: 6,
                              border: '1.5px solid #E2E8F0',
                              flexShrink: 0,
                            }}>
                              <button
                                onClick={() => handleUpdateQuantity(product.id, quantity - 1)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#374151',
                                  fontFamily: 'inherit',
                                }}
                              >
                                <IconMinus />
                              </button>
                              <span style={{
                                minWidth: 24,
                                textAlign: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#0F172A',
                              }}>
                                {quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(product.id, quantity + 1)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#374151',
                                  fontFamily: 'inherit',
                                }}
                              >
                                <IconPlus />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step: Customer Details */}
          {step === 'customer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                padding: 12,
                background: '#F8FAFC',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
                  Order Summary
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {orderSummary.items.map((item) => (
                    <div key={item.productId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: '#0F172A',
                    }}>
                      <span>{item.quantity}x {item.name}</span>
                      <span style={{ fontWeight: 600 }}>₹{item.rowTotal.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                <div style={{
                  borderTop: '1px solid #CBD5E1',
                  marginTop: 8,
                  paddingTop: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#166534',
                }}>
                  <span>Total</span>
                  <span>₹{orderSummary.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step: Review Order */}
          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
    </div>
  );
}
