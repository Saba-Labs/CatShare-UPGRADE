import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  AuthError,
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

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
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  // Anonymous Authentication - Guest account
  loginAsGuest: async () => {
    try {
      const result = await signInAnonymously(auth);
      return result.user;
    } catch (error) {
      throw handleAuthError(error);
    }
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
      'auth/internal-error': 'An internal error occurred. Please try again.',
    };

    const message = errorMessages[authError.code] || authError.message || 'Authentication failed';
    const authException = new Error(message);
    authException.name = authError.code;
    return authException;
  }

  return new Error('An unexpected error occurred');
}
