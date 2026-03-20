import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLogOut, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { syncUserSettings } from '../services/supabaseSync';

const WHATSAPP_COUNTRIES: Array<{ label: string; dial: string }> = [
  { label: 'India (+91)', dial: '+91' },
  { label: 'United States (+1)', dial: '+1' },
  { label: 'United Kingdom (+44)', dial: '+44' },
  { label: 'United Arab Emirates (+971)', dial: '+971' },
  { label: 'Saudi Arabia (+966)', dial: '+966' },
  { label: 'Qatar (+974)', dial: '+974' },
  { label: 'Oman (+968)', dial: '+968' },
  { label: 'Singapore (+65)', dial: '+65' },
  { label: 'Australia (+61)', dial: '+61' },
  { label: 'Canada (+1)', dial: '+1' },
  { label: 'Germany (+49)', dial: '+49' },
  { label: 'France (+33)', dial: '+33' },
  { label: 'Spain (+34)', dial: '+34' },
  { label: 'Italy (+39)', dial: '+39' },
];

function parseWhatsAppNumber(saved: string): { dial: string; local: string } {
  const cleaned = (saved || '').replace(/\s+/g, '').trim();
  if (!cleaned) return { dial: '', local: '' };

  const candidates = [...WHATSAPP_COUNTRIES.map((c) => c.dial)].sort((a, b) => b.length - a.length);
  const match = candidates.find((d) => cleaned.startsWith(d));

  if (match) {
    const local = cleaned.slice(match.length).replace(/\D/g, '');
    return { dial: match, local };
  }

  // Dial code not recognized => force the user to pick it again.
  const local = cleaned.replace(/\D/g, '');
  return { dial: '', local };
}

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, supabaseData } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState('');
  const [whatsappLocalNumber, setWhatsappLocalNumber] = useState('');

  useEffect(() => {
    // Try supabaseData first, fallback to localStorage
    const fromSupabase = supabaseData?.userSettings?.whatsapp_number || '';
    const fromLocal = localStorage.getItem('whatsappNumber') || '';
    const saved = fromSupabase || fromLocal;
    const parsed = parseWhatsAppNumber(saved);
    setWhatsappCountryCode(parsed.dial);
    setWhatsappLocalNumber(parsed.local);
  }, [supabaseData?.userSettings]);

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
        whatsapp_number: clean,  // save as top-level column, not nested in data
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to sync WhatsApp number to cloud');
      }

      const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
      if (strictOnline) {
        window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
      }
      // Also save to localStorage so it persists without refetching
      localStorage.setItem('whatsappNumber', clean);
      showToast('WhatsApp number saved', 'success');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to save WhatsApp number';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Status bar placeholder */}
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      {/* Header */}
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

      {/* Content */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8"
        >
          {/* Error Message */}
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
              <p className="text-xs sm:text-sm text-gray-500">Your account details</p>
            </div>

            {/* Name */}
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

            {/* Email */}
            {user?.email && (
              <div className="flex items-center gap-3 sm:gap-4 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100 hover:border-emerald-200 transition-colors">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                    <FiMail className="text-white text-base sm:text-lg" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600">Email Address</p>
                  <p className="text-base sm:text-lg font-medium text-gray-900 truncate">{user.email}</p>
                </div>
              </div>
            )}

            {/* Email Verified */}
            <div className={`p-4 rounded-xl border transition-colors ${
              user?.emailVerified
                ? 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-100 hover:border-green-200'
                : 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-100 hover:border-yellow-200'
            }`}>
              <p className="text-xs sm:text-sm text-gray-600 mb-2 font-medium">Email Verification</p>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full shadow-lg ${
                  user?.emailVerified ? 'bg-green-500 shadow-green-500/30' : 'bg-yellow-500 shadow-yellow-500/30'
                }`}></div>
                <p className={`text-sm sm:text-base font-semibold ${
                  user?.emailVerified ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {user?.emailVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="border-t border-gray-200 pt-6 sm:pt-8 space-y-6">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1">WhatsApp number</h3>
              <p className="text-xs text-gray-500 mb-3">
                Used for “Share as link” order confirmations (customers will message you on WhatsApp).
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={whatsappCountryCode}
                  onChange={(e) => setWhatsappCountryCode(e.target.value)}
                  className="sm:w-40 px-3 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                >
                  <option value="">Select country</option>
                  {WHATSAPP_COUNTRIES.map((c) => (
                    <option key={c.dial} value={c.dial}>
                      {c.dial}
                    </option>
                  ))}
                </select>
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
                Country code is required (example: +91, +1, +44).
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
