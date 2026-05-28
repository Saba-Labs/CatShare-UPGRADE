import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useState } from 'react';
import { getSellerStore, type Store } from '../services/storeService';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import HomepageBuilder from '../components/HomepageBuilder/HomepageBuilder';

const STORE_FETCH_TIMEOUT_MS = 14_000;
const sellerStoreCacheKey = (uid: string) => getStorageKey('sellerStore', uid);

export default function HomepageEditorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStore = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const cacheKey = sellerStoreCacheKey(user.uid);
        const cached = safeGetFromStorage<Store | null>(cacheKey, null);

        // Try to fetch with timeout
        type StoreResult = Awaited<ReturnType<typeof getSellerStore>>;
        const result = await Promise.race<StoreResult>([
          getSellerStore(user.uid),
          new Promise<StoreResult>((resolve) =>
            setTimeout(() => resolve({ success: false, error: 'Store fetch timed out' }), STORE_FETCH_TIMEOUT_MS)
          ),
        ]);

        if (cancelled) return;

        if (result.success && result.data) {
          setStore(result.data);
        } else {
          // Fall back to cached data if available
          const fallback = cached ?? null;
          if (fallback) {
            setStore(fallback);
            showToast('Using cached store settings', 'info');
          } else {
            showToast('Store not found. Please create a store first.', 'error');
            navigate('/store');
          }
        }
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : 'Failed to load store';
        console.error('Error loading store:', error);

        // Try fallback cache
        const cacheKey = sellerStoreCacheKey(user?.uid || '');
        const cached = safeGetFromStorage<Store | null>(cacheKey, null);
        if (cached) {
          setStore(cached);
          showToast('Using cached store. Please check your connection.', 'warning');
        } else {
          showToast(msg, 'error');
          navigate('/store');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadStore();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, navigate, showToast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>Loading...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!store) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px 0' }}>Unable to Load Store</h2>
          <p style={{ margin: '0 0 24px 0', color: '#666' }}>There was an error loading your store. Please try refreshing the page or go back to the store page.</p>
          <button
            onClick={() => navigate('/store')}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Go Back to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <HomepageBuilder
      storeId={store.id}
      storeSlug={store.storeSlug}
      onClose={() => navigate('/store')}
    />
  );
}
