import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchOrderByTrackingToken,
  updateOrderByTrackingToken,
} from '../services/orderTrackingService';
import type { Order, OrderItem } from '../services/orderService';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { applyQuantityDelta } from '../utils/quantityPricingUtils';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import { getCurrencySymbol } from '../utils/trackOrderCatalog';
import './TrackOrder.css';

type EditLine = OrderItem & { _key: string };

const STATUS = {
  pending: {
    label: 'Pending',
    pill: 'trk-pill--pending',
    icon: 'trk-status-icon--pending',
    headline: 'Waiting for seller',
    hint: 'You can still update quantities or contact details until the seller confirms.',
  },
  completed: {
    label: 'Completed',
    pill: 'trk-pill--completed',
    icon: 'trk-status-icon--completed',
    headline: 'Order completed',
    hint: 'This order has been fulfilled. No further changes can be made.',
  },
  cancelled: {
    label: 'Cancelled',
    pill: 'trk-pill--cancelled',
    icon: 'trk-status-icon--cancelled',
    headline: 'Order cancelled',
    hint: 'This order was cancelled and is now closed.',
  },
} as const;

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatOrderDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function linesFromOrder(items: OrderItem[]): EditLine[] {
  return (items || []).map((it, i) => ({
    ...it,
    _key: `${it.productId}-${i}`,
  }));
}

function StatusIcon({ status }: { status: Order['status'] }) {
  if (status === 'completed') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'cancelled') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QtyControl({
  value,
  step,
  onChange,
  disabled,
}: {
  value: number;
  step: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
}) {
  const s = Math.max(1, Math.floor(step) || 1);
  const inc = s > 1 ? s : 1;
  return (
    <div className="trk-qty">
      <button
        type="button"
        className="trk-qty-btn"
        disabled={disabled}
        onClick={() => onChange(-inc)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="trk-qty-val">{value}</span>
      <button
        type="button"
        className="trk-qty-btn"
        disabled={disabled}
        onClick={() => onChange(inc)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function ProductThumb({ url, name, imageVersion }: { url?: string; name: string; imageVersion?: number }) {
  const [failed, setFailed] = useState(false);
  const src = url && /^https?:\/\//i.test(url) ? productImageDisplayUrl(url, imageVersion) : '';
  const valid = url && /^https?:\/\//i.test(url) && !failed;
  return (
    <div className="trk-item-thumb">
      {valid ? (
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )}
    </div>
  );
}

function OrderItemRow({
  line,
  canEdit,
  currencySymbol,
  onQtyChange,
  onRemove,
}: {
  line: EditLine;
  canEdit: boolean;
  currencySymbol: string;
  onQtyChange: (delta: number) => void;
  onRemove: () => void;
}) {
  const lineTotal = (line.unitPrice || 0) * line.quantity;

  return (
    <article className="trk-item">
      <ProductThumb url={line.imageUrl} name={line.name} imageVersion={line.imageVersion} />
      <div className="trk-item-body">
        <div className="trk-item-name">{line.name}</div>
        {line.subtitle ? <div className="trk-item-meta">{line.subtitle}</div> : null}
        {line.variantSummary ? (
          <span className="trk-item-variant">{line.variantSummary}</span>
        ) : null}
        {(line.unitPrice ?? 0) > 0 ? (
          <div className="trk-item-unit">{formatMoney(line.unitPrice || 0, currencySymbol)} each</div>
        ) : null}
      </div>
      <div className="trk-item-right">
        <div className="trk-item-price">{formatMoney(lineTotal, currencySymbol)}</div>
        {canEdit ? (
          <div className="trk-item-actions">
            <QtyControl
              value={line.quantity}
              step={line.quantityStep || 1}
              onChange={onQtyChange}
            />
            <button type="button" className="trk-remove-btn" onClick={onRemove}>
              Remove
            </button>
          </div>
        ) : (
          <span className="trk-item-qty-read">Qty {line.quantity}</span>
        )}
      </div>
    </article>
  );
}

function ActionButtons({
  saving,
  onSave,
  onCancel,
  className,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button type="button" className="trk-btn trk-btn--primary" disabled={saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button type="button" className="trk-btn trk-btn--ghost" disabled={saving} onClick={onCancel}>
        Cancel order
      </button>
    </div>
  );
}

export default function TrackOrder() {
  const { token: routeToken } = useParams<{ token: string }>();
  const trackingToken = decodeURIComponent(routeToken || '').trim();
  const { guardOnline } = useCloudWriteGate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');

  const canEdit = order?.status === 'pending';
  const currencySymbol = useMemo(
    () => getCurrencySymbol(order?.currency_code || 'INR'),
    [order?.currency_code]
  );

  const activeLines = useMemo(
    () => editLines.filter((l) => l.quantity > 0),
    [editLines]
  );

  const orderTotal = useMemo(() => {
    return activeLines.reduce((sum, line) => sum + (line.unitPrice || 0) * line.quantity, 0);
  }, [activeLines]);

  const loadOrder = useCallback(async () => {
    if (!trackingToken) {
      setError('Invalid tracking link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await fetchOrderByTrackingToken(trackingToken);
    if (fetchErr || !data) {
      setError(fetchErr || 'Order not found');
      setOrder(null);
      setLoading(false);
      return;
    }
    setOrder(data);
    setEditLines(linesFromOrder(data.items || []));
    setCustomerName(data.customer_name || '');
    setCustomerWhatsapp(data.customer_whatsapp || '');
    setLoading(false);
  }, [trackingToken]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const updateLineQty = (key: string, delta: number) => {
    setEditLines((prev) =>
      prev.map((line) => {
        if (line._key !== key) return line;
        const step = normalizeOrderQuantityStep(line.quantityStep);
        const next = applyQuantityDelta(line.quantity, delta, step, undefined);
        return { ...line, quantity: next, rowTotal: (line.unitPrice || 0) * next };
      })
    );
  };

  const removeLine = (key: string) => {
    setEditLines((prev) => prev.filter((l) => l._key !== key));
  };

  const persistOrder = async (status?: 'pending' | 'cancelled') => {
    if (!order || !trackingToken) return;
    if (!guardOnline()) return;
    if (status !== 'cancelled') {
      if (!customerName.trim()) {
        alert('Please enter your name');
        return;
      }
      if (activeLines.length === 0) {
        alert('Your order needs at least one item');
        return;
      }
    }

    setSaving(true);
    setSaveMessage(null);
    const itemsToSave = activeLines.map(({ _key, ...item }) => ({
      ...item,
      rowTotal: (item.unitPrice || 0) * item.quantity,
    }));
    const total = itemsToSave.reduce((s, it) => s + (it.unitPrice || 0) * it.quantity, 0);

    const { data, error: saveErr } = await updateOrderByTrackingToken({
      trackingToken,
      customerName: customerName.trim(),
      customerWhatsapp: customerWhatsapp.trim() || undefined,
      items: status === 'cancelled' ? (order.items || []) : itemsToSave,
      totalAmount: status === 'cancelled' ? order.total_amount : total,
      status,
    });

    setSaving(false);
    if (saveErr || !data) {
      alert(saveErr || 'Failed to save');
      return;
    }
    setOrder(data);
    setEditLines(linesFromOrder(data.items || []));
    setSaveMessage(status === 'cancelled' ? 'Your order has been cancelled.' : 'Changes saved successfully.');
  };

  const handleCancelOrder = () => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      void persistOrder('cancelled');
    }
  };

  if (loading) {
    return (
      <div className="trk-state">
        <div className="trk-spinner" aria-hidden />
        <p>Loading your order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="trk-state">
        <h1>Order not found</h1>
        <p>{error || 'This link may be invalid or expired. Contact the seller if you need help.'}</p>
      </div>
    );
  }

  const statusKey = order.status in STATUS ? order.status : 'pending';
  const statusCfg = STATUS[statusKey];

  return (
    <div className="trk-root">
      <div className={`trk-shell${canEdit ? ' trk-shell--editable' : ''}`}>
        <header className="trk-topbar">
          <div className="trk-brand">
            <span className="trk-brand-dot" aria-hidden />
            Order tracking
          </div>
          <h1 className="trk-title">Your order</h1>
          <p className="trk-date">Placed {formatOrderDate(order.created_at)}</p>
        </header>

        <div className="trk-grid">
          <div className="trk-main-col">
            {saveMessage ? (
              <div className="trk-banner trk-banner--success" role="status">
                {saveMessage}
              </div>
            ) : null}

            <section className="trk-card trk-card-pad">
              <div className="trk-status-row">
                <div className={`trk-status-icon ${statusCfg.icon}`}>
                  <StatusIcon status={statusKey} />
                </div>
                <div className="trk-status-text">
                  <h2>{statusCfg.headline}</h2>
                  <p>{statusCfg.hint}</p>
                  <span className={`trk-pill ${statusCfg.pill}`}>
                    <span className="trk-pill-dot" aria-hidden />
                    {statusCfg.label}
                  </span>
                </div>
              </div>
              {order.customer_edited_at ? (
                <p className="trk-summary-meta" style={{ marginTop: 16, marginBottom: 0 }}>
                  Last updated {formatOrderDate(order.customer_edited_at)}
                </p>
              ) : null}
            </section>

            <section className="trk-card trk-card-pad">
              <h2 className="trk-card-label">Your details</h2>
              {canEdit ? (
                <>
                  <div className="trk-field">
                    <label htmlFor="trk-name">
                      Full name <span>*</span>
                    </label>
                    <input
                      id="trk-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="As shown to the seller"
                      autoComplete="name"
                    />
                  </div>
                  <div className="trk-field">
                    <label htmlFor="trk-wa">WhatsApp number</label>
                    <input
                      id="trk-wa"
                      value={customerWhatsapp}
                      onChange={(e) => setCustomerWhatsapp(e.target.value)}
                      placeholder="+91 98765 43210"
                      type="tel"
                      autoComplete="tel"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="trk-readonly-name">{order.customer_name}</div>
                  {order.customer_whatsapp ? (
                    <div className="trk-readonly-phone">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      {order.customer_whatsapp}
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <section className="trk-card trk-card-pad">
              <h2 className="trk-card-label">
                Items ({activeLines.length})
              </h2>
              {activeLines.length === 0 ? (
                <p className="trk-empty-items">No items in this order.</p>
              ) : (
                <div className="trk-items-list">
                  {activeLines.map((line) => (
                    <OrderItemRow
                      key={line._key}
                      line={line}
                      canEdit={canEdit}
                      currencySymbol={currencySymbol}
                      onQtyChange={(d) => updateLineQty(line._key, d)}
                      onRemove={() => removeLine(line._key)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="trk-side-col">
            <div className="trk-card trk-card-pad">
              <h2 className="trk-card-label">Order summary</h2>
              <div className="trk-item-count">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                </svg>
                {activeLines.length} item{activeLines.length !== 1 ? 's' : ''}
              </div>
              {orderTotal > 0 ? (
                <div className="trk-summary-total">
                  <span>Total</span>
                  <span>{formatMoney(orderTotal, currencySymbol)}</span>
                </div>
              ) : (
                <p className="trk-summary-meta">Price confirmed by seller</p>
              )}
              {canEdit ? (
                <p className="trk-summary-meta">
                  Adjust quantities above, then save. Prices are set by the seller and cannot be changed here.
                </p>
              ) : null}

              {canEdit ? (
                <ActionButtons
                  className="trk-actions trk-side-actions-desktop"
                  saving={saving}
                  onSave={() => void persistOrder()}
                  onCancel={handleCancelOrder}
                />
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {canEdit ? (
        <footer className="trk-footer-mobile">
          <div className="trk-footer-mobile-inner">
            <button
              type="button"
              className="trk-btn trk-btn--primary"
              disabled={saving}
              onClick={() => void persistOrder()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="trk-btn trk-btn--ghost"
              disabled={saving}
              onClick={handleCancelOrder}
            >
              Cancel
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
