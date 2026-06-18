export interface SecurityApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  scopes: string[];
}

export interface SecurityDevice {
  id: string;
  name: string;
  browser: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface SecuritySession {
  id: string;
  device: string;
  ipAddress: string;
  startedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface SecurityActivityLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'failed';
}

export interface SecurityPermission {
  id: string;
  label: string;
  description: string;
  owner: boolean;
  admin: boolean;
  staff: boolean;
  comingSoon?: boolean;
}

export const PLACEHOLDER_API_KEYS: SecurityApiKey[] = [
  {
    id: 'key_1',
    name: 'Storefront Webhooks',
    prefix: 'cs_live_a8f3',
    createdAt: '2026-03-12',
    lastUsedAt: '2026-06-17',
    scopes: ['orders.read', 'products.read'],
  },
  {
    id: 'key_2',
    name: 'Mobile App',
    prefix: 'cs_live_b2c9',
    createdAt: '2026-01-08',
    lastUsedAt: null,
    scopes: ['catalogue.read'],
  },
];

export const PLACEHOLDER_DEVICES: SecurityDevice[] = [
  {
    id: 'dev_1',
    name: 'MacBook Pro',
    browser: 'Chrome 137',
    location: 'Mumbai, IN',
    lastActive: 'Active now',
    current: true,
  },
  {
    id: 'dev_2',
    name: 'iPhone 15',
    browser: 'Safari Mobile',
    location: 'Mumbai, IN',
    lastActive: '2 hours ago',
    current: false,
  },
  {
    id: 'dev_3',
    name: 'Windows PC',
    browser: 'Edge 136',
    location: 'Delhi, IN',
    lastActive: '3 days ago',
    current: false,
  },
];

export const PLACEHOLDER_SESSIONS: SecuritySession[] = [
  {
    id: 'sess_1',
    device: 'MacBook Pro · Chrome',
    ipAddress: '103.**.**.42',
    startedAt: '2026-06-18 09:14',
    expiresAt: '2026-06-25',
    current: true,
  },
  {
    id: 'sess_2',
    device: 'iPhone 15 · Safari',
    ipAddress: '103.**.**.88',
    startedAt: '2026-06-17 18:30',
    expiresAt: '2026-06-24',
    current: false,
  },
];

export const PLACEHOLDER_ACTIVITY_LOGS: SecurityActivityLog[] = [
  {
    id: 'log_1',
    timestamp: '2026-06-18 10:22',
    action: 'Signed in',
    actor: 'you@store.com',
    ipAddress: '103.**.**.42',
    status: 'success',
  },
  {
    id: 'log_2',
    timestamp: '2026-06-18 09:05',
    action: 'Updated checkout settings',
    actor: 'you@store.com',
    ipAddress: '103.**.**.42',
    status: 'success',
  },
  {
    id: 'log_3',
    timestamp: '2026-06-17 21:40',
    action: 'Failed login attempt',
    actor: 'unknown',
    ipAddress: '185.**.**.11',
    status: 'failed',
  },
  {
    id: 'log_4',
    timestamp: '2026-06-17 14:15',
    action: 'Connected Razorpay',
    actor: 'you@store.com',
    ipAddress: '103.**.**.42',
    status: 'success',
  },
  {
    id: 'log_5',
    timestamp: '2026-06-16 11:00',
    action: 'API key created',
    actor: 'you@store.com',
    ipAddress: '103.**.**.42',
    status: 'warning',
  },
];

export const PLACEHOLDER_PERMISSIONS: SecurityPermission[] = [
  {
    id: 'manage_store',
    label: 'Manage store settings',
    description: 'Edit catalogue, checkout, and storefront configuration.',
    owner: true,
    admin: true,
    staff: false,
  },
  {
    id: 'manage_orders',
    label: 'Manage orders',
    description: 'View, fulfill, and refund customer orders.',
    owner: true,
    admin: true,
    staff: true,
  },
  {
    id: 'manage_products',
    label: 'Manage products',
    description: 'Add, edit, and remove catalogue products.',
    owner: true,
    admin: true,
    staff: true,
  },
  {
    id: 'manage_payments',
    label: 'Manage payments',
    description: 'Connect gateways and view payout settings.',
    owner: true,
    admin: false,
    staff: false,
  },
  {
    id: 'manage_team',
    label: 'Manage team members',
    description: 'Invite staff and assign roles.',
    owner: true,
    admin: false,
    staff: false,
    comingSoon: true,
  },
  {
    id: 'danger_zone',
    label: 'Danger zone actions',
    description: 'Archive, export, transfer, or delete the store.',
    owner: true,
    admin: false,
    staff: false,
    comingSoon: true,
  },
];

export const SECURITY_COUNTRY_OPTIONS = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'ZA', name: 'South Africa' },
];
