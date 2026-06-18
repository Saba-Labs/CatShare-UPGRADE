import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { getSellerStore } from '../../services/storeService';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import DangerActionCard from './components/DangerActionCard';
import ConfirmDialog from './components/ConfirmDialog';
import {
  FiAlertTriangle,
  FiArchive,
  FiDownload,
  FiTrash2,
  FiUserCheck,
} from 'react-icons/fi';

type DangerAction = 'archive' | 'export' | 'transfer' | 'delete' | null;

export default function DangerZone() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [storeSlug, setStoreSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<DangerAction>(null);
  const [confirmText, setConfirmText] = useState('');
  const [transferEmail, setTransferEmail] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadStore = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getSellerStore(sellerId);
    if (result.success && result.data?.storeSlug) {
      setStoreSlug(result.data.storeSlug);
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadStore();
  }, [authLoading, sellerId, loadStore]);

  const closeDialog = () => {
    setActiveAction(null);
    setConfirmText('');
    setTransferEmail('');
    setProcessing(false);
  };

  const runAction = async () => {
    if (!guardCloudWrite()) return;

    setProcessing(true);

    await new Promise((resolve) => setTimeout(resolve, 800));

    switch (activeAction) {
      case 'archive':
        showToast('Store archive requested (preview)', 'success');
        break;
      case 'export':
        showToast('Store export started — you will receive a download link by email', 'success');
        break;
      case 'transfer':
        showToast(`Ownership transfer to ${transferEmail} requested (preview)`, 'success');
        break;
      case 'delete':
        showToast('Store deletion is not available in preview mode', 'error');
        break;
      default:
        break;
    }

    closeDialog();
  };

  const deleteConfirmPhrase = storeSlug ? `delete ${storeSlug}` : 'DELETE STORE';
  const archiveConfirmPhrase = storeSlug ? `archive ${storeSlug}` : 'ARCHIVE';

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-2xl">
          <div className="h-12 w-48 rounded bg-red-200 dark:bg-red-900/40" />
          <div className="h-64 rounded-2xl bg-red-100 dark:bg-red-950/30" />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="max-w-2xl pb-8">
        <PageHeader
          title="Danger Zone"
          backTo="/store"
        />

        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-5 mb-6">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                These actions cannot be easily undone
              </p>
              <p className="mt-1 text-sm text-red-800/80 dark:text-red-200/70">
                Every destructive operation requires explicit confirmation. CatShare may retain
                backups for a limited period after deletion.
              </p>
            </div>
          </div>
        </div>

        <SettingsCard
          title="Destructive Actions"
          description="Manage high-impact store operations."
          className="border-red-200 dark:border-red-900/50"
        >
          <div className="space-y-4 -mt-2">
            <DangerActionCard
              icon={<FiArchive className="h-5 w-5" />}
              title="Archive Store"
              description="Hide your storefront and pause new orders. You can restore your store later. Existing data is preserved."
              actionLabel="Archive Store"
              onAction={() => setActiveAction('archive')}
            />

            <DangerActionCard
              icon={<FiDownload className="h-5 w-5" />}
              title="Export Store Data"
              description="Download a copy of your products, orders, customers, and settings as a portable archive."
              actionLabel="Export Data"
              onAction={() => setActiveAction('export')}
            />

            <DangerActionCard
              icon={<FiUserCheck className="h-5 w-5" />}
              title="Transfer Ownership"
              description="Move full ownership of this store to another CatShare merchant account."
              actionLabel="Transfer"
              onAction={() => setActiveAction('transfer')}
            />

            <DangerActionCard
              icon={<FiTrash2 className="h-5 w-5" />}
              title="Delete Store"
              description="Permanently delete your store, catalogue, and all associated data. This action is irreversible."
              actionLabel="Delete Store"
              onAction={() => setActiveAction('delete')}
            />
          </div>
        </SettingsCard>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Need help?{' '}
          <button
            type="button"
            onClick={() => navigate('/store/security')}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Review security settings
          </button>
        </p>
      </div>

      <ConfirmDialog
        open={activeAction === 'archive'}
        title="Archive your store?"
        description="Your storefront will go offline and customers will not be able to place new orders. You can unarchive at any time from this page."
        confirmLabel="Archive Store"
        variant="danger"
        loading={processing}
        requireConfirmText={archiveConfirmPhrase}
        confirmTextValue={confirmText}
        onConfirmTextChange={setConfirmText}
        confirmHint={`Type "${archiveConfirmPhrase}" to confirm`}
        onClose={closeDialog}
        onConfirm={() => void runAction()}
      />

      <ConfirmDialog
        open={activeAction === 'export'}
        title="Export store data?"
        description="We will prepare a downloadable archive of your store data. You will receive an email when the export is ready. Large stores may take several minutes."
        confirmLabel="Start Export"
        variant="danger"
        loading={processing}
        onClose={closeDialog}
        onConfirm={() => void runAction()}
      />

      <ConfirmDialog
        open={activeAction === 'transfer'}
        title="Transfer store ownership?"
        description="The new owner will have full control of this store. You will lose owner access once the transfer is accepted."
        confirmLabel="Request Transfer"
        variant="danger"
        loading={processing}
        onClose={closeDialog}
        onConfirm={() => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferEmail.trim())) {
            showToast('Enter a valid email for the new owner', 'error');
            return;
          }
          void runAction();
        }}
      >
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            New owner email
          </label>
          <input
            type="email"
            value={transferEmail}
            onChange={(e) => setTransferEmail(e.target.value)}
            placeholder="newowner@email.com"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-transparent"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={activeAction === 'delete'}
        title="Delete store permanently?"
        description="This will permanently delete your store, products, orders, and all settings. This action cannot be undone."
        confirmLabel="Delete Store"
        variant="danger"
        loading={processing}
        requireConfirmText={deleteConfirmPhrase}
        confirmTextValue={confirmText}
        onConfirmTextChange={setConfirmText}
        confirmHint={`Type "${deleteConfirmPhrase}" to confirm`}
        onClose={closeDialog}
        onConfirm={() => void runAction()}
      />
    </StoreLayout>
  );
}
