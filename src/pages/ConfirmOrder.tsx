import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { createOrder, type OrderItem } from '../services/orderService';
import { buildOrderTrackingUrl } from '../services/orderTrackingService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { type ShareLinkItem } from '../services/shareLinks';
import { formatVariantSelectionSummary } from '../utils/productVariants';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import OrderPlacedSuccessModal from '../components/OrderPlacedSuccessModal';

type QtyMap = Record<string, number>;

interface ConfirmOrderState {
  selectedItems: ShareLinkItem[];
  qty: QtyMap;
  variantSelections?: Record<string, Record<string, string>>;
  currencySymbol: string;
  currencyCode: string;
  sellerWhatsapp: string;
  sellerUserId: string;
  customerName: string;
  customerWhatsapp: string;
  lineAmounts: Record<string, number>;
  orderTotalAmount: number;
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

// SVG Icons
const Ic = {
  Img: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
    </svg>
  ),
  Back: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// Row divider
const Divider = () => (
  <div style={{ height: 1, background: '#F2F2F7', margin: '0 0' }} />
);

// Quantity Control
function QtyControl({ value, step, onChange }: { value: number; step: number; onChange: (delta: number) => void }) {
  const s = Math.max(1, Math.floor(step) || 1);
  const inc = s > 1 ? s : 1;
  return (
    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: '#F5F5F7', borderRadius: 6, padding: '3px 6px', width: 'fit-content' }}>
      <button type="button" onClick={() => onChange(-inc)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: COLORS.muted, padding: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
      <span style={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: 600, color: COLORS.text }}>{value}</span>
      <button type="button" onClick={() => onChange(inc)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: COLORS.muted, padding: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  );
}

// Product image thumbnail
function ProductThumb({
  url,
  name,
  imageVersion,
}: {
  url?: string;
  name: string;
  imageVersion?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = url && /^https?:\/\//i.test(url) ? productImageDisplayUrl(url, imageVersion) : '';
  const valid = url && /^https?:\/\//i.test(url) && !failed;
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
      overflow: 'hidden', background: '#F2F2F7',
      border: `1px solid ${COLORS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {valid ? (
        <img
          key={src}
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Ic.Img />
      )}
    </div>
  );
}

function parseItemPriceNumeric(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function formatOrderMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

function getItemCategories(item: ShareLinkItem): string[] {
  if (Array.isArray(item.category)) {
    return item.category.filter((c) => c && String(c).trim() !== '');
  }
  return [];
}

export default function ConfirmOrder() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const state = location.state as ConfirmOrderState | null;
  const { guardOnline } = useCloudWriteGate();

  const [customerName, setCustomerName] = useState(state?.customerName || '');
  const [customerWhatsapp, setCustomerWhatsapp] = useState(state?.customerWhatsapp || '');
  const [savingOrder, setSavingOrder] = useState(false);
  const [localQty, setLocalQty] = useState<QtyMap>(state?.qty || {});
  const [orderSuccess, setOrderSuccess] = useState<{
    trackingUrl: string | null;
    whatsAppHref: string;
  } | null>(null);

  // Validate that we have the required state
  if (!state || !token) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        <p>Invalid order data. Please go back and try again.</p>
        <button onClick={() => navigate(`/o/${token}`)}>Back to Order Form</button>
      </div>
    );
  }

  const {
    selectedItems,
    currencySymbol,
    currencyCode,
    sellerWhatsapp,
    sellerUserId,
    variantSelections = {},
  } = state;

  const handleQtyChange = (productId: string, delta: number) => {
    setLocalQty((prev) => {
      const newQty = Math.max(0, (prev[productId] ?? 0) + delta);
      return { ...prev, [productId]: newQty };
    });
  };

  // Recalculate line amounts and total based on local quantities
  const { updatedLineAmounts, updatedTotal } = useMemo(() => {
    const lineAmounts: Record<string, number> = {};
    let total = 0;
    selectedItems.forEach((item) => {
      const q = localQty[item.productId] ?? 0;
      const unitPrice = parseItemPriceNumeric(item.price);
      const lineTotal = Number.isFinite(unitPrice) ? unitPrice * q : 0;
      lineAmounts[item.productId] = lineTotal;
      total += lineTotal;
    });
    return { updatedLineAmounts: lineAmounts, updatedTotal: total };
  }, [selectedItems, localQty]);

  const confirmOrder = async () => {
    // Validate customer name (required)
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    const to = (sellerWhatsapp || '').replace(/[^\d]/g, '');
    if (!to) {
      alert('Seller WhatsApp number is not configured.');
      return;
    }

    if (!guardOnline()) return;

    let trackingUrl: string | null = null;

    // Save order to Supabase
    if (token && sellerUserId) {
      setSavingOrder(true);
      setSupabaseRlsUserId(sellerUserId);
      try {
        // Build order items structure
        const orderItems: OrderItem[] = selectedItems.map((i) => {
          const q = localQty[i.productId] ?? 0;
          const unitPrice = parseItemPriceNumeric(i.price);
          const rowTotal = Number.isFinite(unitPrice) ? unitPrice * q : 0;

          return {
            productId: i.productId,
            name: i.name,
            quantity: q,
            unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
            rowTotal: rowTotal,
            category: (i.category || []).join(', ') || '',
            subtitle: i.subtitle || '',
            priceUnit: i.priceUnit || undefined,
            imageUrl: i.imageUrl,
            quantityStep: i.quantityStep,
            variantSummary:
              formatVariantSelectionSummary(
                i.variantGroups ?? [],
                variantSelections[i.productId]
              ) || undefined,
          };
        });

        // Create order
        const { data: createdOrder, error } = await createOrder(
          sellerUserId,
          token,
          customerName.trim(),
          orderItems,
          updatedTotal,
          currencyCode,
          customerWhatsapp.trim() || undefined
        );

        if (error) {
          console.error('Error creating order:', error);
          // Don't block WhatsApp opening even if order creation fails
        } else {
          if (createdOrder?.tracking_token) {
            trackingUrl = buildOrderTrackingUrl(createdOrder.tracking_token);
          }
          // Clear the saved order quantities from sessionStorage on successful order creation
          sessionStorage.removeItem(`catshare_order_qty_${token}`);
        }
      } catch (err) {
        console.error('Error saving order:', err);
        // Don't block WhatsApp opening on error
      } finally {
        setSupabaseRlsUserId(null);
        void getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.id) setSupabaseRlsUserId(session.user.id);
        });
        setSavingOrder(false);
      }
    }

    // Build WhatsApp message
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const lines: string[] = [];
    lines.push(`🛍️ *New Order — ${date}*`);
    lines.push(`_via CatShare Order Form_`);
    lines.push('');
    lines.push('*Items Ordered:*');

    let total = 0;
    selectedItems.forEach((i, idx) => {
      const q = localQty[i.productId] ?? 0;
      const unit = parseItemPriceNumeric(i.price);
      const itemTotal = Number.isFinite(unit) ? unit * q : 0;
      total += itemTotal;

      const subtitlePart = i.subtitle ? ` _(${i.subtitle})_` : '';
      lines.push(`${idx + 1}. *${i.name}*${subtitlePart}`);
      const variantLine = formatVariantSelectionSummary(
        i.variantGroups ?? [],
        variantSelections[i.productId]
      );
      if (variantLine) {
        lines.push(`   _${variantLine}_`);
      }

      if (Number.isFinite(unit)) {
        const unitLabel = getOrderUnitLabel(i.priceUnit);
        const unitLabelDisplay = q === 1 && unitLabel === 'pcs' ? 'piece' : unitLabel;
        const unitPrice = `${currencySymbol}${unit.toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`;
        const rowTotal = `${currencySymbol}${itemTotal.toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`;
        lines.push(`   ${q} ${unitLabelDisplay} x ${unitPrice} = ${rowTotal}`);
      } else {
        lines.push(`   Qty: ${q}`);
      }

      lines.push('');
    });

    if (total > 0) {
      lines.push(`💰 *Total: ${currencySymbol}${total.toLocaleString('en-IN')}*`);
      lines.push('');
    }

    lines.push('Please confirm availability and share payment details. Thank you!');
    if (trackingUrl) {
      lines.push('');
      lines.push('📦 *Track & edit your order:*');
      lines.push(trackingUrl);
    }
    const message = lines.join('\n');

    setOrderSuccess({
      trackingUrl,
      whatsAppHref: `https://wa.me/${to}?text=${encodeURIComponent(message)}`,
    });
  };

  return (
    <div className="of-bg">
      <div className="of-page">
        {/* Header */}
        <div className="of-header">
          <div className="of-header-inner">
            <button
              onClick={() => navigate(`/o/${token}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                cursor: 'pointer',
                padding: 0,
                color: COLORS.text,
                transition: 'all 0.2s ease',
                fontFamily: FONT,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.border;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = COLORS.bg;
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
            >
              <Ic.Back />
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="of-header-title">Confirm Your Order</div>
            </div>
            <div style={{ width: 40 }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 16px', paddingBottom: 120 }}>
          {/* Customer Name Input */}
          <div className="of-modal-input-group">
            <label className="of-modal-label">
              Your Name
              <span className="of-modal-required">*</span>
            </label>
            <input
              type="text"
              className="of-modal-input"
              placeholder="Enter your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoFocus
            />
            {!customerName.trim() && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 6, fontFamily: FONT }}>
                Please enter your name to confirm the order
              </div>
            )}
          </div>

          {/* Customer WhatsApp Input */}
          <div className="of-modal-input-group">
            <label className="of-modal-label">Your WhatsApp</label>
            <input
              type="tel"
              className="of-modal-input"
              placeholder="Enter your WhatsApp number (optional)"
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
            />
          </div>

          {/* Order Items Summary */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 12, fontFamily: FONT }}>
              Order Items ({selectedItems.length})
            </div>
            <div style={{
              background: COLORS.surface,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '4px 16px' }}>
                {selectedItems.map((item, i) => {
                  const q = localQty[item.productId] ?? 0;
                  const hasCost = item.price !== undefined && item.price !== '';
                  const unitPrice = parseItemPriceNumeric(item.price);
                  const lineTotal = updatedLineAmounts[item.productId] ?? 0;

                  return (
                    <div key={item.productId}>
                      {i > 0 && <Divider />}
                      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0', gap: 12 }}>
                        <ProductThumb url={item.imageUrl} name={item.name} imageVersion={item.imageVersion} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 2, fontFamily: FONT }}>
                            {item.name}
                          </div>
                          {item.subtitle && (
                            <div style={{ fontSize: 11, color: COLORS.subtle, fontFamily: FONT, marginBottom: 8 }}>
                              {item.subtitle}
                            </div>
                          )}
                          <QtyControl value={q} step={item.quantityStep || 1} onChange={(delta) => handleQtyChange(item.productId, delta)} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          {hasCost && Number.isFinite(unitPrice) && (
                            <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: FONT }}>
                              {currencySymbol}{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          {(!hasCost || !Number.isFinite(unitPrice)) && (
                            <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: FONT }}>
                              {hasCost ? 'Price' : 'Item'}
                            </div>
                          )}
                          {hasCost && Number.isFinite(unitPrice) && lineTotal > 0 && (
                            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, fontFamily: FONT }}>
                              {formatOrderMoney(lineTotal, currencySymbol)}
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
                    {formatOrderMoney(updatedTotal, currencySymbol)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Buttons */}
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px 16px',
            background: '#fff',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            gap: 12,
          }}
        >
          <button
            type="button"
            className="of-modal-btn of-modal-cancel"
            onClick={() => navigate(`/o/${token}`)}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="of-modal-btn of-modal-confirm"
            onClick={confirmOrder}
            disabled={!customerName.trim() || savingOrder}
            title={!customerName.trim() ? 'Please enter your name first' : ''}
            style={{ flex: 1 }}
          >
            {savingOrder ? 'Saving…' : 'Confirm & Order'}
          </button>
        </div>
      </div>

      <OrderPlacedSuccessModal
        isOpen={orderSuccess != null}
        onClose={() => {
          setOrderSuccess(null);
          navigate(`/o/${token}`);
        }}
        trackingUrl={orderSuccess?.trackingUrl ?? null}
        whatsAppHref={orderSuccess?.whatsAppHref ?? null}
        subtitle="Copy or open your tracking link below. You can edit the order while it is pending. When ready, send the order details to the seller on WhatsApp."
      />
    </div>
  );
}
