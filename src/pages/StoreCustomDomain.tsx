import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSellerStore, type Store } from '../services/storeService';
import { getPersistedAuthUserId } from '../utils/authUserId';
import {
  connectCustomDomain,
  disconnectCustomDomain,
  fetchCustomDomainState,
  refreshCustomDomainStatus,
  type CustomDomainState,
  type CustomDomainVerificationRecord,
} from '../services/storeCustomDomainApi';
import { buildStorefrontPublicUrl, buildStorefrontUrl } from '../utils/storefrontDomain';
import { validateStoreHostnameInput } from '../utils/normalizeStoreHostname';
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
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');

  :where(.cd-root) *, :where(.cd-root) *::before, :where(.cd-root) *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: rgb(224, 238, 243);
    --card: #FFFFFF;
    --border: #E2E8F0;
    --text-primary: #0F172A;
    --text-secondary: #64748B;
    --text-muted: #94A3B8;
    --accent: #2563EB;
    --accent-hover: #1D4ED8;
    --green: #1A7A4A;
    --green-bg: #F0FAF5;
    --green-border: #C3E8D5;
    --amber-bg: #FDF8EE;
    --amber-border: #F0E4C8;
    --amber: #92641A;
    --red: #C0392B;
    --red-bg: #FDF4F3;
    --shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04);
    --radius: 16px;
    --radius-sm: 10px;
    --font: 'DM Sans', system-ui, sans-serif;
    --mono: 'DM Mono', Menlo, monospace;
  }

  .cd-root {
    min-height: 100dvh;
    background: var(--bg);
    font-family: var(--font);
    display: flex;
    flex-direction: column;
    padding-bottom: 72px;
  }

  .cd-status-bar { height: 40px; background: #0F172A; flex-shrink: 0; }

  .cd-header {
    position: sticky;
    top: 40px;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px 0 8px;
    height: 52px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }

  .cd-back {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    font-family: var(--font);
    transition: background 0.15s;
  }
  .cd-back:hover { background: #F1F5F9; }
  .cd-back:active { background: #E2E8F0; }

  .cd-title {
    flex: 1;
    min-width: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
  }

  .cd-header-spacer { width: 44px; flex-shrink: 0; }

  .cd-main { padding: 16px 20px 24px; max-width: 520px; margin: 0 auto; width: 100%; }

  .cd-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    box-shadow: var(--shadow);
    margin-bottom: 14px;
  }

  .cd-lead {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.55;
    margin-bottom: 14px;
  }

  .cd-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  .cd-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-family: var(--mono);
    color: var(--text-primary);
    background: #FAFBFC;
  }
  .cd-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  .cd-hint { font-size: 12px; color: var(--text-muted); margin-top: 8px; line-height: 1.45; }

  .cd-btn {
    width: 100%;
    margin-top: 12px;
    padding: 13px;
    border-radius: var(--radius-sm);
    border: none;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .cd-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .cd-btn-primary { background: var(--accent); color: #fff; }
  .cd-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
  .cd-btn-secondary {
    background: #F8F9FB;
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .cd-btn-danger {
    background: var(--red-bg);
    color: var(--red);
    border: 1px solid #F5C6C2;
    margin-top: 8px;
  }

  .cd-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .cd-status-pill.active { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
  .cd-status-pill.pending { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
  .cd-status-pill.error { background: var(--red-bg); color: var(--red); border: 1px solid #F5C6C2; }

  .cd-dns-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
  .cd-dns-table th, .cd-dns-table td {
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .cd-dns-table th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
  .cd-dns-val { font-family: var(--mono); font-size: 12px; word-break: break-all; color: var(--text-primary); }
  .cd-copy-row { display: flex; gap: 8px; align-items: flex-start; margin-top: 4px; }
  .cd-copy-btn {
    flex-shrink: 0;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-family: var(--font);
  }

  .cd-url-active {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--accent);
    word-break: break-all;
  }

  .cd-loader { display: flex; justify-content: center; padding: 48px; }
  .cd-spinner {
    width: 28px; height: 28px;
    border: 2.5px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: cd-spin 0.7s linear infinite;
  }
  @keyframes cd-spin { to { transform: rotate(360deg); } }

  .cd-error-box {
    background: var(--red-bg);
    border: 1px solid #F5C6C2;
    border-radius: var(--radius-sm);
    padding: 12px;
    font-size: 13px;
    color: #8B2E2E;
    margin-bottom: 12px;
    line-height: 1.45;
  }

  .cd-steps { list-style: none; counter-reset: step; }
  .cd-steps li {
    counter-increment: step;
    position: relative;
    padding-left: 28px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .cd-steps li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #EEF2F8;
    color: var(--text-primary);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

function statusLabel(status: CustomDomainState['status'], verified: boolean): string {
  if (verified || status === 'active') return 'Connected';
  if (status === 'error') return 'Needs attention';
  if (status === 'pending') return 'Waiting for DNS';
  return 'Not connected';
}

function DnsRecordsTable({ records }: { records: CustomDomainVerificationRecord[] }) {
  const { showToast } = useToast();
  if (!records.length) {
    return (
      <p className="cd-hint">
        After you connect, DNS records from Vercel will appear here. Add them at your domain registrar,
        then tap &quot;Check status&quot;.
      </p>
    );
  }
  return (
    <table className="cd-dns-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Name / Host</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {records.map((r, i) => (
          <tr key={`${r.type}-${r.domain}-${i}`}>
            <td>{r.type}</td>
            <td className="cd-dns-val">{r.domain}</td>
            <td>
              <div className="cd-copy-row">
                <span className="cd-dns-val">{r.value}</span>
                <button
                  type="button"
                  className="cd-copy-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(r.value);
                    showToast('Copied', 'success');
                  }}
                >
                  Copy
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StoreCustomDomainPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [domainApiLoading, setDomainApiLoading] = useState(false);
  const [domainState, setDomainState] = useState<CustomDomainState | null>(null);
  const [hostnameInput, setHostnameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [domainApiError, setDomainApiError] = useState('');

  const effectiveUid = useMemo(
    () => user?.uid ?? getPersistedAuthUserId() ?? null,
    [user?.uid]
  );

  const loadDomainState = useCallback(async () => {
    setDomainApiLoading(true);
    setDomainApiError('');
    try {
      const domainRes = await fetchCustomDomainState();
      setDomainState(domainRes);
      if (domainRes.hostname) setHostnameInput(domainRes.hostname);
      if (!domainRes.ok) {
        setDomainApiError(domainRes.error || 'Could not load domain settings');
      }
    } catch (e) {
      setDomainApiError(e instanceof Error ? e.message : 'Could not load domain settings');
    } finally {
      setDomainApiLoading(false);
    }
  }, []);

  const loadPage = useCallback(async () => {
    if (!effectiveUid) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setLocalError('');
    try {
      const storeRes = await withTimeout(
        getSellerStore(effectiveUid),
        STORE_FETCH_TIMEOUT_MS,
        'Store load timed out. Check your connection and try again.'
      );
      if (!storeRes.success || !storeRes.data) {
        setLocalError(storeRes.error || 'Store not found');
        setStore(null);
        setPageLoading(false);
        return;
      }
      setStore(storeRes.data);
      setPageLoading(false);
      void loadDomainState();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not load store');
      setStore(null);
      setPageLoading(false);
    }
  }, [effectiveUid, loadDomainState]);

  useEffect(() => {
    if (authLoading && !effectiveUid) return;
    void loadPage();
  }, [authLoading, effectiveUid, loadPage]);

  const handleConnect = async () => {
    const validation = validateStoreHostnameInput(hostnameInput);
    if (validation.ok === false) {
      setLocalError(validation.error);
      return;
    }
    setLocalError('');
    setBusy(true);
    const res = await connectCustomDomain(validation.hostname);
    setBusy(false);
    if (!res.ok) {
      setLocalError(res.error || 'Could not connect domain');
      showToast(res.error || 'Could not connect domain', 'error');
      return;
    }
    setDomainState(res);
    setHostnameInput(res.hostname || validation.hostname);
    showToast('Domain added on Vercel — configure DNS below', 'success');
    void loadDomainState();
    void getSellerStore(effectiveUid!).then((r) => {
      if (r.success && r.data) setStore(r.data);
    });
  };

  const handleRefresh = async () => {
    setBusy(true);
    setLocalError('');
    const res = await refreshCustomDomainStatus();
    setBusy(false);
    if (!res.ok) {
      setLocalError(res.error || 'Could not check status');
      showToast(res.error || 'Could not check status', 'error');
      return;
    }
    setDomainState(res);
    if (res.verified) showToast('Domain is connected!', 'success');
    else showToast('Still waiting for DNS — check your records', 'warning');
    void getSellerStore(user!.uid).then((r) => {
      if (r.success && r.data) setStore(r.data);
    });
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Remove this custom domain from your store and Vercel?')) return;
    setBusy(true);
    const res = await disconnectCustomDomain();
    setBusy(false);
    if (!res.ok) {
      showToast(res.error || 'Could not remove domain', 'error');
      return;
    }
    setHostnameInput('');
    setDomainState({
      configured: true,
      hostname: null,
      status: null,
      verified: false,
      verification: [],
    });
    showToast('Custom domain removed', 'success');
    void getSellerStore(user!.uid).then((r) => {
      if (r.success && r.data) setStore(r.data);
    });
  };

  const defaultUrl = store ? buildStorefrontUrl(store.storeSlug) : '';
  const publicUrl = store
    ? buildStorefrontPublicUrl(store.storeSlug, {
        hostname: domainState?.hostname ?? store.customHostname,
        status: domainState?.status ?? store.customDomainStatus,
      })
    : '';
  const hasHostname = Boolean(domainState?.hostname);
  const verified = domainState?.verified === true || domainState?.status === 'active';
  const pillClass =
    verified ? 'active' : domainState?.status === 'error' ? 'error' : hasHostname ? 'pending' : 'pending';

  return (
    <>
      <style>{CSS}</style>
      <div className="cd-root">
        <div className="cd-status-bar" />
        <header className="cd-header">
          <button
            type="button"
            className="cd-back"
            aria-label="Back to My Store"
            onClick={() => navigate('/store')}
          >
            <IconBack />
          </button>
          <h1 className="cd-title">Custom domain</h1>
          <div className="cd-header-spacer" aria-hidden />
        </header>

        <main className="cd-main">
          {authLoading && !effectiveUid ? (
            <div className="cd-loader">
              <div className="cd-spinner" />
            </div>
          ) : pageLoading ? (
            <div className="cd-loader">
              <div className="cd-spinner" />
            </div>
          ) : !effectiveUid ? (
            <div className="cd-card">
              <p className="cd-lead">Sign in to connect a custom domain.</p>
              <button type="button" className="cd-btn cd-btn-primary" onClick={() => navigate('/login')}>
                Log in
              </button>
            </div>
          ) : localError && !store ? (
            <div className="cd-error-box">{localError}</div>
          ) : (
            <>
              {localError && <div className="cd-error-box">{localError}</div>}
              {domainApiLoading && (
                <p className="cd-hint" style={{ marginBottom: 12 }}>Loading domain settings…</p>
              )}
              {domainApiError && !domainApiLoading && (
                <div className="cd-error-box">{domainApiError}</div>
              )}

              <div className="cd-card">
                <p className="cd-lead">
                  Use your own domain (e.g. <strong>shop.yourbrand.com</strong>) for your storefront.
                  We register it on Vercel and show the DNS records you need at your registrar.
                </p>
                <p className="cd-hint">
                  Default CatShare link: <span className="cd-dns-val">{defaultUrl}</span>
                </p>
              </div>

              {domainState?.configured === false && (
                <div className="cd-card">
                  <div className="cd-error-box">
                    Server is not configured for custom domains. Add VERCEL_API_TOKEN and VERCEL_PROJECT_ID
                    in Vercel environment variables.
                  </div>
                </div>
              )}

              {hasHostname && (
                <div className="cd-card">
                  <span className={`cd-status-pill ${pillClass}`}>
                    {statusLabel(domainState?.status ?? null, verified)}
                  </span>
                  {verified && publicUrl && (
                    <a className="cd-url-active" href={publicUrl} target="_blank" rel="noreferrer">
                      {publicUrl}
                    </a>
                  )}
                  {!verified && (
                    <p className="cd-hint" style={{ marginTop: 8 }}>
                      Connected hostname: <strong>{domainState?.hostname}</strong>
                    </p>
                  )}
                  {domainState?.vercelError && (
                    <p className="cd-hint" style={{ color: 'var(--red)', marginTop: 8 }}>
                      {domainState.vercelError}
                    </p>
                  )}
                </div>
              )}

              {!hasHostname ? (
                <div className="cd-card">
                  <div className="cd-label">Your domain</div>
                  <input
                    type="text"
                    className="cd-input"
                    placeholder="shop.yourbrand.com"
                    value={hostnameInput}
                    onChange={(e) => setHostnameInput(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <p className="cd-hint">Use a subdomain you control. Apex domains (yourbrand.com) may need extra DNS setup.</p>
                  <button
                    type="button"
                    className="cd-btn cd-btn-primary"
                    disabled={busy || domainState?.configured === false}
                    onClick={() => void handleConnect()}
                  >
                    {busy ? 'Connecting…' : 'Connect on Vercel'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="cd-card">
                    <div className="cd-label">DNS records (at your registrar)</div>
                    <ol className="cd-steps">
                      <li>Open DNS settings for your domain at GoDaddy, Namecheap, Cloudflare, etc.</li>
                      <li>Add each record below exactly as shown.</li>
                      <li>Wait a few minutes (up to 48 hours), then tap Check status.</li>
                    </ol>
                    <DnsRecordsTable records={domainState?.verification ?? []} />
                    <button
                      type="button"
                      className="cd-btn cd-btn-primary"
                      disabled={busy}
                      onClick={() => void handleRefresh()}
                    >
                      {busy ? 'Checking…' : 'Check status'}
                    </button>
                    <button
                      type="button"
                      className="cd-btn cd-btn-secondary"
                      disabled={busy || domainApiLoading}
                      onClick={() => void loadDomainState()}
                    >
                      Reload
                    </button>
                  </div>

                  <div className="cd-card">
                    <button
                      type="button"
                      className="cd-btn cd-btn-danger"
                      disabled={busy}
                      onClick={() => void handleDisconnect()}
                    >
                      Remove custom domain
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </main>

        <MainAppBottomNav active="store" />
      </div>
    </>
  );
}
