import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchShareLinkForCustomer, fetchSellerUserIdForToken, type ShareLinkItem } from '../services/shareLinks';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { resolveShareLinkCurrencyDisplay } from '../utils/currencyUtils';
import { productImageDisplayUrl } from '../utils/imageUrl';
import ProductImageGallery from '../components/ProductImageGallery';
import ProductVariantsDisplay from '../components/ProductVariantsDisplay';
import {
  formatVariantSelectionSummary,
  isVariantSelectionComplete,
} from '../utils/productVariants';
import './OrderForm.css';

/** CatShare on Google Play — update if store listing changes. */
const CATSHARE_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.catshare.official';

/** History state key so swipe / hardware back closes the drawer before leaving the page. */
const ORDER_FORM_DRAWER_HISTORY_KEY = 'ofProductDrawer';

type QtyMap = Record<string, number>;
type VariantSelectionMap = Record<string, Record<string, string>>;

function getQuantityStep(item: ShareLinkItem): number {
  return normalizeOrderQuantityStep(item.quantityStep);
}

function parseItemPriceNumeric(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function formatOrderMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatUnitPrice(price: ShareLinkItem['price'], symbol: string): string {
  const n = parseItemPriceNumeric(price);
  if (!Number.isFinite(n)) return String(price ?? '');
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Short label from price unit (e.g. "/ piece" → "pcs"). */
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

/** e.g. "24 pcs × ₹48" above subtotal */
function formatLineCalculationDetail(
  q: number,
  item: ShareLinkItem,
  currencySymbol: string
): string | null {
  if (q <= 0) return null;
  const unit = parseItemPriceNumeric(item.price);
  if (!Number.isFinite(unit)) return null;
  const label = getOrderUnitLabel(item.priceUnit);
  const priceStr = formatUnitPrice(item.price, currencySymbol);
  const qstep = normalizeOrderQuantityStep(item.quantityStep);
  return `${q} ${label} × ${priceStr}`;
}

function isPublicHttpUrl(url: string): boolean {
  const u = url.trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getFieldLabelAndUnitSuffix(
  item: ShareLinkItem,
  n: number
): { label: string; unitSuffix: string } {
  const row = item as unknown as Record<string, string | undefined>;
  const explicitUnit = row[`field${n}Unit`];
  const rawLabel = row[`field${n}Label`];
  if (explicitUnit != null && String(explicitUnit).trim() !== '') {
    return { label: (rawLabel || `Field ${n}`).trim(), unitSuffix: String(explicitUnit).trim() };
  }
  if (rawLabel) {
    const m = rawLabel.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { label: m[1].trim(), unitSuffix: m[2].trim() };
    return { label: rawLabel.trim(), unitSuffix: '' };
  }
  return { label: `Field ${n}`, unitSuffix: '' };
}

function getItemSearchText(item: ShareLinkItem): string {
  const extraFields = Array.from({ length: 4 }, (_, index) => {
    const fieldNumber = index + 1;
    const row = item as unknown as Record<string, string | undefined>;
    return [
      row[`field${fieldNumber}`],
      row[`field${fieldNumber}Label`],
      row[`field${fieldNumber}Unit`],
    ]
      .filter(Boolean)
      .join(' ');
  });

  return [item.name, item.subtitle, item.priceUnit, ...(item.category || []), ...extraFields]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getItemCategories(item: ShareLinkItem): string[] {
  return Array.from(
    new Set(
      (item.category || [])
        .map((category) => String(category).trim())
        .filter(Boolean)
    )
  );
}


// ─── Icons ────────────────────────────────────────────────────────────────────
function ImgIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
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

function WhatsAppIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 18l6-6-6-6" />
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

// ─── Sub-components ───────────────────────────────────────────────────────────
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
    <div className="of-qty">
      <button type="button" className="of-qty-btn" onClick={() => onChange(-inc)}>−</button>
      <span className="of-qty-val">{value}</span>
      <button type="button" className="of-qty-btn" onClick={() => onChange(inc)}>+</button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0',
      display: 'flex', overflow: 'hidden', marginBottom: 8
    }}>
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function OrderForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [sellerBusinessName, setSellerBusinessName] = useState('');
  const [sellerLogoUrl, setSellerLogoUrl] = useState('');
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [qty, setQty] = useState<QtyMap>({});
  const [variantSelections, setVariantSelections] = useState<VariantSelectionMap>({});
  const [drawerItem, setDrawerItem] = useState<ShareLinkItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  /** Number of drawer entries we pushed onto session history (usually 0 or 1). */
  const drawerHistoryDepthRef = useRef(0);

  const openProductDrawer = useCallback((item: ShareLinkItem) => {
    setDrawerItem(item);
    window.history.pushState({ [ORDER_FORM_DRAWER_HISTORY_KEY]: true }, '', window.location.href);
    drawerHistoryDepthRef.current += 1;
  }, []);

  const closeProductDrawer = useCallback(() => {
    if (drawerHistoryDepthRef.current > 0) {
      window.history.back();
    } else {
      setDrawerItem(null);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setDrawerItem((current) => {
        if (current) {
          drawerHistoryDepthRef.current = Math.max(0, drawerHistoryDepthRef.current - 1);
          return null;
        }
        return current;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setDrawerItem(null);
    setSearchQuery('');
    setSelectedCategory('all');
    drawerHistoryDepthRef.current = 0;
    // Clear sessionStorage for old token if switching to a new one
    // (This will be handled naturally when token changes and new useEffect fetches new data)
  }, [token]);

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
        setSellerLogoUrl((data.sellerLogoUrl || '').trim());
        setHeaderLogoFailed(false);
        setCurrencySymbol(
          resolveShareLinkCurrencyDisplay({
            sellerCurrencyCode: data.sellerCurrencyCode,
            sellerCurrencySymbol: data.sellerCurrencySymbol,
            sellerCustomCurrencies: data.sellerCustomCurrencies,
          })
        );
        setCurrencyCode(data.sellerCurrencyCode || 'INR');
        setItems(data.items || []);
        const initial: QtyMap = {};
        (data.items || []).forEach((i) => { initial[i.productId] = 0; });

        // Try to restore qty from sessionStorage
        const savedQty = sessionStorage.getItem(`catshare_order_qty_${token}`);
        if (savedQty) {
          try {
            const restored = JSON.parse(savedQty) as QtyMap;
            // Merge restored qty with initial (in case items list changed)
            (data.items || []).forEach((i) => {
              if (restored[i.productId] !== undefined) {
                initial[i.productId] = restored[i.productId];
              }
            });
          } catch {
            // If JSON parsing fails, just use initial
          }
        }
        setQty(initial);

        // Fetch seller_user_id using public RPC function
        if (token) {
          const sellerId = await fetchSellerUserIdForToken(token);
          if (sellerId) {
            setSellerUserId(sellerId);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load order form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    setHeaderLogoFailed(false);
  }, [sellerLogoUrl]);

  const changeQty = (id: string, delta: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  };

  // Persist qty to sessionStorage whenever it changes
  useEffect(() => {
    if (token && Object.keys(qty).length > 0) {
      sessionStorage.setItem(`catshare_order_qty_${token}`, JSON.stringify(qty));
    }
  }, [qty, token]);

  /** Number of distinct products with qty > 0 (not sum of quantities). */
  const selectedProductCount = useMemo(
    () => items.filter((i) => (qty[i.productId] ?? 0) > 0).length,
    [items, qty]
  );

  const availableCategories = useMemo(() => {
    const categories = items.flatMap((item) => getItemCategories(item));
    return Array.from(new Set(categories));
  }, [items]);

  const hasUncategorizedItems = useMemo(
    () => items.some((item) => getItemCategories(item).length === 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || getItemSearchText(item).includes(query);
      const itemCategories = getItemCategories(item);
      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized'
          ? itemCategories.length === 0
          : itemCategories.includes(selectedCategory));
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

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

  const selectionIncludesUnpricedLines = useMemo(
    () => items.some((i) => {
      const q = qty[i.productId] ?? 0;
      return q > 0 && !Number.isFinite(parseItemPriceNumeric(i.price));
    }),
    [items, qty]
  );

  const message = useMemo(() => {
    const selectedItems = items.filter((i) => (qty[i.productId] ?? 0) > 0);
    if (selectedItems.length === 0) return 'No items selected.';

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
    return lines.join('\n');
  }, [items, qty, currencySymbol, variantSelections]);

  const goToConfirmOrder = () => {
    const selectedItems = items.filter((i) => (qty[i.productId] ?? 0) > 0);
    if (selectedItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    for (const item of selectedItems) {
      const groups = item.variantGroups ?? [];
      if (
        groups.length > 0 &&
        !isVariantSelectionComplete(groups, variantSelections[item.productId])
      ) {
        alert(`Please choose all variants for "${item.name}" before confirming.`);
        openProductDrawer(item);
        return;
      }
    }

    // Navigate to confirm page with order data
    navigate(`/o/${token}/confirm`, {
      state: {
        selectedItems,
        qty,
        variantSelections,
        currencySymbol,
        currencyCode,
        sellerWhatsapp,
        sellerUserId,
        customerName: '',
        customerWhatsapp: '',
        lineAmounts,
        orderTotalAmount,
      },
    });
  };

  // ── Loading ──
  if (loading) return (
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
            <div className="of-skeleton" style={{ height: 38, width: 130, borderRadius: 100 }} />
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

 // ── Error / Expired ──
 if (error) {
  const isExpired =
    error.toLowerCase().includes('expir') ||
    error.toLowerCase().includes('invalid') ||
    error.toLowerCase().includes('not found');

  return (
    <div className="of-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        borderRadius: 24,
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        fontFamily: 'var(--font)',
      }}>
        {/* Top accent strip */}
        <div style={{
          height: 6,
          background: isExpired
            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
            : 'linear-gradient(90deg, #ef4444, #dc2626)',
        }} />

        <div style={{ padding: '36px 32px 32px', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72,
            borderRadius: '50%',
            background: isExpired ? '#fef3c7' : '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 32,
          }}>
            {isExpired ? '⏰' : '⚠️'}
          </div>

          {/* Heading */}
          <div style={{
            fontSize: 22, fontWeight: 800, color: '#0f172a',
            letterSpacing: '-0.5px', marginBottom: 10, lineHeight: 1.2,
          }}>
            {isExpired ? 'This link has expired' : 'Link unavailable'}
          </div>

          {/* Subtext */}
          <div style={{
            fontSize: 14, color: '#64748b', lineHeight: 1.6,
            marginBottom: 28,
          }}>
            {isExpired
              ? 'This order link has expired or is no longer active. Ask the seller for a new link.'
              : error}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f1f5f9', marginBottom: 24 }} />

          {/* Contact seller prompt */}
          <div style={{
            background: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 24,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              What to do next
            </div>
            <div style={{ fontSize: 13.5, color: '#166534', lineHeight: 1.6 }}>
              Contact the seller directly to get an updated order link or place your order via WhatsApp.
            </div>
          </div>

          {/* WhatsApp CTA — only if seller number is known */}
          {sellerWhatsapp ? (
              <button
                onClick={() => window.open(`https://wa.me/${sellerWhatsapp.replace(/[^\d]/g, '')}`, '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#25d366', color: '#fff',
                  padding: '13px 20px', borderRadius: 100,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(37,211,102,0.35)',
                  border: 'none', cursor: 'pointer', width: '100%',
                  fontFamily: 'var(--font)',
                }}
              >
                <WhatsAppIcon size={16} />
                Message Seller on WhatsApp
              </button>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Reach out to the seller for a fresh link.
              </div>
            )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #f1f5f9',
          padding: '14px 20px',
          textAlign: 'center',
          background: '#f8fafc',
        }}>
          
          <button
              onClick={() => window.open(CATSHARE_PLAY_STORE_URL, '_blank')}
              style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
            >
              📲 Get CatShare on Google Play
            </button>
        </div>
      </div>
    </div>
  );
}

  // ── Main ──
  return (
    <div className="of-bg">
      <div className="of-page">

        {/* Sticky header */}
        <div className="of-header">
          <div className="of-header-inner">
            <div className="of-store-row">
              <div className="of-store-icon">
                {sellerLogoUrl && !headerLogoFailed && isPublicHttpUrl(sellerLogoUrl) ? (
                  <img
                    src={sellerLogoUrl}
                    alt=""
                    className="of-store-logo-img"
                    onError={() => setHeaderLogoFailed(true)}
                  />
                ) : (
                  <StoreIcon />
                )}
              </div>
              <div className="of-store-meta">
                <div className="of-store-name">
                  {sellerBusinessName || 'Order Form'}
                </div>
                <div className="of-store-sub">
                  {sellerBusinessName ? 'Order Form' : 'Pick items & confirm via WhatsApp'}
                </div>
              </div>
            </div>
            <button
              className="of-confirm-btn"
              onClick={goToConfirmOrder}
              disabled={selectedProductCount === 0}
            >
              <WhatsAppIcon size={14} />
              <span className="btn-label">Order on WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Section label */}
        <div className="of-toolbar">
          <div className="of-section-head">
            {searchQuery.trim() || selectedCategory !== 'all'
              ? `${filteredItems.length} of ${items.length} item${items.length === 1 ? '' : 's'} shown`
              : `${items.length} item${items.length === 1 ? '' : 's'} available`}
          </div>

          {items.length > 0 && (
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

        {/* Product list */}
        <div className="of-items">
          {items.length === 0 && (
            <div className="of-empty">No items in this order link.</div>
          )}

          {items.length > 0 && filteredItems.length === 0 && (
            <div className="of-empty">
              <strong>No matching items</strong>
              Try a different name or category.
            </div>
          )}

          {filteredItems.map((item) => {
            const q = qty[item.productId] ?? 0;
            const isSelected = q > 0;
            const lineAmt = lineAmounts[item.productId] ?? 0;
            const hasParsedPrice = Number.isFinite(parseItemPriceNumeric(item.price));
            const lineCalcDetail =
              hasParsedPrice && q > 0
                ? formatLineCalculationDetail(q, item, currencySymbol)
                : null;

            return (
              <div
                key={item.productId}
                className={`of-item-card${isSelected ? ' is-selected' : ''}`}
              >
                {/* Image */}
                <div className="of-img-wrap" onClick={() => openProductDrawer(item)}>
                  {item.imageUrl ? (
                    <img
                      key={productImageDisplayUrl(item.imageUrl, item.imageVersion)}
                      src={productImageDisplayUrl(item.imageUrl, item.imageVersion)}
                      alt={item.name}
                      className="of-img"
                    />
                  ) : (
                    <div className="of-img-ph"><ImgIcon /></div>
                  )}
                  {isSelected && <div className="of-selected-badge">✓ Added</div>}
                </div>

                {/* Body */}
                <div className="of-item-body">
                  <div className="of-item-top">
                    <div className="of-item-text">
                      <div className="of-item-title-line">
                        <span className="of-item-name">{item.name}</span>
                        {item.subtitle ? (
                          <span className="of-item-subtitle-inline">({item.subtitle})</span>
                        ) : null}
                      </div>
                      <div className="of-item-price-row">
                        {item.price !== undefined && item.price !== null && item.price !== '' && (
                          <div className="of-price-tag">
                            {formatUnitPrice(item.price, currencySymbol)}
                            {item.priceUnit ? ` ${item.priceUnit}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="of-item-bottom">
                    <div className="of-item-qty-cluster">
                      <div className="of-qty-inline-row">
                        <QtyControl
                          value={q}
                          step={getQuantityStep(item)}
                          onChange={(delta) => changeQty(item.productId, delta)}
                        />
                        {getQuantityStep(item) > 1 ? (
                          <div className="of-step-hint of-step-hint--next-to-qty">
                            <AlertIcon />
                            Pack of {getQuantityStep(item)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="of-view-btn"
                      onClick={() => openProductDrawer(item)}
                    >
                      Details ›
                    </button>
                  </div>

                  {isSelected && (
                    <div className="of-line-total-below" aria-live="polite">
                      <span className="of-subtotal-label">subtotal</span>
                      <span className="of-line-sep" aria-hidden>
                        ·
                      </span>
                      {lineCalcDetail ? (
                        <>
                          <span className="of-line-calc" title={lineCalcDetail}>
                            {lineCalcDetail}
                          </span>
                          <span className="of-line-sep" aria-hidden>
                            ·
                          </span>
                        </>
                      ) : null}
                      {hasParsedPrice ? (
                        <span className="of-line-total-val">
                          {formatOrderMoney(lineAmt, currencySymbol)}
                        </span>
                      ) : (
                        <span className="of-line-total-na">—</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="of-footer">
          <div className="of-footer-app-row">
            <a
              href={CATSHARE_PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="of-footer-link"
            >
              📲 Get CatShare on Google Play
            </a>
          </div>
          <p className="of-footer-desc">
            Create catalogues, share products & take orders — built for small businesses.
          </p>
        </div>
      </div>

      {/* Floating summary bar */}
      {selectedProductCount > 0 && (
        <div className="of-summary">
          <div className="of-summary-card" onClick={goToConfirmOrder}>
            <div className="of-summary-left">
              <span className="of-summary-count">
                {selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected
              </span>
              {orderTotalAmount > 0 ? (
                <span className="of-summary-total">
                  {formatOrderMoney(orderTotalAmount, currencySymbol)}
                </span>
              ) : (
                <span className="of-summary-total">Review order</span>
              )}
              {selectionIncludesUnpricedLines && (
                <span className="of-summary-no-price">
                  Some items don't have a price
                </span>
              )}
            </div>
            <button className="of-summary-cta">
              <WhatsAppIcon size={16} />
              Place Order
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {drawerItem && (() => {
        const dQ = qty[drawerItem.productId] ?? 0;
        const dAmt = lineAmounts[drawerItem.productId] ?? 0;
        const dHasPrice = Number.isFinite(parseItemPriceNumeric(drawerItem.price));
        const drawerCalcDetail =
          dHasPrice && dQ > 0
            ? formatLineCalculationDetail(dQ, drawerItem, currencySymbol)
            : null;
        const fields = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const val = (drawerItem as Record<string, unknown>)[`field${n}`];
          if (val === undefined || val === null || String(val).trim() === '') return null;
          const { label, unitSuffix } = getFieldLabelAndUnitSuffix(drawerItem, n);
          return { label, value: unitSuffix ? `${String(val)} ${unitSuffix}` : String(val) };
        }).filter(Boolean);

        return (
          <div
            ref={overlayRef}
            className="of-overlay"
            onClick={(e) => { if (e.target === overlayRef.current) closeProductDrawer(); }}
          >
            <div className="of-drawer">
              <div className="of-drawer-handle" />

              {/* Image */}
              <div className="of-drawer-img-wrap">
                {drawerItem.imageUrls && drawerItem.imageUrls.length > 1 ? (
                  <div className="of-drawer-img of-drawer-img--gallery">
                    <ProductImageGallery
                      urls={drawerItem.imageUrls}
                      primaryIndex={drawerItem.primaryImageIndex ?? 0}
                      primaryImageVersion={drawerItem.imageVersion}
                    />
                  </div>
                ) : drawerItem.imageUrl ? (
                  <img
                    key={productImageDisplayUrl(drawerItem.imageUrl, drawerItem.imageVersion)}
                    src={productImageDisplayUrl(drawerItem.imageUrl, drawerItem.imageVersion)}
                    alt={drawerItem.name}
                    className="of-drawer-img"
                  />
                ) : (
                  <div className="of-drawer-img-ph"><ImgIcon size={48} /></div>
                )}
                <button type="button" className="of-drawer-close" onClick={() => closeProductDrawer()}>✕</button>
              </div>

              {/* Content */}
              <div className="of-drawer-body">
                <div className="of-drawer-name">{drawerItem.name}</div>
                {drawerItem.subtitle && (
                  <div className="of-drawer-sub">({drawerItem.subtitle})</div>
                )}

                {drawerItem.price !== undefined && drawerItem.price !== '' && (
                  <div className="of-drawer-price-row">
                    <div className="of-drawer-price">
                      {formatUnitPrice(drawerItem.price, currencySymbol)}
                      {drawerItem.priceUnit ? ` ${drawerItem.priceUnit}` : ''}
                    </div>
                  </div>
                )}

                {/* Detail fields table */}
                {fields.length > 0 && (
                  <div className="of-detail-table">
                    {fields.map((f, i) => (
                      <div key={i} className="of-detail-row">
                        <span className="of-detail-label">{f!.label}</span>
                        <span className="of-detail-val">{f!.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(drawerItem.variantGroups?.length ?? 0) > 0 && (
                  <ProductVariantsDisplay
                    groups={drawerItem.variantGroups!}
                    mode="select"
                    selection={variantSelections[drawerItem.productId] ?? {}}
                    onSelect={(groupId, option) => {
                      setVariantSelections((prev) => ({
                        ...prev,
                        [drawerItem.productId]: {
                          ...(prev[drawerItem.productId] ?? {}),
                          [groupId]: option,
                        },
                      }));
                    }}
                  />
                )}

                {/* Quantity section */}
                <div className="of-drawer-qty-section">
                  <div className="of-drawer-qty-label">Select quantity</div>
                  <div className="of-drawer-qty-row">
                    <QtyControl
                      value={dQ}
                      step={getQuantityStep(drawerItem)}
                      onChange={(delta) => changeQty(drawerItem.productId, delta)}
                    />
                    {dQ > 0 && (
                      <div className="of-drawer-line-total-wrap">
                        {drawerCalcDetail && (
                          <div className="of-drawer-line-calc">{drawerCalcDetail}</div>
                        )}
                        <span className="of-drawer-line-total">
                          {dHasPrice ? formatOrderMoney(dAmt, currencySymbol) : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button type="button" className="of-drawer-done" onClick={() => closeProductDrawer()}>
                  Done — {dQ > 0 ? `${dQ} added` : 'close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
