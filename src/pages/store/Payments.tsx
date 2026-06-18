import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Payments() {
  return (
    <StoreLayout>
      <PageHeader
        title="Payments"
        description="Set up and manage payment gateways"
      />

      <SettingsCard
        title="Payment Configuration"
        description="Configure payment methods and gateways"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
