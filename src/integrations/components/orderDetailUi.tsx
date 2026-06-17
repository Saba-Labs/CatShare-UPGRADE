import React from 'react';

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

export function OdSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        color: OD_COLORS.subtle,
        padding: '0 4px',
        marginBottom: 8,
        marginTop: 4,
        fontFamily: OD_FONT,
      }}
    >
      {children}
    </div>
  );
}

export function OdCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: OD_COLORS.surface,
        borderRadius: 16,
        border: `1px solid ${OD_COLORS.border}`,
        overflow: 'hidden',
        marginBottom: 12,
        fontFamily: OD_FONT,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function OdDivider() {
  return <div style={{ height: 1, background: OD_COLORS.divider }} />;
}

export function OdCardHeader({
  icon,
  title,
  subtitle,
  badge,
  accentColor = OD_COLORS.blue,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${OD_COLORS.divider}`,
        background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${accentColor}14`,
          border: `1px solid ${accentColor}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accentColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: OD_COLORS.text }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: OD_COLORS.muted, marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>
      {badge ? <div style={{ flexShrink: 0 }}>{badge}</div> : null}
    </div>
  );
}

export function OdStatusPill({
  label,
  dot,
  bg,
  border,
  text,
}: {
  label: string;
  dot: string;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        borderRadius: 100,
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.1px',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
        }}
      />
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
  return getPaymentStatusPill('pending');
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : `1px solid ${OD_COLORS.divider}`,
      }}
    >
      <span style={{ fontSize: 13, color: OD_COLORS.muted, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: highlight ? 15 : mono ? 12 : 13,
          fontWeight: highlight ? 700 : 600,
          color: highlight ? OD_COLORS.text : OD_COLORS.text,
          textAlign: 'right',
          wordBreak: 'break-word',
          fontFamily: mono ? "'DM Mono', Menlo, monospace" : OD_FONT,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function OdEmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div style={{ padding: '20px 16px', textAlign: 'center' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: '#F2F2F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          color: OD_COLORS.subtle,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: OD_COLORS.text, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: OD_COLORS.muted, lineHeight: 1.45, maxWidth: 280, margin: '0 auto' }}>
        {description}
      </div>
    </div>
  );
}

export function OdFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 16px 14px',
        borderTop: `1px solid ${OD_COLORS.divider}`,
        fontSize: 11,
        color: OD_COLORS.subtle,
        lineHeight: 1.4,
        background: '#FAFAFA',
      }}
    >
      {children}
    </div>
  );
}

export const OdIcons = {
  Payment: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  Shipment: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 18H3a2 2 0 01-2-2V8a2 2 0 012-2h3m0 12h10m0 0h2a2 2 0 002-2V8a2 2 0 00-2-2h-5" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M5 8h10v8H5z" />
    </svg>
  ),
  Link: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
