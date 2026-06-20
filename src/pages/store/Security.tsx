import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { deleteStore, getSellerStore } from '../../services/storeService';
import {
  fetchSecuritySettings,
  updateSecuritySettings,
} from '../../services/storeSecurityService';
import {
  DEFAULT_SECURITY_SETTINGS,
  type StoreSecuritySettings,
} from '../../types/storeSecuritySettings';
import {
  clearStorePageCaches,
  readCachedSecuritySettings,
  readCachedSellerStore,
} from '../../utils/storePageCache';
import { invalidateSellerStoreSessionFetch } from '../../utils/catalogueSessionHydration';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import ConfirmDialog from './components/ConfirmDialog';
import DangerActionCard from './components/DangerActionCard';
import { FiAlertTriangle, FiShield, FiTrash2 } from 'react-icons/fi';
import {
  STORE_FIELD_CLASS,
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from './storeTypography';

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        {description ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        ) : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function Security() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [settings, setSettings] = useState<StoreSecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<StoreSecuritySettings>(
    DEFAULT_SECURITY_SETTINGS
  );
  const [storeSlug, setStoreSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedSecuritySettings(sellerId);
    const cachedStore = readCachedSellerStore(sellerId);
    if (cached) {
      setSettings(cached);
      setOriginalSettings(cached);
      setLoading(false);
    }
    if (cachedStore?.storeSlug) {
      setStoreSlug(cachedStore.storeSlug);
    }
  }, [sellerId]);

  const loadSettings = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const cached = readCachedSecuritySettings(sellerId);
    if (!cached) {
      setLoading(true);
    }

    const [securityResult, storeResult] = await Promise.all([
      fetchSecuritySettings(sellerId),
      getSellerStore(sellerId),
    ]);

    if (securityResult.error && !cached) {
      showToast('Failed to load security settings', 'error');
    }
    setSettings(securityResult.data);
    setOriginalSettings(securityResult.data);

    if (storeResult.success && storeResult.data?.storeSlug) {
      setStoreSlug(storeResult.data.storeSlug);
    }

    setLoading(false);
  }, [sellerId, showToast]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadSettings();
  }, [authLoading, sellerId, loadSettings]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const canSave = hasChanges && !saving;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const patch = (partial: Partial<StoreSecuritySettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    if (!sellerId || !guardCloudWrite()) return;

    if (settings.passwordProtected && !settings.storePassword.trim()) {
      showToast('Enter a store password or disable password protection', 'error');
      return;
    }

    setSaving(true);
    const result = await updateSecuritySettings(sellerId, settings);
    setSaving(false);

    if (result.error || !result.data) {
      showToast('Failed to save security settings', 'error');
      return;
    }

    setSettings(result.data);
    setOriginalSettings(result.data);
    showToast('Security settings saved', 'success');
  };

  const handleDeleteStore = async () => {
    if (!sellerId || !guardCloudWrite()) return;

    setDeleting(true);
    const result = await deleteStore(sellerId);
    setDeleting(false);

    if (!result.success) {
      showToast(result.error || 'Failed to delete store', 'error');
      return;
    }

    clearStorePageCaches(sellerId);
    invalidateSellerStoreSessionFetch(sellerId);
    setDeleteOpen(false);
    setDeleteConfirmText('');
    showToast('Store deleted', 'success');
    navigate('/store', { replace: true });
  };

  const deleteConfirmPhrase = storeSlug ? `DELETE ${storeSlug.toUpperCase()}` : 'DELETE STORE';

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 max-w-3xl">
        <PageHeader
          title="Security"
          sticky
          actions={(
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className={`hidden sm:inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        />

        <div className="space-y-6">
          <SettingsCard
            title="Password Protected Store"
            description="Require visitors to enter a password before viewing your catalogue."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable password protection"
                description="Customers must enter your store password to browse products."
                checked={settings.passwordProtected}
                onChange={(value) => patch({ passwordProtected: value })}
                disabled={saving}
              />
              {settings.passwordProtected ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Store Password
                    </label>
                    <input
                      type="password"
                      value={settings.storePassword}
                      disabled={saving}
                      onChange={(e) => patch({ storePassword: e.target.value })}
                      placeholder="Enter a secure password"
                      className={STORE_FIELD_CLASS}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex items-start gap-2">
                      <FiShield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p>
                        Share this password with customers you want to allow in. You can browse your
                        own store without entering it while signed in.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Delete Store"
            description="Permanently remove your store and its public link."
            className="border-red-200 dark:border-red-900/50"
          >
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 mb-4">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Deleting your store removes the storefront link immediately. Products and orders in
                  your account are not deleted.
                </p>
              </div>
            </div>
            <DangerActionCard
              icon={<FiTrash2 className="h-5 w-5" />}
              title="Delete Store"
              description="Remove this store from CatShare. You can create a new store later with a different slug."
              actionLabel="Delete Store"
              onAction={() => setDeleteOpen(true)}
            />
          </SettingsCard>
        </div>
      </div>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 z-[55]">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`${canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED} shadow-lg`}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      {hasChanges ? (
        <div className="hidden md:block fixed bottom-20 right-6 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
          You have unsaved changes
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete store permanently?"
        description="This will remove your store and its public link. Customers will no longer be able to open your storefront. This cannot be undone."
        confirmLabel="Delete Store"
        variant="danger"
        loading={deleting}
        requireConfirmText={deleteConfirmPhrase}
        confirmTextValue={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        confirmHint={`Type "${deleteConfirmPhrase}" to confirm`}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirmText('');
        }}
        onConfirm={() => void handleDeleteStore()}
      />
    </StoreLayout>
  );
}
