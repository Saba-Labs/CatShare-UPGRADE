import { useState } from 'react';
import { FiCopy } from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import { STORE_PAGE_TITLE } from '../storeTypography';

interface StoreHeaderProps {
  storeName?: string;
  storeUrl?: string;
  isLive?: boolean;
}

export default function StoreHeader({
  storeName = 'My Store',
  storeUrl,
  isLive = false,
}: StoreHeaderProps) {
  const { showToast } = useToast();
  const [copying, setCopying] = useState(false);

  const handleCopyLink = async () => {
    if (!storeUrl) return;

    setCopying(true);
    try {
      await navigator.clipboard.writeText(`https://${storeUrl}`);
      showToast('Store link copied!', 'success');
    } catch {
      showToast('Failed to copy link', 'error');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-4">
        <h1 className={STORE_PAGE_TITLE}>{storeName}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              isLive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-100 mb-1.5 uppercase tracking-wide">
              Your Store URL
            </p>
            <a
              href={storeUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white font-mono break-all hover:text-blue-50 transition-colors"
            >
              {storeUrl || 'Not configured'}
            </a>
          </div>
          {storeUrl ? (
            <button
              onClick={() => void handleCopyLink()}
              disabled={copying}
              className="flex-shrink-0 p-2.5 text-white bg-white/20 hover:bg-white/30 rounded-xl transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              title="Copy link"
            >
              <FiCopy className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
