import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SplashLoadingLayout } from './SplashLoadingLayout';
import { resolveStoreSlugFromHostname } from '../utils/storefrontDomain';
import StoreView from '../pages/StoreView';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const slugFromHost = resolveStoreSlugFromHostname();

  // On seller subdomains, root path should always show the public storefront.
  if (slugFromHost && location.pathname === '/') {
    return <StoreView />;
  }

  if (loading) {
    return <SplashLoadingLayout />;
  }

  if (!user) {
    if (slugFromHost && !location.pathname.startsWith('/store/')) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
