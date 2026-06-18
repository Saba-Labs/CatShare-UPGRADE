import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Security() {
  return (
    <StoreLayout>
      <PageHeader
        title="Security"
        description="Manage access and security settings"
      />

      <SettingsCard
        title="Security Settings"
        description="Configure security and access controls"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
