import type { IntegrationGuideStep, IntegrationSecurityNote } from '../../../core/types';

export const SHIPROCKET_GUIDE_STEPS: IntegrationGuideStep[] = [
  {
    step: 1,
    title: 'Create a Shiprocket seller account at shiprocket.in.',
  },
  {
    step: 2,
    title: 'Add your warehouse / pickup address in the Shiprocket panel.',
  },
  {
    step: 3,
    title:
      'Go to Settings → API → Create API User (use a new email, not your login email).',
  },
  {
    step: 4,
    title: 'Enter that API user email and password below, then tap Connect.',
  },
  {
    step: 5,
    title:
      'On an order: Edit → add shipping address → Create AWB in Shiprocket from the Shipment section.',
  },
];

export const SHIPROCKET_SECURITY_NOTE: IntegrationSecurityNote = {
  title: 'Your credentials are safe',
  points: [
    'CatShare never stores your Shiprocket login password.',
    'Only the API user credentials are sent to our server to obtain a token from Shiprocket.',
    'Tokens are encrypted at rest; they are never shown in the app.',
  ],
};
