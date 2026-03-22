import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, persistAuthUserIdsForStorage, clearAuthUserIdsFromStorage } from '../supabaseClient';
import { fetchAllUserData } from '../services/supabaseSync';
import { authService } from '../services/authService';

/** Shape compatible with previous Firebase `user` (components use .uid, .email, .displayName). */
export type AppAuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
  /** Supabase: derived from user.email_confirmed_at */
  emailVerified?: boolean;
};

function mapSupabaseUserToApp(u: SupabaseUser): AppAuthUser {
  const meta = u.user_metadata || {};
  const displayName =
    (meta.display_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    u.email?.split('@')[0] ||
    null;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName,
    photoURL: (meta.avatar_url as string) || (meta.picture as string) || null,
    emailVerified: !!u.email_confirmed_at,
  };
}

interface SupabaseUserData {
  products: any[];
  deletedProducts: any[];
  categories: any[];
  cataloguesDefinition: any;
  fieldsDefinition: any;
  userSettings: any;
}

interface AuthContextType {
  user: AppAuthUser | null;
  loading: boolean;
  error: string | null;
  supabaseData: SupabaseUserData | null;
  supabaseDataLoading: boolean;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultSupabaseData: SupabaseUserData = {
  products: [],
  deletedProducts: [],
  categories: [],
  cataloguesDefinition: null,
  fieldsDefinition: null,
  userSettings: null,
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseData, setSupabaseData] = useState<SupabaseUserData | null>(null);
  const [supabaseDataLoading, setSupabaseDataLoading] = useState(false);

  useEffect(() => {
    const checkGuestMode = () => {
      const isOfflineGuest = authService.isOfflineGuest();

      if (isOfflineGuest) {
        const guestId = localStorage.getItem('guestUserId');
        const guestUser: AppAuthUser = {
          uid: guestId || `guest-${Date.now()}`,
          email: null,
          displayName: 'Guest User',
          isAnonymous: true,
          emailVerified: false,
        };

        setUser(guestUser);
        console.log('👤 Offline guest mode activated');
        setLoading(false);
        setSupabaseData(defaultSupabaseData);
        return true;
      }
      return false;
    };

    if (checkGuestMode()) {
      return;
    }

    const handleGuestModeActivated = () => {
      console.log('🎯 Guest mode activation detected');
      checkGuestMode();
    };

    window.addEventListener('guestModeActivated', handleGuestModeActivated);

    let cancelled = false;

    const loadUserData = async (uid: string) => {
      setSupabaseDataLoading(true);
      try {
        const result = await fetchAllUserData(uid);
        if (cancelled) return;
        if (result.success && result.data) {
          setSupabaseData(result.data as SupabaseUserData);
          console.log('✅ Fetched Supabase data for user:', uid);
        } else {
          console.warn('⚠️ Failed to fetch Supabase data:', result.error);
          setSupabaseData(defaultSupabaseData);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Error fetching Supabase data:', err);
          setSupabaseData(defaultSupabaseData);
        }
      } finally {
        if (!cancelled) setSupabaseDataLoading(false);
      }
    };

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user) {
        const appUser = mapSupabaseUserToApp(session.user);
        setUser(appUser);
        persistAuthUserIdsForStorage(session.user.id);
        await loadUserData(session.user.id);
      } else {
        setUser(null);
        clearAuthUserIdsFromStorage();
        setSupabaseData(null);
      }
      setLoading(false);
    };

    void initSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (authService.isOfflineGuest()) return;

      if (session?.user) {
        const appUser = mapSupabaseUserToApp(session.user);
        setUser(appUser);
        persistAuthUserIdsForStorage(session.user.id);
        // Include INITIAL_SESSION so OAuth redirect + full page load still fetches profile
        // (initSession also loads; duplicate fetch is harmless vs missing load on some races).
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          event === 'INITIAL_SESSION'
        ) {
          await loadUserData(session.user.id);
        }
      } else {
        setUser(null);
        clearAuthUserIdsFromStorage();
        setSupabaseData(null);
        setSupabaseDataLoading(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener('guestModeActivated', handleGuestModeActivated);
    };
  }, []);

  const logout = async () => {
    try {
      setError(null);

      if (authService.isOfflineGuest()) {
        authService.logoutOfflineGuest();
        console.log('👤 Guest user logged out');
      } else {
        await supabase.auth.signOut();
      }

      setUser(null);
      setSupabaseData(null);
      clearAuthUserIdsFromStorage();

      localStorage.removeItem('products');
      localStorage.removeItem('deletedProducts');
      localStorage.removeItem('retailProducts');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        supabaseData,
        supabaseDataLoading,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
