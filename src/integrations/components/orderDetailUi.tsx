import React from 'react';
import './order-detail-integrations.css';

/** Design tokens aligned with OrderDetail.tsx */
export const OD_FONT = "'DM Sans', system-ui, sans-serif";

export const OD_COLORS = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  border: '#E8E8ED',
  text: '#1C1C1E',
  muted: '#6E6E73',
  subtle: '#AEAEB2',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  greenBorder: '#BBF7D0',
  blue: '#0A84FF',
  blueLight: '#EFF6FF',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  amberBorder: '#FDE68A',
  amberText: '#92400E',
  red: '#FF3B30',
  redLight: '#FFF1F2',
  redBorder: '#FECDD3',
  redText: '#881337',
  divider: '#F2F2F7',
};

export function OdIntegrationsStack({ children }: { children: React.ReactNode }) {
  return <div className="od-integrations-stack">{children}</div>;
}

export function OdSectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="od-section-label">{children}</p>;
}

export function OdCard({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`od-card${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}

export function OdCardHeader({
  icon,
  title,
  subtitle,
  badge,
  variant = 'payment',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  variant?: 'payment' | 'shipment' | 'tracking';
}) {
  return (
    <div className={`od-card-header od-card-header--${variant}`}>
      <div className="od-card-icon">{icon}</div>
      <div className="od-card-heading">
        <div className="od-card-title">{title}</div>
        {subtitle ? <div className="od-card-subtitle">{subtitle}</div> : null}
      </div>
      {badge ? <div style={{ flexShrink: 0 }}>{badge}</div> : null}
    </div>
  );
}

export function OdHeroAmount({ children }: { children: React.ReactNode }) {
  return <div className="od-hero-amount">{children}</div>;
}

export function OdStatusPill({
  label,
  dot,
  bg,
  border,
  text,
  kind = 'default',
}: {
  label: string;
  dot: string;
  bg: string;
  border: string;
  text: string;
  kind?: 'default' | 'payment' | 'delivery';
}) {
  return (
    <span
      className={`od-status-pill od-status-pill--${kind}`}
      style={{ background: bg, borderColor: border, color: text }}
    >
      {kind === 'payment' ? (
        <svg
          className="od-status-pill-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ) : kind === 'delivery' ? (
        <svg
          className="od-status-pill-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 18H3a2 2 0 01-2-2V8a2 2 0 012-2h3m0 12h10m0 0h2a2 2 0 002-2V8a2 2 0 00-2-2h-5" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
          <path d="M5 8h10v8H5z" />
        </svg>
      ) : (
        <span className="od-status-pill-dot" style={{ background: dot }} />
      )}
      {label}
    </span>
  );
}

export function getPaymentStatusPill(status: string) {
  switch (status) {
    case 'paid':
      return {
        label: 'Paid',
        dot: '#16A34A',
        bg: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
        border: '#BBF7D0',
        text: '#14532D',
      };
    case 'pending':
      return {
        label: 'Pending',
        dot: '#F59E0B',
        bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
        border: '#FDE68A',
        text: '#92400E',
      };
    case 'refunded':
      return {
        label: 'Refunded',
        dot: '#0A84FF',
        bg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
        border: '#BFDBFE',
        text: '#1E40AF',
      };
    case 'failed':
    case 'cancelled':
      return {
        label: status === 'failed' ? 'Failed' : 'Cancelled',
        dot: '#F43F5E',
        bg: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
        border: '#FECDD3',
        text: '#881337',
      };
    default:
      return {
        label: status,
        dot: '#94A3B8',
        bg: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
        border: '#E2E8F0',
        text: '#475569',
      };
  }
}

/** Payment badge on order detail — labels differ from order fulfillment status. */
export function getOrderPaymentStatusPill(
  status: string,
  paymentMethod?: string | null,
  customerClaimedPaidAt?: string | null,
  paymentConfirmedBy?: 'customer' | 'seller' | null
) {
  if (status === 'paid' && paymentMethod === 'upi' && paymentConfirmedBy === 'customer') {
    return {
      label: 'Customer reported paid',
      dot: '#D97706',
      bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
      border: '#FDE68A',
      text: '#92400E',
    };
  }

  if (status === 'paid') {
    return getPaymentStatusPill(status);
  }

  if (status === 'pending') {
    if (paymentMethod === 'cod') {
      return {
        label: 'Pay on delivery',
        dot: '#7C3AED',
        bg: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
        border: '#DDD6FE',
        text: '#5B21B6',
      };
    }
    if (paymentMethod === 'upi') {
      if (customerClaimedPaidAt) {
        return {
          label: 'Customer marked paid',
          dot: '#D97706',
          bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
          border: '#FDE68A',
          text: '#92400E',
        };
      }
      return {
        label: 'Awaiting UPI payment',
        dot: '#7C3AED',
        bg: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
        border: '#DDD6FE',
        text: '#5B21B6',
      };
    }
    if (paymentMethod === 'manual') {
      return {
        label: 'Payment with seller',
        dot: '#64748B',
        bg: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
        border: '#E2E8F0',
        text: '#475569',
      };
    }
    return {
      label: 'Awaiting payment',
      dot: '#2563EB',
      bg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
      border: '#BFDBFE',
      text: '#1E40AF',
    };
  }
  if (status === 'failed') {
    return {
      label: 'Payment failed',
      dot: '#F43F5E',
      bg: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
      border: '#FECDD3',
      text: '#881337',
    };
  }
  if (status === 'cancelled') {
    return {
      label: 'Payment cancelled',
      dot: '#F43F5E',
      bg: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
      border: '#FECDD3',
      text: '#881337',
    };
  }
  return getPaymentStatusPill(status);
}

export function getDeliveryStatusPill(status: string) {
  if (status === 'delivered') return getPaymentStatusPill('paid');
  if (status === 'in_transit' || status === 'out_for_delivery' || status === 'picked_up') {
    return {
      label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      dot: '#0A84FF',
      bg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
      border: '#BFDBFE',
      text: '#1E40AF',
    };
  }
  if (status === 'failed' || status === 'cancelled') return getPaymentStatusPill('failed');
  return {
    label: 'Not shipped',
    dot: '#94A3B8',
    bg: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
    border: '#E2E8F0',
    text: '#475569',
  };
}

export function OdDetailRow({
  label,
  value,
  mono,
  highlight,
  isLast,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  highlight?: boolean;
  isLast?: boolean;
}) {
  if (!value || value === '—') return null;
  return (
    <div className="od-detail-row" style={isLast ? { borderBottom: 'none' } : undefined}>
      <span className="od-detail-label">{label}</span>
      <span
        className={`od-detail-value${mono ? ' od-detail-value--mono' : ''}${highlight ? ' od-detail-value--highlight' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export function OdMethodChip({
  method,
}: {
  method: string | null | undefined;
}) {
  if (!method) return null;
  const label =
    method === 'cod'
      ? 'Cash on delivery'
      : method === 'prepaid'
        ? 'Pay online / UPI'
        : method === 'upi'
          ? 'Pay via UPI'
          : method === 'manual'
            ? 'Manual payment'
            : method;
  const isCod = method === 'cod';
  const isUpi = method === 'upi';
  return (
    <span
      className={`od-method-chip${isCod ? ' od-method-chip--cod' : ''}${isUpi ? ' od-method-chip--upi' : ''}`}
    >
      {label}
    </span>
  );
}

export function OdEmptyState({
  icon,
  title,
  description,
  variant = 'shipment',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'payment' | 'shipment';
}) {
  return (
    <div className="od-empty">
      <div
        className="od-empty-icon"
        style={
          variant === 'payment'
            ? { background: 'linear-gradient(145deg, #ecfdf5, #d1fae5)', color: '#059669' }
            : undefined
        }
      >
        {icon}
      </div>
      <div className="od-empty-title">{title}</div>
      <div className="od-empty-desc">{description}</div>
    </div>
  );
}

export function OdFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-info-banner">
      <svg
        className="od-info-banner-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export const OdIcons = {
  Payment: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  Shipment: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 18H3a2 2 0 01-2-2V8a2 2 0 012-2h3m0 12h10m0 0h2a2 2 0 002-2V8a2 2 0 00-2-2h-5" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M5 8h10v8H5z" />
    </svg>
  ),
  Link: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Check: () => (
    <svg width="11" height="9" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
