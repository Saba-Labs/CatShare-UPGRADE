import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import {
  FiMail,
  FiLock,
  FiUser,
  FiAlertCircle,
  FiCheck,
  FiArrowLeft,
} from 'react-icons/fi';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { logSignUp, logSignUpFailed, logSignUpCancelled } from '../config/analyticsEvents';
import { resolveStoreSlugFromHostname } from '../utils/storefrontDomain';

function GoogleIcon() {
  return (
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
  );
}

export default function Register() {
  const isNativeApp = Capacitor.isNativePlatform();
  const navigate = useNavigate();
  const subdomainStoreSlug = resolveStoreSlugFromHostname();
  const { showToast } = useToast();
  const { supabaseDataLoading } = useAuth();

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);
  const [hasJustSignedUp, setHasJustSignedUp] = useState(false);

  const isAuthCancelError = (msg: string): boolean => {
    const m = msg.toLowerCase();
    return (
      m.includes('cancel') ||
      m.includes('cancelled') ||
      m.includes('canceled') ||
      m.includes('popup closed') ||
      m.includes('popup_closed_by_user') ||
      m.includes('sign in cancelled') ||
      m.includes('sign-in cancelled') ||
      m.includes('sign_in_cancelled')
    );
  };

  useEffect(() => {
    if (!subdomainStoreSlug) return;
    navigate('/', { replace: true });
  }, [subdomainStoreSlug, navigate]);

  useEffect(() => {
    if (hasJustSignedUp && !supabaseDataLoading) {
      showToast('Account created successfully!', 'success');
      navigate('/welcome');
      setHasJustSignedUp(false);
    }
  }, [hasJustSignedUp, supabaseDataLoading, navigate, showToast]);

  const validatePassword = (password: string) => {
    const errors = [];
    if (password.length < 6) errors.push('At least 6 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    return errors;
  };

  const passwordRequirements = validatePassword(formData.password);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordRequirements.length > 0) {
      setError('Password does not meet requirements');
      return;
    }

    setIsLoading(true);

    try {
      await authService.registerWithEmail(formData.email, formData.password, formData.displayName);
      logSignUp('email');
      setHasJustSignedUp(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      logSignUpFailed('email', errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setAuthLoading('google');

    try {
      await authService.loginWithGoogle();
      logSignUp('google');
      setHasJustSignedUp(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google signup failed';
      if (isAuthCancelError(errorMessage)) {
        logSignUpCancelled('google');
        showToast('Signup cancelled', 'info');
      } else {
        setError(errorMessage);
        logSignUpFailed('google', errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      setAuthLoading(null);
    }
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-11 pr-4 text-[15px] text-slate-900 placeholder:text-[14px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:py-3 sm:text-[16px] sm:placeholder:text-[15px] lg:text-base';

  const showRegisterOverlay =
    isLoading || (hasJustSignedUp && supabaseDataLoading) || authLoading === 'google';

  const formColumnClassName = [
    'flex-1 flex flex-col min-h-0',
    'flex',
    'overflow-y-auto',
    'px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]',
    'pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-2',
  ].join(' ');

  return (
    <div
      className={[
        'min-h-[100dvh] min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white',
        'pt-[40px]',
        isNativeApp ? 'overscroll-y-contain' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="fixed inset-x-0 top-0 z-50 h-[40px] bg-black" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.38]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 22%, rgba(96, 165, 250, 0.38), transparent 46%), radial-gradient(circle at 82% 78%, rgba(129, 140, 248, 0.28), transparent 42%), radial-gradient(circle at 50% 108%, rgba(59, 130, 246, 0.15), transparent 48%)',
        }}
      />

      <div style={{ WebkitOverflowScrolling: 'touch' }} className={formColumnClassName + ' relative z-10'}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="w-full max-w-[420px] mx-auto"
        >
          <div className="mb-3 -mt-1">
            <Link
              to="/login"
              className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pl-2 pr-3 text-[13px] font-semibold text-sky-50 hover:text-white active:bg-white/10 sm:gap-2 sm:text-sm"
            >
              <FiArrowLeft className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" aria-hidden />
              Back
            </Link>
          </div>

          <div className="mb-3 text-center lg:mb-4">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Create account</h2>
            <p className="mt-0.5 text-sm text-blue-100/85 sm:mt-1 sm:text-base">
              Set up your CatShare workspace
            </p>
          </div>

          <div
            className={[
              'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-lg shadow-slate-300/20 sm:p-8 lg:p-8',
              isNativeApp ? 'shadow-slate-300/15' : '',
              showRegisterOverlay ? 'relative pointer-events-none opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {showRegisterOverlay && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 sm:h-10 sm:w-10" />
                  <p className="text-xs font-medium text-slate-700 sm:text-sm">
                    {isLoading
                      ? 'Creating account…'
                      : authLoading === 'google'
                        ? 'Signing up…'
                        : 'Setting up…'}
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3 sm:mb-6 sm:gap-3 sm:p-3.5">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 sm:h-[18px] sm:w-[18px]" />
                <p className="text-[13px] leading-snug text-red-800 sm:text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="mb-5 space-y-3.5 sm:mb-6 sm:space-y-4">
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                >
                  Full name
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="register-name"
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    autoComplete="name"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                >
                  Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="register-email"
                    type="email"
                    name="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                >
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="register-password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                </div>
                {formData.password && (
                  <div className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2">
                    {[
                      { text: 'At least 6 characters', met: formData.password.length >= 6 },
                      { text: 'One uppercase letter', met: /[A-Z]/.test(formData.password) },
                      { text: 'One number', met: /[0-9]/.test(formData.password) },
                    ].map((req) => (
                      <div key={req.text} className="flex items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
                        <div
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded sm:h-4 sm:w-4 ${
                            req.met ? 'bg-emerald-100' : 'bg-slate-100'
                          }`}
                        >
                          {req.met && <FiCheck className="text-[10px] text-emerald-600 sm:text-xs" />}
                        </div>
                        <span className={req.met ? 'text-emerald-800' : 'text-slate-500'}>{req.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="register-confirm"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="register-confirm"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || passwordRequirements.length > 0}
                className="mt-1.5 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:from-blue-500 active:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-2 sm:py-3.5 sm:text-base"
              >
                {isLoading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div className="relative mb-5 sm:mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-[11px] font-medium text-slate-500 sm:px-3 sm:text-xs lg:text-xs">
                  Or sign up with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={authLoading !== null}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2.5 sm:py-3 sm:text-base"
            >
              <GoogleIcon />
              {authLoading === 'google' ? 'Signing up…' : 'Google'}
            </button>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center sm:mt-8 sm:pt-6">
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                Already have an account?{' '}
                <Link
                  to="/login"
                  state={{ showLoginForm: true }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-500 sm:text-sm"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="relative z-10 mt-3 pb-1 text-center text-[11px] text-blue-200/65 sm:mt-4 sm:text-xs">
            <Link
              to="/website"
              className="inline-block py-1.5 font-medium text-sky-200/90 hover:text-white hover:underline active:text-white sm:py-2"
            >
              About CatShare
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
