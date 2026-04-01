import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSellerOrders, type Order } from '../services/orderService';

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    loadOrders();
  }, [user?.uid]);

  const loadOrders = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);

    const { data, error } = await fetchSellerOrders(user.uid);

    if (error) {
      console.error('Error loading orders:', error);
      setError('Failed to load orders');
      showToast('Error loading orders', 'error');
    } else {
      setOrders(data || []);
    }

    setLoading(false);
  };

  const handleTabChange = (newTab: 'all' | 'pending' | 'completed') => {
    setTab(newTab);
  };

  const handleBack = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
    navigate('/');
  };

  const handleNavigate = async (path: string) => {
    await Haptics.impact({ style: ImpactStyle.Light });
    navigate(path);
  };

  const filteredOrders = tab === 'all'
    ? orders
    : orders.filter(order => order.status === tab);

  return (
    <div className="flex flex-col h-screen bg-white pb-[env(safe-area-inset-bottom,0px)]">
      {/* Status bar */}
      <div className="fixed inset-x-0 top-0 h-[40px] bg-black z-50" />

      {/* Header with back button */}
      <div className="sticky top-[40px] z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold text-gray-900">Orders</h1>
          <div className="w-12" />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          {['all', 'pending', 'completed'].map((tabName) => (
            <button
              key={tabName}
              onClick={async () => {
                await Haptics.impact({ style: ImpactStyle.Light });
                handleTabChange(tabName as 'all' | 'pending' | 'completed');
              }}
              className={`flex-1 py-3 text-center font-medium text-sm transition-all relative ${
                tab === tabName
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
              {tab === tabName && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="h-9 w-9 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-3">Loading orders...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={loadOrders}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-500 font-medium">No {tab !== 'all' ? tab : ''} orders</p>
              <p className="text-gray-400 text-sm mt-1">Orders will appear here when customers place them</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredOrders.map((order) => {
              const date = new Date(order.created_at).toLocaleDateString('en-IN');
              const currencySymbol = order.currency_code === 'USD' ? '$' :
                                    order.currency_code === 'EUR' ? '€' : '₹';
              const total = order.total_amount ? `${currencySymbol}${order.total_amount.toLocaleString('en-IN')}` : 'N/A';
              const itemCount = (order.items || []).length;

              return (
                <div
                  key={order.id}
                  className="p-4 hover:bg-gray-50 transition cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{order.customer_name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'} ordered
                      </p>
                      {order.items && order.items.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={idx}>
                              • {item.name} (Qty: {item.quantity})
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-gray-500">+{order.items.length - 2} more</div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">{date}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900">{total}</p>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full mt-2 inline-block ${
                          order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around text-sm font-medium pb-[env(safe-area-inset-bottom,0px)] bg-white border-t border-gray-200">
        <button
          onClick={() => handleNavigate('/')}
          className="flex-1 py-3.5 text-center transition-all bg-white text-gray-600 hover:bg-gray-50"
        >
          Products
        </button>
        <button
          onClick={() => handleNavigate('/catalogues')}
          className="flex-1 py-3.5 text-center transition-all bg-white text-gray-600 hover:bg-gray-50"
        >
          Catalogues
        </button>
        <button
          className="flex-1 py-3.5 text-center transition-all bg-blue-500 text-white"
        >
          Orders
        </button>
      </nav>
    </div>
  );
}
