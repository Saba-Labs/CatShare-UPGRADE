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
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">{storeName}</h1>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{isLive ? '🟢' : '🔴'}</span>
          <span className={`text-lg font-semibold ${isLive ? 'text-green-600' : 'text-gray-500'}`}>
            {isLive ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Store URL */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-100">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Store URL</p>
        <p className="text-lg font-mono text-blue-600 font-semibold break-all">{storeUrl || 'Not configured'}</p>
      </div>

      {/* Action Buttons */}
      {storeUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleCopyLink}
            disabled={copyLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <FiCopy className="h-5 w-5" />
            <span className="hidden sm:inline">Copy Link</span>
            <span className="sm:hidden">Copy</span>
          </button>

          <button
            onClick={handleOpenStore}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <FiExternalLink className="h-5 w-5" />
            <span className="hidden sm:inline">Open Store</span>
            <span className="sm:hidden">Open</span>
          </button>

          <button
            onClick={handleShareStore}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 rounded-lg font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
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
