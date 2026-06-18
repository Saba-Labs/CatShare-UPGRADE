import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function DangerZone() {
  return (
    <StoreLayout>
      <PageHeader
        title="Danger Zone"
        description="Advanced actions and destructive operations"
      />

      <SettingsCard
        title="Danger Zone"
        description="Irreversible actions - use with caution"
        className="max-w-2xl"
      >
        <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
