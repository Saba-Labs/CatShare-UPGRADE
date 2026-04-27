import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SplashLoadingLayout } from './SplashLoadingLayout';
import { resolveStoreSlugFromHostname } from '../utils/storefrontDomain';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <SplashLoadingLayout />;
  }

  if (!user) {
    const slugFromHost = resolveStoreSlugFromHostname();
    if (slugFromHost && !location.pathname.startsWith('/store/')) {
      return <Navigate to={`/store/${slugFromHost}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
