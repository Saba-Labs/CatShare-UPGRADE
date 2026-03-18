import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLogOut, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { syncUserSettings } from '../services/supabaseSync';

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, supabaseData } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    // Try supabaseData first, fallback to localStorage
    const fromSupabase = supabaseData?.userSettings?.whatsapp_number || '';
    const fromLocal = localStorage.getItem('whatsappNumber') || '';
    setWhatsappNumber(fromSupabase || fromLocal);
  }, [supabaseData?.userSettings]);

  const saveWhatsApp = async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    setError('');
    try {
      const clean = whatsappNumber.trim();
      await syncUserSettings(user.uid, {
        whatsapp_number: clean,  // save as top-level column, not nested in data
      });
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
          className="bg-white rounded-lg shadow-lg p-4 sm:p-8"
        >
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-red-700 break-words">{error}</p>
            </div>
          )}

          {/* Profile Info */}
          <div className="space-y-6 mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Profile Information</h2>

            {/* Name */}
            {user?.displayName && (
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100">
                    <FiUser className="text-blue-600 text-base sm:text-lg" />
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
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100">
                    <FiMail className="text-blue-600 text-base sm:text-lg" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600">Email Address</p>
                  <p className="text-base sm:text-lg font-medium text-gray-900 truncate">{user.email}</p>
                </div>
              </div>
            )}

            {/* Email Verified */}
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Email Verification</p>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${user?.emailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <p className="text-base sm:text-lg font-medium text-gray-900">
                  {user?.emailVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="border-t border-gray-200 pt-6 sm:pt-8 space-y-6">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">WhatsApp number</h3>
              <p className="text-xs text-gray-500 mb-3">
                Used for “Share as link” order confirmations (customers will message you on WhatsApp).
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g. +91XXXXXXXXXX"
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={saveWhatsApp}
                  disabled={isLoading}
                  className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold whitespace-nowrap"
                >
                  Save
                </button>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm sm:text-base"
            >
              <FiLogOut className="text-lg" />
              <span>{isLoading ? 'Logging out...' : 'Log Out'}</span>
            </button>
            <p className="text-center text-xs sm:text-sm text-gray-500 mt-4">
              You'll be logged out from this device
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
