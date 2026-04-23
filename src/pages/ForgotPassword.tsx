import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { FiMail, FiAlertCircle, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const isNativeApp = Capacitor.isNativePlatform();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.sendPasswordReset(email);
      setSubmitted(true);
      showToast('Password reset email sent!', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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

      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="hidden lg:flex relative shrink-0 lg:w-[46%] xl:w-[44%] flex-col justify-center px-6 py-10 xl:px-16 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.24]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, rgba(96, 165, 250, 0.24), transparent 45%), radial-gradient(circle at 82% 78%, rgba(129, 140, 248, 0.16), transparent 42%)',
          }}
        />
        <div className="relative z-10 max-w-md mx-auto lg:mx-0 w-full">
          <Link
            to="/website"
            className="inline-flex items-center gap-3 group mb-10 min-h-[44px] -ml-1 pl-1 rounded-lg active:opacity-90"
          >
            <span className="inline-flex items-center justify-center shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/10">
              <img
                src="/CatShare_logo.png"
                alt="CatShare"
                className="h-8 w-auto max-h-10 object-contain object-center"
              />
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white group-active:text-blue-100 transition-colors">
              CatShare
            </span>
          </Link>

          <p className="text-sm font-medium tracking-wide text-sky-200/95 mb-3">Account recovery</p>
          <h1 className="text-[1.75rem] xl:text-3xl font-semibold tracking-tight leading-snug text-white mb-3">
            Get back into your account.
          </h1>
          <p className="text-sm text-blue-100/90 leading-relaxed">
            Enter your login email and we will send a secure reset link. It only takes a minute.
          </p>
        </div>
      </motion.aside>

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
          <div className="mb-2 -mt-1 lg:hidden">
            <Link
              to="/login"
              className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pl-2 pr-3 text-[13px] font-semibold text-white/90 hover:text-white active:bg-white/10 sm:gap-2 sm:text-sm"
            >
              <FiArrowLeft className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" aria-hidden />
              Back
            </Link>
          </div>

          <div className="mb-3 text-center lg:mb-4 lg:hidden">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {submitted ? 'Check your email' : 'Reset password'}
            </h2>
            <p className="mt-1 text-sm text-blue-100/80">
              {submitted ? 'We sent you a reset link' : 'Enter your email to receive a reset link'}
            </p>
          </div>

          <div
            className={[
              'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-lg shadow-slate-300/20 sm:p-6 lg:p-8',
              isNativeApp ? 'shadow-slate-300/15' : '',
              isLoading ? 'relative pointer-events-none opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[1.5px]">
                <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 sm:h-10 sm:w-10" />
                  <p className="text-xs font-medium text-slate-700 sm:text-sm">Sending...</p>
                </div>
              </div>
            )}

            <div className="hidden lg:block mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {submitted ? 'Check your email' : 'Reset password'}
              </h2>
              <p className="text-slate-500 text-sm mt-1.5">
                {submitted
                  ? 'We sent you a password reset link'
                  : 'Enter your email to receive a password reset link'}
              </p>
            </div>

            {submitted ? (
              <div className="space-y-4 sm:space-y-5">
                <div className="flex flex-col items-center text-center">
                  <FiCheckCircle className="h-11 w-11 text-emerald-600 sm:h-12 sm:w-12" />
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-600 sm:text-sm">
                    We sent a reset link to <span className="font-semibold text-slate-800">{email}</span>.
                    Please check your inbox and spam folder.
                  </p>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                    }}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 active:bg-slate-50 sm:py-3 sm:text-base"
                  >
                    Try another email
                  </button>
                  <Link
                    to="/login"
                    className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:from-blue-500 active:to-indigo-500 sm:py-3.5 sm:text-base"
                  >
                    Back to login
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3 sm:mb-6 sm:gap-3 sm:p-3.5">
                    <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 sm:h-[18px] sm:w-[18px]" />
                    <p className="text-[13px] leading-snug text-red-800 sm:text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mb-4 space-y-3.5 sm:mb-5 sm:space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:mb-1.5 lg:text-xs"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-11 pr-4 text-[15px] text-slate-900 placeholder:text-[14px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:py-3 sm:text-[16px] sm:placeholder:text-[15px] lg:text-base"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1.5 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:from-blue-500 active:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-2 sm:py-3.5 sm:text-base"
                  >
                    Send reset link
                  </button>
                </form>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-center sm:mt-4 sm:space-y-3 sm:pt-4">
                  <Link
                    to="/login"
                    className="flex min-h-[40px] items-center justify-center py-1 text-xs font-medium text-slate-500 hover:text-slate-800 sm:min-h-[44px] sm:py-2 sm:text-sm"
                  >
                    Back to login
                  </Link>
                  <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                    Don&apos;t have an account?{' '}
                    <Link
                      to="/register"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-500 sm:text-sm"
                    >
                      Sign up
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          <p className="mt-2 pb-1 text-center text-[11px] text-neutral-500 sm:mt-3 sm:text-xs lg:hidden">
            <Link
              to="/website"
              className="inline-block py-1.5 font-medium text-neutral-400 hover:text-white active:text-white sm:py-2"
            >
              About CatShare
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
