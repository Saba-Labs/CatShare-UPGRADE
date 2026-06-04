import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useMemo, useState } from 'react';
import { getSellerStore, type Store } from '../services/storeService';
import { ensureCataloguesForStorefront, getAllCatalogues } from '../config/catalogueConfig';
import { isOfflineBuilderMode } from '../config/offlineBuilder';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import { getPersistedAuthUserId } from '../utils/authUserId';
import HomepageBuilder from '../components/HomepageBuilder/HomepageBuilder';

const STORE_FETCH_TIMEOUT_MS = isOfflineBuilderMode() ? 1_500 : 6_000;
const sellerStoreCacheKey = (uid: string) => getStorageKey('sellerStore', uid);

/** Minimal local store so the editor can open without a Supabase round-trip. */
function buildLocalFallbackStore(uid: string): Store {
  return {
    id: `local-${uid}`,
    sellerUserId: uid,
    storeSlug: 'preview',
    catalogueId: '',
    createdAt: new Date().toISOString(),
    isLive: false,
    storeWhatsapp: null,
    minimumOrderValue: null,
    viewMode: 'grid',
    homepageEnabled: true,
    websiteModeEnabled: true,
    customHostname: null,
    customDomainStatus: null,
  };
}

export default function HomepageEditorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveUid = user?.uid ?? getPersistedAuthUserId() ?? null;

  const catalogues = useMemo(
    () =>
      store && effectiveUid
        ? ensureCataloguesForStorefront(getAllCatalogues(effectiveUid), store.catalogueId)
        : [],
    [effectiveUid, store]
  );

  useEffect(() => {
    let cancelled = false;

    const loadStore = async () => {
      if (!effectiveUid) {
        setLoading(false);
        return;
      }

      const cacheKey = sellerStoreCacheKey(effectiveUid);
      const cached = safeGetFromStorage<Store | null>(cacheKey, null);

      if (isOfflineBuilderMode()) {
        setStore(cached ?? buildLocalFallbackStore(effectiveUid));
        setLoading(false);
        if (!cached) {
          showToast('Website builder is offline — layouts save on this device', 'warning');
        }
        return;
      }

      if (cached) {
        setStore(cached);
        setLoading(false);
        getSellerStore(effectiveUid)
          .then((result) => {
            if (!cancelled && result.success && result.data) setStore(result.data);
          })
          .catch(() => {/* offline: keep cached store */});
        return;
      }

      try {
        setLoading(true);
        type StoreResult = Awaited<ReturnType<typeof getSellerStore>>;
        const result = await Promise.race<StoreResult>([
          getSellerStore(effectiveUid),
          new Promise<StoreResult>((resolve) =>
            setTimeout(() => resolve({ success: false, error: 'Store fetch timed out' }), STORE_FETCH_TIMEOUT_MS)
          ),
        ]);

        if (cancelled) return;

        if (result.success && result.data) {
          setStore(result.data);
        } else {
          setStore(buildLocalFallbackStore(effectiveUid));
          showToast('Editing offline — changes are saved locally', 'warning');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading store:', error);
        setStore(buildLocalFallbackStore(effectiveUid));
        showToast('Editing offline — changes are saved locally', 'warning');
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
  }, [effectiveUid, showToast]);

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

  if (!effectiveUid) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 style={{ margin: '0 0 8px' }}>Sign in to edit your website</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Or open the app once while online so your account is cached on this device.
          </p>
          <button type="button" onClick={() => navigate('/login')} style={{ padding: '10px 20px', marginRight: 8 }}>
            Log in
          </button>
          <button type="button" onClick={() => navigate('/store')}>
            Back
          </button>
        </div>
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
      sellerUserId={store.sellerUserId || effectiveUid}
      catalogues={catalogues}
      catalogueId={store.catalogueId}
      storeWhatsapp={store.storeWhatsapp}
      onClose={() => navigate('/store')}
    />
  );
}
