import type { StoreIconKey } from '../components/StoreIconTile';

export interface StoreNavCard {
  title: string;
  description: string;
  iconKey: StoreIconKey;
  href: string;
}

export interface StoreNavCategory {
  title: string;
  cards: StoreNavCard[];
}

export const STORE_NAVIGATION: StoreNavCategory[] = [
  {
    title: 'Core Settings',
    cards: [
      {
        title: 'Store Settings',
        description: 'Manage store behaviour and visibility',
        iconKey: 'store',
        href: '/store/settings',
      },
      {
        title: 'Business Profile',
        description: 'Business information and branding',
        iconKey: 'business',
        href: '/store/business',
      },
    ],
  },
  {
    title: 'Store Experience',
    cards: [
      {
        title: 'Homepage Builder',
        description: 'Design your storefront',
        iconKey: 'homepage',
        href: '/store/homepage',
      },
      {
        title: 'Checkout',
        description: 'Customer checkout experience',
        iconKey: 'checkout',
        href: '/store/checkout',
      },
    ],
  },
  {
    title: 'Operations',
    cards: [
      {
        title: 'Payments',
        description: 'Payment gateways and methods',
        iconKey: 'payments',
        href: '/store/payments',
      },
      {
        title: 'Shipping',
        description: 'Shipping providers and delivery rules',
        iconKey: 'shipping',
        href: '/store/shipping',
      },
    ],
  },
  {
    title: 'Growth & Integration',
    cards: [
      {
        title: 'Custom Domain',
        description: 'Connect your own domain',
        iconKey: 'domain',
        href: '/store/domain',
      },
      {
        title: 'Analytics',
        description: 'Sales and order insights',
        iconKey: 'analytics',
        href: '/store/analytics',
      },
      {
        title: 'Marketing',
        description: 'SEO, promotions and announcements',
        iconKey: 'marketing',
        href: '/store/marketing',
      },
      {
        title: 'Integrations',
        description: 'Third-party services',
        iconKey: 'integrations',
        href: '/store/integrations',
      },
    ],
  },
  {
    title: 'Security & Maintenance',
    cards: [
      {
        title: 'Security',
        description: 'Store protection and access control',
        iconKey: 'security',
        href: '/store/security',
      },
      {
        title: 'Danger Zone',
        description: 'Archive or delete store',
        iconKey: 'danger',
        href: '/store/danger',
      },
    ],
  },
];
