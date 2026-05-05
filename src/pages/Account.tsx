import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiMail,
  FiLogOut,
  FiArrowLeft,
  FiAlertCircle,
  FiBriefcase,
  FiImage,
  FiGlobe,
  FiPhone,
  FiMessageCircle,
  FiChevronDown,
  FiInstagram,
  FiFacebook,
  FiTwitter,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSubscription } from '../context/SubscriptionContext';
import { syncUserSettings } from '../services/supabaseSync';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import { uploadProductImageToR2 } from '../services/r2Upload';
import { parseWhatsAppNumber } from '../data/whatsappCountryCodes';
import {
  type BusinessProfile,
  EMPTY_BUSINESS_PROFILE,
  businessProfileFromUserSettings,
} from '../config/businessProfile';

const BUSINESS_LOGO_PRODUCT_ID = 'business-logo';

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/90 bg-white shadow-sm overflow-hidden ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, supabaseData, refreshSupabaseData } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const { isPro, isPaidPro, isTrialActive, trialEndsAt } = useSubscription();

  const [isLoading, setIsLoading] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState('');
  const [whatsappLocalNumber, setWhatsappLocalNumber] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE);
  const [businessSectionOpen, setBusinessSectionOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true
  );
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncWhatsAppFromStorage = () => {
      const saved = localStorage.getItem('whatsappNumber') || '';
      const parsed = parseWhatsAppNumber(saved);
      setWhatsappCountryCode(parsed.dial);
      setWhatsappLocalNumber(parsed.local);
    };
    syncWhatsAppFromStorage();
    window.addEventListener('whatsappNumberLocalStorageUpdated', syncWhatsAppFromStorage);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'whatsappNumber') syncWhatsAppFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('whatsappNumberLocalStorageUpdated', syncWhatsAppFromStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleWhatsAppDialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setWhatsappCountryCode(raw.trim() === '+' ? '+' : '');
      return;
    }
    setWhatsappCountryCode(`+${digits}`);
  };

  useEffect(() => {
    setBusinessProfile(businessProfileFromUserSettings(supabaseData?.userSettings));
  }, [supabaseData?.userSettings]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setBusinessSectionOpen(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const updateBusiness = (patch: Partial<BusinessProfile>) => {
    setBusinessProfile((prev) => ({ ...prev, ...patch }));
  };

  const saveWhatsApp = async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    setError('');
    try {
      const dialDigits = whatsappCountryCode.replace(/\D/g, '');
      if (!dialDigits) {
        const msg = 'Please enter country code (e.g. +91).';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      const local = (whatsappLocalNumber || '').replace(/\D/g, '');
      if (!local) {
        const msg = 'Please enter your WhatsApp number.';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      const clean = `+${dialDigits}${local}`;
      localStorage.setItem('whatsappNumber', clean);
      window.dispatchEvent(new CustomEvent('whatsappNumberLocalStorageUpdated'));
      showToast('WhatsApp number saved', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save WhatsApp number';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (!guardCloudWrite()) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'error');
      return;
    }
    setLogoUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('Could not read file'));
        r.readAsDataURL(file);
      });
      const { url } = await uploadProductImageToR2({
        productId: BUSINESS_LOGO_PRODUCT_ID,
        dataUrl,
      });
      updateBusiness({ logoUrl: url });
      showToast('Logo uploaded — tap Save business details to store', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Logo upload failed';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const saveBusinessDetails = async () => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    setBusinessSaving(true);
    setError('');
    try {
      const res = await syncUserSettings(user.uid, {
        data: { businessProfile: { ...businessProfile } },
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to save business details');
      }
      try {
        localStorage.setItem('businessProfile', JSON.stringify(businessProfile));
      } catch {
        /* ignore */
      }
      await refreshSupabaseData();
      const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
      if (strictOnline) {
        window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
      }
      showToast('Business details saved', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save business details';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setBusinessSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError('');

    try {
      await logout();
      showToast('Logged out successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
      console.warn('Logout error:', err);
      // Don't show error toast - user will be redirected by ProtectedRoute anyway
    }
    // Don't reset isLoading - let ProtectedRoute redirect immediately
  };

  const busy = isLoading || businessSaving || logoUploading;
  const isSessionFallback = user?.isSessionFallback === true;
  const isSessionExpired = user?.sessionExpired === true;
  const accountDisplayName = user?.displayName || (user?.uid ? `User ${user.uid.slice(0, 8)}` : 'Signed in');
  const accountAvatarName = accountDisplayName || user?.email || 'User';
  const businessInputClass =
    'w-full h-11 border-0 border-b border-slate-200 bg-transparent px-0 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-0';
  const businessTextareaClass =
    'w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-0 resize-y';

  return (
    <div className="min-h-screen bg-gray-50 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="sticky top-0 h-[40px] bg-black z-50 shrink-0" />

      <header className="sticky top-[40px] z-40 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              navigate("/");
              // Open the sidemenu
              window.dispatchEvent(new CustomEvent("toggle-menu"));
            }}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
            title="Go to dashboard"
          >
            <FiArrowLeft className="text-gray-700 w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 truncate">Account</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {error ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex gap-2 items-start">
              <FiAlertCircle className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 break-words">{error}</p>
            </div>
          ) : null}

          {/* Intro: compact profile */}
          <SectionCard>
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Your account</p>
              <div className="flex gap-3 items-start">
                <img
                  src={
                    user?.photoURL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(accountAvatarName)}&background=e5e7eb&color=374151`
                  }
                  alt=""
                  className="w-14 h-14 rounded-2xl object-cover border border-gray-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{accountDisplayName}</p>
                  {user?.email ? (
                    <p className="text-sm text-gray-600 truncate mt-0.5 flex items-center gap-1.5">
                      <FiMail className="shrink-0 text-gray-400 w-3.5 h-3.5" />
                      {user.email}
                    </p>
                  ) : null}
                  {isSessionFallback ? (
                    <p
                      className={`text-xs mt-1 ${isSessionExpired ? 'text-red-700 font-medium' : 'text-amber-700'}`}
                    >
                      {isSessionExpired
                        ? 'Session expired. Please log out and log in again to sync changes.'
                        : 'Restoring cloud session... avoid editing until this completes.'}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        user?.emailVerified
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user?.emailVerified ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {user?.emailVerified ? 'Email verified' : 'Email not verified'}
                    </span>
                    {isSessionFallback ? (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          isSessionExpired ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {isSessionExpired ? 'Re-login required' : 'Reconnecting'}
                      </span>
                    ) : null}
                  </div>
                  {isSessionExpired ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoading}
                      className="mt-2 text-xs font-semibold text-red-700 hover:text-red-800 underline underline-offset-2"
                    >
                      Log out and sign in again
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Pro Plan Card */}
          <SectionCard>
            <button
              type="button"
              onClick={() => navigate('/settings/pro?from=account')}
              className="w-full text-left p-4 sm:p-5 bg-green-50 hover:bg-green-100 active:bg-green-100/80 transition-colors touch-manipulation"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base flex-shrink-0">✨</span>
                    <h3 className="text-sm font-semibold text-green-900">
                      {isPaidPro ? 'Pro Plan Active' : isTrialActive ? 'On Free Trial' : 'Free Plan'}
                    </h3>
                  </div>
                  <p className="text-xs text-green-700">
                    {isPaidPro
                      ? 'You have access to all premium features'
                      : isTrialActive
                      ? `Trial expires ${new Date(trialEndsAt).toLocaleDateString('en-GB')}`
                      : 'Subscribe to unlock premium features'}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isPro
                      ? 'bg-green-200 text-green-800 border-green-300'
                      : 'bg-gray-200 text-gray-800 border-gray-300'
                  }`}>
                    {isPro ? 'PRO' : 'FREE'}
                  </span>
                </div>
              </div>
            </button>
          </SectionCard>

          {/* WhatsApp — directly under intro */}
          <SectionCard>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-1">
                <FiMessageCircle className="text-green-600 w-5 h-5" />
                <h2 className="text-base font-semibold text-gray-900">WhatsApp</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Used for order links so customers can message you on WhatsApp.
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    inputMode="tel"
                    autoComplete="tel-country-code"
                    aria-label="Country code"
                    value={whatsappCountryCode}
                    onChange={handleWhatsAppDialChange}
                    disabled={isLoading}
                    placeholder="+91"
                    className="w-[7rem] shrink-0 px-2.5 py-2.5 rounded-xl border border-gray-200 bg-white text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:opacity-60"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    aria-label="Mobile number"
                    value={whatsappLocalNumber}
                    onChange={(e) => setWhatsappLocalNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="98XXXXXXXX"
                    className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 disabled:opacity-60"
                  />
                </div>
                <p className="text-[11px] text-gray-400 leading-snug">
                  <span className="text-gray-500">Example:</span>{' '}
                  <span className="font-mono text-gray-600">+91 9876543210</span>
                  <span className="text-gray-400"> — country code and local number on one row.</span>
                </p>
                <button
                  type="button"
                  onClick={saveWhatsApp}
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 text-white text-sm font-semibold transition-colors touch-manipulation"
                >
                  {isLoading ? 'Saving…' : 'Save WhatsApp number'}
                </button>
                <p className="text-[11px] text-gray-400 leading-snug">
                  Stored on this device in full international format for WhatsApp links.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Business — collapsible on small screens */}
          <SectionCard>
            <button
              type="button"
              onClick={() => setBusinessSectionOpen((o) => !o)}
              className="sm:hidden w-full flex items-center justify-between gap-3 p-4 text-left touch-manipulation bg-white"
              aria-expanded={businessSectionOpen}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FiBriefcase className="text-slate-700 shrink-0 w-5 h-5" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900 block">Business profile</span>
                  <span className="text-xs text-slate-500">Logo, contact and about for PDFs and links</span>
                </div>
              </div>
              <FiChevronDown
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${businessSectionOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`${businessSectionOpen ? 'block' : 'hidden'} sm:block`}>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5 sm:pt-5 space-y-5 border-t border-slate-100 sm:border-t-0 bg-gradient-to-b from-slate-50/70 to-white">
                <div className="hidden sm:flex items-start gap-2 mb-1">
                  <FiBriefcase className="text-slate-700 mt-0.5 w-5 h-5" />
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Business profile</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Shown on PDFs and shared links. Can differ from your login email.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {user?.email ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateBusiness({ email: user.email || '' })}
                      className="text-xs px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium disabled:opacity-50 touch-manipulation"
                    >
                      Use login email
                    </button>
                  ) : null}
                  {user?.displayName ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateBusiness({ businessName: user.displayName || '' })}
                      className="text-xs px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium disabled:opacity-50 touch-manipulation"
                    >
                      Use profile name as business name
                    </button>
                  ) : null}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    <FiImage className="text-slate-500 w-4 h-4" />
                    Logo
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {businessProfile.logoUrl ? (
                        <img
                          src={businessProfile.logoUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 px-1 text-center">No logo</span>
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoFile}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => logoInputRef.current?.click()}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 touch-manipulation"
                        >
                          {logoUploading ? 'Uploading…' : 'Upload'}
                        </button>
                        {businessProfile.logoUrl ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateBusiness({ logoUrl: '' })}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 touch-manipulation"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-400">Save business details below to persist logo.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Business name</label>
                  <input
                    type="text"
                    value={businessProfile.businessName}
                    onChange={(e) => updateBusiness({ businessName: e.target.value })}
                    placeholder="e.g. Your store name"
                    className={businessInputClass}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Address</label>
                  <textarea
                    value={businessProfile.address}
                    onChange={(e) => updateBusiness({ address: e.target.value })}
                    placeholder="Street, city, postal code"
                    rows={2}
                    className={`${businessTextareaClass} min-h-[72px]`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      <FiMail className="text-slate-500 w-4 h-4" />
                      Business email
                    </label>
                    <input
                      type="email"
                      value={businessProfile.email}
                      onChange={(e) => updateBusiness({ email: e.target.value })}
                      placeholder="orders@…"
                      className={businessInputClass}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      <FiPhone className="text-slate-500 w-4 h-4" />
                      Business phone
                    </label>
                    <input
                      type="tel"
                      value={businessProfile.phone}
                      onChange={(e) => updateBusiness({ phone: e.target.value })}
                      placeholder="Customer-facing phone"
                      inputMode="tel"
                      className={businessInputClass}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      <FiGlobe className="text-slate-500 w-4 h-4" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={businessProfile.website}
                      onChange={(e) => updateBusiness({ website: e.target.value.trim() })}
                      placeholder="https://"
                      className={businessInputClass}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      <FiInstagram className="text-slate-500 w-4 h-4" />
                      Instagram
                    </label>
                    <input
                      type="url"
                      value={businessProfile.instagram}
                      onChange={(e) => updateBusiness({ instagram: e.target.value.trim() })}
                      placeholder="https://instagram.com/yourstore"
                      className={businessInputClass}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      <FiFacebook className="text-slate-500 w-4 h-4" />
                      Facebook
                    </label>
                    <input
                      type="url"
                      value={businessProfile.facebook}
                      onChange={(e) => updateBusiness({ facebook: e.target.value.trim() })}
                      placeholder="https://facebook.com/yourstore"
                      className={businessInputClass}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      <FiTwitter className="text-slate-500 w-4 h-4" />
                      Twitter / X
                    </label>
                    <input
                      type="url"
                      value={businessProfile.twitter}
                      onChange={(e) => updateBusiness({ twitter: e.target.value.trim() })}
                      placeholder="https://x.com/yourstore"
                      className={businessInputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Short about</label>
                  <textarea
                    value={businessProfile.about}
                    onChange={(e) => updateBusiness({ about: e.target.value })}
                    placeholder="Brief tagline"
                    rows={2}
                    className={businessTextareaClass}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Full description</label>
                  <textarea
                    value={businessProfile.description}
                    onChange={(e) => updateBusiness({ description: e.target.value })}
                    placeholder="Policies, what you offer…"
                    rows={3}
                    className={`${businessTextareaClass} min-h-[88px]`}
                  />
                </div>

                <button
                  type="button"
                  onClick={saveBusinessDetails}
                  disabled={busy}
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-900/90 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors touch-manipulation"
                >
                  {businessSaving ? 'Saving…' : 'Save business details'}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Log out — separate, minimal */}
          <SectionCard>
            <div className="p-4 sm:p-5">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-100/80 disabled:opacity-50 font-semibold text-sm touch-manipulation"
              >
                <FiLogOut className="w-5 h-5" />
                {isLoading ? 'Logging out…' : 'Log out'}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">Ends your session on this device</p>
            </div>
          </SectionCard>
        </motion.div>
      </main>
    </div>
  );
}
