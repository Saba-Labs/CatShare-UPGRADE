const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const billingSourcePath = path.join(
  root,
  'node_modules/capacitor-billing/android/src/main/java/de/carstenklaffke/billing/BillingPlugin.java'
);
const billingDefinitionsPath = path.join(
  root,
  'node_modules/capacitor-billing/dist/esm/definitions.d.ts'
);

const billingPatchAlreadyApplied =
  fs.existsSync(billingSourcePath) &&
  fs.existsSync(billingDefinitionsPath) &&
  fs.readFileSync(billingSourcePath, 'utf8').includes('pickSubscriptionOffer') &&
  fs.readFileSync(billingSourcePath, 'utf8').includes('PendingPurchasesParams') &&
  fs.readFileSync(billingDefinitionsPath, 'utf8').includes('basePlanId?: string');

if (!billingPatchAlreadyApplied) {
  try {
    execFileSync(process.platform === 'win32' ? 'patch-package.cmd' : 'patch-package', [], {
      stdio: 'inherit',
    });
  } catch {
    console.warn('Skipping the optional capacitor-billing patch because it does not match the installed package.');
  }
}
