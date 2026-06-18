import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import MainAppBottomNav from '../../../components/MainAppBottomNav';
import { FiEye, FiExternalLink } from 'react-icons/fi';

interface StoreLayoutProps {
  children: ReactNode;
  storeUrl?: string;
}

export default function StoreLayout({ children, storeUrl }: StoreLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>

      {/* Sticky bottom action area for mobile */}
      {storeUrl && (
        <div className="fixed bottom-14 md:hidden left-0 right-0 bg-white border-t border-gray-200 p-3 space-y-2">
          <button
            onClick={() => window.open(`https://${storeUrl}`, '_blank')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:bg-blue-700 transition-colors text-sm"
          >
            <FiExternalLink className="h-4 w-4" />
            Open Store
          </button>
          <button
            onClick={() => navigate('/store/homepage')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg active:bg-gray-50 transition-colors text-sm"
          >
            <FiEye className="h-4 w-4" />
            Edit Homepage
          </button>
        </div>
      )}

      <MainAppBottomNav active="store" />
    </div>
  );
}
