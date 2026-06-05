import type { CSSProperties, ReactNode } from 'react';

export interface StorefrontIconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  stroke?: string;
  color?: string;
  'aria-hidden'?: boolean;
}

function svgProps({
  size = 24,
  className,
  style,
  stroke = 'currentColor',
  color,
  'aria-hidden': ariaHidden = true,
}: StorefrontIconProps) {
  return {
    width: size,
    height: size,
    className,
    style: { display: 'block', flexShrink: 0, color, ...style },
    fill: 'none' as const,
    stroke,
    'aria-hidden': ariaHidden,
  };
}

export function IconSearch(props: StorefrontIconProps) {
  const { size = 16, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export function IconImage(props: StorefrontIconProps) {
  const { size = 28, stroke = '#cbd5e1', ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, stroke, ...rest })} strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function IconPackage(props: StorefrontIconProps) {
  const { size = 14, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12" />
      <path d="M12 12l9-5-9-5-9 5 9 5z" />
      <path d="M3 7v10l9 5 9-5V7" />
    </svg>
  );
}

export function IconTag(props: StorefrontIconProps) {
  const { size = 28, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFolder(props: StorefrontIconProps) {
  const { size = 48, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function IconShoppingBag(props: StorefrontIconProps) {
  const { size = 40, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

export function IconAlertTriangle(props: StorefrontIconProps) {
  const { size = 26, stroke = '#dc2626', ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, stroke, ...rest })} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconInfo(props: StorefrontIconProps) {
  const { size = 18, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function IconCheckCircle(props: StorefrontIconProps) {
  const { size = 18, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

export function IconX(props: StorefrontIconProps) {
  const { size = 14, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="2.2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function IconVideo(props: StorefrontIconProps) {
  const { size = 48, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M10 9l6 3-6 3V9z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMessage(props: StorefrontIconProps) {
  const { size = 48, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" {...svgProps({ size, ...rest })} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  );
}

export function PackHint({ step, className }: { step: number; className?: string }) {
  return (
    <div className={className ?? 'sv-pack-hint'}>
      <IconPackage size={12} aria-hidden />
      <span>Pack of {step}</span>
    </div>
  );
}

export function MoqHint({ minQty, className }: { minQty: number; className?: string }) {
  if (minQty <= 1) return null;
  return (
    <div className={className ?? 'sv-pack-hint'}>
      <IconPackage size={12} aria-hidden />
      <span>Min order {minQty}</span>
    </div>
  );
}

export function ProductImagePlaceholder({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconImage size={size} />
    </span>
  );
}

/** Announcement bar icons by type */
export function announcementIcon(type: 'info' | 'warning' | 'success' | 'none', size = 18): ReactNode {
  switch (type) {
    case 'info':
      return <IconInfo size={size} />;
    case 'warning':
      return <IconAlertTriangle size={size} stroke="currentColor" />;
    case 'success':
      return <IconCheckCircle size={size} />;
    default:
      return null;
  }
}
