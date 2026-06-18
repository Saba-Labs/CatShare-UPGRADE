import { useState } from 'react';
import { FiCopy, FiExternalLink, FiShare2 } from 'react-icons/fi';
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
  const [copyLoading, setCopyLoading] = useState(false);

  const handleCopyLink = async () => {
    if (!storeUrl) return;

    setCopyLoading(true);
    try {
      await navigator.clipboard.writeText(`https://${storeUrl}`);
      showToast('Store link copied!', 'success');
    } catch (error) {
      showToast('Failed to copy link', 'error');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleOpenStore = () => {
    if (storeUrl) {
      window.open(`https://${storeUrl}`, '_blank');
    }
  };

  const handleShareStore = async () => {
    if (!storeUrl) return;

    const shareUrl = `https://${storeUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: storeName,
          text: `Check out my store: ${storeName}`,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Store link copied to clipboard!', 'success');
      } catch {
        showToast('Failed to copy link', 'error');
      }
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
        <p className="text-base sm:text-lg font-mono text-blue-700 dark:text-blue-300 font-semibold break-all">{storeUrl || 'Not configured'}</p>
      </div>

      {/* Action Buttons */}
      {storeUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleCopyLink}
            disabled={copyLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <FiCopy className="h-5 w-5" />
            <span className="hidden sm:inline">Copy Link</span>
            <span className="sm:hidden">Copy</span>
          </button>

          <button
            onClick={handleOpenStore}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <FiExternalLink className="h-5 w-5" />
            <span className="hidden sm:inline">Open Store</span>
            <span className="sm:hidden">Open</span>
          </button>

          <button
            onClick={handleShareStore}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 rounded-xl font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            <FiShare2 className="h-5 w-5" />
            <span className="hidden sm:inline">Share Store</span>
            <span className="sm:hidden">Share</span>
          </button>
        </div>
      )}
    </div>
  );
}
