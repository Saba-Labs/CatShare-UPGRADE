import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Shipping() {
  return (
    <StoreLayout>
      <PageHeader
        title="Shipping"
        description="Configure shipping methods and preferences"
      />

      <SettingsCard
        title="Shipping Configuration"
        description="Set up shipping rules and methods"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
