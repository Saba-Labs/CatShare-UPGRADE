import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail,
  updateProfile,
  AuthError,
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Initialize Google provider
const googleProvider = new GoogleAuthProvider();

// Configure provider
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const authService = {
  // Email & Password Authentication
  registerWithEmail: async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: displayName,
        });
      }
      return userCredential.user;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  loginWithEmail: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  // Google Authentication - Popup method
  loginWithGoogle: async () => {
    try {
      // Native (Capacitor): use GoogleAuth plugin to avoid broken browser popup/redirect flows.
      if (Capacitor.getPlatform() !== 'web') {
        const clientId = (import.meta as any).env?.VITE_GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
          throw new Error(
            'Missing VITE_GOOGLE_WEB_CLIENT_ID. Set your Google OAuth Web Client ID in .env.local, then rebuild & run npx cap sync.'
          );
        }

        // Force account chooser (otherwise Android may silently reuse last account)
        try {
          await GoogleAuth.signOut();
        } catch {
          // ignore
        }

        const res = await GoogleAuth.signIn();
        const idToken = (res as any)?.authentication?.idToken;
        if (!idToken) {
          throw new Error('Google sign-in failed: missing idToken');
        }
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      }

      // Web: popup works fine
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  // Offline Guest Mode - No Firebase authentication
  // This is for offline/demo use only without any backend connection
  loginAsOfflineGuest: async () => {
    // Create a pseudo guest user object stored only in localStorage
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('guestUserId', guestId);
    localStorage.setItem('isOfflineGuest', 'true');

    // Dispatch custom event to notify AuthContext of guest mode activation
    window.dispatchEvent(new CustomEvent('guestModeActivated', { detail: { guestId } }));

    // Return a minimal user-like object for compatibility
    return {
      uid: guestId,
      email: null,
      displayName: 'Guest User',
      isAnonymous: true,
    };
  },

  // Check if user is in offline guest mode
  isOfflineGuest: () => {
    return localStorage.getItem('isOfflineGuest') === 'true';
  },

  // Logout guest user from offline mode
  logoutOfflineGuest: () => {
    localStorage.removeItem('guestUserId');
    localStorage.removeItem('isOfflineGuest');
  },

  // Password Reset
  sendPasswordReset: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  // Get current user
  getCurrentUser: () => {
    return auth.currentUser;
  },
};

// Error handling
function handleAuthError(error: unknown): Error {
  if (error instanceof Error) {
    const authError = error as AuthError;

    const errorMessages: { [key: string]: string } = {
      'auth/email-already-in-use': 'This email is already registered. Please login or use a different email.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many login attempts. Please try again later.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email.',
      'auth/network-request-failed': 'Network error. Please check your internet connection.',
      'auth/invalid-credential': 'Google login failed. Please try again.',
      'auth/internal-error': 'An internal error occurred. Please try again.',
    };

    const message = errorMessages[authError.code] || authError.message || 'Authentication failed';
    const authException = new Error(message);
    authException.name = authError.code;
    return authException;
  }

  return new Error('An unexpected error occurred');
}
