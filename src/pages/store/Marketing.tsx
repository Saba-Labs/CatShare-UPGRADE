import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Marketing() {
  return (
    <StoreLayout>
      <PageHeader
        title="Marketing"
        description="Promote your store and reach customers"
      />

      <SettingsCard
        title="Marketing Tools"
        description="Access marketing features and campaigns"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
