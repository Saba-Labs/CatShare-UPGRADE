import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import {
  FiMail,
  FiLock,
  FiAlertCircle,
  FiShoppingBag,
  FiZap,
  FiImage,
  FiEye,
  FiEyeOff,
  FiArrowLeft,
} from 'react-icons/fi';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { safeGetFromStorage } from '../utils/safeStorage';
import { supabase } from '../supabaseClient';

const introHighlights = [
  {
    icon: FiShoppingBag,
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
  const location = useLocation();
  const { showToast } = useToast();
  const { user, supabaseData, loading: authBootstrapLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);
  const [hasJustLoggedIn, setHasJustLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  /** Mobile-only: full-screen landing → tap Log in to show the form (desktop unchanged). */
  const [mobileShowLoginForm, setMobileShowLoginForm] = useState(false);

  /** Avoid double redirect / double toast (e.g. React Strict Mode, re-renders). */
  const postAuthRedirectDoneRef = useRef(false);
  const fieldsSyncAttemptedRef = useRef(false);

  useEffect(() => {
    postAuthRedirectDoneRef.current = false;
    fieldsSyncAttemptedRef.current = false;
  }, [user?.uid]);

  /** Register “Sign in” → land on the sign-in form on mobile (skip marketing landing). */
  useEffect(() => {
    const s = location.state as { showLoginForm?: boolean } | undefined;
    if (!s?.showLoginForm) return;
    setMobileShowLoginForm(true);
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: {} }
    );
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  /** Password recovery links may land on /login first; send user to set-password page. */
  useLayoutEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  /** One-shot sync of legacy local fields when cloud snapshot exists (any visit with session on /login). */
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
  }, [authBootstrapLoading, user, supabaseData]);

  /**
   * After explicit sign-in from this page: redirect home as soon as session is ready.
   * Do not redirect recovery sessions or "already logged in" visits here (see below).
   */
  useEffect(() => {
    if (authService.isOfflineGuest()) return;
    if (authBootstrapLoading) return;
    if (!user?.uid || user.isAnonymous) return;
    if (!hasJustLoggedIn) return;

    if (postAuthRedirectDoneRef.current) return;
    postAuthRedirectDoneRef.current = true;

    showToast('Login successful!', 'success');
    setHasJustLoggedIn(false);

    navigate('/', { replace: true });
  }, [authBootstrapLoading, user, hasJustLoggedIn, navigate, showToast]);

  /** Already logged in and opened /login: brief delay so PASSWORD_RECOVERY can navigate first. */
  useEffect(() => {
    if (authService.isOfflineGuest()) return;
    if (authBootstrapLoading) return;
    if (!user?.uid || user.isAnonymous) return;
    if (hasJustLoggedIn) return;
    if (location.pathname !== '/login') return;

    const t = window.setTimeout(() => {
      if (window.location.pathname !== '/login') return;
      navigate('/', { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [authBootstrapLoading, user, hasJustLoggedIn, location.pathname, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.loginWithEmail(email, password);
      setIsRedirecting(true);
      setHasJustLoggedIn(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setAuthLoading('google');
    try {
      const user = await authService.loginWithGoogle();
      if (user) {
        setIsRedirecting(true);
        setHasJustLoggedIn(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google login failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setAuthLoading(null);
    }
  };

  const formColumnClassName = [
    'flex-1 flex flex-col min-h-0 lg:min-h-[100dvh]',
    mobileShowLoginForm ? 'flex' : 'hidden lg:flex',
    'overflow-y-auto lg:overflow-visible',
    'px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]',
    'pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-2 lg:pt-10 lg:pb-10 xl:p-12',
    'lg:items-center lg:justify-center',
  ].join(' ');

  return (
    <div
      className={[
        'min-h-[100dvh] min-h-screen flex flex-col lg:flex-row bg-slate-950 lg:bg-slate-50',
        'pt-[calc(40px+env(safe-area-inset-top,0px))] lg:pt-[env(safe-area-inset-top,0px)]',
        isNativeApp ? 'overscroll-y-contain' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="fixed inset-x-0 top-0 z-50 h-[40px] bg-black lg:hidden" aria-hidden />

      {/* Full-screen landing (layout only on small screens) — CatShare palette */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className={[
          'lg:hidden flex flex-col min-h-[100dvh] shrink-0 w-full relative overflow-hidden',
          'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white',
          mobileShowLoginForm ? 'hidden' : 'flex',
        ].join(' ')}
        aria-hidden={mobileShowLoginForm}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.38]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 22%, rgba(96, 165, 250, 0.38), transparent 46%), radial-gradient(circle at 82% 78%, rgba(129, 140, 248, 0.28), transparent 42%), radial-gradient(circle at 50% 108%, rgba(59, 130, 246, 0.15), transparent 48%)',
          }}
        />
        <div className="relative z-10 flex flex-1 flex-col px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-1 flex-col items-center justify-center text-center pt-2 pb-6 min-h-0">
            <Link
              to="/website"
              className="inline-flex flex-col items-center gap-3 active:opacity-90 mb-6 sm:mb-7"
            >
              <span className="inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-1 ring-black/10">
                <img
                  src="/CatShare_logo.png"
                  alt="CatShare"
                  className="h-10 w-auto max-h-[48px] object-contain object-center sm:h-11 sm:max-h-[52px]"
                />
              </span>
              <span className="text-base font-semibold tracking-tight text-white sm:text-lg">CatShare</span>
            </Link>

            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-200/90 sm:text-[11px] sm:tracking-[0.16em]">
              Share faster · Sell quicker
            </p>

            <h1 className="max-w-[17.5rem] px-2 text-[1.4375rem] font-bold leading-tight tracking-tight text-white sm:max-w-none sm:text-[1.625rem] sm:leading-snug">
              Create. Share. Sell.
            </h1>
            <p className="mt-2.5 max-w-[20rem] px-2 text-[13px] leading-relaxed text-blue-100/85 sm:mt-3 sm:max-w-[19rem] sm:text-sm">
            Built for Instagram and WhatsApp sellers — Catalogues, storefront and orders all in one place.
            </p>
          </div>

          <div className="mx-auto mt-auto w-full max-w-md space-y-2 pb-1 sm:space-y-2.5">
            <Link
              to="/register"
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-indigo-950/45 ring-1 ring-sky-300/25 transition-colors hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 sm:min-h-[46px] sm:py-2.5 sm:text-sm"
            >
              Sign up free
            </Link>
            <button
              type="button"
              onClick={() => setMobileShowLoginForm(true)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-sky-200/70 bg-sky-400/10 px-4 py-2 text-[13px] font-semibold text-sky-50 backdrop-blur-[2px] transition-colors hover:bg-sky-400/15 hover:border-sky-200/90 active:bg-sky-400/20 sm:min-h-[46px] sm:py-2.5 sm:text-sm"
            >
              Log in
            </button>

            <div className="relative py-1.5 sm:py-2">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-white/15" aria-hidden />
              <p className="relative px-2 text-center text-[10px] font-medium uppercase tracking-wide text-blue-200/75 sm:text-[11px]">
                Or continue with
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading !== null || isRedirecting}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:pointer-events-none disabled:opacity-50 sm:min-h-[46px] sm:gap-2.5 sm:py-2.5 sm:text-sm"
            >
              <svg
                className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5"
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
              {authLoading === 'google' || isRedirecting ? 'Signing in…' : 'Continue with Google'}
            </button>
          </div>

          <p className="relative z-10 mt-4 text-center text-[10px] text-blue-200/65 sm:mt-5 sm:text-xs">
            <Link
              to="/website"
              className="inline-block py-1.5 font-medium text-sky-200/90 underline-offset-4 hover:text-white hover:underline sm:py-2"
            >
              What is CatShare?
            </Link>
          </p>
        </div>

        {(authLoading === 'google' || isRedirecting) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm">
            <div className="h-9 w-9 rounded-full border-2 border-white/25 border-t-white animate-spin sm:h-10 sm:w-10" />
            <p className="mt-2.5 text-xs font-medium text-white sm:mt-3 sm:text-sm">Signing in…</p>
          </div>
        )}
      </motion.section>

      {/* Brand / intro — desktop only (unchanged split layout) */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="hidden lg:flex relative shrink-0 lg:w-[46%] xl:w-[44%] flex-col justify-center px-5 pt-2 pb-6 sm:px-8 lg:min-h-[100dvh] lg:py-10 lg:px-12 xl:px-16 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white"
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
            Create. Share. Sell.
          </h1>

          {/* Mobile / tablet: one line — keeps sign-in above the fold */}
          <p className="text-sm text-blue-100/90 leading-snug mb-0 lg:hidden">
            Create your catalogue in minutes. Share as images, PDFs, links, or your online store — and start taking orders.
          </p>

          {/* Desktop: full intro */}
          <p className="hidden lg:block text-sm text-blue-100/90 leading-relaxed mb-6 lg:mb-8">
            Create a branded storefront to showcase your products, manage inventory, and sell directly to customers with instant order management.
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
      <div style={{ WebkitOverflowScrolling: 'touch' }} className={formColumnClassName}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="w-full max-w-[420px] mx-auto lg:my-auto"
        >
          {mobileShowLoginForm && (
            <div className="mb-3 -mt-1 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileShowLoginForm(false)}
                className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pl-2 pr-3 text-[13px] font-semibold text-white/90 hover:text-white active:bg-white/10 sm:gap-2 sm:text-sm"
              >
                <FiArrowLeft className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" aria-hidden />
                Back
              </button>
            </div>
          )}

          <div className="mb-3 text-center lg:mb-4 lg:hidden">
            <h2
              className={`text-base font-semibold sm:text-lg ${mobileShowLoginForm ? 'text-white' : 'text-slate-900'}`}
            >
              Welcome
            </h2>
            <p
              className={`mt-0.5 text-xs sm:mt-1 sm:text-sm ${mobileShowLoginForm ? 'text-neutral-400' : 'text-slate-500'}`}
            >
              Sign in to your catalogues
            </p>
          </div>

          <div
            className={[
              'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-lg shadow-slate-300/20 sm:p-8 lg:p-8',
              isNativeApp ? 'shadow-slate-300/15' : '',
              isRedirecting ? 'relative pointer-events-none opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isRedirecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 sm:h-10 sm:w-10" />
                  <p className="text-xs font-medium text-slate-700 sm:text-sm">Signing in...</p>
                </div>
              </div>
            )}
            <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome</h2>
              <p className="text-slate-500 text-sm mt-1.5">Sign in to continue to your catalogues</p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3 sm:mb-6 sm:gap-3 sm:p-3.5">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 sm:h-[18px] sm:w-[18px]" />
                <p className="text-[13px] leading-snug text-red-800 sm:text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="mb-5 space-y-3.5 sm:mb-6 sm:space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                >
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
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-11 pr-4 text-[15px] text-slate-900 placeholder:text-[14px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:py-3 sm:text-[16px] sm:placeholder:text-[15px] lg:text-base"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                >
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-11 pr-12 text-[15px] text-slate-900 placeholder:text-[14px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:py-3 sm:text-[16px] sm:placeholder:text-[15px] lg:text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-4 w-4" />
                    ) : (
                      <FiEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1.5 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:from-blue-500 active:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-2 sm:py-3.5 sm:text-base"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="relative mb-5 sm:mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-[11px] font-medium text-slate-500 sm:px-3 sm:text-xs lg:text-xs">
                  Or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading !== null}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2.5 sm:py-3 sm:text-base"
            >
              <svg
                className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5"
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

            <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-center sm:mt-8 sm:space-y-3 sm:pt-6">
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-500 sm:text-sm"
                >
                  Sign up
                </Link>
              </p>
              <Link
                to="/forgot-password"
                className="flex min-h-[44px] items-center justify-center py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 sm:py-2 sm:text-sm"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <p
            className={[
              'mt-3 pb-1 text-center text-[11px] sm:mt-4 sm:text-xs lg:hidden',
              mobileShowLoginForm ? 'text-neutral-500' : 'text-slate-500',
            ].join(' ')}
          >
            <Link
              to="/website"
              className={[
                'inline-block py-1.5 font-medium sm:py-2',
                mobileShowLoginForm
                  ? 'text-neutral-400 hover:text-white active:text-white'
                  : 'text-blue-600 active:text-blue-700',
              ].join(' ')}
            >
              About CatShare
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
