import type { StoreIconKey } from '../components/StoreIconTile';

export interface StoreNavCard {
  title: string;
  description: string;
  iconKey: StoreIconKey;
  href: string;
  proOnly?: boolean;
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
        proOnly: true,
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
        description: 'Connect logistics providers',
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
        proOnly: true,
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
        proOnly: true,
      },
    ],
  },
  {
    title: 'Security & Maintenance',
    cards: [
      {
        title: 'Security',
        description: 'Password protection and delete store',
        iconKey: 'security',
        href: '/store/security',
      },
    ],
  },
];
