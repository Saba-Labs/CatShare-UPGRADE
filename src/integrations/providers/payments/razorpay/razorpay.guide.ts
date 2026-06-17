import type { IntegrationGuideStep, IntegrationSecurityNote } from '../../../core/types';

export const RAZORPAY_GUIDE_STEPS: IntegrationGuideStep[] = [
  {
    step: 1,
    title: 'Create a Razorpay account and complete KYC.',
  },
  {
    step: 2,
    title: 'Enable payment methods and bank settlement in Razorpay Dashboard.',
  },
  {
    step: 3,
    title: 'Switch to Test Mode, then go to Settings > API Keys and generate Test Key ID + Secret.',
  },
  {
    step: 4,
    title: 'Keep Key Secret safe (you may not be able to view it again).',
  },
  {
    step: 5,
    title: 'Return to CatShare and paste Key ID + Key Secret below.',
  },
  {
    step: 6,
    title: 'Click Connect Razorpay.',
  },
];

export const RAZORPAY_SECURITY_NOTE: IntegrationSecurityNote = {
  title: 'How payments work',
  points: [
    'Payments will be collected directly into your Razorpay account.',
    'CatShare never stores your Razorpay dashboard password.',
    'API credentials are encrypted before storage on the server.',
  ],
};
