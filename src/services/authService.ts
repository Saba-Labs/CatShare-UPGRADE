import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '../supabaseClient';

function mapSupabaseError(error: unknown): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: string }).message);
    const lower = msg.toLowerCase();

    const friendly: Record<string, string> = {
      'user already registered': 'This email is already registered. Please login or use a different email.',
      'invalid login credentials': 'Invalid email or password.',
      'email not confirmed': 'Please confirm your email before signing in. Check your inbox.',
      'signup requires a valid password': 'Password does not meet requirements.',
    };

    for (const [key, val] of Object.entries(friendly)) {
      if (lower.includes(key)) return new Error(val);
    }

    return new Error(msg);
  }
  return new Error('An unexpected error occurred');
}

export const authService = {
  registerWithEmail: async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            full_name: displayName.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed — no user returned');
      return data.user;
    } catch (error) {
      throw mapSupabaseError(error);
    }
  },

  loginWithEmail: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error('Login failed — no user returned');
      return data.user;
    } catch (error) {
      throw mapSupabaseError(error);
    }
  },

  loginWithGoogle: async () => {
    try {
      if (Capacitor.getPlatform() !== 'web') {
        const clientId = (import.meta as any).env?.VITE_GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
          throw new Error(
            'Missing VITE_GOOGLE_WEB_CLIENT_ID. Set your Google OAuth Web Client ID in .env.local, then rebuild & run npx cap sync.'
          );
        }

        try {
          await GoogleAuth.signOut();
        } catch {
          /* ignore */
        }

        const res = await GoogleAuth.signIn();
        const idToken = (res as any)?.authentication?.idToken;
        if (!idToken) {
          throw new Error('Google sign-in failed: missing idToken');
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (error) throw error;
        if (!data.user) throw new Error('Google login failed — no user returned');
        return data.user;
      }

      const redirectTo = `${window.location.origin}/login`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (data.url) {
        window.location.assign(data.url);
      }
      return null;
    } catch (error) {
      throw mapSupabaseError(error);
    }
  },

  loginAsOfflineGuest: async () => {
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('guestUserId', guestId);
    localStorage.setItem('isOfflineGuest', 'true');
    window.dispatchEvent(new CustomEvent('guestModeActivated', { detail: { guestId } }));
    return {
      uid: guestId,
      email: null,
      displayName: 'Guest User',
      isAnonymous: true,
    };
  },

  isOfflineGuest: () => localStorage.getItem('isOfflineGuest') === 'true',

  logoutOfflineGuest: () => {
    localStorage.removeItem('guestUserId');
    localStorage.removeItem('isOfflineGuest');
  },

  sendPasswordReset: async (email: string) => {
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) throw error;
    } catch (error) {
      throw mapSupabaseError(error);
    }
  },

  getCurrentUser: () => {
    return supabase.auth.getUser().then(({ data }) => data.user ?? null);
  },
};
