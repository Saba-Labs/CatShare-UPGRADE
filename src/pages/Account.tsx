import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLogOut, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Account() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Go back"
          >
            <FiArrowLeft className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-8"
        >
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Profile Info */}
          <div className="space-y-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>

            {/* Name */}
            {user?.displayName && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                    <FiUser className="text-blue-600 text-lg" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="text-lg font-medium text-gray-900">{user.displayName}</p>
                </div>
              </div>
            )}

            {/* Email */}
            {user?.email && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                    <FiMail className="text-blue-600 text-lg" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Email Address</p>
                  <p className="text-lg font-medium text-gray-900">{user.email}</p>
                </div>
              </div>
            )}

            {/* Email Verified */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Email Verification</p>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${user?.emailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <p className="text-lg font-medium text-gray-900">
                  {user?.emailVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="border-t border-gray-200 pt-8">
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              <FiLogOut className="text-lg" />
              <span>{isLoading ? 'Logging out...' : 'Log Out'}</span>
            </button>
            <p className="text-center text-sm text-gray-500 mt-4">
              You'll be logged out from this device
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
