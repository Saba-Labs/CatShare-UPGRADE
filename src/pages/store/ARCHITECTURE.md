# Store Module Architecture

## Overview

The Store module has been restructured into a modular, scalable merchant dashboard following the pattern of Shopify, iOS Settings, and modern SaaS applications.

## Directory Structure

```
src/pages/store/
├── components/
│   ├── PageHeader.tsx           # Consistent header with back button
│   ├── StoreLayout.tsx          # Main wrapper layout
│   ├── SettingsCard.tsx         # Card component for grouped settings
│   ├── SectionCard.tsx          # Versatile section component
│   └── NavigationCard.tsx       # Navigation button to other pages
├── StoreDashboard.tsx           # Dashboard landing page
├── StoreSettings.tsx            # Store name, slug, basic info
├── BusinessProfile.tsx          # Logo, hours, contact info
├── Payments.tsx                 # Payment gateway configuration
├── Shipping.tsx                 # Shipping methods & rules
├── Checkout.tsx                 # Checkout flow & taxes
├── CustomDomain.tsx             # Domain connection
├── Analytics.tsx                # Sales & metrics
├── Marketing.tsx                # Promotional tools
├── Integrations.tsx             # Third-party services
├── Security.tsx                 # Access & security
├── DangerZone.tsx               # Destructive actions
├── index.ts                     # Module exports
└── ARCHITECTURE.md              # This file
```

## Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/store` | StoreDashboard | Landing page with quick actions |
| `/store/settings` | StoreSettings | Basic store configuration |
| `/store/business` | BusinessProfile | Business information |
| `/store/payments` | Payments | Payment setup |
| `/store/shipping` | Shipping | Shipping configuration |
| `/store/checkout` | Checkout | Checkout settings |
| `/store/domain` | CustomDomain | Custom domain setup |
| `/store/analytics` | Analytics | Sales analytics |
| `/store/marketing` | Marketing | Marketing tools |
| `/store/integrations` | Integrations | Third-party integrations |
| `/store/security` | Security | Security settings |
| `/store/danger` | DangerZone | Destructive actions |

## Layout Components

### StoreLayout
Wraps all store pages. Provides:
- Consistent container width & padding
- Bottom navigation via MainAppBottomNav
- White background

**Usage:**
```tsx
<StoreLayout>
  <PageHeader title="My Page" />
  {/* Page content */}
</StoreLayout>
```

### PageHeader
Displays page title with optional back button and description.

**Props:**
- `title` (string): Page title
- `description` (string, optional): Subtitle
- `showBackButton` (boolean, default: true)
- `backTo` (string, default: '/store'): Navigation target

**Usage:**
```tsx
<PageHeader
  title="Store Settings"
  description="Manage your store name and configuration"
  backTo="/store"
/>
```

### SettingsCard
Card for grouping related settings.

**Props:**
- `title` (string): Card title
- `description` (string, optional): Subtitle
- `children` (ReactNode): Content
- `className` (string, optional): Additional CSS classes

**Usage:**
```tsx
<SettingsCard title="Basic Info" description="Configure...">
  {/* Form fields or content */}
</SettingsCard>
```

### SectionCard
Flexible card for content with optional icon and subtitle.

**Props:**
- `title` (string, optional): Card title
- `subtitle` (string, optional): Subtitle
- `icon` (ReactNode, optional): Icon element
- `children` (ReactNode): Content
- `className` (string, optional): Additional CSS classes

**Usage:**
```tsx
<SectionCard title="Features" icon={<FiFeather />}>
  {/* Content */}
</SectionCard>
```

### NavigationCard
Interactive card that navigates to another page.

**Props:**
- `title` (string): Card title
- `description` (string, optional): Subtitle
- `icon` (ReactNode, optional): Icon element
- `href` (string): Route to navigate to
- `className` (string, optional): Additional CSS classes

**Usage:**
```tsx
<NavigationCard
  title="Payments"
  description="Set up payment gateways"
  icon={<FiCreditCard />}
  href="/store/payments"
/>
```

## Extending the Store Module

### Adding a New Settings Page

1. Create a new file in `src/pages/store/NewFeature.tsx`:

```tsx
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function NewFeature() {
  return (
    <StoreLayout>
      <PageHeader
        title="Feature Name"
        description="Feature description"
      />

      <SettingsCard title="Settings">
        {/* Your content here */}
      </SettingsCard>
    </StoreLayout>
  );
}
```

2. Export from `src/pages/store/index.ts`:

```ts
export { default as NewFeature } from './NewFeature';
```

3. Add lazy import in `src/App.tsx`:

```tsx
const NewFeature = lazy(() => import("./pages/store/NewFeature"));
```

4. Add route in `src/App.tsx`:

```tsx
<Route
  path="/store/new-feature"
  element={
    <ProtectedRoute>
      <NewFeature />
    </ProtectedRoute>
  }
/>
```

5. Add to Dashboard navigation in `StoreDashboard.tsx`:

```tsx
{
  title: "Feature Name",
  description: "Feature description",
  icon: <FiIcon className="h-6 w-6" />,
  href: "/store/new-feature",
}
```

## Implementation Status

All pages currently contain placeholder content. The following pages have existing implementations that should be preserved and integrated:

- `/store/homepage` - HomepageEditorPage (preserved)
- `/store/custom-domain` - StoreCustomDomain (preserved)
- `/store/checkout-settings` - StoreCheckoutSettingsPage (preserved)
- `/store/integrations/razorpay` - RazorpayIntegrationPage (preserved)
- `/store/integrations/shiprocket` - ShiprocketIntegrationPage (preserved)

The legacy `/store` route is preserved as `/store-legacy` for backwards compatibility.

## Design Principles

1. **Mobile-first**: All components are responsive and work well on mobile
2. **Modular**: Each page is independent and can be developed/updated separately
3. **Consistent**: Shared components ensure visual and interaction consistency
4. **Extensible**: Easy to add new pages and features
5. **Accessible**: Proper semantic HTML and ARIA attributes
6. **Performance**: Lazy-loaded routes reduce initial bundle size

## Next Steps

1. Integrate existing Store functionality into dedicated pages
2. Implement form inputs and settings handlers
3. Add validation and error handling
4. Implement analytics dashboard
5. Add integration management UI
6. Build business profile editor
7. Implement security settings
8. Create danger zone confirmations
