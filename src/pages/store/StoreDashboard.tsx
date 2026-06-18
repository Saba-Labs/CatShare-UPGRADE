import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSellerStore } from '../../services/storeService';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import NavigationCard from './components/NavigationCard';
import SettingsCard from './components/SettingsCard';
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
} from 'react-icons/fi';

export default function StoreDashboard() {
  const { user } = useAuth();
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
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </StoreLayout>
    );
  }

  const navigationSections = [
    {
      title: 'Core Settings',
      cards: [
        {
          title: 'Store Settings',
          description: 'Manage store name, slug, and basic info',
          icon: <FiSettings className="h-6 w-6" />,
          href: '/store/settings',
        },
        {
          title: 'Business Profile',
          description: 'Add logo, hours, contact info',
          icon: <FiUser className="h-6 w-6" />,
          href: '/store/business',
        },
      ],
    },
    {
      title: 'Store Experience',
      cards: [
        {
          title: 'Homepage Builder',
          description: 'Design your store homepage',
          icon: <FiHome className="h-6 w-6" />,
          href: '/store/homepage',
        },
        {
          title: 'Checkout Settings',
          description: 'Configure checkout flow',
          icon: <FiShoppingCart className="h-6 w-6" />,
          href: '/store/checkout',
        },
      ],
    },
    {
      title: 'Operations',
      cards: [
        {
          title: 'Payments',
          description: 'Set up payment gateways',
          icon: <FiCreditCard className="h-6 w-6" />,
          href: '/store/payments',
        },
        {
          title: 'Shipping',
          description: 'Configure shipping methods',
          icon: <FiTruck className="h-6 w-6" />,
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
          icon: <FiGlobe className="h-6 w-6" />,
          href: '/store/domain',
        },
        {
          title: 'Analytics',
          description: 'View sales and customer insights',
          icon: <FiBarChart2 className="h-6 w-6" />,
          href: '/store/analytics',
        },
        {
          title: 'Marketing',
          description: 'Promote your store',
          icon: <FiTrendingUp className="h-6 w-6" />,
          href: '/store/marketing',
        },
        {
          title: 'Integrations',
          description: 'Connect third-party services',
          icon: <FiCode className="h-6 w-6" />,
          href: '/store/integrations',
        },
      ],
    },
    {
      title: 'Security & Maintenance',
      cards: [
        {
          title: 'Security',
          description: 'Manage access and security',
          icon: <FiLock className="h-6 w-6" />,
          href: '/store/security',
        },
        {
          title: 'Danger Zone',
          description: 'Advanced actions and deletions',
          icon: <FiAlertTriangle className="h-6 w-6" />,
          href: '/store/danger',
        },
      ],
    },
  ];

  return (
    <StoreLayout>
      <PageHeader
        title="My Store"
        description="Manage all aspects of your store"
        showBackButton={false}
      />

      {store && (
        <div className="mb-8">
          <SettingsCard
            title="Store Status"
            description={`Store: ${store.live ? '🟢 Live' : '🔴 Offline'}`}
          >
            <div className="text-sm text-gray-600">
              <p>URL: {store.slug || 'Not configured'}</p>
            </div>
          </SettingsCard>
        </div>
      )}

      <div className="space-y-8">
        {navigationSections.map((section, index) => (
          <div key={index}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.cards.map((card, cardIndex) => (
                <NavigationCard
                  key={cardIndex}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  href={card.href}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </StoreLayout>
  );
}
