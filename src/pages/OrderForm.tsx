import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchShareLinkForCustomer,
  fetchSellerUserIdForToken,
  fetchSellerCheckoutFeatures,
  type SellerCheckoutFeatures,
  getShareLinkItemUnitPrice,
  type ShareLinkItem,
} from '../services/shareLinks';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { applyQuantityDelta, getEffectiveMinimumOrderQuantity } from '../utils/quantityPricingUtils';
import { resolveShareLinkCurrencyDisplay } from '../utils/currencyUtils';
import { productImageDisplayUrl } from '../utils/imageUrl';
import {
  formatVariantSelectionSummary,
  isVariantSelectionComplete,
} from '../utils/productVariants';
import {
  activeCartLines,
  getCartLineQty,
  loadCartLinesFromSession,
  loadLegacyQtyMapFromSession,
  migrateLegacyCartToLines,
  productHasCartLines,
  saveCartLinesToSession,
  setCartLineQty,
  setCartLineQtyById,
  totalCartLineCount,
  type OrderCartLine,
} from '../utils/orderCartLines';
import {
  findShareLinkItemByHandle,
  orderLinkBasePath,
  orderLinkProductPath,
  parseOrderLinkProductHandle,
} from '../utils/orderLinkPaths';
import OrderLinkProductDetail from './OrderLinkProductDetail';
import './OrderForm.css';

/** CatShare on Google Play — update if store listing changes. */
const CATSHARE_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.catshare.official';

type VariantSelectionMap = Record<string, Record<string, string>>;

function getQuantityStep(item: ShareLinkItem): number {
  return normalizeOrderQuantityStep(item.quantityStep);
}

function getItemMinimumOrderQuantity(item: ShareLinkItem): number {
  return getEffectiveMinimumOrderQuantity(item.minimumOrderQuantity, getQuantityStep(item));
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
  const unit = getShareLinkItemUnitPrice(item, q);
  if (!Number.isFinite(unit)) return null;
  const label = getOrderUnitLabel(item.priceUnit);
  const priceStr = `${currencySymbol}${unit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const qstep = normalizeOrderQuantityStep(item.quantityStep);
  const setCount = Math.floor(q / qstep);
  return `${q} ${label} (${setCount}) × ${priceStr}`;
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
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [sellerBusinessName, setSellerBusinessName] = useState('');
  const [sellerLogoUrl, setSellerLogoUrl] = useState('');
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [cartLines, setCartLines] = useState<OrderCartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [draftVariantSelections, setDraftVariantSelections] = useState<VariantSelectionMap>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);
  const [checkoutFeatures, setCheckoutFeatures] = useState<SellerCheckoutFeatures | null>(null);
  const navigate = useNavigate();

  const productHandle = useMemo(
    () => (token ? parseOrderLinkProductHandle(location.pathname, token) : null),
    [location.pathname, token]
  );

  const activeProduct = useMemo(
    () => (productHandle ? findShareLinkItemByHandle(items, productHandle) : null),
    [items, productHandle]
  );

  const openProductPage = useCallback(
    (item: ShareLinkItem) => {
      if (!token) return;
      navigate(orderLinkProductPath(token, item));
    },
    [navigate, token]
  );

  const closeProductPage = useCallback(() => {
    if (!token) return;
    navigate(orderLinkBasePath(token));
  }, [navigate, token]);

  useEffect(() => {
    setSearchQuery('');
    setSelectedCategory('all');
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setCartHydrated(false);
        setCartLines([]);
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
        const restoredCart = token ? loadCartLinesFromSession(token) : null;
        if (restoredCart && restoredCart.length > 0) {
          setCartLines(restoredCart);
        } else if (token) {
          const legacyQty = loadLegacyQtyMapFromSession(token);
          if (legacyQty) {
            setCartLines(migrateLegacyCartToLines(legacyQty, {}));
          }
        }
        setCartHydrated(true);

        // Fetch seller_user_id using public RPC function
        if (token) {
          const sellerId = await fetchSellerUserIdForToken(token);
          if (sellerId) {
            setSellerUserId(sellerId);
            const features = await fetchSellerCheckoutFeatures(sellerId);
            if (!cancelled) setCheckoutFeatures(features);
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
    const item = items.find((i) => i.productId === id);
    if (!item) return;
    const draftSelection = draftVariantSelections[id] ?? {};
    const groups = item.variantGroups ?? [];
    if (groups.length > 0 && !isVariantSelectionComplete(groups, draftSelection)) {
      const drawerTarget = items.find((i) => i.productId === id);
      if (drawerTarget) openProductPage(drawerTarget);
      return;
    }
    const current = getCartLineQty(cartLines, id, draftSelection);
    const next = applyQuantityDelta(
      current,
      delta,
      getQuantityStep(item),
      item.minimumOrderQuantity
    );
    setCartLines((prev) => setCartLineQty(prev, id, draftSelection, next));
  };

  const changeCartLineQty = (lineId: string, delta: number) => {
    const line = cartLines.find((l) => l.lineId === lineId);
    if (!line) return;
    const item = items.find((i) => i.productId === line.productId);
    if (!item) return;
    const next = applyQuantityDelta(
      line.quantity,
      delta,
      getQuantityStep(item),
      item.minimumOrderQuantity
    );
    setCartLines((prev) => setCartLineQtyById(prev, lineId, next));
  };

  useEffect(() => {
    if (token && cartHydrated) {
      saveCartLinesToSession(token, cartLines);
    }
  }, [cartHydrated, cartLines, token]);

  const selectedProductCount = useMemo(() => totalCartLineCount(cartLines), [cartLines]);

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

  const orderTotalAmount = useMemo(
    () =>
      activeCartLines(cartLines).reduce((sum, line) => {
        const item = items.find((i) => i.productId === line.productId);
        if (!item) return sum;
        const unit = getShareLinkItemUnitPrice(item, line.quantity);
        return sum + (line.quantity > 0 && Number.isFinite(unit) ? line.quantity * unit : 0);
      }, 0),
    [cartLines, items]
  );

  const selectionIncludesUnpricedLines = useMemo(
    () =>
      activeCartLines(cartLines).some((line) => {
        const item = items.find((i) => i.productId === line.productId);
        if (!item) return false;
        return line.quantity > 0 && !Number.isFinite(getShareLinkItemUnitPrice(item, line.quantity));
      }),
    [cartLines, items]
  );

  const message = useMemo(() => {
    const linesInCart = activeCartLines(cartLines);
    if (linesInCart.length === 0) return 'No items selected.';

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
    linesInCart.forEach((line, idx) => {
      const i = items.find((it) => it.productId === line.productId);
      if (!i) return;
      const q = line.quantity;
      const unit = getShareLinkItemUnitPrice(i, q);
      const itemTotal = Number.isFinite(unit) ? unit * q : 0;
      total += itemTotal;

      const subtitlePart = i.subtitle ? ` _(${i.subtitle})_` : '';
      lines.push(`${idx + 1}. *${i.name}*${subtitlePart}`);
      const variantLine = formatVariantSelectionSummary(i.variantGroups ?? [], line.variantSelection);
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
  }, [items, cartLines, currencySymbol]);

  const goToConfirmOrder = () => {
    const linesInCart = activeCartLines(cartLines);
    if (linesInCart.length === 0) {
      alert('Please select at least one item');
      return;
    }

    for (const line of linesInCart) {
      const item = items.find((i) => i.productId === line.productId);
      if (!item) continue;
      const groups = item.variantGroups ?? [];
      if (groups.length > 0 && !isVariantSelectionComplete(groups, line.variantSelection)) {
        alert(`Please choose all variants for "${item.name}" before confirming.`);
        openProductPage(item);
        return;
      }
    }

    navigate(`/o/${token}/confirm`, {
      state: {
        cartLines: linesInCart,
        items,
        currencySymbol,
        currencyCode,
        sellerWhatsapp,
        sellerUserId,
        customerName: '',
        customerWhatsapp: '',
        orderTotalAmount,
        integrationFlags: checkoutFeatures?.integrationFlags,
        checkoutSettings: checkoutFeatures?.checkoutSettings,
        sellerBusinessName,
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
      {productHandle ? (
        <div className="of-product-page">
          <div className="of-product-page-top">
            <button type="button" className="of-product-back" onClick={closeProductPage} aria-label="Back to items">
              ←
            </button>
            <div className="of-product-top-meta">
              <div className="of-store-name">{sellerBusinessName || 'Order Form'}</div>
            </div>
          </div>
          <div className="of-product-page-content">
            {activeProduct ? (
              <OrderLinkProductDetail
                item={activeProduct}
                currencySymbol={currencySymbol}
                cartLines={cartLines}
                draftVariantSelections={draftVariantSelections}
                onDraftVariantSelectionsChange={setDraftVariantSelections}
                onCartLinesChange={setCartLines}
                onDone={closeProductPage}
              />
            ) : (
              <div className="of-empty of-product-not-found">
                <strong>Product not found</strong>
                <p>This item is not on this order link anymore.</p>
                <button type="button" className="of-view-btn" onClick={closeProductPage}>
                  Back to all items
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
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
            const draftSelection = draftVariantSelections[item.productId] ?? {};
            const q = getCartLineQty(cartLines, item.productId, draftSelection);
            const isSelected = productHasCartLines(cartLines, item.productId);
            const unit = getShareLinkItemUnitPrice(item, q);
            const lineAmt = q > 0 && Number.isFinite(unit) ? q * unit : 0;
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
                <div className="of-img-wrap" onClick={() => openProductPage(item)}>
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
                        {getItemMinimumOrderQuantity(item) > 1 ? (
                          <div className="of-step-hint of-step-hint--next-to-qty">
                            <AlertIcon />
                            Min {getItemMinimumOrderQuantity(item)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="of-view-btn"
                      onClick={() => openProductPage(item)}
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
      )}

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

    </div>
  );
}
