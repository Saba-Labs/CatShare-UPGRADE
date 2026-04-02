import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { createOrder, type OrderItem } from '../services/orderService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { type ShareLinkItem } from '../services/shareLinks';

type QtyMap = Record<string, number>;

interface ConfirmOrderState {
  selectedItems: ShareLinkItem[];
  qty: QtyMap;
  currencySymbol: string;
  currencyCode: string;
  sellerWhatsapp: string;
  sellerUserId: string;
  customerName: string;
  customerWhatsapp: string;
  lineAmounts: Record<string, number>;
  orderTotalAmount: number;
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

  const [customerName, setCustomerName] = useState(state?.customerName || '');
  const [customerWhatsapp, setCustomerWhatsapp] = useState(state?.customerWhatsapp || '');
  const [savingOrder, setSavingOrder] = useState(false);

  // Validate that we have the required state
  if (!state || !token) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        <p>Invalid order data. Please go back and try again.</p>
        <button onClick={() => navigate(`/o/${token}`)}>Back to Order Form</button>
      </div>
    );
  }

  const { selectedItems, qty, currencySymbol, currencyCode, sellerWhatsapp, sellerUserId, lineAmounts, orderTotalAmount } = state;

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

    // Save order to Supabase
    if (token && sellerUserId) {
      setSavingOrder(true);
      setSupabaseRlsUserId(sellerUserId);
      try {
        // Build order items structure
        const orderItems: OrderItem[] = selectedItems.map((i) => {
          const q = qty[i.productId] ?? 0;
          const unitPrice = parseItemPriceNumeric(i.price);
          const rowTotal = Number.isFinite(unitPrice) ? unitPrice * q : 0;

          return {
            productId: i.productId,
            name: i.name,
            quantity: q,
            unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
            rowTotal: rowTotal,
            category: (i.category || []).join(', ') || i.subtitle || '',
            priceUnit: i.priceUnit || undefined,
            imageUrl: i.imageUrl,
          };
        });

        // Create order
        const { error } = await createOrder(
          sellerUserId,
          token,
          customerName.trim(),
          orderItems,
          orderTotalAmount,
          currencyCode,
          customerWhatsapp.trim() || undefined
        );

        if (error) {
          console.error('Error creating order:', error);
          // Don't block WhatsApp opening even if order creation fails
        }
      } catch (err) {
        console.error('Error saving order:', err);
        // Don't block WhatsApp opening on error
      } finally {
        setSupabaseRlsUserId(null);
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
      const q = qty[i.productId] ?? 0;
      const unit = parseItemPriceNumeric(i.price);
      const itemTotal = Number.isFinite(unit) ? unit * q : 0;
      total += itemTotal;

      const subtitlePart = i.subtitle ? ` _(${i.subtitle})_` : '';
      lines.push(`${idx + 1}. *${i.name}*${subtitlePart}`);

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
    const message = lines.join('\n');

    // Open WhatsApp
    window.location.href = `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
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
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                padding: 8,
                marginLeft: -8,
              }}
            >
              ←
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
          <div className="of-modal-items-section">
            <div className="of-modal-items-title">Order Items ({selectedItems.length})</div>
            {selectedItems.map((item) => {
              const q = qty[item.productId] ?? 0;
              const amount = lineAmounts[item.productId] ?? 0;
              const categories = getItemCategories(item);

              return (
                <div key={item.productId} className="of-modal-item">
                  <div className="of-modal-item-detail">
                    <div className="of-modal-item-name">{item.name}</div>
                    {item.subtitle && (
                      <div className="of-modal-item-info">Category: {item.subtitle}</div>
                    )}
                    {categories.length > 0 && (
                      <div className="of-modal-item-info">Tags: {categories.join(', ')}</div>
                    )}
                    {item.price && (
                      <div className="of-modal-item-info">Price: {formatOrderMoney(parseItemPriceNumeric(item.price), currencySymbol)}</div>
                    )}
                    <div className="of-modal-item-qty">Qty: {q} {getOrderUnitLabel(item.priceUnit)}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '80px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>
                      {item.price ? formatOrderMoney(amount, currencySymbol) : '—'}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Order Summary */}
            <div className="of-modal-order-summary">
              <div className="of-modal-total-row">
                <span>Subtotal</span>
                <span>{formatOrderMoney(orderTotalAmount, currencySymbol)}</span>
              </div>
              <div className="of-modal-total-row final">
                <span>Total</span>
                <span>{formatOrderMoney(orderTotalAmount, currencySymbol)}</span>
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
            style={{ flex: 1 }}
          >
            {savingOrder ? 'Saving…' : 'Confirm & Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
