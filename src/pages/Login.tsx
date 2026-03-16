import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { FaGoogle } from 'react-icons/fa';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { safeGetFromStorage } from '../utils/safeStorage';

export default function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, supabaseData, supabaseDataLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);
  const [hasJustLoggedIn, setHasJustLoggedIn] = useState(false);

  // After user logs in and supabaseData loads, check if they need onboarding
  useEffect(() => {
    if (hasJustLoggedIn && !supabaseDataLoading && supabaseData) {
      console.log('🔍 Login check - supabaseData:', supabaseData);
      console.log('🔍 fieldsDefinition from Supabase:', supabaseData.fieldsDefinition);

      showToast('Login successful!', 'success');

      // Check if user has already configured their fields
      // First check Supabase, then fallback to localStorage for old users
      const hasSupabaseFields = supabaseData.fieldsDefinition &&
                               supabaseData.fieldsDefinition.fields &&
                               Array.isArray(supabaseData.fieldsDefinition.fields) &&
                               supabaseData.fieldsDefinition.fields.length > 0;

      const localStorageFields = safeGetFromStorage('fieldsDefinition', null);
      const hasLocalFields = localStorageFields &&
                            localStorageFields.fields &&
                            Array.isArray(localStorageFields.fields) &&
                            localStorageFields.fields.length > 0;

      const hasFieldsDefinition = hasSupabaseFields || hasLocalFields;

      console.log('🔍 hasSupabaseFields:', hasSupabaseFields);
      console.log('🔍 hasLocalFields:', hasLocalFields);
      console.log('🔍 hasFieldsDefinition (combined):', hasFieldsDefinition);

      // If user has local fields but no Supabase fields, sync them to cloud (for old users)
      if (hasLocalFields && !hasSupabaseFields && user?.uid) {
        console.log('🔄 Syncing local fields to Supabase for old user...');
        import('../services/supabaseSync').then(({ syncFieldsDefinition }) => {
          syncFieldsDefinition(user.uid, localStorageFields)
            .then(result => {
              if (result.success) {
                console.log('✅ Successfully synced local fields to Supabase');
              } else {
                console.warn('⚠️ Failed to sync local fields:', result.error);
              }
            });
        });
      }

      if (hasFieldsDefinition) {
        // Returning user - go to main app
        console.log('✅ User has fields definition (Supabase or localStorage) - redirecting to home');
        navigate('/');
      } else {
        // New user - go to onboarding
        console.log('🆕 No fields definition found - redirecting to welcome');
        navigate('/welcome');
      }

      setHasJustLoggedIn(false);
    }
  }, [hasJustLoggedIn, supabaseDataLoading, supabaseData, user, navigate, showToast]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.loginWithEmail(email, password);
      setHasJustLoggedIn(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setAuthLoading('google');
    try {
      const user = await authService.loginWithGoogle();
      if (user) {
        setHasJustLoggedIn(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google login failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setAuthLoading(null);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setAuthLoading('guest');
    try {
      const user = await authService.loginAsGuest();
      if (user) {
        setHasJustLoggedIn(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Guest login failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setAuthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="mb-6 space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 transition-colors"
            >
              <FaGoogle className="text-red-600" />
              <span className="text-gray-700 font-medium">
                {authLoading === 'google' ? 'Signing in...' : 'Google'}
              </span>
            </button>

            <button
              onClick={handleGuestLogin}
              disabled={authLoading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 transition-colors"
            >
              <span className="text-gray-700 font-medium">
                {authLoading === 'guest' ? 'Signing in...' : 'Continue as Guest'}
              </span>
            </button>
          </div>

          {/* Footer Links */}
          <div className="text-center space-y-2 text-sm">
            <div>
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </div>
            <Link to="/forgot-password" className="text-blue-600 hover:underline block">
              Forgot password?
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
