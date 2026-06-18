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
import { DEFAULT_CHECKOUT_SETTINGS } from '../types/checkoutSettings';

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
    maintenanceMode: false,
    checkoutSettings: { ...DEFAULT_CHECKOUT_SETTINGS },
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
            Preparing homepage builder...
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveUid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Sign in to edit your website</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Or open the app once while online so your account is cached on this device.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="ml-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-gray-900 p-6 shadow-sm text-center">
          <div className="text-4xl mb-2" aria-hidden>⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Store</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">There was an error loading your store. Please try refreshing the page or go back to the store page.</p>
          <button
            onClick={() => navigate('/store')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
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
