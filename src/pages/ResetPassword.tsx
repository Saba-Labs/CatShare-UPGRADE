import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiLock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import { logPasswordResetCompleted } from '../config/analyticsEvents';
import { resolveStoreSlugFromHostname } from '../utils/storefrontDomain';

/**
 * Landing page for Supabase password recovery email link (redirectTo must be /reset-password).
 * Session is established from URL hash by Supabase before this renders.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const subdomainStoreSlug = resolveStoreSlugFromHostname();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!subdomainStoreSlug) return;
    navigate(`/store/${subdomainStoreSlug}`, { replace: true });
  }, [subdomainStoreSlug, navigate]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(!!session?.user);
      setChecking(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      await supabase.auth.signOut();
      logPasswordResetCompleted();
      setDone(true);
      showToast('Password updated. Sign in with your new password.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update password';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goLogin = () => navigate('/login', { replace: true });

  if (checking) {
    return (
      <div className="min-h-[100dvh] min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-[100dvh] min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center"
        >
          <FiAlertCircle className="mx-auto text-amber-500 text-5xl mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link invalid or expired</h1>
          <p className="text-gray-600 text-sm mb-6">
            Request a new reset link from the login page.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
          >
            Request new link
          </Link>
          <button
            type="button"
            onClick={goLogin}
            className="mt-3 text-sm text-blue-600 hover:underline w-full"
          >
            Back to login
          </button>
        </motion.div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[100dvh] min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center"
        >
          <FiCheckCircle className="mx-auto text-green-600 text-6xl mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h1>
          <p className="text-gray-600 text-sm mb-6">You can sign in with your new password.</p>
          <button
            type="button"
            onClick={goLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
          >
            Go to login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-lg shadow-lg p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h1>
          <p className="text-gray-600 text-sm">Enter a new password for your account.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                minLength={6}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                minLength={6}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg"
          >
            {isSubmitting ? 'Saving…' : 'Update password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={goLogin} className="text-sm text-blue-600 hover:underline">
            Back to login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
