import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSellerOrders, updateOrder, updateOrderStatus, deleteOrder, type Order } from '../services/orderService';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { generateInvoicePDF } from '../utils/invoiceGenerator';
import { getBusinessProfileForPdf } from '../config/businessProfile';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusType = 'pending' | 'completed' | 'cancelled';

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
  productId?: string;
  imageUrl?: string;
  priceUnit?: string;
  quantityStep?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return {
        bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
        border: '#FDE68A',
        text: '#92400E',
        dot: '#F59E0B',
        label: 'Pending',
        icon: '⏳',
        accent: '#F59E0B',
      };
    case 'completed':
      return {
        bg: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
        border: '#BBF7D0',
        text: '#14532D',
        dot: '#16A34A',
        label: 'Completed',
        icon: '✅',
        accent: '#16A34A',
      };
    case 'cancelled':
      return {
        bg: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
        border: '#FECDD3',
        text: '#881337',
        dot: '#F43F5E',
        label: 'Cancelled',
        icon: '✕',
        accent: '#F43F5E',
      };
    default:
      return {
        bg: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
        border: '#E2E8F0',
        text: '#475569',
        dot: '#94A3B8',
        label: status,
        icon: '•',
        accent: '#94A3B8',
      };
  }
}

const billText = (order: Order, symbol: string) => {
  const date = formatDate(order.created_at);
  const items: OrderItem[] = order.items || [];
  const lines: string[] = [];
  lines.push(`🧾 *Order Bill*`);
  lines.push(`Customer: ${order.customer_name}`);
  lines.push(`Date: ${date}`);
  lines.push('');
  lines.push('*Items:*');
  items.forEach((item, i) => {
    const unitStr = item.unitPrice ? `${symbol}${item.unitPrice} × ${item.quantity}` : `Qty: ${item.quantity}`;
    const totalStr = item.rowTotal ? ` = ${symbol}${item.rowTotal}` : '';
    lines.push(`${i + 1}. ${item.name} — ${unitStr}${totalStr}`);
  });
  lines.push('');
  if (order.total_amount) {
    lines.push(`💰 *Total: ${symbol}${order.total_amount.toLocaleString('en-IN')}*`);
  }
  lines.push(`Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`);
  return lines.join('\n');
};

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  blue: '#0A84FF',
  red: '#FF3B30',
};

// ─── SVG Icons (crisp, iOS-style) ────────────────────────────────────────────
const Ic = {
  Back: () => (
    <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
      <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
      <path d="M1 1L6 7L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  WhatsApp: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  Copy: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  Edit: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Share: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  PDF: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Trash: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
  Minus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Phone: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.2 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Img: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
    </svg>
  ),
  MoreVertical: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
    </svg>
  ),
};

// ─── Status Pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 100,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.text, fontSize: 12, fontWeight: 600,
      letterSpacing: '0.1px',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: COLORS.surface, borderRadius: 16,
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.6px',
      textTransform: 'uppercase', color: COLORS.subtle,
      padding: '0 4px', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ─── Row divider ─────────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ height: 1, background: '#F2F2F7', margin: '0 16px' }} />
);

// ─── Status dropdown ─────────────────────────────────────────────────────────
function StatusDropdown({
  current,
  onChange,
  onClose,
}: {
  current: string;
  onChange: (s: StatusType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const statuses: StatusType[] = ['pending', 'completed', 'cancelled'];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 6px)', right: 0,
      background: '#FFFFFF', borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 300, overflow: 'hidden', minWidth: 180,
      animation: 'dropIn 0.15s cubic-bezier(0.34,1.3,0.64,1)',
    }}>
      <style>{`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px) scale(0.97) } to { opacity: 1; transform: none } }`}</style>
      {statuses.map((s, i) => {
        const cfg = getStatusConfig(s);
        const isActive = s === current;
        return (
          <button
            key={s}
            onClick={() => { onChange(s); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 16px',
              border: 'none', borderBottom: i < statuses.length - 1 ? `1px solid #F2F2F7` : 'none',
              background: isActive ? `${cfg.accent}08` : 'transparent',
              cursor: 'pointer', fontFamily: FONT,
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? cfg.text : COLORS.text,
              transition: 'background 0.1s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: cfg.dot, flexShrink: 0,
              }} />
              {cfg.label}
            </span>
            {isActive && <span style={{ color: cfg.accent }}><Ic.Check /></span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Actions dropdown menu ───────────────────────────────────────────────────
function ActionsMenu({
  onClose,
  onWhatsApp,
  onDownloadPDF,
  onCopyBill,
  onShare,
  pdfLoading,
  copied,
}: {
  onClose: () => void;
  onWhatsApp: () => void;
  onDownloadPDF: () => void;
  onCopyBill: () => void;
  onShare: () => void;
  pdfLoading: boolean;
  copied: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const actions = [
    { icon: <Ic.WhatsApp size={16} />, label: 'Send Invoice', sublabel: 'WhatsApp', onClick: onWhatsApp, color: '#16A34A' },
    { icon: <Ic.PDF />, label: 'Download PDF', sublabel: pdfLoading ? 'Generating…' : 'Invoice', onClick: onDownloadPDF, color: '#0A84FF' },
    { icon: <Ic.Copy />, label: copied ? 'Copied!' : 'Copy Bill', sublabel: 'Plain text', onClick: onCopyBill, color: '#8B5CF6' },
    { icon: <Ic.Share />, label: 'Share', sublabel: 'Other apps', onClick: onShare, color: '#F59E0B' },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
      background: '#FFFFFF', borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 300, overflow: 'hidden', minWidth: 240,
      animation: 'dropIn 0.15s cubic-bezier(0.34,1.3,0.64,1)',
    }}>
      <style>{`@keyframes dropIn { from { opacity: 0; transform: translateY(-6px) scale(0.97) } to { opacity: 1; transform: none } }`}</style>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => { action.onClick(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '12px 16px',
            border: 'none', borderBottom: i < actions.length - 1 ? `1px solid #F2F2F7` : 'none',
            background: 'transparent',
            cursor: 'pointer', fontFamily: FONT,
            fontSize: 13, fontWeight: 500,
            color: COLORS.text,
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F7'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {action.icon}
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{action.label}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{action.sublabel}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Action tile ─────────────────────────────────────────────────────────────
function ActionTile({
  icon, label, sublabel, color, bg, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  bg: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '14px 14px 12px',
        background: pressed ? `${bg}` : '#FAFAFA',
        border: `1.5px solid ${color}18`,
        borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
        transition: 'transform 0.1s, background 0.1s',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        gap: 10,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.text, lineHeight: 1.3 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10.5, color: COLORS.subtle, marginTop: 1 }}>{sublabel}</div>}
      </div>
    </button>
  );
}

// ─── Qty stepper ─────────────────────────────────────────────────────────────
function QtyStepper({ value, step, onChange }: { value: number; step: number; onChange: (n: number) => void }) {
  const normalizedStep = normalizeOrderQuantityStep(step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F2F2F7', borderRadius: 6, border: '1.5px solid #E2E8F0', width: 'fit-content' }}>
      <button
        onClick={() => onChange(Math.max(0, value - normalizedStep))}
        style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: value === 0 ? '#CBD5E1' : COLORS.text }}
        disabled={value === 0}
      >
        <Ic.Minus />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value > 0 ? String(value) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          if (!digits) {
            onChange(0);
          } else {
            const num = parseInt(digits, 10);
            // Round to nearest valid step value
            const rounded = Math.max(0, Math.round(num / normalizedStep) * normalizedStep);
            onChange(rounded);
          }
        }}
        aria-label="Quantity"
        style={{
          width: 40,
          border: 'none',
          background: 'transparent',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: value === 0 ? '#94A3B8' : COLORS.text,
          fontFamily: 'inherit',
          padding: 0,
          outline: 'none',
        }}
      />
      <button
        onClick={() => onChange(value + normalizedStep)}
        style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.text }}
      >
        <Ic.Plus />
      </button>
    </div>
  );
}

// ─── Product image ────────────────────────────────────────────────────────────
function ProductThumb({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const valid = url && (url.startsWith('data:') || /^https?:\/\//i.test(url)) && !failed;
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
        <Ic.Img />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, supabaseData } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<(OrderItem & { _key: string })[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSwipeProcessing, setIsSwipeProcessing] = useState(false);

  const swipeHandlers = useSwipeable({
    onSwipedRight: async () => {
      // Prevent multiple swipes from being processed simultaneously
      if (isSwipeProcessing) return;

      setIsSwipeProcessing(true);
      await Haptics.impact({ style: ImpactStyle.Light });

      if (editMode) {
        setEditMode(false);
      } else {
        navigate('/orders');
      }

      // Clear the flag after a short delay to prevent rapid consecutive swipes
      setTimeout(() => setIsSwipeProcessing(false), 300);
    },
    trackMouse: false,
    delta: 50,
  });

  useEffect(() => {
    if (!user?.uid || !id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await fetchSellerOrders(user.uid);
      if (!error && data) {
        const found = data.find((o: Order) => o.id === id);
        if (found) {
          setOrder(found);
          setEditName(found.customer_name || '');
          setEditPhone((found as any).customer_whatsapp || '');
          setEditItems((found.items || []).map((it: OrderItem, i: number) => ({ ...it, _key: String(i) })));
        } else showToast('Order not found', 'error');
      } else showToast('Failed to load order', 'error');
      setLoading(false);
    })();
  }, [user?.uid, id]);

  const handleBack = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
    if (editMode) {
      setEditMode(false);
    } else {
      navigate('/orders');
    }
  };

  const handleStatusChange = async (status: StatusType) => {
    if (!order) return;

    await Haptics.impact({ style: ImpactStyle.Light });

    // Store old status in case we need to revert
    const oldStatus = order.status;

    // Update local state immediately for optimistic UI
    setOrder(prev => prev ? { ...prev, status } : null);

    // Persist to backend
    const { error } = await updateOrderStatus(order.id, status);
    if (error) {
      showToast('Failed to update order status', 'error');
      // Revert on error
      setOrder(prev => prev ? { ...prev, status: oldStatus } : null);
    } else {
      showToast(`Marked as ${status}`, 'success');
    }
  };

  const handleSaveEdit = async () => {
    if (!order) return;
    setSaveLoading(true);
    try {
      const total = editItems.reduce((s, it) => s + ((it.unitPrice || 0) * it.quantity), 0);
      const itemsToSave = editItems.map(({ _key, ...item }) => item) as any[];
      const { error } = await updateOrder(order.id, {
        items: itemsToSave as any,
        customer_name: editName,
        customer_whatsapp: editPhone,
        total_amount: total > 0 ? total : order.total_amount,
      });

      if (error) {
        showToast('Failed to save order', 'error');
        setSaveLoading(false);
        return;
      }

      setOrder({
        ...order,
        items: editItems,
        customer_name: editName,
        customer_whatsapp: editPhone,
        total_amount: total > 0 ? total : order.total_amount,
      } as any);
      setEditMode(false);
      showToast('Order saved', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save order', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!order) return;
    setPdfLoading(true);
    try {
      const businessProfile = getBusinessProfileForPdf(supabaseData?.userSettings);
      const symbol = getSymbolForCurrencyCode(order.currency_code);
      const pdfBlob = await generateInvoicePDF(order, businessProfile, symbol);
      const fileName = `Invoice_${order.id.substring(0, 8)}_${(order.customer_name || 'customer').replace(/\s+/g, '_')}.pdf`;

      // Check if running on mobile (Capacitor)
      const isMobile = (window as any).Capacitor?.isNative;

      if (isMobile) {
        // Use Capacitor's Filesystem API for mobile
        try {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents,
            recursive: true,
          });

          showToast(`Invoice saved to ${result.uri}`, 'success');
        } catch (fsErr) {
          console.error('Filesystem error:', fsErr);
          // Fallback: try native share
          try {
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            if (navigator.share) {
              await navigator.share({
                title: `Invoice - ${order.customer_name}`,
                text: `Invoice for ${order.customer_name}`,
                files: [new File([pdfBlob], fileName, { type: 'application/pdf' })],
              });
            }
            showToast('Invoice generated!', 'success');
          } catch (shareErr) {
            showToast('Failed to save invoice', 'error');
          }
        }
      } else {
        // Web: Use standard download
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
        showToast('Invoice downloaded!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF', 'error');
    }
    setPdfLoading(false);
  };

  const handleShareWhatsApp = async () => {
    if (!order) return;
    setPdfLoading(true);
    try {
      const businessProfile = getBusinessProfileForPdf(supabaseData?.userSettings);
      const symbol = getSymbolForCurrencyCode(order.currency_code);
      const pdfBlob = await generateInvoicePDF(order, businessProfile, symbol);
      const fileName = `Invoice_${order.id.substring(0, 8)}_${(order.customer_name || 'customer').replace(/\s+/g, '_')}.pdf`;

      // Try to use native share API if available (works on mobile)
      try {
        if (navigator.share) {
          await navigator.share({
            title: `Invoice - ${order.customer_name}`,
            text: `Hi ${order.customer_name}, please find your invoice attached. 📎`,
            files: [new File([pdfBlob], fileName, { type: 'application/pdf' })],
          });
          showToast('Invoice shared!', 'success');
          setPdfLoading(false);
          return;
        }
      } catch (shareErr) {
        // Share API failed or not supported, continue with fallback
      }

      // Fallback: Download PDF and open WhatsApp with message
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);

      const phone = (order as any).customer_whatsapp || '';
      const message = encodeURIComponent(`Hi ${order.customer_name}, please find your invoice attached. 📎`);
      const cleaned = phone.replace(/[^\d]/g, '');
      window.open(cleaned ? `https://wa.me/${cleaned}?text=${message}` : `https://wa.me/?text=${message}`, '_blank');
      showToast('Invoice downloaded. You can now attach it in WhatsApp.', 'success');
    } catch {
      // Fallback: Send bill as text if PDF generation fails
      const symbol = getSymbolForCurrencyCode(order.currency_code);
      const phone = ((order as any).customer_whatsapp || '').replace(/[^\d]/g, '');
      const text = encodeURIComponent(billText(order, symbol));
      window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
      showToast('Sent bill details to WhatsApp', 'info');
    }
    setPdfLoading(false);
  };

  const handleCopy = () => {
    if (!order) return;
    const symbol = getSymbolForCurrencyCode(order.currency_code);
    navigator.clipboard.writeText(billText(order, symbol)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleNativeShare = async () => {
    if (!order) return;
    const symbol = getSymbolForCurrencyCode(order.currency_code);
    if (navigator.share) {
      await navigator.share({ title: `Order — ${order.customer_name}`, text: billText(order, symbol) });
    } else {
      handleCopy();
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    try {
      const { error } = await deleteOrder(order.id);
      if (error) {
        showToast('Failed to delete order', 'error');
        return;
      }
      showToast('Order deleted', 'success');
      navigate('/orders');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete order', 'error');
    }
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, fontFamily: FONT }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.blue, animation: 'spin 0.75s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: COLORS.subtle, fontSize: 14, margin: 0 }}>Loading order…</p>
      </div>
    </div>
  );

  if (!order) return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, fontFamily: FONT, padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Order not found</div>
      <button onClick={handleBack} style={{ marginTop: 16, padding: '11px 24px', borderRadius: 100, border: 'none', background: COLORS.blue, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Back to Orders
      </button>
    </div>
  );

  const symbol = getSymbolForCurrencyCode(order.currency_code);
  const items: OrderItem[] = order.items || [];
  const phone = (order as any).customer_whatsapp || '';
  const editTotal = editItems.reduce((s, it) => s + ((it.unitPrice || 0) * it.quantity), 0);
  const statusCfg = getStatusConfig(order.status);

  return (
    <div {...swipeHandlers} style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: COLORS.bg, fontFamily: FONT, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; }
        input, textarea { font-family: inherit; }
        input:focus { outline: none; border-color: ${COLORS.green} !important; box-shadow: 0 0 0 3px ${COLORS.green}14 !important; }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>

      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto', height: 44, background: '#1C1C1E', zIndex: 100 }} />

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 44, zIndex: 50,
        background: 'rgba(245,245,247,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {/* Nav row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.blue, flexShrink: 0, transition: 'background 0.1s',
            }}
          >
            <Ic.Back />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: COLORS.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {editMode ? 'Edit Order' : order.customer_name}
            </div>
            {!editMode && (
              <div style={{ fontSize: 12, color: COLORS.subtle, marginTop: 1 }}>
                {formatDate(order.created_at)} · {formatTime(order.created_at)}
              </div>
            )}
          </div>
          {!editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowStatusDrop(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px 6px 10px', borderRadius: 100,
                    background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
                    color: statusCfg.text, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusCfg.dot }} />
                  {statusCfg.label}
                  <span style={{ opacity: 0.7 }}><Ic.ChevronDown /></span>
                </button>
                {showStatusDrop && (
                  <StatusDropdown
                    current={order.status}
                    onChange={handleStatusChange}
                    onClose={() => setShowStatusDrop(false)}
                  />
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowActionsMenu(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 100,
                    background: 'transparent', border: 'none',
                    color: COLORS.muted, cursor: 'pointer', fontFamily: FONT,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Ic.MoreVertical />
                </button>
                {showActionsMenu && (
                  <ActionsMenu
                    onClose={() => setShowActionsMenu(false)}
                    onWhatsApp={handleShareWhatsApp}
                    onDownloadPDF={handleGeneratePDF}
                    onCopyBill={handleCopy}
                    onShare={handleNativeShare}
                    pdfLoading={pdfLoading}
                    copied={copied}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status color bar */}
        <div style={{ height: 3, background: statusCfg.bg, borderTop: `1px solid ${statusCfg.border}` }}>
          <div style={{ height: '100%', background: statusCfg.dot, width: order.status === 'completed' ? '100%' : order.status === 'pending' ? '50%' : '0%', transition: 'width 0.5s ease', opacity: 0.5 }} />
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 40px' }}>
        <div style={{ animation: 'fadeUp 0.3s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Customer card ── */}
          {editMode ? (
            <>
              <SectionLabel>Customer Info</SectionLabel>
              <Card>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                      Customer Name
                    </label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Enter name"
                      style={{
                        width: '100%', padding: '10px 12px',
                        borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                        fontSize: 15, background: '#FAFAFA',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                      WhatsApp Number
                    </label>
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      type="tel" placeholder="+91 98xxxxxxxx"
                      style={{
                        width: '100%', padding: '10px 12px',
                        borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                        fontSize: 15, background: '#FAFAFA',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    />
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              <SectionLabel>Customer</SectionLabel>
              <Card>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 22,
                      background: `${statusCfg.dot}18`,
                      border: `2px solid ${statusCfg.dot}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 700, color: statusCfg.dot, flexShrink: 0,
                    }}>
                      {(order.customer_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{order.customer_name}</div>
                      {phone ? (
                        <a
                          href={`https://wa.me/${phone.replace(/[^\d]/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: '#25D366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}
                        >
                          <Ic.WhatsApp size={12} />
                          {phone}
                        </a>
                      ) : (
                        <div style={{ fontSize: 12, color: COLORS.subtle, marginTop: 1 }}>No phone saved</div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: '-0.5px' }}>
                      {order.total_amount ? formatMoney(order.total_amount, symbol) : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.subtle, marginTop: 2 }}>
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* ── Items ── */}
          <SectionLabel>{editMode ? 'Edit Items' : 'Order Items'}</SectionLabel>
          <Card>
            {editMode ? (
              <div style={{ padding: '4px 16px' }}>
                {editItems.map((it, i) => (
                  <div key={it._key}>
                    {i > 0 && <Divider />}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', gap: 12 }}>
                      <ProductThumb url={it.imageUrl} name={it.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{it.name}</div>
                        {it.unitPrice ? (
                          <div style={{ fontSize: 12, color: COLORS.muted }}>{symbol}{it.unitPrice} per unit</div>
                        ) : null}
                      </div>
                      <QtyStepper value={it.quantity} step={it.quantityStep ?? 1} onChange={qty => {
                        if (qty === 0) {
                          setEditItems(prev => prev.filter(x => x._key !== it._key));
                        } else {
                          setEditItems(prev => prev.map(x => x._key === it._key ? { ...x, quantity: qty } : x));
                        }
                      }} />
                    </div>
                  </div>
                ))}
                {editItems.length === 0 && (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: COLORS.subtle, fontSize: 14 }}>
                    No items remaining
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '4px 16px' }}>
                {items.map((item, i) => {
                  const hasCost = item.unitPrice != null && item.unitPrice > 0;
                  const lineTotal = item.rowTotal || (hasCost ? item.unitPrice! * item.quantity : null);
                  return (
                    <div key={i}>
                      {i > 0 && <Divider />}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', gap: 12 }}>
                        <ProductThumb url={item.imageUrl} name={item.name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{item.name}</div>
                          {item.category && (
                            <div style={{ fontSize: 11, color: COLORS.subtle }}>{item.category}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          {hasCost && (
                            <div style={{ fontSize: 12, color: COLORS.muted }}>
                              {symbol}{item.unitPrice} × {item.quantity} {getOrderUnitLabel(item.priceUnit)}
                            </div>
                          )}
                          {!hasCost && (
                            <div style={{ fontSize: 12, color: COLORS.muted }}>
                              Qty: {item.quantity} {getOrderUnitLabel(item.priceUnit)}
                            </div>
                          )}
                          {lineTotal != null ? (
                            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
                              {formatMoney(lineTotal, symbol)}
                            </div>
                          ) : null}
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
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted }}>Order Total</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.green, letterSpacing: '-0.4px' }}>
                    {order.total_amount ? formatMoney(order.total_amount, symbol) : '—'}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* ── Edit mode total ── */}
          {editMode && editTotal > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: COLORS.greenLight, borderRadius: 12, padding: '12px 16px',
              border: `1px solid #BBF7D0`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>Updated Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{formatMoney(editTotal, symbol)}</span>
            </div>
          )}

          {/* ── Actions (edit mode) ── */}
          {editMode ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setEditMode(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14,
                  border: `1.5px solid ${COLORS.border}`, background: COLORS.surface,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', color: COLORS.muted, fontFamily: FONT,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saveLoading}
                style={{
                  flex: 2, padding: '14px', borderRadius: 14,
                  border: 'none', background: saveLoading ? '#A3E6BE' : COLORS.green,
                  fontSize: 15, fontWeight: 700, cursor: saveLoading ? 'not-allowed' : 'pointer',
                  color: '#fff', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.2s',
                }}
              >
                {saveLoading ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                    Saving…
                  </>
                ) : 'Save Changes'}
              </button>
            </div>
          ) : (
            <>
              {/* ── Quick status change ── */}
              <SectionLabel>Quick Actions</SectionLabel>

              {/* Mark as row */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pending', 'completed', 'cancelled'] as StatusType[]).filter(s => s !== order.status).map(s => {
                  const cfg = getStatusConfig(s);
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        flex: 1, padding: '11px 8px', borderRadius: 12,
                        border: `1.5px solid ${cfg.dot}25`,
                        background: cfg.bg, cursor: 'pointer',
                        fontSize: 12.5, fontWeight: 600, color: cfg.text, fontFamily: FONT,
                        transition: 'transform 0.1s',
                      }}
                    >
                      {s === 'completed' ? '✓ Complete' : s === 'cancelled' ? '✕ Cancel' : '↩ Reopen'}
                    </button>
                  );
                })}
              </div>


              {/* Edit */}
              <button
                onClick={() => setEditMode(true)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  border: `1.5px solid ${COLORS.border}`, background: COLORS.surface,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  color: COLORS.text, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                <Ic.Edit />
                Edit Order
              </button>

              {/* Delete */}
              {showDeleteConfirm ? (
                <div style={{
                  background: '#FFF1F2', borderRadius: 14, border: `1.5px solid #FECDD3`,
                  padding: '16px',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#881337', textAlign: 'center', marginBottom: 4 }}>
                    Delete this order?
                  </div>
                  <div style={{ fontSize: 12, color: '#BE123C', textAlign: 'center', marginBottom: 14 }}>
                    This action cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowDeleteConfirm(false)} style={{
                      flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`,
                      background: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: COLORS.muted,
                    }}>Keep</button>
                    <button onClick={handleDelete} style={{
                      flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                      background: '#F43F5E', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#fff',
                    }}>Delete</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    width: '100%', padding: '12px', borderRadius: 12,
                    border: `1.5px solid #FECDD3`, background: '#FFF1F2',
                    cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#F43F5E',
                    transition: 'background 0.15s',
                  }}
                >
                  <Ic.Trash />
                  Delete Order
                </button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
