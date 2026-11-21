import { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCalendar, FiClock, FiExternalLink, FiPackage, FiShoppingBag } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { getSellerStore } from '../../services/storeService';
import { fetchSellerOrders, type Order } from '../../services/orderService';
import { fetchSellerCatalogue } from '../../services/sellerCatalogueService';
import { buildStorefrontPublicUrl } from '../../utils/storefrontDomain';
import type { Store } from '../../services/storeService';
import {
  readCachedSellerOrders,
  readCachedSellerStore,
  writeCachedSellerOrders,
} from '../../utils/storePageCache';
import { readProductsWithLegacyFallback } from '../../utils/safeStorage';
import { getOrderStatusLabel } from '../../types/orderStatus';
import StoreLayout from './components/StoreLayout';
import StoreHeader from './components/StoreHeader';
import NavigationCard from './components/NavigationCard';
import StoreIconTile from './components/StoreIconTile';
import CreateStoreForm from './components/CreateStoreForm';
import { STORE_NAVIGATION } from './config/storeNavigation';
import { STORE_CATEGORY_TITLE } from './storeTypography';

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

function getRecentOrders(orders: Order[]): Order[] {
  return [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
}

function formatOrderDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatOrderAmount(order: Order): string {
  const amount = order.total_amount ?? 0;
  return `${currencySymbol(order.currency_code)}${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function orderStatusClass(status: string): string {
  if (status === 'completed') return 'is-completed';
  if (status === 'cancelled') return 'is-cancelled';
  if (status === 'shipped') return 'is-shipped';
  if (status === 'processing') return 'is-processing';
  return 'is-pending';
}

function applyDashboardMetrics(
  orders: ReturnType<typeof readCachedSellerOrders>,
  setOrdersToday: (n: number) => void,
  setRevenueToday: (n: number) => void,
  setPendingOrders: (n: number) => void,
  setCurrencyCode: (c: string) => void
) {
  const todayOrders = orders.filter((order) => isToday(order.created_at));
  const todayCompleted = todayOrders.filter((order) => order.status === 'completed');
  const todayRevenue = todayCompleted.reduce(
    (sum, order) => sum + (order.total_amount || 0),
    0
  );

  setOrdersToday(todayOrders.length);
  setRevenueToday(todayRevenue);
  setPendingOrders(orders.filter((order) => order.status === 'pending').length);
  setCurrencyCode(todayCompleted[0]?.currency_code || orders[0]?.currency_code || 'INR');
}

export default function StoreDashboard() {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useLayoutEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const uid = user.uid;
    const cachedStore = readCachedSellerStore(uid);
    if (cachedStore) {
      setStore(cachedStore);
      setShowCreateForm(false);
    } else {
      setShowCreateForm(true);
    }

    const cachedOrders = readCachedSellerOrders(uid);
    if (cachedOrders.length > 0) {
      applyDashboardMetrics(
        cachedOrders,
        setOrdersToday,
        setRevenueToday,
        setPendingOrders,
        setCurrencyCode
      );
      setRecentOrders(getRecentOrders(cachedOrders));
    }

    const cachedProducts = readProductsWithLegacyFallback(uid);
    if (cachedProducts.length > 0) {
      setProductCount(cachedProducts.length);
    }

    if (cachedStore || cachedOrders.length > 0 || cachedProducts.length > 0) {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const uid = user.uid;
      const hadCache =
        Boolean(readCachedSellerStore(uid)) ||
        readCachedSellerOrders(uid).length > 0 ||
        readProductsWithLegacyFallback(uid).length > 0;

      if (!hadCache) {
        setLoading(true);
      }

      try {
        const [storeResult, ordersResult, catalogueResult] = await Promise.all([
          getSellerStore(uid),
          fetchSellerOrders(uid),
          fetchSellerCatalogue(uid),
        ]);

        if (storeResult.success && storeResult.data) {
          setStore(storeResult.data);
          setShowCreateForm(false);
        } else {
          setShowCreateForm(true);
        }

        const products = catalogueResult.data?.products ?? readProductsWithLegacyFallback(uid);
        setProductCount(products.length);

        const orders = ordersResult.data ?? readCachedSellerOrders(uid);
        setRecentOrders(getRecentOrders(orders));
        writeCachedSellerOrders(uid, orders);
        applyDashboardMetrics(
          orders,
          setOrdersToday,
          setRevenueToday,
          setPendingOrders,
          setCurrencyCode
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
      { label: 'Products published', value: String(productCount), detail: 'In your catalogue', iconKey: 'products' as const },
      { label: 'Orders today', value: String(ordersToday), detail: 'Placed today', iconKey: 'orders' as const },
      {
        label: 'Revenue today',
        value: `${sym}${revenueToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        detail: 'From completed orders',
        iconKey: 'revenue' as const,
      },
      { label: 'Awaiting fulfillment', value: String(pendingOrders), detail: 'Pending orders', iconKey: 'pending' as const },
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

  if (showCreateForm) {
    return (
      <StoreLayout>
        <div className="py-6 sm:py-8 md:py-12 px-4 sm:px-6">
          <CreateStoreForm
            onStoreCreated={() => {
              setShowCreateForm(false);
              setLoading(true);
              const uid = user?.uid;
              if (uid) {
                getSellerStore(uid).then((result) => {
                  if (result.success && result.data) {
                    setStore(result.data);
                  }
                  setLoading(false);
                });
              }
            }}
          />
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

      <div className="store-dashboard__mobile-navigation space-y-8">
        {STORE_NAVIGATION.map((category) => (
          <section key={category.title}>
            <h2 className={`${STORE_CATEGORY_TITLE} mb-3`}>{category.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.cards.map((card) => (
                <NavigationCard
                  key={card.href}
                  title={card.title}
                  description={card.description}
                  icon={<StoreIconTile iconKey={card.iconKey} />}
                  href={card.href}
                  proOnly={card.proOnly}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="store-dashboard__overview">
        <div className="store-dashboard__overview-heading">
          <div>
            <p>STORE OVERVIEW</p>
            <h2>Your store at a glance</h2>
            <span>Keep track of today’s activity and recent customer orders.</span>
          </div>
          <Link to="/orders" className="store-dashboard__view-orders">
            All orders <FiArrowRight aria-hidden="true" />
          </Link>
        </div>

        <div className="store-dashboard__metrics">
          {metrics.map((metric) => (
            <article className="store-dashboard__metric" key={metric.label}>
              <StoreIconTile iconKey={metric.iconKey} size="sm" />
              <div className="store-dashboard__metric-copy">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </div>
            </article>
          ))}
        </div>

        <section className="store-dashboard__recent-orders">
          <div className="store-dashboard__section-heading">
            <div>
              <h2>Recent orders</h2>
              <p>The latest activity from your customers</p>
            </div>
            <Link to="/orders" aria-label="View all orders">View all <FiArrowRight aria-hidden="true" /></Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="store-dashboard__order-list">
              {recentOrders.map((order) => (
                <Link className="store-dashboard__order-row" to={`/orders/${order.id}`} key={order.id}>
                  <span className="store-dashboard__order-icon"><FiShoppingBag aria-hidden="true" /></span>
                  <span className="store-dashboard__order-customer">
                    <strong>{order.customer_name || 'Customer'}</strong>
                    <small><FiCalendar aria-hidden="true" /> {formatOrderDate(order.created_at)} <span>·</span> {order.items.length} item{order.items.length === 1 ? '' : 's'}</small>
                  </span>
                  <span className={`store-dashboard__order-status ${orderStatusClass(order.status)}`}>
                    <FiClock aria-hidden="true" /> {getOrderStatusLabel(order.status)}
                  </span>
                  <strong className="store-dashboard__order-total">{formatOrderAmount(order)}</strong>
                  <FiExternalLink className="store-dashboard__order-open" aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="store-dashboard__empty-orders">
              <span><FiPackage aria-hidden="true" /></span>
              <strong>No orders yet</strong>
              <p>When customers place orders, they’ll appear here.</p>
            </div>
          )}
        </section>
      </div>
    </StoreLayout>
  );
}
