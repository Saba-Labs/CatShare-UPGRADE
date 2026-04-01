import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export default function Orders() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'pending' | 'completed'>('all');

  const handleTabChange = (newTab: 'all' | 'pending' | 'completed') => {
    setTab(newTab);
  };

  const handleBack = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
    navigate('/');
  };

  // Sample orders data
  const orders = [
    {
      id: '1',
      customerName: 'John Doe',
      status: 'pending',
      date: '2025-04-01',
      total: '$125.00',
    },
    {
      id: '2',
      customerName: 'Jane Smith',
      status: 'completed',
      date: '2025-03-31',
      total: '$89.50',
    },
    {
      id: '3',
      customerName: 'Bob Johnson',
      status: 'pending',
      date: '2025-03-30',
      total: '$245.00',
    },
    {
      id: '4',
      customerName: 'Alice Brown',
      status: 'completed',
      date: '2025-03-29',
      total: '$156.75',
    },
  ];

  const filteredOrders = tab === 'all' 
    ? orders 
    : orders.filter(order => order.status === tab);

  return (
    <div className="flex flex-col h-screen bg-white pb-[env(safe-area-inset-bottom,0px)]">
      {/* Header with back button */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition"
            aria-label="Go back"
          >
            <FiArrowLeft size={24} />
            <span className="text-sm font-medium">Back</span>
          </button>
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
      <main className="flex-1 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-500 font-medium">No {tab !== 'all' ? tab : ''} orders</p>
              <p className="text-gray-400 text-sm mt-1">Orders will appear here</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{order.customerName}</h3>
                    <p className="text-sm text-gray-500 mt-1">Order #{order.id}</p>
                    <p className="text-xs text-gray-400 mt-1">{order.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{order.total}</p>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full mt-2 inline-block ${
                        order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {order.status === 'pending' ? 'Pending' : 'Completed'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
