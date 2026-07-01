import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchSellerOrders } from '../../services/orderService';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { readCachedSellerOrders, writeCachedSellerOrders } from '../../utils/storePageCache';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import AnalyticsMetricCard from './components/AnalyticsMetricCard';
import AnalyticsDateFilter from './components/AnalyticsDateFilter';
import AnalyticsSalesChart from './components/AnalyticsSalesChart';
import AnalyticsBreakdownList from './components/AnalyticsBreakdownList';
import type { AnalyticsDateRange } from './types/analytics';
import {
  computeAnalyticsFromOrders,
  hasAnalyticsData,
} from './utils/storeAnalytics';

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('month');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchSellerOrders>>['data']>([]);

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedSellerOrders(sellerId);
    if (cached.length > 0) {
      setOrders(cached);
      setLoading(false);
    }
  }, [sellerId]);

  const loadOrders = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const cached = readCachedSellerOrders(sellerId);
    if (cached.length === 0) {
      setLoading(true);
    }

    const result = await fetchSellerOrders(sellerId);
    const list = result.data ?? [];
    setOrders(list);
    if (list.length > 0) {
      writeCachedSellerOrders(sellerId, list);
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadOrders();
  }, [authLoading, sellerId, loadOrders]);

  const data = useMemo(
    () => computeAnalyticsFromOrders(orders ?? [], dateRange),
    [orders, dateRange]
  );

  const hasData = hasAnalyticsData(data);
  const { metrics } = data;

  const salesMetrics = [
    metrics.totalOrders,
    metrics.completedOrders,
    metrics.revenue,
    metrics.averageOrderValue,
  ];

  const customerMetrics = [
    metrics.itemsSold,
    metrics.uniqueCustomers,
    metrics.returningCustomers,
    metrics.shippedOrders,
  ];

  const pipelineMetrics = [metrics.activePipeline, metrics.cancelledOrders];

  return (
    <StoreLayout>
      <div className="max-w-6xl pb-8">
        <PageHeader
          title="Analytics"
          actions={(
            <div className="hidden sm:block">
              <AnalyticsDateFilter
                value={dateRange}
                onChange={setDateRange}
                disabled={loading}
              />
            </div>
          )}
        />

        <div className="mb-4 sm:hidden overflow-x-auto">
          <AnalyticsDateFilter
            value={dateRange}
            onChange={setDateRange}
            disabled={loading}
          />
        </div>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Showing data for{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">{data.rangeLabel}</span>
        </p>

        {!loading && !hasData ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              No analytics data yet
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Once you start receiving orders, sales metrics, product performance, and charts will
              appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Sales
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {salesMetrics.map((metric) => (
                  <AnalyticsMetricCard key={metric.id} metric={metric} loading={loading} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Customers & fulfillment
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {customerMetrics.map((metric) => (
                  <AnalyticsMetricCard key={metric.id} metric={metric} loading={loading} />
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pipelineMetrics.map((metric) => (
                <AnalyticsMetricCard key={metric.id} metric={metric} loading={loading} />
              ))}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {loading ? (
                  <div className="h-64 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ) : (
                  <AnalyticsSalesChart
                    rangeLabel={data.rangeLabel}
                    bars={data.chartBars}
                    labels={data.chartLabels}
                    empty={!hasData}
                  />
                )}
              </div>

              <AnalyticsBreakdownList
                title="Order status"
                rows={data.orderStatusBreakdown}
                loading={loading}
              />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnalyticsBreakdownList
                title="Order sources"
                rows={data.orderSourceBreakdown}
                loading={loading}
              />
              <AnalyticsBreakdownList
                title="Payment methods"
                rows={data.paymentMethodBreakdown}
                loading={loading}
              />
            </section>

            {data.popularProducts.length > 0 ? (
              <section>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Top products
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800">
                          <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Product
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Qty sold
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Revenue
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {data.popularProducts.map((product, index) => (
                          <tr key={product.id}>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-300">
                                  {index + 1}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {product.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-right text-gray-700 dark:text-gray-300">
                              {product.orders}
                            </td>
                            <td className="py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                              {product.revenue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
