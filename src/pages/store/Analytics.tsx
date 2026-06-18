import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

export default function Analytics() {
  return (
    <StoreLayout>
      <PageHeader
        title="Analytics"
        description="View sales and customer insights"
      />

      <SettingsCard
        title="Analytics Dashboard"
        description="Track sales, orders, and customer metrics"
        className="max-w-2xl"
      >
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
          <p className="text-gray-700">Content will be implemented later.</p>
        </div>
      </SettingsCard>
    </StoreLayout>
  );
}
