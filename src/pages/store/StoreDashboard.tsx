import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSellerStore } from '../../services/storeService';
import { fetchSellerOrders } from '../../services/orderService';
import { fetchSellerCatalogue } from '../../services/sellerCatalogueService';
import { buildStorefrontPublicUrl } from '../../utils/storefrontDomain';
import type { Store } from '../../services/storeService';
import StoreLayout from './components/StoreLayout';
import StoreHeader from './components/StoreHeader';
import NavigationCard from './components/NavigationCard';
import StoreIconTile from './components/StoreIconTile';
import { STORE_NAVIGATION } from './config/storeNavigation';

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function currencySymbol(code?: string): string {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return '₹';
}

export default function StoreDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [storeResult, ordersResult, catalogueResult] = await Promise.all([
          getSellerStore(user.uid),
          fetchSellerOrders(user.uid),
          fetchSellerCatalogue(user.uid),
        ]);

        if (storeResult.success && storeResult.data) {
          setStore(storeResult.data);
        }

        const products = catalogueResult.data?.products ?? [];
        setProductCount(products.length);

        const orders = ordersResult.data ?? [];
        const todayOrders = orders.filter((order) => isToday(order.created_at));
        const todayCompleted = todayOrders.filter((order) => order.status === 'completed');
        const todayRevenue = todayCompleted.reduce(
          (sum, order) => sum + (order.total_amount || 0),
          0
        );

        setOrdersToday(todayOrders.length);
        setRevenueToday(todayRevenue);
        setPendingOrders(orders.filter((order) => order.status === 'pending').length);
        setCurrencyCode(
          todayCompleted[0]?.currency_code || orders[0]?.currency_code || 'INR'
        );
      } catch (error) {
        console.error('Failed to load store dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.uid]);

  const storeUrl = store?.storeSlug
    ? buildStorefrontPublicUrl(store.storeSlug, {
        hostname: store.customHostname,
        status: store.customDomainStatus,
      })
    : undefined;
  const sym = currencySymbol(currencyCode);

  const metrics = useMemo(
    () => [
      { label: 'Products Published', value: String(productCount), iconKey: 'products' as const },
      { label: 'Orders Today', value: String(ordersToday), iconKey: 'orders' as const },
      {
        label: 'Revenue Today',
        value: `${sym}${revenueToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        iconKey: 'revenue' as const,
      },
      { label: 'Pending Orders', value: String(pendingOrders), iconKey: 'pending' as const },
    ],
    [productCount, ordersToday, revenueToday, pendingOrders, sym]
  );

  if (loading) {
    return (
      <StoreLayout>
        <div className="space-y-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-40 bg-gray-200 dark:bg-gray-800 rounded"></div>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
          <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout storeUrl={storeUrl}>
      <StoreHeader
        storeName={store?.storeSlug ? store.storeSlug : 'My Store'}
        storeUrl={storeUrl}
        isLive={store?.isLive ?? false}
      />

      <div className="space-y-10">
        {STORE_NAVIGATION.map((category) => (
          <section key={category.title}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.cards.map((card) => (
                <NavigationCard
                  key={card.href}
                  title={card.title}
                  description={card.description}
                  icon={<StoreIconTile iconKey={card.iconKey} />}
                  href={card.href}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="h-20 md:h-0"></div>
    </StoreLayout>
  );
}
