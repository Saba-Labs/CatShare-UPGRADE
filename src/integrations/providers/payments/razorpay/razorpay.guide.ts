import type { IntegrationGuideStep, IntegrationSecurityNote } from '../../../core/types';

export const RAZORPAY_GUIDE_STEPS: IntegrationGuideStep[] = [
  {
    step: 1,
    title: 'Create a Razorpay account if you don\'t already have one.',
  },
  {
    step: 2,
    title: 'Complete KYC.',
  },
  {
    step: 3,
    title: 'Add your bank account.',
  },
  {
    step: 4,
    title: 'Wait until Razorpay activates your account.',
  },
  {
    step: 5,
    title: 'Return here.',
  },
  {
    step: 6,
    title: 'Click Connect Razorpay.',
  },
  {
    step: 7,
    title: 'Authorize CatShare.',
  },
];

export const RAZORPAY_SECURITY_NOTE: IntegrationSecurityNote = {
  title: 'How payments work',
  points: [
    'Payments will be collected directly into your Razorpay account.',
    'CatShare never stores your banking passwords.',
    'CatShare only stores the secure connection information needed to process payments.',
  ],
};
