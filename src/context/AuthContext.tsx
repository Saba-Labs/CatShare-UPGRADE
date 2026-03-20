import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { fetchAllUserData } from '../services/supabaseSync';
import { setSupabaseUser } from '../supabaseClient';
import { authService } from '../services/authService';

interface SupabaseUserData {
  products: any[];
  deletedProducts: any[];
  categories: any[];
  cataloguesDefinition: any;
  fieldsDefinition: any;
  userSettings: any;
}

interface AuthContextType {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseData, setSupabaseData] = useState<SupabaseUserData | null>(null);
  const [supabaseDataLoading, setSupabaseDataLoading] = useState(false);

  useEffect(() => {
    // Check if user is in offline guest mode
    const checkGuestMode = () => {
      const isOfflineGuest = authService.isOfflineGuest();

      if (isOfflineGuest) {
        // Offline guest mode - set up guest user without Firebase
        const guestId = localStorage.getItem('guestUserId');
        const guestUser = {
          uid: guestId || `guest-${Date.now()}`,
          email: null,
          displayName: 'Guest User',
          isAnonymous: true,
        } as any;

        setUser(guestUser);
        console.log('👤 Offline guest mode activated');
        setLoading(false);
        setSupabaseData(defaultSupabaseData); // No cloud data for guests
        return true;
      }
      return false;
    };

    // Check guest mode on mount
    if (checkGuestMode()) {
      return;
    }

    // Listen for guest mode activation (can happen after initial mount)
    const handleGuestModeActivated = () => {
      console.log('🎯 Guest mode activation detected');
      checkGuestMode();
    };

    window.addEventListener('guestModeActivated', handleGuestModeActivated);

    // Normal Firebase authentication flow
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Store user UID in localStorage for sync operations
      if (currentUser && currentUser.uid) {
        try {
          localStorage.setItem('firebaseUserId', currentUser.uid);
          console.log('✅ Stored Firebase user ID in localStorage:', currentUser.uid);
          // Also set Supabase user header source for RLS
          setSupabaseUser(currentUser.uid);
        } catch (err) {
          console.warn('⚠️ Could not store user ID in localStorage:', err);
        }
      } else {
        try {
          localStorage.removeItem('firebaseUserId');
          localStorage.removeItem('supabase_user_id');
          console.log('🔄 Cleared Firebase user ID from localStorage');
        } catch (err) {
          console.warn('⚠️ Could not remove user ID from localStorage:', err);
        }
      }

      // Fetch Supabase data if user is logged in
      if (currentUser && currentUser.uid) {
        setSupabaseDataLoading(true);
        try {
          const result = await fetchAllUserData(currentUser.uid);
          if (result.success && result.data) {
            setSupabaseData(result.data as SupabaseUserData);
            console.log('✅ Fetched Supabase data for user:', currentUser.uid);
          } else {
            console.warn('⚠️ Failed to fetch Supabase data:', result.error);
            // Initialize with empty data if fetch fails
            setSupabaseData(defaultSupabaseData);
          }
        } catch (err) {
          console.error('❌ Error fetching Supabase data:', err);
          setSupabaseData(defaultSupabaseData);
        } finally {
          setSupabaseDataLoading(false);
        }
      } else {
        // Clear data when user logs out
        setSupabaseData(null);
      }

      setLoading(false);
    }, (error) => {
      setError(error.message);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('guestModeActivated', handleGuestModeActivated);
    };
  }, []);

  const logout = async () => {
    try {
      setError(null);

      // Handle offline guest logout
      if (authService.isOfflineGuest()) {
        authService.logoutOfflineGuest();
        console.log('👤 Guest user logged out');
      } else {
        // Normal Firebase logout
        await signOut(auth);
      }

      setUser(null);
      setSupabaseData(null);

      // Security: remove legacy/unkeyed local product caches so another account
      // on the same device cannot read previous user's local data during login.
      localStorage.removeItem("products");
      localStorage.removeItem("deletedProducts");
      localStorage.removeItem("retailProducts");
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
        clearError
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
