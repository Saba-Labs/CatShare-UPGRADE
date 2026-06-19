import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import {
  getSellerStore,
  updateStoreCheckoutSettings,
  type Store,
} from '../services/storeService';
import { getPersistedAuthUserId } from '../utils/authUserId';
import { readCachedSellerStore } from '../utils/storePageCache';
import StoreCheckoutSettingsEditor, { emptyCheckoutSettings } from '../components/StoreCheckoutSettingsEditor';
import { normalizeCheckoutSettings, type StoreCheckoutSettings } from '../types/checkoutSettings';
import MainAppBottomNav from '../components/MainAppBottomNav';

const STORE_FETCH_TIMEOUT_MS = 12_000;

const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :where(.cs-root) *, :where(.cs-root) *::before, :where(.cs-root) *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: rgb(224, 238, 243);
    --card: #FFFFFF;
    --border: #E2E8F0;
    --text-primary: #0F172A;
    --text-secondary: #64748B;
    --text-muted: #94A3B8;
    --accent: #2563EB;
    --red: #C0392B;
    --red-bg: #FDF4F3;
    --shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04);
    --radius: 16px;
    --font: 'DM Sans', system-ui, sans-serif;
  }

  .cs-root {
    min-height: 100dvh;
    background: var(--bg);
    font-family: var(--font);
    display: flex;
    flex-direction: column;
    padding-top: 40px;
    padding-bottom: 72px;
  }

  .cs-status-bar {
    position: fixed;
    inset: 0 0 auto 0;
    height: 40px;
    background: #0F172A;
    z-index: 60;
  }

  .cs-header {
    position: sticky;
    top: 40px;
    z-index: 50;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 0 12px 0 8px;
    display: flex;
    align-items: center;
    height: 52px;
    border-bottom: 1px solid var(--border);
  }

  .cs-back {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .cs-back:hover { background: #f1f5f9; }

  .cs-title {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
  }

  .cs-header-spacer { width: 40px; flex-shrink: 0; }

  .cs-main {
    flex: 1;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 16px 16px 24px;
  }

  .cs-loader {
    display: flex;
    justify-content: center;
    padding: 48px 0;
  }
  .cs-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid #e2e8f0;
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: cs-spin 0.7s linear infinite;
  }
  @keyframes cs-spin { to { transform: rotate(360deg); } }

  .cs-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
  }

  .cs-lead {
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text-secondary);
    margin-bottom: 0;
  }

  .cs-error-box {
    background: var(--red-bg);
    border: 1px solid #f5c6c2;
    color: var(--red);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 13px;
    margin-bottom: 12px;
    line-height: 1.45;
  }

  .cs-editor-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 14px 16px;
    box-shadow: var(--shadow);
  }
`;

export default function StoreCheckoutSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const [store, setStore] = useState<Store | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [localError, setLocalError] = useState('');
  const [checkoutSettings, setCheckoutSettings] = useState<StoreCheckoutSettings>(emptyCheckoutSettings());
  const [saving, setSaving] = useState(false);

  const effectiveUid = useMemo(
    () => user?.uid ?? getPersistedAuthUserId() ?? null,
    [user?.uid]
  );

  useLayoutEffect(() => {
    if (!effectiveUid) return;
    const cached = readCachedSellerStore(effectiveUid);
    if (cached) {
      setStore(cached);
      setCheckoutSettings(normalizeCheckoutSettings(cached.checkoutSettings));
      setPageLoading(false);
    }
  }, [effectiveUid]);

  const loadPage = useCallback(async () => {
    if (!effectiveUid) {
      setPageLoading(false);
      return;
    }

    const cached = readCachedSellerStore(effectiveUid);
    if (!cached) {
      setPageLoading(true);
    }
    setLocalError('');
    try {
      const storeRes = await withTimeout(
        getSellerStore(effectiveUid),
        STORE_FETCH_TIMEOUT_MS,
        'Store load timed out. Check your connection and try again.'
      );
      if (!storeRes.success || !storeRes.data) {
        if (cached) {
          setStore(cached);
          setCheckoutSettings(normalizeCheckoutSettings(cached.checkoutSettings));
        } else {
          setLocalError(storeRes.error || 'Store not found');
          setStore(null);
        }
        return;
      }
      setStore(storeRes.data);
      setCheckoutSettings(normalizeCheckoutSettings(storeRes.data.checkoutSettings));
    } catch (e) {
      if (cached) {
        setStore(cached);
        setCheckoutSettings(normalizeCheckoutSettings(cached.checkoutSettings));
      } else {
        setLocalError(e instanceof Error ? e.message : 'Could not load store');
        setStore(null);
      }
    } finally {
      setPageLoading(false);
    }
  }, [effectiveUid]);

  useEffect(() => {
    if (authLoading && !effectiveUid) return;
    void loadPage();
  }, [authLoading, effectiveUid, loadPage]);

  const handleSave = async () => {
    if (!effectiveUid) return;
    if (!guardCloudWrite()) return;
    setSaving(true);
    const result = await updateStoreCheckoutSettings(effectiveUid, checkoutSettings);
    setSaving(false);
    if (result.success && result.data) {
      setStore(result.data);
      setCheckoutSettings(normalizeCheckoutSettings(result.data.checkoutSettings));
      showToast('Checkout settings saved', 'success');
    } else {
      showToast(result.error || 'Failed to save checkout settings', 'error');
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="cs-root">
        <div className="cs-status-bar" />
        <header className="cs-header">
          <button
            type="button"
            className="cs-back"
            aria-label="Back to My Store"
            onClick={() => navigate('/store')}
          >
            <IconBack />
          </button>
          <h1 className="cs-title">Checkout settings</h1>
          <div className="cs-header-spacer" aria-hidden />
        </header>

        <main className="cs-main">
          {authLoading && !effectiveUid ? (
            <div className="cs-loader">
              <div className="cs-spinner" />
            </div>
          ) : pageLoading ? (
            <div className="cs-loader">
              <div className="cs-spinner" />
            </div>
          ) : !effectiveUid ? (
            <div className="cs-card">
              <p className="cs-lead">Sign in to configure checkout settings for your store.</p>
            </div>
          ) : localError && !store ? (
            <div className="cs-error-box">{localError}</div>
          ) : (
            <>
              {localError ? <div className="cs-error-box">{localError}</div> : null}
              <div className="cs-card">
                <p className="cs-lead">
                  Set shipping charges, taxes, and discounts for your public storefront checkout.
                  Customers see these on the order summary before they place an order.
                </p>
              </div>
              <div className="cs-editor-card">
                <StoreCheckoutSettingsEditor
                  value={checkoutSettings}
                  onChange={setCheckoutSettings}
                  onSave={handleSave}
                  saving={saving}
                />
              </div>
            </>
          )}
        </main>

        <MainAppBottomNav active="store" />
      </div>
    </>
  );
}
