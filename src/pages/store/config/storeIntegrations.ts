import type { IntegrationProviderId } from '../../../integrations/core/types';

export type StoreIntegrationId =
  | 'razorpay'
  | 'shiprocket'
  | 'cloudflare-images'
  | 'cloudflare-r2'
  | 'supabase'
  | 'firebase'
  | 'google-login'
  | 'facebook-login'
  | 'apple-login'
  | 'whatsapp-business'
  | 'resend';

export type StoreIntegrationCategory =
  | 'payments'
  | 'shipping'
  | 'storage'
  | 'platform'
  | 'authentication'
  | 'messaging';

export interface StoreIntegrationLogo {
  initials: string;
  background: string;
  color: string;
}

export interface StoreIntegrationDefinition {
  id: StoreIntegrationId;
  name: string;
  description: string;
  category: StoreIntegrationCategory;
  version: string;
  logo: StoreIntegrationLogo;
  /** When true, seller can connect/disconnect via UI. */
  available: boolean;
  /** CatShare platform-provided — no disconnect. */
  platformManaged?: boolean;
  integrationProviderId?: IntegrationProviderId;
  managePath?: string;
}

export const STORE_INTEGRATION_CATEGORIES: Record<
  StoreIntegrationCategory,
  { label: string; description: string }
> = {
  payments: { label: 'Payments', description: 'Accept online payments from customers.' },
  shipping: { label: 'Shipping', description: 'Fulfillment and delivery providers.' },
  storage: { label: 'Storage & Media', description: 'Images, files, and CDN delivery.' },
  platform: { label: 'Platform Services', description: 'Core infrastructure powering your store.' },
  authentication: { label: 'Authentication', description: 'Social and passwordless login options.' },
  messaging: { label: 'Messaging', description: 'Customer communication and email delivery.' },
};

export const STORE_INTEGRATIONS: StoreIntegrationDefinition[] = [
  {
    id: 'razorpay',
    name: 'Razorpay',
    description: 'Accept UPI, cards, and net banking. Payments settle directly to your Razorpay account.',
    category: 'payments',
    version: '2.1',
    logo: { initials: 'RZ', background: '#0C2451', color: '#FFFFFF' },
    available: true,
    integrationProviderId: 'razorpay',
    managePath: '/store/integrations/razorpay',
  },
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    description: 'Automate shipping, pickups, AWB generation, and order tracking across India.',
    category: 'shipping',
    version: '1.4',
    logo: { initials: 'SR', background: '#6F2DBD', color: '#FFFFFF' },
    available: true,
    integrationProviderId: 'shiprocket',
    managePath: '/store/integrations/shiprocket',
  },
  {
    id: 'cloudflare-images',
    name: 'Cloudflare Images',
    description: 'Optimized image delivery, transforms, and responsive variants for your catalogue.',
    category: 'storage',
    version: '1.0',
    logo: { initials: 'CI', background: '#F38020', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'cloudflare-r2',
    name: 'Cloudflare R2',
    description: 'Scalable object storage for product images and store assets with zero egress fees.',
    category: 'storage',
    version: '1.2',
    logo: { initials: 'R2', background: '#F38020', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Database, authentication, and real-time sync for your store data.',
    category: 'platform',
    version: '2.0',
    logo: { initials: 'SB', background: '#3ECF8E', color: '#1C1C1C' },
    available: true,
    platformManaged: true,
  },
  {
    id: 'firebase',
    name: 'Firebase',
    description: 'Analytics, push notifications, and mobile app services for CatShare.',
    category: 'platform',
    version: '11.0',
    logo: { initials: 'Fb', background: '#FFCA28', color: '#1C1C1C' },
    available: true,
    platformManaged: true,
  },
  {
    id: 'google-login',
    name: 'Google Login',
    description: 'Let customers sign in with their Google account at checkout and on your store.',
    category: 'authentication',
    version: '1.0',
    logo: { initials: 'G', background: '#4285F4', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'facebook-login',
    name: 'Facebook Login',
    description: 'Enable one-tap sign in with Facebook for faster checkout.',
    category: 'authentication',
    version: '1.0',
    logo: { initials: 'f', background: '#1877F2', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'apple-login',
    name: 'Apple Login',
    description: 'Sign in with Apple for a private, secure customer login experience.',
    category: 'authentication',
    version: '1.0',
    logo: { initials: '', background: '#000000', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business',
    description: 'Send order updates and marketing messages via WhatsApp Business API.',
    category: 'messaging',
    version: '1.0',
    logo: { initials: 'WA', background: '#25D366', color: '#FFFFFF' },
    available: false,
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Transactional email delivery for order confirmations and campaigns.',
    category: 'messaging',
    version: '1.0',
    logo: { initials: 'Re', background: '#000000', color: '#FFFFFF' },
    available: false,
  },
];

export function getStoreIntegration(id: StoreIntegrationId): StoreIntegrationDefinition | undefined {
  return STORE_INTEGRATIONS.find((item) => item.id === id);
}

export function getIntegrationsByCategory(
  category: StoreIntegrationCategory
): StoreIntegrationDefinition[] {
  return getActiveStoreIntegrations().filter((item) => item.category === category);
}

export function getActiveStoreIntegrations(): StoreIntegrationDefinition[] {
  return STORE_INTEGRATIONS.filter((item) => item.available || item.platformManaged);
}

export const STORE_INTEGRATION_CATEGORY_ORDER: StoreIntegrationCategory[] = [
  'payments',
  'shipping',
  'storage',
  'platform',
  'authentication',
  'messaging',
];
