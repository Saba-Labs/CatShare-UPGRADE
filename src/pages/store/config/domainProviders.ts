export type DomainProviderId =
  | 'cloudflare'
  | 'godaddy'
  | 'hostinger'
  | 'namecheap'
  | 'vercel';

export interface DomainProviderGuide {
  id: DomainProviderId;
  name: string;
  description: string;
  available: boolean;
  steps: string[];
}

export const DOMAIN_PROVIDER_GUIDES: DomainProviderGuide[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'Add DNS records in the Cloudflare DNS dashboard.',
    available: true,
    steps: [
      'Open your domain in Cloudflare → DNS → Records.',
      'Add each record from the table (Type, Name, Value).',
      'Set Proxy status to DNS only (grey cloud) for verification records unless instructed otherwise.',
      'Save and wait a few minutes, then check status in CatShare.',
    ],
  },
  {
    id: 'godaddy',
    name: 'GoDaddy',
    description: 'Manage DNS through GoDaddy Domain Portfolio.',
    available: true,
    steps: [
      'Go to GoDaddy → My Products → DNS for your domain.',
      'Select Add under DNS Records.',
      'Enter Type, Name, and Value exactly as shown in CatShare.',
      'Save all records and return here to verify.',
    ],
  },
  {
    id: 'hostinger',
    name: 'Hostinger',
    description: 'Configure DNS from hPanel.',
    available: true,
    steps: [
      'Open hPanel → Domains → Manage → DNS / Nameservers.',
      'Add new DNS records matching Type, Host, and Points to.',
      'Remove conflicting old records if prompted.',
      'Check status after DNS propagation.',
    ],
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    description: 'Edit Advanced DNS in Namecheap.',
    available: true,
    steps: [
      'Domain List → Manage → Advanced DNS.',
      'Add records under Host Records.',
      'Use the exact host/name and value from CatShare.',
      'Save changes and verify here.',
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'If your domain is on Vercel, add records in the Domains tab.',
    available: true,
    steps: [
      'Project Settings → Domains → your domain → DNS Records.',
      'Add the records shown in CatShare.',
      'Vercel will provision SSL automatically once verified.',
      'Return here and tap Check Status.',
    ],
  },
];
