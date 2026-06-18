import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function StoreSettings() {
  return (
    <StoreLayout>
      <PageHeader
        title="Store Settings"
        description="Manage your store name, URL, and basic configuration"
      />

      <SettingsCard
        title="Store Settings"
        description="Configure your store's basic information"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
