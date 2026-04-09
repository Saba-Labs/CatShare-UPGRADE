import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { FiMail, FiLock, FiAlertCircle, FiStore, FiZap, FiImage } from 'react-icons/fi';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { safeGetFromStorage } from '../utils/safeStorage';

const introHighlights = [
  {
    icon: FiStore,
    title: 'Branded storefronts',
    text: 'Showcase and sell your collection.',
  },
  {
    icon: FiZap,
    title: 'Easier days',
    text: 'Your prices and packs carry through—less back-and-forth.',
  },
  {
    icon: FiImage,
    title: 'Smart catalogues',
    text: 'Lists, renders, sync—aligned with what you stock.',
  },
];

export default function Login() {
  const isNativeApp = Capacitor.isNativePlatform();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, supabaseData, loading: authBootstrapLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);
  const [hasJustLoggedIn, setHasJustLoggedIn] = useState(false);

  /** Avoid double redirect / double toast (e.g. React Strict Mode, re-renders). */
  const postAuthRedirectDoneRef = useRef(false);
  const fieldsSyncAttemptedRef = useRef(false);

  useEffect(() => {
    postAuthRedirectDoneRef.current = false;
    fieldsSyncAttemptedRef.current = false;
  }, [user?.uid]);

  /**
   * Redirect off /login as soon as the session is ready — do not wait for fetchAllUserData.
   * Home shows SplashLoadingLayout (CatShare loading) while cloud sync / startup pipeline runs.
   * Welcome vs catalogue is handled in App after data loads.
   */
  useEffect(() => {
    if (authService.isOfflineGuest()) return;
    if (authBootstrapLoading) return;
    if (!user?.uid || user.isAnonymous) return;

    const data = supabaseData ?? { fieldsDefinition: null };

    const hasSupabaseFields =
      data.fieldsDefinition &&
      data.fieldsDefinition.fields &&
      Array.isArray(data.fieldsDefinition.fields) &&
      data.fieldsDefinition.fields.length > 0;

    const localStorageFields = safeGetFromStorage('fieldsDefinition', null);
    const hasLocalFields =
      localStorageFields &&
      localStorageFields.fields &&
      Array.isArray(localStorageFields.fields) &&
      localStorageFields.fields.length > 0;

    // After cloud snapshot exists: one-shot sync of legacy local fields (same as before).
    if (
      supabaseData != null &&
      hasLocalFields &&
      !hasSupabaseFields &&
      user?.uid &&
      !fieldsSyncAttemptedRef.current
    ) {
      fieldsSyncAttemptedRef.current = true;
      import('../services/supabaseSync').then(({ syncFieldsDefinition }) => {
        syncFieldsDefinition(user.uid, localStorageFields).then((result) => {
          if (result.success) {
            console.log('✅ Successfully synced local fields to Supabase');
          } else {
            console.warn('⚠️ Failed to sync local fields:', result.error);
          }
        });
      });
    }

    if (postAuthRedirectDoneRef.current) return;
    postAuthRedirectDoneRef.current = true;

    if (hasJustLoggedIn) {
      showToast('Login successful!', 'success');
    }
    setHasJustLoggedIn(false);

    navigate('/', { replace: true });
  }, [authBootstrapLoading, user, supabaseData, hasJustLoggedIn, navigate, showToast]);

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

  return (
    <div
      className={[
        'min-h-[100dvh] min-h-screen bg-slate-50 flex flex-col lg:flex-row',
        'pt-[env(safe-area-inset-top,0px)]',
        isNativeApp ? 'overscroll-y-contain' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Brand / intro — compact on phone / native; full story on lg+ */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="relative shrink-0 lg:w-[46%] xl:w-[44%] flex flex-col justify-center px-5 pt-2 pb-6 sm:px-8 lg:min-h-[100dvh] lg:py-10 lg:px-12 xl:px-16 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(96, 165, 250, 0.35), transparent 45%), radial-gradient(circle at 80% 80%, rgba(129, 140, 248, 0.25), transparent 40%)',
          }}
        />
        <div className="relative z-10 max-w-md mx-auto lg:mx-0 w-full">
          <Link
            to="/website"
            className="inline-flex items-center gap-2.5 sm:gap-3 group mb-4 lg:mb-10 min-h-[44px] -ml-1 pl-1 rounded-lg active:opacity-90"
          >
            <span className="inline-flex items-center justify-center shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/10">
              <img
                src="/CatShare_logo.png"
                alt="CatShare"
                className="h-8 w-auto sm:h-10 max-h-10 object-contain object-center"
              />
            </span>
            <span className="text-lg sm:text-2xl font-semibold tracking-tight text-white group-active:text-blue-100 transition-colors">
              CatShare
            </span>
          </Link>

          <p className="text-sm font-medium tracking-wide text-sky-200/95 mb-3 lg:mb-4">
            Share faster · Sell quicker
          </p>

          <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] xl:text-3xl font-semibold tracking-tight leading-snug text-white mb-2 lg:mb-3">
            Catalogues and order links—less busywork.
          </h1>

          {/* Mobile / tablet: one line — keeps sign-in above the fold */}
          <p className="text-sm text-blue-100/90 leading-snug mb-0 lg:hidden">
            Order links with live prices; buyers pick qty and message you on WhatsApp.
          </p>

          {/* Desktop: full intro */}
          <p className="hidden lg:block text-sm text-blue-100/90 leading-relaxed mb-6 lg:mb-8">
            Shareable order forms from your catalogue—clear prices and subtotals, then one tap to WhatsApp.
          </p>

          <ul className="hidden lg:block space-y-4">
            {introHighlights.map(({ icon: Icon, title, text }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.08, duration: 0.35 }}
                className="flex gap-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-sky-200" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-xs sm:text-sm text-blue-100/80 leading-snug mt-0.5">{text}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <p className="mt-4 lg:mt-10 text-xs text-blue-200/70 hidden lg:block">
            <Link
              to="/website"
              className="text-sky-200 active:text-white underline-offset-4 hover:underline font-medium py-2 inline"
            >
              Learn more
            </Link>
            {' · '}
            <Link
              to="/register"
              className="text-sky-200 active:text-white underline-offset-4 hover:underline font-medium py-2 inline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </motion.aside>

      {/* Sign-in — scrollable on small screens so keyboard / long forms don’t clip */}
      <div
        style={{ WebkitOverflowScrolling: 'touch' }}
        className={[
          'flex-1 flex flex-col min-h-0 lg:min-h-[100dvh]',
          'overflow-y-auto lg:overflow-visible',
          'px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]',
          'pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-2 lg:pt-10 lg:pb-10 xl:p-12',
          'lg:items-center lg:justify-center',
        ].join(' ')}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="w-full max-w-[420px] mx-auto lg:my-auto"
        >
          <div className="lg:hidden text-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to your catalogues</p>
          </div>

          <div
            className={[
              'rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-200/40 p-5 sm:p-8',
              isNativeApp ? 'shadow-slate-300/30' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-1.5">Sign in to continue to your catalogues</p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full min-h-[44px] pl-11 pr-4 py-3 text-base text-slate-900 placeholder:text-slate-400 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-shadow"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full min-h-[44px] pl-11 pr-4 py-3 text-base text-slate-900 placeholder:text-slate-400 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-shadow"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 min-h-[48px] py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-500 active:to-indigo-500 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 transition-all"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-500 font-medium">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading !== null}
              className="w-full min-h-[48px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-base font-medium active:bg-slate-50 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {authLoading === 'google' ? 'Signing in…' : 'Google'}
            </button>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-3 text-sm">
              <p className="text-slate-600">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-500">
                  Sign up
                </Link>
              </p>
              <Link
                to="/forgot-password"
                className="block text-slate-500 hover:text-slate-800 font-medium py-2 min-h-[44px] flex items-center justify-center"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <p className="lg:hidden text-center text-xs text-slate-500 mt-4 pb-1">
            <Link to="/website" className="text-blue-600 font-medium active:text-blue-700 py-2">
              About CatShare
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
