import type { ReactNode } from 'react';
import {
  FiActivity,
  FiBarChart2,
  FiClipboard,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiGlobe,
  FiGrid,
  FiHome,
  FiLink2,
  FiLock,
  FiPackage,
  FiPieChart,
  FiSettings,
  FiShield,
  FiShoppingBag,
  FiShoppingCart,
  FiTrash2,
  FiTruck,
  FiUser,
  FiUsers,
} from 'react-icons/fi';

export type StoreIconKey =
  | 'store'
  | 'business'
  | 'homepage'
  | 'checkout'
  | 'payments'
  | 'shipping'
  | 'domain'
  | 'analytics'
  | 'marketing'
  | 'integrations'
  | 'security'
  | 'danger'
  | 'products'
  | 'orders'
  | 'visitors'
  | 'revenue'
  | 'pending'
  | 'conversion'
  | 'aov'
  | 'returning';

const ICON_CONFIG: Record<
  StoreIconKey,
  { Icon: React.ComponentType<{ className?: string }>; bg: string; color: string }
> = {
  store: { Icon: FiHome, bg: '#EEF2FF', color: '#4F46E5' },
  business: { Icon: FiUser, bg: '#F0FDF4', color: '#16A34A' },
  homepage: { Icon: FiGrid, bg: '#FDF4FF', color: '#9333EA' },
  checkout: { Icon: FiShoppingCart, bg: '#FFF7ED', color: '#EA580C' },
  payments: { Icon: FiCreditCard, bg: '#EFF6FF', color: '#2563EB' },
  shipping: { Icon: FiTruck, bg: '#F5F3FF', color: '#7C3AED' },
  domain: { Icon: FiGlobe, bg: '#ECFEFF', color: '#0891B2' },
  analytics: { Icon: FiBarChart2, bg: '#F0F9FF', color: '#0284C7' },
  marketing: { Icon: FiActivity, bg: '#FFF1F2', color: '#E11D48' },
  integrations: { Icon: FiLink2, bg: '#F8FAFC', color: '#475569' },
  security: { Icon: FiShield, bg: '#F0FDFA', color: '#0D9488' },
  danger: { Icon: FiTrash2, bg: '#FEF2F2', color: '#DC2626' },
  products: { Icon: FiPackage, bg: '#EEF2FF', color: '#4F46E5' },
  orders: { Icon: FiClipboard, bg: '#F0F9FF', color: '#0369A1' },
  visitors: { Icon: FiUsers, bg: '#FAF5FF', color: '#7E22CE' },
  revenue: { Icon: FiDollarSign, bg: '#F0FDF4', color: '#15803D' },
  pending: { Icon: FiClock, bg: '#FFFBEB', color: '#D97706' },
  conversion: { Icon: FiPieChart, bg: '#FDF2F8', color: '#DB2777' },
  aov: { Icon: FiShoppingBag, bg: '#F8FAFC', color: '#334155' },
  returning: { Icon: FiUsers, bg: '#ECFDF5', color: '#059669' },
};

interface StoreIconTileProps {
  iconKey: StoreIconKey;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12 rounded-xl', icon: 'h-6 w-6' },
};

export default function StoreIconTile({ iconKey, size = 'md', className = '' }: StoreIconTileProps) {
  const config = ICON_CONFIG[iconKey];
  const { Icon } = config;
  const sizes = sizeClasses[size];

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center ${sizes.box} ${className}`}
      style={{ backgroundColor: config.bg, color: config.color }}
      aria-hidden
    >
      <Icon className={sizes.icon} />
    </span>
  );
}

export function renderStoreIcon(iconKey: StoreIconKey, size: 'sm' | 'md' | 'lg' = 'md'): ReactNode {
  return <StoreIconTile iconKey={iconKey} size={size} />;
}
