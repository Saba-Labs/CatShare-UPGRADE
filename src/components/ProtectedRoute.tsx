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

  // On seller subdomains, public storefront paths render StoreView (not only "/").
  if (slugFromHost && isPublicStorefrontPath(location.pathname)) {
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

/** Paths served by the public website storefront on a seller subdomain. */
function isPublicStorefrontPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return true;
  if (pathname.startsWith('/collections')) return true;
  if (pathname.startsWith('/products')) return true;
  // Custom pages: single segment slug (e.g. /about) — exclude known app routes.
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return false;
  const appRoots = new Set([
    'login',
    'register',
    'forgot-password',
    'reset-password',
    'email-confirmed',
    'welcome',
    'catalogues',
    'orders',
    'create',
    'create-bulk',
    'create-order',
    'account',
    'settings',
    'website',
    'privacy',
    'terms',
    'o',
  ]);
  if (appRoots.has(seg)) return false;
  // One-segment paths like /about are custom storefront pages.
  return pathname.split('/').filter(Boolean).length >= 1 && !pathname.startsWith('/store/');
}
