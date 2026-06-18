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
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#1f2937', lineHeight: 1.2, marginBottom: 8 }}>{storeName}</h1>
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
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-800 rounded-2xl p-6 sm:p-8 mb-8 shadow-lg hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-100 mb-2 uppercase tracking-wider">Your Store URL</p>
            <a
              href={storeUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'monospace', wordBreak: 'break-all' }}
              className="hover:text-blue-50 transition-colors cursor-pointer"
            >
              {storeUrl || 'Not configured'}
            </a>
          </div>
          {storeUrl && (
            <button
              onClick={handleCopyLink}
              disabled={copying}
              className="flex-shrink-0 p-3 text-white bg-white/20 hover:bg-white/30 rounded-xl transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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
