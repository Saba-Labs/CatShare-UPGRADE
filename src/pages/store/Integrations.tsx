import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Integrations() {
  return (
    <StoreLayout>
      <PageHeader
        title="Integrations"
        description="Connect third-party services and tools"
      />

      <SettingsCard
        title="Third-party Integrations"
        description="Manage and configure integrations"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
