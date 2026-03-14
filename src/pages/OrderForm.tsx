import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchShareLinkForCustomer, type ShareLinkItem } from '../services/shareLinks';

type QtyMap = Record<string, number>;

export default function OrderForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState<string>('');
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
        setItems(data.items || []);
        const initial: QtyMap = {};
        (data.items || []).forEach((i) => { initial[i.productId] = 1; });
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

  const message = useMemo(() => {
    const lines: string[] = ['New order from CatShare link:'];
    items.forEach((i) => {
      const q = qty[i.productId] ?? 0;
      if (q > 0) lines.push(`- ${i.name} x ${q}`);
    });
    if (lines.length === 1) lines.push('- (No items selected)');
    return lines.join('\n');
  }, [items, qty]);

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
                Order<span style={{ color: '#1a5c38' }}>Form</span>
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
                <div>
                  <div style={styles.itemName}>{item.name}</div>
                  {item.price !== undefined && item.price !== null && item.price !== '' && (
                    <div style={styles.itemPrice}>
                      {String(item.price)}{item.priceUnit ? ` ${item.priceUnit}` : ''}
                    </div>
                  )}
                </div>
                <div style={styles.itemBottom}>
                  <QtyControl
                    value={qty[item.productId] ?? 0}
                    onChange={(delta) => changeQty(item.productId, delta)}
                  />
                  <button style={styles.viewBtn} onClick={() => setDrawerItem(item)}>
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
            <span style={styles.summaryLabel}>Total items</span>
            <span style={styles.summaryTotal}>
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </span>
          </div>
        )}
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
              {drawerItem.price !== undefined && drawerItem.price !== '' && (
                <div style={styles.drawerPrice}>
                  {String(drawerItem.price)}{drawerItem.priceUnit ? ` ${drawerItem.priceUnit}` : ''}
                </div>
              )}

              {/* Detail rows from fields */}
              <div style={styles.detailsBlock}>
                {[1,2,3,4,5].map((n) => {
                  const val = (drawerItem as any)[`field${n}`];
                  const label = (drawerItem as any)[`field${n}Label`] || (drawerItem as any)[`field${n}Unit`];
                  if (!val || !label) return null;
                  return (
                    <div key={n} style={styles.detailRow}>
                      <span style={styles.detailLabel}>{label}</span>
                      <span style={styles.detailVal}>{val}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quantity in drawer */}
              <div style={styles.drawerQtyRow}>
                <span style={styles.drawerQtyLabel}>Quantity</span>
                <QtyControl
                  value={qty[drawerItem.productId] ?? 0}
                  onChange={(delta) => changeQty(drawerItem.productId, delta)}
                />
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

function QtyControl({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  return (
    <div style={styles.qtyControl}>
      <button style={styles.qtyBtn} onClick={() => onChange(-1)}>−</button>
      <span style={styles.qtyVal}>{value}</span>
      <button style={styles.qtyBtn} onClick={() => onChange(1)}>+</button>
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
  page: { maxWidth: 640, margin: '0 auto', padding: '16px 12px 48px' },
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
  itemName: { fontWeight: 600, fontSize: 15, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemPrice: { fontSize: 13, color: '#4a9468', marginTop: 3, fontWeight: 500 },
  itemBottom: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
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
  summaryBar: {
    background: '#fff', border: '1px solid #e4e2d8',
    borderRadius: 16, padding: '14px 18px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 20,
  },
  summaryLabel: { fontSize: 13, color: '#6b6b63' },
  summaryTotal: { fontSize: 18, fontWeight: 600, color: '#1a1a18' },
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
  drawerPrice: { fontSize: 15, fontWeight: 600, color: '#4a9468', marginBottom: 16 },
  detailsBlock: { borderTop: '1px solid #e4e2d8', marginBottom: 4 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e4e2d8', fontSize: 14 },
  detailLabel: { color: '#6b6b63' },
  detailVal: { color: '#1a1a18', fontWeight: 500, textAlign: 'right' },
  drawerQtyRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 },
  drawerQtyLabel: { fontSize: 14, color: '#6b6b63' },
  drawerDoneBtn: {
    width: '100%', background: '#1a5c38', color: '#fff',
    border: 'none', borderRadius: 100, padding: 13,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    marginTop: 20, fontFamily: 'inherit',
  },
};