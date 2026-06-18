import { useState } from 'react';
import { FiCopy } from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';

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
    } catch (error) {
      showToast('Failed to copy link', 'error');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="mb-8">
      {/* Title and Status */}
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-3">{storeName}</h1>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            isLive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}>
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Store URL */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 rounded-2xl p-4 sm:p-5 mb-6 border border-blue-100 dark:border-blue-900/40">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Store URL</p>
        <div className="flex items-center justify-between gap-3">
          <a
            href={storeUrl ? `https://${storeUrl}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base sm:text-lg font-mono text-blue-700 dark:text-blue-300 font-semibold break-all hover:underline cursor-pointer"
          >
            {storeUrl || 'Not configured'}
          </a>
          {storeUrl && (
            <button
              onClick={handleCopyLink}
              disabled={copying}
              className="flex-shrink-0 p-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
              title="Copy link"
            >
              <FiCopy className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
