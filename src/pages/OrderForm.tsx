import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchShareLinkForCustomer, type ShareLinkItem } from '../services/shareLinks';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { getCurrencyData } from '../utils/currencyUtils';

/** CatShare on Google Play — update if store listing changes. */
const CATSHARE_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.catshare.official';

type QtyMap = Record<string, number>;

function getQuantityStep(item: ShareLinkItem): number {
  return normalizeOrderQuantityStep(item.quantityStep);
}

/** Same numeric extraction as WhatsApp order message (handles "₹1,234", etc.). */
function parseItemPriceNumeric(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function formatOrderMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Unit price with seller’s currency symbol (numeric part only; price field may omit symbol). */
function formatUnitPrice(price: ShareLinkItem['price'], symbol: string): string {
  const n = parseItemPriceNumeric(price);
  if (!Number.isFinite(n)) return String(price ?? '');
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Left: field name only. Right: value + unit (e.g. "12 pcs / dozen").
 * New share links store `fieldNLabel` + `fieldNUnit`; legacy links used "Name (unit)" in one label.
 */
function getFieldLabelAndUnitSuffix(
  item: ShareLinkItem,
  n: number
): { label: string; unitSuffix: string } {
  const row = item as unknown as Record<string, string | undefined>;
  const explicitUnit = row[`field${n}Unit`];
  const rawLabel = row[`field${n}Label`];

  if (explicitUnit != null && String(explicitUnit).trim() !== '') {
    return {
      label: (rawLabel || `Field ${n}`).trim(),
      unitSuffix: String(explicitUnit).trim(),
    };
  }

  if (rawLabel) {
    const m = rawLabel.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) {
      return { label: m[1].trim(), unitSuffix: m[2].trim() };
    }
    return { label: rawLabel.trim(), unitSuffix: '' };
  }

  return { label: `Field ${n}`, unitSuffix: '' };
}

export default function OrderForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState<string>('');
  const [sellerBusinessName, setSellerBusinessName] = useState<string>('');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [qty, setQty] = useState<QtyMap>({});
  const [drawerItem, setDrawerItem] = useState<ShareLinkItem | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!token) { setError('Invalid link'); return; }
        const data = await fetchShareLinkForCustomer(token);
        if (cancelled) return;
        if (!data) { setError('This link is invalid or expired.'); return; }
        setSellerWhatsapp(data.sellerWhatsapp);
        setSellerBusinessName((data.sellerBusinessName || '').trim());
        const sym = (data.sellerCurrencySymbol || '').trim();
        const code = (data.sellerCurrencyCode || 'INR').trim() || 'INR';
        setCurrencySymbol(sym || getCurrencyData(code).symbol);
        setItems(data.items || []);
        const initial: QtyMap = {};
        (data.items || []).forEach((i) => { initial[i.productId] = 0; });
        setQty(initial);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load order form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const changeQty = (id: string, delta: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  };

  const totalItems = useMemo(
    () => Object.values(qty).reduce((a, b) => a + (b || 0), 0),
    [qty]
  );

  /** Per product line amount (qty × unit price) when both are valid. */
  const lineAmounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      const q = qty[i.productId] ?? 0;
      const unit = parseItemPriceNumeric(i.price);
      map[i.productId] = q > 0 && Number.isFinite(unit) ? q * unit : 0;
    });
    return map;
  }, [items, qty]);

  const orderTotalAmount = useMemo(
    () => Object.values(lineAmounts).reduce((a, b) => a + b, 0),
    [lineAmounts]
  );

  /** Selected lines where unit price can’t be parsed (no order total from those lines). */
  const selectionIncludesUnpricedLines = useMemo(
    () =>
      items.some((i) => {
        const q = qty[i.productId] ?? 0;
        return q > 0 && !Number.isFinite(parseItemPriceNumeric(i.price));
      }),
    [items, qty]
  );

  const message = useMemo(() => {
    const selectedItems = items.filter((i) => (qty[i.productId] ?? 0) > 0);
    
    if (selectedItems.length === 0) return 'No items selected.';
  
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
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
  
      lines.push(`${idx + 1}. *${i.name}*`);
      lines.push(`   Qty: ${q}${i.price ? ` | Price: ${i.price}${i.priceUnit ? ' ' + i.priceUnit : ''}` : ''}`);
      if (itemTotal > 0) lines.push(`   Subtotal: ${currencySymbol}${itemTotal.toLocaleString('en-IN')}`);
    });
  
    if (total > 0) {
      lines.push('');
      lines.push(`💰 *Total: ${currencySymbol}${total.toLocaleString('en-IN')}*`);
    }
  
    lines.push('');
    lines.push('Please confirm availability and share payment details. Thank you! 🙏');
  
    return lines.join('\n');
  }, [items, qty, currencySymbol]);

  const openWhatsApp = () => {
    const to = (sellerWhatsapp || '').replace(/[^\d]/g, '');
    if (!to) { alert('Seller WhatsApp number is not configured.'); return; }
    const url = `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
    window.location.href = url;
  };

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.stateCard}>
        <div style={styles.stateTitle}>Loading order form…</div>
        <div style={styles.stateSub}>Please wait.</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={styles.page}>
      <div style={styles.stateCard}>
        <div style={styles.stateTitle}>Order form</div>
        <div style={{ ...styles.stateSub, color: '#c0392b' }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={styles.bg}>
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <div style={styles.brand}>
                {sellerBusinessName ? (
                  <>
                    <span style={{ color: '#1a1a18' }}>{sellerBusinessName}</span>{' '}
                    Order<span style={{ color: '#1a5c38' }}>Form</span>
                  </>
                ) : (
                  <>
                    Order<span style={{ color: '#1a5c38' }}>Form</span>
                  </>
                )}
              </div>
              <div style={styles.subtitle}>Select quantities and confirm via WhatsApp</div>
            </div>
            <button style={styles.confirmBtn} onClick={openWhatsApp}>
              Confirm order
            </button>
          </div>
        </div>

        {/* Items */}
        <div style={styles.itemsList}>
          {items.length === 0 && (
            <div style={styles.emptyState}>No items in this order link.</div>
          )}
          {items.map((item) => (
            <div key={item.productId} style={styles.itemCard}>
              {/* Image */}
              <div style={styles.imgWrap} onClick={() => setDrawerItem(item)}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} style={styles.img} />
                ) : (
                  <div style={styles.imgPlaceholder}>
                    <ImgIcon />
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={styles.itemBody}>
                <div style={styles.itemMainRow}>
                  <div style={styles.itemTextCol}>
                    <div style={styles.itemName}>{item.name}</div>
                    {item.subtitle ? (
                      <div style={styles.itemSubtitle}>{item.subtitle}</div>
                    ) : null}
                    {item.price !== undefined && item.price !== null && item.price !== '' && (
                      <div style={styles.itemPrice}>
                        {formatUnitPrice(item.price, currencySymbol)}
                        {item.priceUnit ? ` ${item.priceUnit}` : ''}
                      </div>
                    )}
                    {getQuantityStep(item) > 1 && (
                      <div style={styles.stepHint}>
                        Sold in multiples of {getQuantityStep(item)}
                      </div>
                    )}
                  </div>
                  {(qty[item.productId] ?? 0) > 0 && (
                    <div style={styles.itemLineTotalCol}>
                      {Number.isFinite(parseItemPriceNumeric(item.price)) ? (
                        <span style={styles.itemLineTotalVal}>
                          {formatOrderMoney(lineAmounts[item.productId] ?? 0, currencySymbol)}
                        </span>
                      ) : (
                        <span style={styles.itemSubtotalNa}>—</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={styles.itemBottom}>
                  <QtyControl
                    value={qty[item.productId] ?? 0}
                    step={getQuantityStep(item)}
                    onChange={(delta) => changeQty(item.productId, delta)}
                  />
                  <button type="button" style={styles.viewBtn} onClick={() => setDrawerItem(item)}>
                    View details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary bar */}
        {totalItems > 0 && (
          <div style={styles.summaryBar}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Total items</span>
              <span style={styles.summaryTotal}>
                {totalItems} item{totalItems === 1 ? '' : 's'}
              </span>
            </div>
            {orderTotalAmount > 0 && (
              <div style={{ ...styles.summaryRow, marginTop: 10, paddingTop: 10, borderTop: '1px solid #e4e2d8' }}>
                <span style={styles.summaryLabel}>Order total</span>
                <span style={styles.summaryMoney}>{formatOrderMoney(orderTotalAmount, currencySymbol)}</span>
              </div>
            )}
            {orderTotalAmount === 0 && totalItems > 0 && selectionIncludesUnpricedLines && (
              <div style={styles.summaryNoPriceNote}>
                Some selected items don’t have a unit price on this link — line totals use prices from the catalogue when available.
              </div>
            )}
          </div>
        )}

        <footer style={styles.orderFooter}>
          <a
            href={CATSHARE_PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.orderFooterLink}
          >
            Get CatShare on Google Play
          </a>
          <p style={styles.orderFooterDesc}>
            Create catalogues, share products with customers, and take orders — built for small businesses.
          </p>
        </footer>
      </div>

      {/* Drawer */}
      {drawerItem && (
        <div
          ref={overlayRef}
          style={styles.overlay}
          onClick={(e) => { if (e.target === overlayRef.current) setDrawerItem(null); }}
        >
          <div style={styles.drawer}>
            {/* Image */}
            <div style={{ position: 'relative' }}>
              {drawerItem.imageUrl ? (
                <img src={drawerItem.imageUrl} alt={drawerItem.name} style={styles.drawerImg} />
              ) : (
                <div style={styles.drawerImgPlaceholder}><ImgIcon size={48} /></div>
              )}
              <button style={styles.drawerClose} onClick={() => setDrawerItem(null)}>✕</button>
            </div>

            {/* Content */}
            <div style={styles.drawerContent}>
              <div style={styles.drawerName}>{drawerItem.name}</div>
              {drawerItem.subtitle ? (
                <div style={styles.drawerSubtitle}>{drawerItem.subtitle}</div>
              ) : null}
              {drawerItem.price !== undefined && drawerItem.price !== '' && (
                <div style={styles.drawerPrice}>
                  {formatUnitPrice(drawerItem.price, currencySymbol)}
                  {drawerItem.priceUnit ? ` ${drawerItem.priceUnit}` : ''}
                </div>
              )}
              {getQuantityStep(drawerItem) > 1 && (
                <div style={styles.drawerStepHint}>
                  Sold in multiples of {getQuantityStep(drawerItem)}
                </div>
              )}

              {/* Detail rows from fields */}
              <div style={styles.detailsBlock}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const val = (drawerItem as Record<string, unknown>)[`field${n}`];
                  if (val === undefined || val === null || String(val).trim() === '') return null;
                  const { label, unitSuffix } = getFieldLabelAndUnitSuffix(drawerItem, n);
                  const valueText = unitSuffix
                    ? `${String(val)} ${unitSuffix}`
                    : String(val);
                  return (
                    <div key={n} style={styles.detailRow}>
                      <span style={styles.detailLabel}>{label}</span>
                      <span style={styles.detailVal}>{valueText}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quantity controls left, line total right */}
              <div style={styles.drawerQtyRow}>
                <div style={styles.drawerQtyLeft}>
                  <span style={styles.drawerQtyLabel}>Quantity</span>
                  <QtyControl
                    value={qty[drawerItem.productId] ?? 0}
                    step={getQuantityStep(drawerItem)}
                    onChange={(delta) => changeQty(drawerItem.productId, delta)}
                  />
                </div>
                {(qty[drawerItem.productId] ?? 0) > 0 && (
                  <span style={styles.drawerLineTotalInline}>
                    {Number.isFinite(parseItemPriceNumeric(drawerItem.price)) ? (
                      formatOrderMoney(lineAmounts[drawerItem.productId] ?? 0, currencySymbol)
                    ) : (
                      '—'
                    )}
                  </span>
                )}
              </div>

              <button style={styles.drawerDoneBtn} onClick={() => setDrawerItem(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const s = Math.max(1, Math.floor(step) || 1);
  const inc = s > 1 ? s : 1;
  return (
    <div style={styles.qtyControl}>
      <button type="button" style={styles.qtyBtn} onClick={() => onChange(-inc)}>−</button>
      <span style={styles.qtyVal}>{value}</span>
      <button type="button" style={styles.qtyBtn} onClick={() => onChange(inc)}>+</button>
    </div>
  );
}

function ImgIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.2">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: '100vh', background: '#f7f6f2', fontFamily: "'DM Sans', system-ui, sans-serif" },
  page: { maxWidth: 640, margin: '0 auto', padding: '16px 12px 24px' },
  stateCard: { background: '#fff', border: '1px solid #e4e2d8', borderRadius: 16, padding: 24, marginTop: 40 },
  stateTitle: { fontWeight: 600, fontSize: 16, color: '#1a1a18' },
  stateSub: { fontSize: 13, color: '#6b6b63', marginTop: 6 },
  header: { paddingBottom: 16, borderBottom: '1px solid #e4e2d8', marginBottom: 20 },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  brand: { fontSize: 26, fontWeight: 700, color: '#1a1a18', letterSpacing: '-0.5px', lineHeight: 1 },
  subtitle: { fontSize: 13, color: '#6b6b63', marginTop: 5 },
  confirmBtn: {
    background: '#1a5c38', color: '#fff', border: 'none',
    padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.2px',
    fontFamily: 'inherit',
  },
  itemsList: { display: 'flex', flexDirection: 'column', gap: 12 },
  emptyState: { textAlign: 'center', padding: '40px 20px', color: '#6b6b63', fontSize: 14 },
  itemCard: {
    background: '#fff', border: '1px solid #e4e2d8',
    borderRadius: 16, overflow: 'hidden',
    display: 'flex', alignItems: 'stretch',
  },
  imgWrap: { width: 90, flexShrink: 0, cursor: 'pointer', background: '#f0ede4', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  imgPlaceholder: { width: '100%', height: '100%', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 },
  itemMainRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  itemTextCol: { flex: 1, minWidth: 0 },
  itemName: { fontWeight: 600, fontSize: 15, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSubtitle: {
    fontSize: 12,
    color: '#6b6b63',
    marginTop: 4,
    lineHeight: 1.35,
    wordBreak: 'break-word' as const,
  },
  itemPrice: { fontSize: 13, color: '#4a9468', marginTop: 4, fontWeight: 500 },
  itemLineTotalCol: {
    flexShrink: 0,
    textAlign: 'right' as const,
    paddingTop: 2,
    maxWidth: '42%',
  },
  itemLineTotalVal: { fontSize: 16, fontWeight: 700, color: '#1a5c38', display: 'block' },
  stepHint: { fontSize: 11, color: '#6b6b63', marginTop: 4 },
  itemBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  qtyControl: {
    display: 'flex', alignItems: 'center',
    background: '#f0ede4', borderRadius: 100,
    border: '1px solid #e4e2d8', overflow: 'hidden',
  },
  qtyBtn: {
    width: 32, height: 32, border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 18, color: '#1a1a18',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', lineHeight: 1,
  },
  qtyVal: { minWidth: 32, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1a1a18', userSelect: 'none' },
  viewBtn: {
    fontSize: 12, color: '#4a9468', cursor: 'pointer',
    fontWeight: 500, border: 'none', background: 'none',
    textDecoration: 'underline', textUnderlineOffset: 3,
    fontFamily: 'inherit', padding: 0,
  },
  itemSubtotalNa: { fontSize: 14, color: '#9b9b93', fontWeight: 600 },
  summaryBar: {
    background: '#fff', border: '1px solid #e4e2d8',
    borderRadius: 16, padding: '14px 18px',
    display: 'flex', flexDirection: 'column',
    marginTop: 20,
  },
  summaryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  summaryLabel: { fontSize: 13, color: '#6b6b63' },
  summaryTotal: { fontSize: 18, fontWeight: 600, color: '#1a1a18' },
  summaryMoney: { fontSize: 20, fontWeight: 700, color: '#1a5c38' },
  summaryNoPriceNote: { fontSize: 12, color: '#8b8b82', marginTop: 10, lineHeight: 1.45 },
  orderFooter: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid #e4e2d8',
    textAlign: 'center' as const,
  },
  orderFooterLink: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a5c38',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  orderFooterDesc: {
    fontSize: 12,
    color: '#6b6b63',
    marginTop: 8,
    lineHeight: 1.45,
    maxWidth: 420,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,15,12,0.55)', zIndex: 100,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  drawer: {
    background: '#fff', borderRadius: '22px 22px 0 0',
    width: '100%', maxWidth: 640, maxHeight: '92vh',
    overflowY: 'auto',
  },
  drawerImg: { width: '100%', aspectRatio: '1', objectFit: 'contain', background: '#f0ede4', display: 'block' },
  drawerImgPlaceholder: { width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ede4' },
  drawerClose: {
    position: 'absolute', top: 14, right: 14,
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(0,0,0,0.35)', border: 'none',
    cursor: 'pointer', color: '#fff', fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  },
  drawerContent: { padding: '20px 20px 32px' },
  drawerName: { fontSize: 22, fontWeight: 700, color: '#1a1a18', letterSpacing: '-0.3px', marginBottom: 4 },
  drawerSubtitle: { fontSize: 13, color: '#6b6b63', marginBottom: 8, lineHeight: 1.4 },
  drawerPrice: { fontSize: 15, fontWeight: 600, color: '#4a9468', marginBottom: 8 },
  drawerStepHint: { fontSize: 12, color: '#6b6b63', marginBottom: 16 },
  detailsBlock: { borderTop: '1px solid #e4e2d8', marginBottom: 4 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e4e2d8', fontSize: 14 },
  detailLabel: { color: '#6b6b63' },
  detailVal: { color: '#1a1a18', fontWeight: 500, textAlign: 'right' },
  drawerQtyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  drawerQtyLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap' as const,
    minWidth: 0,
  },
  drawerQtyLabel: { fontSize: 14, color: '#6b6b63', flexShrink: 0 },
  drawerLineTotalInline: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1a5c38',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    marginLeft: 'auto',
  },
   drawerDoneBtn: {
    width: '100%', background: '#1a5c38', color: '#fff',
    border: 'none', borderRadius: 100, padding: 13,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    marginTop: 20, fontFamily: 'inherit',
  },
};