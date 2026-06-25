import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  supabase,
  getSupabaseClient,
  persistAuthUserIdsForStorage,
  clearAuthUserIdsFromStorage,
  setSupabaseRlsUserId,
  recoverSupabaseSession,
  hydrateAuthSessionFromLocalStorage,
  getAuthUserFromLocalStorage,
  CATSHARE_AUTH_RESTORED_EVENT,
  CATSHARE_CLOUD_FETCH_OK_EVENT,
} from '../supabaseClient';
import { fetchAllUserData } from '../services/supabaseSync';
import { persistCatalogueSnapshotForUser } from '../utils/catalogueCachePersist';
import { authService } from '../services/authService';
import { getDeviceId } from '../services/deviceIdService';
import { PUSH_REGISTERED_STORAGE_KEY } from '../services/pushTokenService';
import { logLogout } from '../config/analyticsEvents';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import {
  getPersistedAuthUserId,
  tryGetSupabaseUserIdFromAuthToken,
  tryDiscoverCatalogueOwnerUserIdFromStorage,
} from '../utils/authUserId';
import {
  AUTH_INIT_MAX_MS,
  isOfflineBuilderMode,
  SESSION_RECOVERY_INTERVAL_MS,
  SUPABASE_PROFILE_FETCH_TIMEOUT_MS,
  SUPABASE_SESSION_TIMEOUT_MS,
} from '../config/offlineBuilder';
import { getSessionWithTimeout } from '../utils/supabaseSession';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

/** App user shape from Supabase session (components use .uid, .email, .displayName). */
export type AppAuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
  /** Supabase: derived from user.email_confirmed_at */
  emailVerified?: boolean;
  /** True when we only restored cached UID and session may not be valid yet. */
  isSessionFallback?: boolean;
  /** True only when refresh token is invalid — user must sign in again (not slow network). */
  sessionExpired?: boolean;
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
    isSessionFallback: false,
    sessionExpired: false,
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
  deleteAccount: () => Promise<void>;
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
const sessionExpiredStorageKey = (uid: string) => `sessionExpired::${uid}`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseData, setSupabaseData] = useState<SupabaseUserData | null>(null);
  const [supabaseDataLoading, setSupabaseDataLoading] = useState(false);

  const intentionalLogoutRef = useRef(false);
  const intentionalLogoutResetTimerRef = useRef<number | null>(null);
  const authNullRecoveryTimerRef = useRef<number | null>(null);
  const fallbackRecoveryIntervalRef = useRef<number | null>(null);
  const userRef = useRef<AppAuthUser | null>(null);
  /** Prevents init deadline from forcing fallback after auth already confirmed. */
  const sessionConfirmedRef = useRef(false);
  const clearIntentionalLogoutResetTimer = useCallback(() => {
    if (intentionalLogoutResetTimerRef.current !== null) {
      window.clearTimeout(intentionalLogoutResetTimerRef.current);
      intentionalLogoutResetTimerRef.current = null;
    }
  }, []);
  const clearAuthNullRecoveryTimer = useCallback(() => {
    if (authNullRecoveryTimerRef.current !== null) {
      window.clearTimeout(authNullRecoveryTimerRef.current);
      authNullRecoveryTimerRef.current = null;
    }
  }, []);
  const clearFallbackRecoveryTimers = useCallback(() => {
    if (fallbackRecoveryIntervalRef.current !== null) {
      window.clearInterval(fallbackRecoveryIntervalRef.current);
      fallbackRecoveryIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const markSessionExpired = useCallback((uid: string) => {
    try {
      localStorage.setItem(sessionExpiredStorageKey(uid), 'true');
    } catch {
      /* ignore */
    }
  }, []);
  const clearSessionExpiredMark = useCallback((uid: string) => {
    try {
      localStorage.removeItem(sessionExpiredStorageKey(uid));
    } catch {
      /* ignore */
    }
  }, []);
  const refreshSupabaseData = useCallback(async (opts?: { skipLoadingIndicator?: boolean }): Promise<SupabaseUserData | null> => {
    if (authService.isOfflineGuest()) return null;
    if (isOfflineBuilderMode()) return null;

    const skipIndicator = opts?.skipLoadingIndicator === true;
    if (!skipIndicator) {
      setSupabaseDataLoading(true);
    }
    try {
      if (!isBrowserOnline()) {
        return null;
      }
      const {
        data: { session },
      } = await getSessionWithTimeout();
      const uid = session?.user?.id;
      if (!uid) return null;

      const result = await Promise.race([
        fetchAllUserData(uid),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(
            () => resolve({ success: false, error: 'Profile fetch timed out' }),
            SUPABASE_PROFILE_FETCH_TIMEOUT_MS
          )
        ),
      ]);
      const {
        data: { session: latest },
      } = await getSessionWithTimeout();
      if (!latest?.user || latest.user.id !== uid) return null;

      if (result.success && result.data) {
        const data = result.data as SupabaseUserData;
        setSupabaseData(data);
        persistCatalogueSnapshotForUser(uid, data.products, data.deletedProducts);
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
          isSessionFallback: false,
          sessionExpired: false,
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
          if (!isBrowserOnline() || isOfflineBuilderMode()) {
            if (!cancelled) {
              setSupabaseData((prev) => prev ?? defaultSupabaseData);
            }
            return;
          }
          const result = await Promise.race([
            fetchAllUserData(uid),
            new Promise<{ success: false; error: string }>((resolve) =>
              setTimeout(
                () => resolve({ success: false, error: 'Profile fetch timed out' }),
                SUPABASE_PROFILE_FETCH_TIMEOUT_MS
              )
            ),
          ]);
          if (cancelled) return;

          if (result.success && result.data) {
            const snapshot = result.data as SupabaseUserData;
            setSupabaseData(snapshot);
            persistCatalogueSnapshotForUser(
              uid,
              snapshot.products,
              snapshot.deletedProducts
            );
            console.log('✅ Fetched Supabase data for user:', uid);
            void confirmSessionAfterSuccessfulCloudFetch(uid);
          } else {
            console.warn('⚠️ Failed to fetch Supabase data:', result.error);
            setSupabaseData(defaultSupabaseData);
          }
        } catch (err) {
          if (!cancelled) {
            console.warn('⚠️ Error fetching Supabase data:', err instanceof Error ? err.message : String(err));
            try {
              const { data: { session: latest } } = await getSessionWithTimeout();
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
      sessionConfirmedRef.current = true;
      clearFallbackRecoveryTimers();
      clearSessionExpiredMark(sessionUser.id);
      const appUser = mapSupabaseUserToApp(sessionUser);
      setUser(appUser);
      persistAuthUserIdsForStorage(sessionUser.id);
      setSupabaseRlsUserId(sessionUser.id);
    };

    /** Instant exit from reconnecting when sb-*-auth-token exists (no getSession/setSession wait). */
    const promoteFromStoredAuth = (expectedUid?: string): boolean => {
      if (cancelled || hasLiveSession()) return false;
      const storedUser = getAuthUserFromLocalStorage(expectedUid);
      if (!storedUser) return false;
      applySignedInSession(storedUser);
      void hydrateAuthSessionFromLocalStorage();
      return true;
    };

    /** Cloud fetch succeeded (200) but getSession() may still hang — promote out of reconnecting. */
    const confirmSessionAfterSuccessfulCloudFetch = async (uid: string) => {
      if (cancelled || hasLiveSession()) return;
      if (promoteFromStoredAuth(uid)) return;
      try {
        const {
          data: { session: latest },
        } = await getSessionWithTimeout(SUPABASE_SESSION_TIMEOUT_MS, 1);
        if (latest?.user?.id === uid) {
          applySignedInSession(latest.user);
          return;
        }
        const recovered = await recoverSupabaseSession();
        if (recovered.session?.user?.id === uid) {
          applySignedInSession(recovered.session.user);
        }
      } catch {
        /* ignore */
      }
    };

    const hasLiveSession = (): boolean =>
      sessionConfirmedRef.current || (userRef.current != null && userRef.current.isSessionFallback !== true);

    const clearSignedOutState = () => {
      setUser(null);
      clearAuthUserIdsFromStorage();
      setSupabaseRlsUserId(null);
      setSupabaseData(null);
      setSupabaseDataLoading(false);
      inFlightProfileByUid.current.clear();
      activeProfileLoadsRef.current = 0;
      clearFallbackRecoveryTimers();
    };

    const markAuthInvalidForUid = (cachedUid: string) => {
      markSessionExpired(cachedUid);
      setUser((prev) => {
        if (!prev || prev.uid !== cachedUid) return prev;
        return { ...prev, sessionExpired: true, isSessionFallback: true };
      });
    };

    const attemptSessionRecovery = async (expectedUid?: string) => {
      if (cancelled || authService.isOfflineGuest()) return;
      if (!isBrowserOnline()) return;
      if (hasLiveSession()) return;

      const cachedUid = (expectedUid || userRef.current?.uid || getPersistedAuthUserId() || '').trim();

      if (promoteFromStoredAuth(cachedUid || undefined)) {
        const uid = getAuthUserFromLocalStorage(cachedUid || undefined)?.id || cachedUid;
        if (uid) void loadUserData(uid);
        return;
      }

      const { session, authInvalid } = await recoverSupabaseSession();
      if (cancelled) return;

      if (session?.user) {
        applySignedInSession(session.user);
        void loadUserData(session.user.id);
        return;
      }

      if (authInvalid && cachedUid) {
        markAuthInvalidForUid(cachedUid);
      }
    };

    const startFallbackRecoveryMonitor = (cachedUid: string) => {
      clearFallbackRecoveryTimers();
      if (!isBrowserOnline()) return;

      void attemptSessionRecovery(cachedUid);

      fallbackRecoveryIntervalRef.current = window.setInterval(() => {
        void attemptSessionRecovery(cachedUid);
      }, SESSION_RECOVERY_INTERVAL_MS);
    };

    /**
     * Restore a minimal signed-in user when Supabase reports no session but the device still
     * knows who was logged in. Required for offline reload and for "lie-fi" (navigator.onLine
     * true while the network/session is dead); the old `!online` guard left user null and wiped UI state.
     */
    const applyOfflineCachedIdentity = (): boolean => {
      if (hasLiveSession()) {
        return false;
      }

      let cachedUid = (getPersistedAuthUserId() || '').trim();
      if (!cachedUid) {
        const fromSessionBlob = (tryGetSupabaseUserIdFromAuthToken() || '').trim();
        if (fromSessionBlob) {
          cachedUid = fromSessionBlob;
          persistAuthUserIdsForStorage(cachedUid);
        }
      }
      if (!cachedUid && !isBrowserOnline()) {
        const fromProducts = (tryDiscoverCatalogueOwnerUserIdFromStorage() || '').trim();
        if (fromProducts) {
          cachedUid = fromProducts;
          persistAuthUserIdsForStorage(cachedUid);
        }
      }
      if (!cachedUid) return false;

      if (promoteFromStoredAuth(cachedUid)) {
        if (isBrowserOnline()) void loadUserData(cachedUid);
        return false;
      }

      clearSessionExpiredMark(cachedUid);

      setUser((prev) => {
        const fallbackName = `User ${cachedUid.slice(0, 8)}`;
        if (prev?.uid === cachedUid) {
          return {
            ...prev,
            displayName: prev.displayName || fallbackName,
            isSessionFallback: true,
            sessionExpired: false,
          };
        }
        return {
          uid: cachedUid,
          email: null,
          displayName: prev?.displayName || fallbackName,
          photoURL: prev?.photoURL ?? null,
          emailVerified: prev?.emailVerified ?? false,
          isSessionFallback: true,
          sessionExpired: false,
        };
      });
      setSupabaseRlsUserId(cachedUid);
      setSupabaseData((prev) => prev ?? defaultSupabaseData);
      setSupabaseDataLoading(false);
      persistAuthUserIdsForStorage(cachedUid);
      startFallbackRecoveryMonitor(cachedUid);
      if (isBrowserOnline()) void loadUserData(cachedUid);
      return true;
    };

    const initSession = async () => {
      const initDeadline = window.setTimeout(() => {
        if (cancelled) return;
        if (hasLiveSession()) {
          setLoading(false);
          return;
        }
        if (applyOfflineCachedIdentity()) {
          setLoading(false);
          return;
        }
        setLoading(false);
      }, AUTH_INIT_MAX_MS);

      // Fast path: no network — one session read, then cached identity. Avoids multi-retry delay
      // and keeps ProtectedRoute from showing the auth splash longer than necessary on reload.
      if (!isBrowserOnline()) {
        try {
          const fastSession = await getSessionWithTimeout();
          const session = fastSession?.data?.session ?? null;
          if (!cancelled && session?.user) {
            applySignedInSession(session.user);
            setLoading(false);
            clearTimeout(initDeadline);
            void loadUserData(session.user.id);
            return;
          }
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        if (applyOfflineCachedIdentity()) {
          setLoading(false);
          clearTimeout(initDeadline);
          return;
        }
        clearSignedOutState();
        setLoading(false);
        clearTimeout(initDeadline);
        return;
      }

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const promotedUid = promoteFromStoredAuth()
        ? getAuthUserFromLocalStorage()?.id || getPersistedAuthUserId()
        : null;
      if (promotedUid) {
        setLoading(false);
        clearTimeout(initDeadline);
        void loadUserData(promotedUid);
        return;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        if (attempt > 0) await sleep(120 * attempt);
        try {
          const {
            data: { session },
          } = await getSessionWithTimeout();
          if (cancelled) return;
          if (session?.user) {
            applySignedInSession(session.user);
            setLoading(false);
            clearTimeout(initDeadline);
            void loadUserData(session.user.id);
            return;
          }
        } catch (err) {
          console.warn('⚠️ initSession attempt failed:', err instanceof Error ? err.message : String(err));
        }
      }

      if (cancelled) return;
      const recovered = await Promise.race([
        recoverSupabaseSession(),
        new Promise<{ session: null; authInvalid: false }>((resolve) =>
          setTimeout(() => resolve({ session: null, authInvalid: false }), SUPABASE_SESSION_TIMEOUT_MS)
        ),
      ]);
      if (cancelled) return;
      if (recovered.session?.user) {
        applySignedInSession(recovered.session.user);
        setLoading(false);
        clearTimeout(initDeadline);
        void loadUserData(recovered.session.user.id);
        return;
      }

      if (recovered.authInvalid) {
        const cachedUid = (getPersistedAuthUserId() || '').trim();
        if (cachedUid && applyOfflineCachedIdentity()) {
          markAuthInvalidForUid(cachedUid);
          setLoading(false);
          clearTimeout(initDeadline);
          return;
        }
        clearSignedOutState();
        setLoading(false);
        clearTimeout(initDeadline);
        return;
      }

      if (applyOfflineCachedIdentity()) {
        setLoading(false);
        clearTimeout(initDeadline);
        return;
      }

      clearSignedOutState();
      setLoading(false);
      clearTimeout(initDeadline);
    };

    const syncAfterLocalAuthRestore = () => {
      if (authService.isOfflineGuest() || cancelled) return;
      const uid = userRef.current?.uid || getPersistedAuthUserId() || undefined;
      const restoredUid = promoteFromStoredAuth(uid || undefined)
        ? getAuthUserFromLocalStorage(uid || undefined)?.id || uid
        : null;
      if (restoredUid) {
        void loadUserData(restoredUid);
        return;
      }
      void (async () => {
        const {
          data: { session },
        } = await getSessionWithTimeout(SUPABASE_SESSION_TIMEOUT_MS, 0);
        if (session?.user) {
          applySignedInSession(session.user);
          void loadUserData(session.user.id);
        }
      })();
    };

    window.addEventListener(CATSHARE_AUTH_RESTORED_EVENT, syncAfterLocalAuthRestore);

    const onCloudFetchOk = (ev: Event) => {
      const uid = (ev as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!uid || cancelled) return;
      if (userRef.current?.isSessionFallback !== true) return;
      void confirmSessionAfterSuccessfulCloudFetch(uid);
    };
    window.addEventListener(CATSHARE_CLOUD_FETCH_OK_EVENT, onCloudFetchOk);

    const onReconnect = () => {
      void attemptSessionRecovery();
    };
    window.addEventListener('online', onReconnect);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void attemptSessionRecovery();
    };
    document.addEventListener('visibilitychange', onVisible);

    let capacitorAppListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void attemptSessionRecovery();
      }).then((handle) => {
        capacitorAppListener = handle;
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (authService.isOfflineGuest()) return;

      if (session?.user) {
        clearAuthNullRecoveryTimer();
        const wasFallback = userRef.current?.isSessionFallback === true;
        applySignedInSession(session.user);
        setLoading(false);
        // Avoid duplicate full sync on TOKEN_REFRESHED; do load when coming out of fallback.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION' || wasFallback) {
          void loadUserData(session.user.id);
        }
      } else if (event !== 'INITIAL_SESSION') {
        // If logout was intentional, don't try to recover — clear immediately
        if (intentionalLogoutRef.current) {
          clearAuthNullRecoveryTimer();
          clearIntentionalLogoutResetTimer();
          clearSignedOutState();
          intentionalLogoutRef.current = false;
          return;
        }
        // Transient null sessions can happen on network/app-resume timing.
        // Use a short grace window before force-clearing auth state.
        if (authNullRecoveryTimerRef.current !== null) {
          return;
        }
        authNullRecoveryTimerRef.current = window.setTimeout(async () => {
          authNullRecoveryTimerRef.current = null;
          const recovered = await recoverSupabaseSession();
          if (recovered.session?.user) {
            applySignedInSession(recovered.session.user);
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
              void loadUserData(recovered.session.user.id);
            }
            return;
          }
          if (recovered.authInvalid) {
            const cachedUid = (getPersistedAuthUserId() || '').trim();
            if (cachedUid) {
              markAuthInvalidForUid(cachedUid);
              return;
            }
          }
          if (applyOfflineCachedIdentity()) {
            return;
          }
          clearSignedOutState();
        }, 1200);
      }
    });

    void (async () => {
      if (!authService.isOfflineGuest()) {
        const bootUid = promoteFromStoredAuth()
          ? getAuthUserFromLocalStorage()?.id || getPersistedAuthUserId()
          : null;
        if (!cancelled && bootUid) {
          setLoading(false);
          void loadUserData(bootUid);
          return;
        }
      }
      if (!cancelled && !sessionConfirmedRef.current) {
        await initSession();
      } else if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearAuthNullRecoveryTimer();
      clearIntentionalLogoutResetTimer();
      clearFallbackRecoveryTimers();
      sub.subscription.unsubscribe();
      window.removeEventListener('guestModeActivated', handleGuestModeActivated);
      window.removeEventListener(CATSHARE_AUTH_RESTORED_EVENT, syncAfterLocalAuthRestore);
      window.removeEventListener(CATSHARE_CLOUD_FETCH_OK_EVENT, onCloudFetchOk);
      window.removeEventListener('online', onReconnect);
      document.removeEventListener('visibilitychange', onVisible);
      capacitorAppListener?.remove();
    };
  }, [clearAuthNullRecoveryTimer, clearIntentionalLogoutResetTimer, clearFallbackRecoveryTimers, clearSessionExpiredMark, markSessionExpired]);

  const logout = async () => {
    try {
      setError(null);
      clearIntentionalLogoutResetTimer();
      intentionalLogoutRef.current = true;
      intentionalLogoutResetTimerRef.current = window.setTimeout(() => {
        intentionalLogoutRef.current = false;
        intentionalLogoutResetTimerRef.current = null;
      }, 3000);

      // Delete push token for this device before logout
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const deviceId = await getDeviceId();
          await getSupabaseClient()
            .from('user_push_tokens')
            .delete()
            .eq('user_id', session.user.id)
            .eq('device_id', deviceId);
        }
      } catch (err) {
        console.warn('[CatShare] Failed to delete push token on logout:', err);
        // Continue with logout even if token deletion fails
      }

      if (authService.isOfflineGuest()) {
        authService.logoutOfflineGuest();
        console.log('👤 Guest user logged out');
      } else {
        await supabase.auth.signOut();
      }

      setUser(null);
      setSupabaseData(null);
      if (user?.uid) clearSessionExpiredMark(user.uid);
      clearAuthUserIdsFromStorage();
      setSupabaseRlsUserId(null);

      try {
        const { clearSellerCatalogueSessionHydration } = await import('../utils/catalogueSessionHydration');
        clearSellerCatalogueSessionHydration();
      } catch {
        /* ignore */
      }

      localStorage.removeItem('products');
      localStorage.removeItem('deletedProducts');
      localStorage.removeItem('retailProducts');
      localStorage.removeItem(PUSH_REGISTERED_STORAGE_KEY);
      logLogout();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteAccount = async () => {
    try {
      setError(null);

      if (!user?.uid) {
        throw new Error('User not found');
      }

      // Delete user data from Supabase and R2
      const { deleteUserAccount } = await import('../services/supabaseSync');
      const result = await deleteUserAccount(user.uid);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete account');
      }

      // Sign out (note: Supabase auth user deletion requires server-side access)
      if (!authService.isOfflineGuest()) {
        await supabase.auth.signOut();
      }

      // Clear local state
      setUser(null);
      setSupabaseData(null);
      if (user?.uid) clearSessionExpiredMark(user.uid);
      clearAuthUserIdsFromStorage();
      setSupabaseRlsUserId(null);

      localStorage.removeItem('products');
      localStorage.removeItem('deletedProducts');
      localStorage.removeItem('retailProducts');
      localStorage.removeItem(PUSH_REGISTERED_STORAGE_KEY);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
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
        refreshSupabaseData,
        logout,
        deleteAccount,
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
