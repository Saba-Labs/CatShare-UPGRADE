import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Checkout() {
  return (
    <StoreLayout>
      <PageHeader
        title="Checkout Settings"
        description="Configure your checkout flow and rules"
      />

      <SettingsCard
        title="Checkout Configuration"
        description="Set up taxes, coupons, and checkout rules"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
