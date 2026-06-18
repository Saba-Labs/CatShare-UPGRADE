import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSellerStore } from '../../services/storeService';
import StoreLayout from './components/StoreLayout';
import StoreHeader from './components/StoreHeader';
import StoreHealthCard from './components/StoreHealthCard';
import QuickActionButton from './components/QuickActionButton';
import NavigationCard from './components/NavigationCard';
import {
  FiSettings,
  FiUser,
  FiHome,
  FiCreditCard,
  FiTruck,
  FiShoppingCart,
  FiGlobe,
  FiBarChart2,
  FiTrendingUp,
  FiCode,
  FiLock,
  FiAlertTriangle,
  FiEye,
  FiPackage,
  FiShoppingBag,
} from 'react-icons/fi';

export default function StoreDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const loadStore = async () => {
      try {
        const storeData = await getSellerStore(user.uid);
        setStore(storeData);
      } catch (error) {
        console.error('Failed to load store:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [user?.uid]);

  if (loading) {
    return (
      <StoreLayout>
        <div className="space-y-8 py-8">
          {/* Header skeleton */}
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-40 bg-gray-200 rounded"></div>
            <div className="h-6 w-32 bg-gray-200 rounded"></div>
          </div>

          {/* Health card skeleton */}
          <div className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>

          {/* Quick actions skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </StoreLayout>
    );
  }

  // Generate store URL
  const storeUrl = store?.slug ? `catshare.app/${store.slug}` : null;

  // Prepare metrics
  const metrics = [
    { label: 'Products Published', value: '0', icon: '📦' },
    { label: 'Orders Today', value: '0', icon: '📋' },
    { label: 'Visitors Today', value: '0', icon: '👥' },
    { label: 'Revenue Today', value: '$0', icon: '💰' },
    { label: 'Pending Orders', value: '0', icon: '⏳' },
    { label: 'Conversion Rate', value: '0%', icon: '📈' },
  ];

  // Navigation categories
  const settingsCategories = [
    {
      title: 'Core Settings',
      cards: [
        {
          title: 'Store Settings',
          description: 'Manage store behaviour and visibility',
          icon: '🏬',
          href: '/store/settings',
        },
        {
          title: 'Business Profile',
          description: 'Business information and branding',
          icon: '👤',
          href: '/store/business',
        },
      ],
    },
    {
      title: 'Store Experience',
      cards: [
        {
          title: 'Homepage Builder',
          description: 'Design your storefront',
          icon: '🎨',
          href: '/store/homepage',
        },
        {
          title: 'Checkout',
          description: 'Customer checkout experience',
          icon: '🛒',
          href: '/store/checkout',
        },
      ],
    },
    {
      title: 'Operations',
      cards: [
        {
          title: 'Payments',
          description: 'Payment gateways and methods',
          icon: '💳',
          href: '/store/payments',
        },
        {
          title: 'Shipping',
          description: 'Shipping providers and delivery rules',
          icon: '🚚',
          href: '/store/shipping',
        },
      ],
    },
    {
      title: 'Growth & Integration',
      cards: [
        {
          title: 'Custom Domain',
          description: 'Connect your own domain',
          icon: '🌐',
          href: '/store/domain',
        },
        {
          title: 'Analytics',
          description: 'Sales and visitor insights',
          icon: '📊',
          href: '/store/analytics',
        },
        {
          title: 'Marketing',
          description: 'SEO, promotions and announcements',
          icon: '📣',
          href: '/store/marketing',
        },
        {
          title: 'Integrations',
          description: 'Third-party services',
          icon: '🔗',
          href: '/store/integrations',
        },
      ],
    },
    {
      title: 'Security & Maintenance',
      cards: [
        {
          title: 'Security',
          description: 'Store protection and permissions',
          icon: '🔐',
          href: '/store/security',
        },
        {
          title: 'Danger Zone',
          description: 'Archive or delete store',
          icon: '🗑',
          href: '/store/danger',
        },
      ],
    },
  ];

  return (
    <StoreLayout storeUrl={storeUrl}>
      {/* Header Section */}
      <StoreHeader
        storeName={store?.name || 'My Store'}
        storeUrl={storeUrl}
        isLive={store?.live || false}
      />

      {/* Store Health Card */}
      <StoreHealthCard metrics={metrics} isLoading={false} />

      {/* Quick Actions Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <QuickActionButton
            icon={<FiEye className="h-8 w-8" />}
            title="Preview Store"
            description="View as customer"
            onClick={() => storeUrl && window.open(`https://${storeUrl}`, '_blank')}
          />
          <QuickActionButton
            icon={<FiHome className="h-8 w-8" />}
            title="Edit Homepage"
            description="Design storefront"
            onClick={() => navigate('/store/homepage')}
          />
          <QuickActionButton
            icon={<FiPackage className="h-8 w-8" />}
            title="Manage Products"
            description="View & edit items"
            onClick={() => navigate('/')}
          />
          <QuickActionButton
            icon={<FiShoppingBag className="h-8 w-8" />}
            title="Orders"
            description="See all orders"
            onClick={() => navigate('/orders')}
          />
          <QuickActionButton
            icon={<FiShoppingCart className="h-8 w-8" />}
            title="Share Store"
            description="Share with customers"
            onClick={() => {
              if (storeUrl) {
                if (navigator.share) {
                  navigator.share({
                    title: store?.name || 'My Store',
                    text: 'Check out my store!',
                    url: `https://${storeUrl}`,
                  }).catch(() => {});
                }
              }
            }}
          />
        </div>
      </div>

      {/* Settings Categories */}
      <div className="space-y-10">
        {settingsCategories.map((category, sectionIdx) => (
          <section key={sectionIdx}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{category.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.cards.map((card, cardIdx) => (
                <NavigationCard
                  key={cardIdx}
                  title={card.title}
                  description={card.description}
                  icon={<span className="text-xl">{card.icon}</span>}
                  href={card.href}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Spacer for mobile sticky area */}
      <div className="h-20 md:h-0"></div>
    </StoreLayout>
  );
}
