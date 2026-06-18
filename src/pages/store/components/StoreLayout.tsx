import { ReactNode } from 'react';
import MainAppBottomNav from '../../../components/MainAppBottomNav';

interface StoreLayoutProps {
  children: ReactNode;
}

export default function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>
      <MainAppBottomNav active="store" />
    </div>
  );
}
