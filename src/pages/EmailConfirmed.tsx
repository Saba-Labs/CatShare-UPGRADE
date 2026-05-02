import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { FiCheckCircle, FiSmartphone } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { resolveStoreSlugFromHostname } from '../utils/storefrontDomain';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.catshare.official';

/**
 * Landing page for Supabase signup confirmation email (`emailRedirectTo`).
 * Establishes session from URL tokens, then signs out so the browser is not left logged in — user continues in the app.
 */
export default function EmailConfirmed() {
  const isNativeApp = Capacitor.isNativePlatform();
  const subdomainStoreSlug = resolveStoreSlugFromHostname();

  const [phase, setPhase] = useState<'loading' | 'confirmed' | 'missing'>('loading');

  useEffect(() => {
    if (subdomainStoreSlug) return;
    let cancelled = false;
    let done = false;

    const complete = async () => {
      if (cancelled || done) return;
      done = true;
      setPhase('confirmed');
      await supabase.auth.signOut();
    };

    const trySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !cancelled) await complete();
    };

    void trySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled || done) return;
      if (session?.user) await complete();
    });

    const timeout = window.setTimeout(() => {
      if (cancelled || done) return;
      setPhase('missing');
    }, 15000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [subdomainStoreSlug]);

  if (subdomainStoreSlug) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900 text-white p-6">
        <p className="text-sm text-center">Open this link from your confirmation email on the main CatShare site.</p>
      </div>
    );
  }

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
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.38]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 22%, rgba(96, 165, 250, 0.38), transparent 46%), radial-gradient(circle at 82% 78%, rgba(129, 140, 248, 0.28), transparent 42%), radial-gradient(circle at 50% 108%, rgba(59, 130, 246, 0.15), transparent 48%)',
        }}
      />
      <div className="fixed inset-x-0 top-0 z-50 h-[40px] bg-black" aria-hidden />

      <div
        style={{ WebkitOverflowScrolling: 'touch' }}
        className="flex-1 flex flex-col min-h-0 overflow-y-auto px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] relative z-10 justify-center items-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="w-full max-w-[420px] mx-auto text-center"
        >
          {phase === 'loading' && (
            <>
              <div className="mx-auto mb-5 h-12 w-12 rounded-full border-2 border-white/25 border-t-sky-400 animate-spin" />
              <h1 className="text-lg font-semibold tracking-tight text-white">Confirming your email…</h1>
              <p className="mt-2 text-sm text-blue-100/85">One moment.</p>
            </>
          )}

          {phase === 'confirmed' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <FiCheckCircle className="h-8 w-8" aria-hidden />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Email confirmed</h1>
              <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
                Your email is verified. Continue in the <strong className="text-white">CatShare app</strong> — sign in with the same email and password.
              </p>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-slate-100"
              >
                <FiSmartphone className="h-5 w-5 shrink-0" aria-hidden />
                Get the app
              </a>
              <p className="mt-5 text-xs text-blue-200/70">
                You can close this browser tab — your account is ready in the app.
              </p>
            </>
          )}

          {phase === 'missing' && (
            <>
              <h1 className="text-lg font-semibold tracking-tight text-white">Link expired or invalid</h1>
              <p className="mt-2 text-sm text-blue-100/85 leading-relaxed">
                Open the confirmation link from your latest email, or register again from the app.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
              >
                Back to log in
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
