import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function CustomDomain() {
  return (
    <StoreLayout>
      <PageHeader
        title="Custom Domain"
        description="Connect your own domain to your store"
      />

      <SettingsCard
        title="Domain Configuration"
        description="Set up a custom domain for your store"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
