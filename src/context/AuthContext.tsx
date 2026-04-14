import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  supabase,
  persistAuthUserIdsForStorage,
  clearAuthUserIdsFromStorage,
  setSupabaseRlsUserId,
  recoverSupabaseSession,
  CATSHARE_AUTH_RESTORED_EVENT,
} from '../supabaseClient';
import { fetchAllUserData } from '../services/supabaseSync';
import { authService } from '../services/authService';

/** App user shape from Supabase session (components use .uid, .email, .displayName). */
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
  /** Refetch cloud snapshot (e.g. after saving Account / business details). Returns the fetched row or null. */
  refreshSupabaseData: (opts?: { skipLoadingIndicator?: boolean }) => Promise<SupabaseUserData | null>;
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

  const intentionalLogoutRef = useRef(false);

  const refreshSupabaseData = useCallback(async (opts?: { skipLoadingIndicator?: boolean }): Promise<SupabaseUserData | null> => {
    if (authService.isOfflineGuest()) return null;

    const skipIndicator = opts?.skipLoadingIndicator === true;
    if (!skipIndicator) {
      setSupabaseDataLoading(true);
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return null;

      const result = await fetchAllUserData(uid);
      const {
        data: { session: latest },
      } = await supabase.auth.getSession();
      if (!latest?.user || latest.user.id !== uid) return null;

      if (result.success && result.data) {
        const data = result.data as SupabaseUserData;
        setSupabaseData(data);
        return data;
      }
      console.warn('⚠️ refreshSupabaseData failed:', result.error);
      return null;
    } catch (e) {
      console.warn('⚠️ refreshSupabaseData:', e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (!skipIndicator) {
        setSupabaseDataLoading(false);
      }
    }
  }, []);

  /** Coalesce concurrent profile fetches for the same uid (initSession + SIGNED_IN, etc.). */
  const inFlightProfileByUid = useRef<Map<string, Promise<void>>>(new Map());
  /** Ref-count in-flight profile loads (avoids clearing loading while another uid still fetches). */
  const activeProfileLoadsRef = useRef(0);

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
      const existing = inFlightProfileByUid.current.get(uid);
      if (existing) return existing;

      const run = (async () => {
        activeProfileLoadsRef.current += 1;
        if (activeProfileLoadsRef.current === 1) setSupabaseDataLoading(true);
        try {
          const result = await fetchAllUserData(uid);
          if (cancelled) return;
          const { data: { session: latest } } = await supabase.auth.getSession();
          if (!latest?.user || latest.user.id !== uid) return;

          if (result.success && result.data) {
            setSupabaseData(result.data as SupabaseUserData);
            console.log('✅ Fetched Supabase data for user:', uid);
          } else {
            console.warn('⚠️ Failed to fetch Supabase data:', result.error);
            setSupabaseData(defaultSupabaseData);
          }
        } catch (err) {
          if (!cancelled) {
            console.warn('⚠️ Error fetching Supabase data:', err instanceof Error ? err.message : String(err));
            try {
              const { data: { session: latest } } = await supabase.auth.getSession();
              if (latest?.user?.id === uid) {
                setSupabaseData(defaultSupabaseData);
              }
            } catch (sessionErr) {
              console.warn(
                '⚠️ Error checking latest session after Supabase fetch failure:',
                sessionErr instanceof Error ? sessionErr.message : String(sessionErr)
              );
            }
          }
        } finally {
          inFlightProfileByUid.current.delete(uid);
          activeProfileLoadsRef.current = Math.max(0, activeProfileLoadsRef.current - 1);
          if (!cancelled && activeProfileLoadsRef.current === 0) {
            setSupabaseDataLoading(false);
          }
        }
      })();

      inFlightProfileByUid.current.set(uid, run);
      return run;
    };

    const applySignedInSession = (sessionUser: SupabaseUser) => {
      const appUser = mapSupabaseUserToApp(sessionUser);
      setUser(appUser);
      persistAuthUserIdsForStorage(sessionUser.id);
      setSupabaseRlsUserId(sessionUser.id);
    };

    const clearSignedOutState = () => {
      setUser(null);
      clearAuthUserIdsFromStorage();
      setSupabaseRlsUserId(null);
      setSupabaseData(null);
      setSupabaseDataLoading(false);
      inFlightProfileByUid.current.clear();
      activeProfileLoadsRef.current = 0;
    };

    const initSession = async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        if (attempt > 0) await sleep(120 * attempt);
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (cancelled) return;
          if (session?.user) {
            applySignedInSession(session.user);
            setLoading(false);
            void loadUserData(session.user.id);
            return;
          }
        } catch (err) {
          console.warn('⚠️ initSession attempt failed:', err instanceof Error ? err.message : String(err));
        }
      }

      if (cancelled) return;
      const recovered = await recoverSupabaseSession();
      if (cancelled) return;
      if (recovered?.user) {
        applySignedInSession(recovered.user);
        setLoading(false);
        void loadUserData(recovered.user.id);
        return;
      }

      clearSignedOutState();
      setLoading(false);
    };

    void initSession();

    const syncAfterLocalAuthRestore = () => {
      void (async () => {
        if (authService.isOfflineGuest() || cancelled) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          applySignedInSession(session.user);
          void loadUserData(session.user.id);
        }
      })();
    };

    window.addEventListener(CATSHARE_AUTH_RESTORED_EVENT, syncAfterLocalAuthRestore);

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (authService.isOfflineGuest()) return;

      if (session?.user) {
        const appUser = mapSupabaseUserToApp(session.user);
        setUser(appUser);
        persistAuthUserIdsForStorage(session.user.id);
        setSupabaseRlsUserId(session.user.id);
        // Avoid duplicate full sync: initSession already loads on cold start.
        // TOKEN_REFRESHED fires often — refetching all tables every ~hour is unnecessary.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          void loadUserData(session.user.id);
        }
      } else {
        // If logout was intentional, don't try to recover — clear immediately
        if (intentionalLogoutRef.current) {
          clearSignedOutState();
          return;
        }

        const recovered = await recoverSupabaseSession();
        if (recovered?.user) {
          const appUser = mapSupabaseUserToApp(recovered.user);
          setUser(appUser);
          persistAuthUserIdsForStorage(recovered.user.id);
          setSupabaseRlsUserId(recovered.user.id);
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            void loadUserData(recovered.user.id);
          }
          return;
        }
        clearSignedOutState();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener('guestModeActivated', handleGuestModeActivated);
      window.removeEventListener(CATSHARE_AUTH_RESTORED_EVENT, syncAfterLocalAuthRestore);
    };
  }, []);

  const logout = async () => {
    try {
      setError(null);
      intentionalLogoutRef.current = true;

      if (authService.isOfflineGuest()) {
        authService.logoutOfflineGuest();
        console.log('👤 Guest user logged out');
      } else {
        await supabase.auth.signOut();
      }

      setUser(null);
      setSupabaseData(null);
      clearAuthUserIdsFromStorage();
      setSupabaseRlsUserId(null);

      localStorage.removeItem('products');
      localStorage.removeItem('deletedProducts');
      localStorage.removeItem('retailProducts');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
      throw err;
    } finally {
      intentionalLogoutRef.current = false;
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
        refreshSupabaseData,
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
