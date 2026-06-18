import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheck,
  FiExternalLink,
  FiLink2,
  FiRefreshCw,
  FiShield,
  FiTrash2,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { getSellerStore, type Store } from '../../services/storeService';
import {
  connectCustomDomain,
  disconnectCustomDomain,
  fetchCustomDomainState,
  refreshCustomDomainStatus,
  type CustomDomainState,
} from '../../services/storeCustomDomainApi';
import { buildStorefrontPublicUrl, buildStorefrontUrl } from '../../utils/storefrontDomain';
import { validateStoreHostnameInput } from '../../utils/normalizeStoreHostname';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import DnsRecordsTable, { formatDnsRecordsForCopy } from './components/DnsRecordsTable';
import { DOMAIN_PROVIDER_GUIDES } from './config/domainProviders';
import { STORE_FIELD_CLASS } from './storeTypography';

const STORE_FIELD_MONO_CLASS = `${STORE_FIELD_CLASS} font-mono`;

function statusBadgeClasses(status: 'connected' | 'pending' | 'error' | 'none'): string {
  switch (status) {
    case 'connected':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    case 'error':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

function verificationStatus(
  domainState: CustomDomainState | null
): { label: string; tone: 'connected' | 'pending' | 'error' | 'none' } {
  if (!domainState?.hostname) return { label: 'Not connected', tone: 'none' };
  if (domainState.verified || domainState.status === 'active') {
    return { label: 'Verified', tone: 'connected' };
  }
  if (domainState.status === 'error') return { label: 'Verification failed', tone: 'error' };
  return { label: 'Pending verification', tone: 'pending' };
}

function sslStatus(domainState: CustomDomainState | null): {
  label: string;
  description: string;
  tone: 'connected' | 'pending' | 'error' | 'none';
} {
  if (!domainState?.hostname) {
    return {
      label: 'Not provisioned',
      description: 'SSL is issued automatically after your domain is verified.',
      tone: 'none',
    };
  }
  if (domainState.verified || domainState.status === 'active') {
    return {
      label: 'Active',
      description: 'HTTPS is enabled for your custom domain via Vercel.',
      tone: 'connected',
    };
  }
  if (domainState.status === 'error') {
    return {
      label: 'Needs attention',
      description: 'Fix DNS records to allow SSL certificate provisioning.',
      tone: 'error',
    };
  }
  return {
    label: 'Provisioning',
    description: 'SSL will activate once DNS verification completes.',
    tone: 'pending',
  };
}

export default function CustomDomain() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [store, setStore] = useState<Store | null>(null);
  const [domainState, setDomainState] = useState<CustomDomainState | null>(null);
  const [hostnameInput, setHostnameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [domainLoading, setDomainLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(DOMAIN_PROVIDER_GUIDES[0]?.id ?? 'cloudflare');

  const loadDomainState = useCallback(async () => {
    setDomainLoading(true);
    try {
      const result = await fetchCustomDomainState();
      setDomainState(result);
      if (result.hostname) setHostnameInput(result.hostname);
      if (!result.ok && result.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load domain settings');
    } finally {
      setDomainLoading(false);
    }
  }, []);

  const loadPage = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const storeResult = await getSellerStore(sellerId);
    if (!storeResult.success || !storeResult.data) {
      setError(storeResult.error || 'Store not found');
      setStore(null);
      setLoading(false);
      return;
    }

    setStore(storeResult.data);
    setLoading(false);
    await loadDomainState();
  }, [sellerId, loadDomainState]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadPage();
  }, [authLoading, sellerId, loadPage]);

  const hasHostname = Boolean(domainState?.hostname);
  const verified = domainState?.verified === true || domainState?.status === 'active';
  const verification = verificationStatus(domainState);
  const ssl = sslStatus(domainState);

  const dnsRecords = useMemo(
    () =>
      domainState?.dnsRecords?.length
        ? domainState.dnsRecords
        : domainState?.verification ?? [],
    [domainState]
  );

  const defaultUrl = store ? buildStorefrontUrl(store.storeSlug) : '';
  const publicUrl = store
    ? domainState?.publicUrl ||
      buildStorefrontPublicUrl(store.storeSlug, {
        hostname: domainState?.hostname ?? store.customHostname,
        status: domainState?.status ?? store.customDomainStatus,
      })
    : '';

  const activeProvider = DOMAIN_PROVIDER_GUIDES.find((p) => p.id === selectedProvider);

  const handleConnect = async () => {
    if (!guardCloudWrite()) return;
    const validation = validateStoreHostnameInput(hostnameInput);
    if (validation.ok === false) {
      setError(validation.error);
      showToast(validation.error, 'error');
      return;
    }

    setError('');
    setBusy(true);
    const result = await connectCustomDomain(validation.hostname);
    setBusy(false);

    if (!result.ok) {
      setError(result.error || 'Could not connect domain');
      showToast(result.error || 'Could not connect domain', 'error');
      return;
    }

    setDomainState(result);
    setHostnameInput(result.hostname || validation.hostname);
    showToast('Domain connected — configure DNS below', 'success');
    await loadDomainState();
    if (sellerId) {
      const storeResult = await getSellerStore(sellerId);
      if (storeResult.success && storeResult.data) setStore(storeResult.data);
    }
  };

  const handleRefresh = async () => {
    if (!guardCloudWrite()) return;
    setBusy(true);
    setError('');
    const result = await refreshCustomDomainStatus();
    setBusy(false);

    if (!result.ok) {
      setError(result.error || 'Could not check status');
      showToast(result.error || 'Could not check status', 'error');
      return;
    }

    setDomainState(result);
    if (result.verified) showToast('Domain verified successfully', 'success');
    else showToast('Still waiting for DNS propagation', 'warning');

    if (sellerId) {
      const storeResult = await getSellerStore(sellerId);
      if (storeResult.success && storeResult.data) setStore(storeResult.data);
    }
  };

  const handleReconnect = async () => {
    if (!domainState?.hostname) {
      showToast('Enter a domain to connect', 'error');
      return;
    }
    setHostnameInput(domainState.hostname);
    await handleConnect();
  };

  const handleRemove = async () => {
    if (!guardCloudWrite()) return;
    if (!window.confirm('Remove this custom domain from your store?')) return;

    setBusy(true);
    const result = await disconnectCustomDomain();
    setBusy(false);

    if (!result.ok) {
      showToast(result.error || 'Could not remove domain', 'error');
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

    if (sellerId) {
      const storeResult = await getSellerStore(sellerId);
      if (storeResult.success && storeResult.data) setStore(storeResult.data);
    }
  };

  const handleCopyAllDns = async () => {
    if (dnsRecords.length === 0) return;
    await navigator.clipboard.writeText(formatDnsRecordsForCopy(dnsRecords));
    showToast('DNS records copied', 'success');
  };

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  if (!sellerId) {
    return (
      <StoreLayout>
        <PageHeader title="Custom Domain" description="Connect your own domain to your storefront." />
        <SettingsCard title="Sign in required" description="Log in to manage your custom domain.">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Log in
          </button>
        </SettingsCard>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="max-w-3xl space-y-6 pb-8">
        <PageHeader
          title="Custom Domain"
        />

        {error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {domainState?.configured === false ? (
          <SettingsCard
            title="Server configuration"
            description="Custom domains are not available on this deployment."
          >
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add <code className="font-mono text-xs">VERCEL_API_TOKEN</code> and{' '}
              <code className="font-mono text-xs">VERCEL_PROJECT_ID</code> to your server environment.
            </p>
          </SettingsCard>
        ) : null}

        <SettingsCard
          title="Current Domain"
          description="Your default CatShare URL and connected custom domain."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                Default CatShare URL
              </p>
              <a
                href={defaultUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-blue-600 dark:text-blue-400 break-all hover:underline"
              >
                {defaultUrl}
              </a>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Custom Domain
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(verification.tone)}`}
                >
                  {verification.label}
                </span>
              </div>
              {hasHostname ? (
                verified && publicUrl ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 font-mono text-sm text-blue-600 dark:text-blue-400 break-all hover:underline"
                  >
                    {publicUrl}
                    <FiExternalLink className="h-4 w-4 flex-shrink-0" />
                  </a>
                ) : (
                  <p className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                    {domainState?.hostname}
                  </p>
                )
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No custom domain connected yet.</p>
              )}
              {domainState?.vercelError ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{domainState.vercelError}</p>
              ) : null}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title={hasHostname ? 'Manage Domain' : 'Connect Domain'}
          description={
            hasHostname
              ? 'Reconnect or remove your custom domain connection.'
              : 'Enter a domain you own (e.g. shop.yourbrand.com).'
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Domain
              </label>
              <input
                type="text"
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                disabled={busy || domainState?.configured === false}
                placeholder="shop.yourbrand.com"
                autoCapitalize="none"
                autoCorrect="off"
                className={STORE_FIELD_MONO_CLASS}
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Use a subdomain you control. Apex domains may require additional DNS setup.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!hasHostname ? (
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={busy || domainState?.configured === false}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <FiLink2 className="h-4 w-4" />
                  {busy ? 'Connecting…' : 'Connect Domain'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <FiRefreshCw className="h-4 w-4" />
                    {busy ? 'Checking…' : 'Check Status'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReconnect()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <FiLink2 className="h-4 w-4" />
                    Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Remove Domain
                  </button>
                </>
              )}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="SSL Status"
          description="HTTPS certificate status for your custom domain."
        >
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-4">
            <FiShield
              className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                ssl.tone === 'connected'
                  ? 'text-green-600 dark:text-green-400'
                  : ssl.tone === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
              }`}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900 dark:text-gray-100">{ssl.label}</p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(ssl.tone)}`}
                >
                  SSL
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{ssl.description}</p>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Verification Status"
          description="DNS verification progress for your custom domain."
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${statusBadgeClasses(verification.tone)}`}
            >
              {verified ? <FiCheck className="h-4 w-4" /> : null}
              {verification.label}
            </span>
            {domainLoading ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Refreshing…</span>
            ) : null}
          </div>
          {!verified && hasHostname ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Add the DNS records below at your domain provider, then tap Check Status.
            </p>
          ) : null}
        </SettingsCard>

        <SettingsCard
          title="DNS Records"
          description="Add these records at your DNS provider to verify domain ownership."
        >
          <DnsRecordsTable
            records={dnsRecords}
            onCopyAll={() => void handleCopyAllDns()}
            onCopyValue={() => showToast('Copied to clipboard', 'success')}
            disabled={busy || dnsRecords.length === 0}
          />
        </SettingsCard>

        <SettingsCard
          title="Setup Instructions"
          description="Follow these steps to connect your domain."
        >
          <ol className="space-y-3">
            {[
              'Enter your custom domain and tap Connect Domain.',
              'Copy the DNS records shown above.',
              'Add each record in your DNS provider (see provider guides below).',
              'Wait for propagation (minutes to 48 hours), then tap Check Status.',
              'Once verified, SSL activates automatically and your store is live on your domain.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-bold text-blue-700 dark:text-blue-300">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </SettingsCard>

        <SettingsCard
          title="DNS Provider Guides"
          description="Step-by-step instructions for popular domain providers."
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {DOMAIN_PROVIDER_GUIDES.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProvider(provider.id)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold border transition-colors ${
                  selectedProvider === provider.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {provider.name}
              </button>
            ))}
          </div>

          {activeProvider ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {activeProvider.name}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {activeProvider.description}
              </p>
              <ol className="mt-4 space-y-2">
                {activeProvider.steps.map((step, index) => (
                  <li key={step} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </SettingsCard>
      </div>
    </StoreLayout>
  );
}
