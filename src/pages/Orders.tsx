import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSellerOrders, updateOrderStatus, type Order } from '../services/orderService';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import './Orders.css';
import MainAppBottomNav from '../components/MainAppBottomNav';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = 'all' | 'pending' | 'completed' | 'cancelled';
type StatusType = 'pending' | 'completed' | 'cancelled';

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
  subtitle?: string;
  productId?: string;
  imageUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCurrencySymbol(code?: string) {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return '₹';
}

function formatMoney(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { bg: '#FEF9C3', text: '#854D0E', dot: '#EAB308', label: 'Pending' };
    case 'completed':
      return { bg: '#DCFCE7', text: '#166534', dot: '#16A34A', label: 'Completed' };
    case 'cancelled':
      return { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Cancelled' };
    default:
      return { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8', label: status };
  }
}

function getOrderSourceConfig(source?: string) {
  switch (source) {
    case 'link':
      return { bg: '#DDD6FE', text: '#4C1D95', label: 'Link' };
    case 'manual':
      return { bg: '#E0E7FF', text: '#3730A3', label: 'Manual' };
    case 'store':
      return { bg: '#DBEAFE', text: '#0C4A6E', label: 'Store' };
    default:
      return { bg: '#F3F4F6', text: '#374151', label: 'Unknown' };
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function IconWhatsApp({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.2 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconPrint() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
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

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.text,
      fontSize: 11, fontWeight: 700,
      padding: '3px 8px', borderRadius: 100,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Status Selector Dropdown ─────────────────────────────────────────────────
function StatusSelector({
  current,
  onChange,
  onClose,
}: {
  current: string;
  onChange: (s: StatusType) => void;
  onClose: () => void;
}) {
  const statuses: StatusType[] = ['pending', 'completed', 'cancelled'];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '110%', right: 0,
      background: '#fff', borderRadius: 12, border: '1.5px solid #E2E8F0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 200,
      overflow: 'hidden', minWidth: 160,
    }}>
      {statuses.map((s) => {
        const cfg = getStatusConfig(s);
        const isActive = s === current;
        return (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onChange(s); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '10px 14px', border: 'none',
              background: isActive ? cfg.bg : '#fff', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: isActive ? cfg.text : '#374151',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
              {cfg.label}
            </span>
            {isActive && <IconCheck />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Order Row (List View) ────────────────────────────────────────────────────
function OrderRow({
  order,
  currencySymbol,
  onStatusChange,
  onClick,
}: {
  order: Order;
  currencySymbol: string;
  onStatusChange: (id: string, status: StatusType) => void;
  onClick: () => void;
}) {
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const statusCfg = getStatusConfig(order.status);
  const total = order.total_amount != null ? formatMoney(order.total_amount, currencySymbol) : null;
  const itemCount = (order.items || []).length;
  const phone = (order as any).customer_whatsapp || (order as any).customerWhatsapp || '';

  return (
    <div
      style={{
        background: '#fff', borderRadius: 16, border: '1.5px solid #E2E8F0',
        margin: '0 12px 10px', overflow: 'visible',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        cursor: 'pointer', transition: 'box-shadow 0.18s, border-color 0.18s',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0';
      }}
    >
      {/* Top stripe by status */}
      <div style={{ height: 3, background: statusCfg.dot, borderRadius: '14px 14px 0 0' }} />

      <div style={{ padding: '12px 14px 14px' }}>
        {/* Row 1: Name + Total */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.2, marginBottom: 2 }}>
              {order.customer_name}
            </div>
            {phone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B', fontSize: 12 }}>
                <IconPhone />
                {phone}
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {total ? (
              <div style={{ fontSize: 17, fontWeight: 800, color: '#166534' }}>{total}</div>
            ) : (
              <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>No price</div>
            )}
          </div>
        </div>

        {/* Row 2: Date + Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 11 }}>
            <IconCalendar />
            {formatDate(order.created_at)}
          </div>

          {/* Pills container */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            {/* Order source pill */}
            {order.order_source && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: getOrderSourceConfig(order.order_source).bg, color: getOrderSourceConfig(order.order_source).text,
                fontSize: 11, fontWeight: 700,
                padding: '4px 9px', borderRadius: 100, border: 'none',
              }}>
                {getOrderSourceConfig(order.order_source).label}
              </span>
            )}

            {/* Status chip — clickable, stops propagation */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStatusDrop(v => !v);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: statusCfg.bg, color: statusCfg.text,
                  fontSize: 11, fontWeight: 700,
                  padding: '4px 9px', borderRadius: 100, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot, display: 'inline-block' }} />
                {statusCfg.label}
                <IconChevronDown />
              </button>
              {showStatusDrop && (
                <StatusSelector
                  current={order.status}
                  onChange={(s) => { onStatusChange(order.id, s); setShowStatusDrop(false); }}
                  onClose={() => setShowStatusDrop(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Qty Row ─────────────────────────────────────────────────────────────
function EditItemRow({
  item,
  onChange,
}: {
  item: OrderItem & { productId?: string; _key: string };
  onChange: (key: string, qty: number) => void;
}) {
  const hasImage = item.imageUrl && /^https?:\/\//i.test(item.imageUrl);
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #F1F5F9', gap: 10,
    }}>
      {/* Image */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        overflow: 'hidden', background: '#F1F5F9', border: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {hasImage ? (
          <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{item.name}</div>
        {item.unitPrice ? (
          <div style={{ fontSize: 12, color: '#64748B' }}>₹{item.unitPrice} / unit</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F1F5F9', borderRadius: 100, border: '1.5px solid #E2E8F0' }}>
        <button
          onClick={() => onChange(item._key, Math.max(0, item.quantity - 1))}
          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
        >
          <IconMinus />
        </button>
        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
          {item.quantity}
        </span>
        <button
          onClick={() => onChange(item._key, item.quantity + 1)}
          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
        >
          <IconPlus />
        </button>
      </div>
    </div>
  );
}


// ─── Main Orders Component ────────────────────────────────────────────────────
export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabType>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    if (!user?.uid || user.uid.trim() === '') return;
    loadOrders();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;
    const handler = () => {
      void fetchSellerOrders(user.uid).then(({ data, error }) => {
        if (!error && data) setOrders(data);
      });
    };
    window.addEventListener('catshareNewOrder', handler);
    return () => window.removeEventListener('catshareNewOrder', handler);
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Handle mobile hardware back button
  useEffect(() => {
    const handleBackButton = async () => {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {
        // Haptics might not be available on web
      }
      navigate(-1);
    };

    let listener: any = null;

    // Only try to add listener on mobile platforms
    const setupListener = async () => {
      try {
        listener = await App.addListener('backButton', handleBackButton);
      } catch (e) {
        // App listener not available (web browser)
      }
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate]);

  // Handle swipe back gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipeProgress(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Only trigger swipe if:
    // 1. Started from left edge (within 50px)
    // 2. More horizontal movement than vertical
    if (touchStartX.current < 50 && Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
      const progress = Math.min(deltaX / 100, 1);
      setSwipeProgress(progress);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - touchStartX.current;

    // Navigate back if swiped more than 80px
    if (deltaX > 80) {
      await Haptics.impact({ style: ImpactStyle.Light });
      navigate(-1);
    }

    setSwipeProgress(0);
  };

  const loadOrders = async () => {
    if (!user?.uid || user.uid.trim() === '') {
      setError('User authentication required');
      setLoading(false);
      return;
    }

    // Prevent guest users from loading orders (guest IDs are not valid UUIDs)
    if (user.isAnonymous) {
      setError('Please sign in to view orders');
      showToast('Sign in required to view orders', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error } = await fetchSellerOrders(user.uid);
    if (error) {
      console.error('Failed to load orders:', error);
      setError('Failed to load orders. Please try again.');
      showToast('Error loading orders', 'error');
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const handleTabChange = async (newTab: TabType) => {
    await Haptics.impact({ style: ImpactStyle.Light });
    setTab(newTab);
  };

  const handleNavigate = async (path: string) => {
    await Haptics.impact({ style: ImpactStyle.Light });
    navigate(path);
  };

  const handleStatusChange = async (id: string, status: StatusType) => {
    // Update local state immediately
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));

    // Persist to backend
    const { error } = await updateOrderStatus(id, status);
    if (error) {
      showToast('Failed to update order status', 'error');
      // Revert local state on error
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: o.status } : o));
    } else {
      showToast(`Order marked as ${status}`, 'success');
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const filteredOrders = orders
    .filter(o => tab === 'all' || o.status === tab)
    .filter(o => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        o.customer_name?.toLowerCase().includes(s) ||
        (o.items || []).some((it: OrderItem) => it.name?.toLowerCase().includes(s))
      );
    });

  // Summary stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders
      .filter(o => o.status === 'completed' && o.total_amount)
      .reduce((s, o) => s + (o.total_amount || 0), 0),
  };
  const symbol = orders[0] ? getCurrencySymbol(orders[0].currency_code) : '₹';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        position: 'relative',
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe back visual indicator */}
      {swipeProgress > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.2)',
            opacity: swipeProgress * 0.3,
            zIndex: 35,
            pointerEvents: 'none',
            transition: swipeProgress === 0 ? 'opacity 0.2s ease-out' : 'none',
          }}
        />
      )}

      {/* Swipe back arrow indicator */}
      {swipeProgress > 0.2 && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: 30,
            transform: `translateY(-50%) scale(${0.8 + swipeProgress * 0.4})`,
            zIndex: 36,
            pointerEvents: 'none',
            opacity: Math.min(swipeProgress * 2, 1),
            transition: 'none',
          }}
        >
          <IconChevronLeft />
        </div>
      )}

      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto 0', height: 40, background: '#0F172A', zIndex: 50 }} />

      {/* Header */}
      <div style={{
        position: 'sticky', top: 40, zIndex: 40,
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: 52, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 16, top: 14, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px', transition: 'opacity 0.15s ease, visibility 0.15s ease', opacity: showSearch ? 0 : 1, visibility: showSearch ? 'hidden' : 'visible' }}>Orders</div>
          </div>

          {/* Create Order Button */}
          <button
            onClick={() => handleNavigate('/create-order')}
            style={{
              padding: '8px 14px',
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginRight: 8,
              transition: 'opacity 0.15s ease, visibility 0.15s ease',
              transitionDelay: showSearch ? '0s' : '0.3s',
              opacity: showSearch ? 0 : 1,
              visibility: showSearch ? 'hidden' : 'visible',
              pointerEvents: showSearch ? 'none' : 'auto',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#2563EB';
            }}
          >
            + New Order
          </button>

          {/* Expanding Search Box */}
          <div
            style={{
              transition: 'all 0.3s ease-out',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              width: showSearch ? 320 : 0,
              opacity: showSearch ? 1 : 0,
              transform: showSearch ? 'scale(1)' : 'scale(0.95)',
              marginRight: showSearch ? 8 : 0,
              height: 36,
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '0 12px 0 12px',
                  paddingRight: 32,
                  fontSize: 14,
                  border: '1px solid #D1D5DB',
                  borderRadius: 6,
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(4px)',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'all 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 2px #3B82F6';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: 'absolute',
                    right: 8,
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
          </div>

          {/* Fixed Icons Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <button
              onClick={() => setShowSearch((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: '#4B5563',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#4B5563'}
              title="Search"
            >
              <IconSearch />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid #F1F5F9', marginTop: 10 }}>
          {tabs.map(t => {
            const count = t.key === 'all' ? orders.length : orders.filter(o => o.status === t.key).length;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                style={{
                  flex: 1, padding: '10px 4px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#2563EB' : '#64748B',
                  borderBottom: isActive ? '2.5px solid #2563EB' : '2.5px solid transparent',
                  transition: 'color 0.15s',
                  position: 'relative',
                }}
              >
                {t.label}
                {count > 0 && (
                  <span style={{
                    marginLeft: 4, fontSize: 10, fontWeight: 700,
                    background: isActive ? '#DBEAFE' : '#F1F5F9',
                    color: isActive ? '#2563EB' : '#94A3B8',
                    padding: '1px 5px', borderRadius: 100,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 70, paddingTop: 50 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Loading orders…</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, padding: 24 }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626' }}>{error}</div>
            {user?.isAnonymous ? (
              <button onClick={() => handleNavigate('/login')} style={{
                padding: '10px 20px', borderRadius: 100, border: 'none',
                background: '#3B82F6', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Sign In</button>
            ) : (
              <button onClick={loadOrders} style={{
                padding: '10px 20px', borderRadius: 100, border: 'none',
                background: '#3B82F6', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Retry</button>
            )}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 8, padding: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 4 }}>{search ? '🔍' : '📦'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
              {search ? 'No results found' : `No ${tab !== 'all' ? tab : ''} orders yet`}
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
              {search ? 'Try a different name or product' : 'Orders will appear here when customers place them'}
            </div>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              currencySymbol={symbol}
              onStatusChange={handleStatusChange}
              onClick={async () => {
                await Haptics.impact({ style: ImpactStyle.Light });
                navigate(`/orders/${order.id}`);
              }}
            />
          ))
        )}
      </main>

      <MainAppBottomNav active="orders" />
    </div>
  );
}
