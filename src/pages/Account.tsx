import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiUser,
  FiMail,
  FiLogOut,
  FiArrowLeft,
  FiAlertCircle,
  FiBriefcase,
  FiImage,
  FiGlobe,
  FiPhone,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { syncUserSettings } from '../services/supabaseSync';
import { uploadProductImageToR2 } from '../services/r2Upload';
import { WhatsAppCountryPicker } from '../components/WhatsAppCountryPicker';
import { defaultCountryOptionForDial, parseWhatsAppNumber } from '../data/whatsappCountryCodes';
import {
  type BusinessProfile,
  EMPTY_BUSINESS_PROFILE,
  businessProfileFromUserSettings,
} from '../config/businessProfile';

const BUSINESS_LOGO_PRODUCT_ID = 'business-logo';

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, supabaseData, refreshSupabaseData } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState('');
  const [whatsappCountryKey, setWhatsappCountryKey] = useState('');
  const [whatsappLocalNumber, setWhatsappLocalNumber] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fromSupabase = supabaseData?.userSettings?.whatsapp_number || '';
    const fromLocal = localStorage.getItem('whatsappNumber') || '';
    const saved = fromSupabase || fromLocal;
    const parsed = parseWhatsAppNumber(saved);
    setWhatsappCountryCode(parsed.dial);
    setWhatsappLocalNumber(parsed.local);
    const match = defaultCountryOptionForDial(parsed.dial);
    setWhatsappCountryKey(match ? `${match.iso2}::${match.dial}` : '');
  }, [supabaseData?.userSettings]);

  useEffect(() => {
    setBusinessProfile(businessProfileFromUserSettings(supabaseData?.userSettings));
  }, [supabaseData?.userSettings]);

  const updateBusiness = (patch: Partial<BusinessProfile>) => {
    setBusinessProfile((prev) => ({ ...prev, ...patch }));
  };

  const saveWhatsApp = async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    setError('');
    try {
      if (!whatsappCountryCode) {
        const msg = 'Please select your WhatsApp country code.';
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

      const clean = `${whatsappCountryCode}${local}`;
      const res = await syncUserSettings(user.uid, {
        whatsapp_number: clean,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to sync WhatsApp number to cloud');
      }

      const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
      if (strictOnline) {
        window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
      }
      localStorage.setItem('whatsappNumber', clean);
      await refreshSupabaseData();
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
      navigate('/login');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const busy = isLoading || businessSaving || logoUploading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      <div className="bg-white border-b border-gray-200 sticky top-[40px] z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Go back"
          >
            <FiArrowLeft className="text-gray-600" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Account</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8"
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-red-700 break-words">{error}</p>
            </div>
          )}

          {/* Profile Info */}
          <div className="space-y-4 mb-8">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Profile Information</h2>
              <p className="text-xs sm:text-sm text-gray-500">Your login account (sign-in email may differ from business contact below)</p>
            </div>

            {user?.displayName && (
              <div className="flex items-center gap-3 sm:gap-4 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100 hover:border-blue-200 transition-colors">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30">
                    <FiUser className="text-white text-base sm:text-lg" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600">Full Name</p>
                  <p className="text-base sm:text-lg font-medium text-gray-900 truncate">{user.displayName}</p>
                </div>
              </div>
            )}

            {user?.email && (
              <div className="flex items-center gap-3 sm:gap-4 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100 hover:border-emerald-200 transition-colors">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                    <FiMail className="text-white text-base sm:text-lg" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600">Login email</p>
                  <p className="text-base sm:text-lg font-medium text-gray-900 truncate">{user.email}</p>
                </div>
              </div>
            )}

            <div
              className={`p-4 rounded-xl border transition-colors ${
                user?.emailVerified
                  ? 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-100 hover:border-green-200'
                  : 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-100 hover:border-yellow-200'
              }`}
            >
              <p className="text-xs sm:text-sm text-gray-600 mb-2 font-medium">Email Verification</p>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full shadow-lg ${
                    user?.emailVerified ? 'bg-green-500 shadow-green-500/30' : 'bg-yellow-500 shadow-yellow-500/30'
                  }`}
                ></div>
                <p
                  className={`text-sm sm:text-base font-semibold ${
                    user?.emailVerified ? 'text-green-700' : 'text-yellow-700'
                  }`}
                >
                  {user?.emailVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Business details */}
          <div className="border-t border-gray-200 pt-8 mb-8 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 rounded-full bg-amber-100 items-center justify-center flex-shrink-0">
                <FiBriefcase className="text-amber-700 text-lg" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Business details</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Shown on PDFs and shared links. You can use different email or phone than your login.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {user?.email && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateBusiness({ email: user.email || '' })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium disabled:opacity-50"
                >
                  Use login email for business
                </button>
              )}
              {user?.displayName && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateBusiness({ businessName: user.displayName || '' })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium disabled:opacity-50"
                >
                  Use profile name as business name
                </button>
              )}
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <FiImage className="text-gray-600" />
                Logo
              </label>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {businessProfile.logoUrl ? (
                    <img src={businessProfile.logoUrl} alt="Business logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400 text-center px-1">No logo</span>
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
                      className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                    >
                      {logoUploading ? 'Uploading…' : 'Upload image'}
                    </button>
                    {businessProfile.logoUrl ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateBusiness({ logoUrl: '' })}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-gray-500">Uploaded to cloud storage. Save business details below to persist.</p>
                  <input
                    type="url"
                    value={businessProfile.logoUrl}
                    onChange={(e) => updateBusiness({ logoUrl: e.target.value.trim() })}
                    placeholder="Or paste image URL"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Business name</label>
              <input
                type="text"
                value={businessProfile.businessName}
                onChange={(e) => updateBusiness({ businessName: e.target.value })}
                placeholder="e.g. CatShare Traders"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Address</label>
              <textarea
                value={businessProfile.address}
                onChange={(e) => updateBusiness({ address: e.target.value })}
                placeholder="Street, city, postal code, country"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y min-h-[80px]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <FiMail className="text-gray-600" />
                Business email
              </label>
              <input
                type="email"
                value={businessProfile.email}
                onChange={(e) => updateBusiness({ email: e.target.value })}
                placeholder="orders@yourbusiness.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <FiPhone className="text-gray-600" />
                Business phone
              </label>
              <input
                type="tel"
                value={businessProfile.phone}
                onChange={(e) => updateBusiness({ phone: e.target.value })}
                placeholder="Landline or mobile for customers"
                inputMode="tel"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <FiGlobe className="text-gray-600" />
                Website
              </label>
              <input
                type="url"
                value={businessProfile.website}
                onChange={(e) => updateBusiness({ website: e.target.value.trim() })}
                placeholder="https://"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">About</label>
              <p className="text-[11px] text-gray-500 mb-1">Short line for headers or cards</p>
              <textarea
                value={businessProfile.about}
                onChange={(e) => updateBusiness({ about: e.target.value })}
                placeholder="One line about your business"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Describe</label>
              <p className="text-[11px] text-gray-500 mb-1">Longer description for catalogues or PDFs</p>
              <textarea
                value={businessProfile.description}
                onChange={(e) => updateBusiness({ description: e.target.value })}
                placeholder="Tell customers what you offer, policies, etc."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y min-h-[100px]"
              />
            </div>

            <button
              type="button"
              onClick={saveBusinessDetails}
              disabled={busy}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
            >
              {businessSaving ? 'Saving…' : 'Save business details'}
            </button>
          </div>

          {/* WhatsApp */}
          <div className="border-t border-gray-200 pt-6 sm:pt-8 space-y-6">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1">WhatsApp number</h3>
              <p className="text-xs text-gray-500 mb-3">
                Used for “Share as link” order confirmations (customers will message you on WhatsApp).
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
                <WhatsAppCountryPicker
                  valueDial={whatsappCountryCode}
                  valueKey={whatsappCountryKey}
                  onChange={(dial, key) => {
                    setWhatsappCountryCode(dial);
                    setWhatsappCountryKey(key);
                  }}
                  disabled={isLoading}
                />
                <input
                  value={whatsappLocalNumber}
                  onChange={(e) => setWhatsappLocalNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 9876543210"
                  inputMode="tel"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                />
                <button
                  onClick={saveWhatsApp}
                  disabled={isLoading}
                  className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold whitespace-nowrap transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Search by country name or dial code. Your full number is saved in international format (E.164).
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors text-sm sm:text-base"
              >
                <FiLogOut className="text-lg" />
                <span>{isLoading ? 'Logging out...' : 'Log Out'}</span>
              </button>
            </div>
            <p className="text-center text-xs sm:text-sm text-gray-500">
              You'll be logged out from this device
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
