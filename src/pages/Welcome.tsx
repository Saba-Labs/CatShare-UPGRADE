import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { INDUSTRY_PRESETS } from '../config/industryPresets';
import { DEFAULT_FIELDS, FieldConfig } from '../config/fieldConfig';
import { safeSetInStorage, getStorageKey } from '../utils/safeStorage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type WelcomeStep = 'welcome' | 'industry' | 'fields' | 'complete';

interface SelectedFields {
  [key: string]: boolean;
}

const industryIcons: { [key: string]: string } = {
  'Fashion & Apparel': '👗',
  'Lifestyle & Personal Care': '🧴',
  'Home, Kitchen & Living': '🏠',
  'Electronics & Accessories': '📱',
  'Hardware, Tools & Industrial': '🔧',
  'Others': '✨',
};

const FloatingShapes = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      animate={{
        y: [0, 30, 0],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-blue-200 to-slate-200 rounded-full opacity-5 blur-3xl"
    />
    <motion.div
      animate={{
        y: [0, -30, 0],
      }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-br from-slate-200 to-blue-200 rounded-full opacity-5 blur-3xl"
    />
  </div>
);

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<WelcomeStep>('welcome');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<SelectedFields>({});
  const [isLoading, setIsLoading] = useState(false);

  // Note: App.tsx handles redirecting first-time users to /welcome automatically.
  // This component allows both first-time and returning users to access the welcome flow.

  useEffect(() => {
    if (step === 'complete') {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, navigate]);

  const handleIndustrySelect = (industryName: string) => {
    setSelectedIndustry(industryName);
    const newSelectedFields: SelectedFields = {};

    if (industryName === 'Others') {
      // For Others, initialize all DEFAULT_FIELDS as unselected
      DEFAULT_FIELDS.forEach((field, index) => {
        newSelectedFields[field.key] = false;
      });
    } else {
      // For preset industries, use preset field defaults
      const industryPreset = INDUSTRY_PRESETS.find(p => p.name === industryName);
      if (industryPreset) {
        industryPreset.fields.forEach((field, index) => {
          newSelectedFields[`field${index + 1}`] = index < 3;
        });
      }
    }

    setSelectedFields(newSelectedFields);
    setStep('fields');
  };

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const handleComplete = async () => {
    setIsLoading(true);

    try {
      let configuredFields;

      if (selectedIndustry === 'Others') {
        // For custom template, use DEFAULT_FIELDS and apply selected state
        configuredFields = DEFAULT_FIELDS.map((field) => ({
          ...field,
          enabled: selectedFields[field.key] || false,
        }));
      } else {
        // For preset industries
        const industryPreset = INDUSTRY_PRESETS.find(p => p.name === selectedIndustry);

        if (!industryPreset) {
          throw new Error('Industry not found');
        }

        configuredFields = DEFAULT_FIELDS.map((field, index) => {
          const fieldNum = index + 1;
          const isSelected = selectedFields[`field${fieldNum}`];
          const presetField = industryPreset.fields[index];

          return {
            ...field,
            enabled: isSelected,
            label: presetField?.label || field.label,
            ...(presetField?.unitOptions && {
              unitOptions: presetField.unitOptions,
              unitsEnabled: true
            }),
            ...(!presetField?.unitOptions && {
              unitOptions: [],
              unitsEnabled: false
            })
          };
        });
      }

      const fieldsDefinition = {
        version: 1,
        fields: configuredFields,
        industry: selectedIndustry,
        lastUpdated: Date.now(),
      };

      // Save to localStorage (keyed per account so new signups are not treated as onboarded)
      if (user?.uid) {
        safeSetInStorage(getStorageKey('fieldsDefinition', user.uid), fieldsDefinition);
        safeSetInStorage(getStorageKey('hasCompletedOnboarding', user.uid), true);
      } else {
        safeSetInStorage('fieldsDefinition', fieldsDefinition);
        safeSetInStorage('hasCompletedOnboarding', true);
      }
      safeSetInStorage('showTutorialOnInit', true);

      // Sync to Supabase if user is logged in
      if (user && user.uid) {
        try {
          const { syncFieldsDefinition } = await import('../services/supabaseSync');
          const syncResult = await syncFieldsDefinition(user.uid, fieldsDefinition);

          if (!syncResult.success) {
            console.warn('⚠️ Failed to sync fields to cloud:', syncResult.error);
            showToast('Note: Changes saved locally but not yet synced to cloud', 'warning');
          } else {
            console.log('✅ Fields definition synced to Supabase');
          }
        } catch (syncError) {
          console.error('❌ Error syncing fields:', syncError);
          showToast('Note: Changes saved locally but not yet synced to cloud', 'warning');
        }
      }

      setStep('complete');
      setIsLoading(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Error setting up. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center p-3 sm:p-4 pt-[56px] relative overflow-hidden">
      <div className="fixed inset-x-0 top-0 h-[40px] bg-black z-50" />
      <FloatingShapes />
      
      <AnimatePresence mode="wait">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-lg relative z-10 px-4"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12 text-center border border-slate-200">
              {/* Animated background gradient */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
              
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 150, damping: 20 }}
                className="mb-8 relative z-10"
              >
                <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center justify-center mx-auto mb-4 sm:mb-6"
              >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/50 p-2">
                    <img
                      src="https://cdn.builder.io/api/v1/image/assets%2F4b59de728c4149beae05f37141fcdb10%2Ff76700758c784ae1b7f01d6405d61f53?format=webp&width=800"
                      alt="CatShare Logo"
                      className="w-14 sm:w-16 md:w-20 object-contain"
                    />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="relative z-10"
              >
                <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-slate-800 mb-2 sm:mb-3">
                  Welcome to CatShare
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-2 sm:mb-3 font-medium">
                  Your Ultimate Product Catalog Solution
                </p>
                <p className="text-slate-500 mb-6 sm:mb-10 text-xs sm:text-sm md:text-base">
                  Create stunning product catalogs, organize inventory, and share effortlessly
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-2 relative z-10"
              >
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 15px 35px rgba(37, 99, 235, 0.35)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep('industry')}
                  className="w-full bg-blue-600 text-white font-semibold py-2.5 sm:py-3 md:py-4 px-4 sm:px-6 md:px-8 rounded-lg sm:rounded-xl hover:bg-blue-700 transition-all duration-300 text-sm sm:text-base md:text-lg"
                >
                  Get Started
                </motion.button>
                <p className="text-xs text-slate-500">Takes just 2 minutes ⚡</p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Industry Selection Step */}
        {step === 'industry' && (
          <motion.div
            key="industry"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-3xl relative z-10 px-4"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12 border border-slate-200">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 sm:mb-8"
              >
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800 mb-2 sm:mb-3">
                  Choose Your Industry
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-slate-600">
                  We'll customize fields based on your business type
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
                {INDUSTRY_PRESETS.map((industry, idx) => (
                  <motion.div
                    key={industry.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleIndustrySelect(industry.name)}
                    className={`relative p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 border-2 group ${
                      selectedIndustry === industry.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                      <div className="text-2xl sm:text-3xl md:text-4xl flex-shrink-0">{industryIcons[industry.name] || '💼'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm sm:text-base md:text-lg text-slate-800">{industry.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">{industry.fields.length} fields pre-configured</p>
                      </div>
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex-shrink-0 transition-all ${
                        selectedIndustry === industry.name
                          ? 'border-blue-400 bg-blue-500'
                          : 'border-slate-500 group-hover:border-purple-400'
                      }`} />
                    </div>
                  </motion.div>
                ))}
                <motion.div
                  key="others"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: INDUSTRY_PRESETS.length * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleIndustrySelect('Others')}
                  className={`relative p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 border-2 group ${
                    selectedIndustry === 'Others'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                    <div className="text-2xl sm:text-3xl md:text-4xl flex-shrink-0">{industryIcons['Others']}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm sm:text-base md:text-lg text-slate-800">Others</p>
                      <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">Custom template - choose your own fields</p>
                    </div>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex-shrink-0 transition-all ${
                      selectedIndustry === 'Others'
                        ? 'border-blue-400 bg-blue-500'
                        : 'border-slate-500 group-hover:border-purple-400'
                    }`} />
                  </div>
                </motion.div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep('welcome')}
                  className="flex-1 border-2 border-slate-300 text-slate-700 font-semibold py-2 px-2 sm:py-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base hover:border-slate-400 hover:bg-slate-100 transition-all"
                >
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep('fields')}
                  disabled={!selectedIndustry}
                  className="flex-1 bg-blue-600 text-white font-semibold py-2 px-2 sm:py-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
                >
                  Next
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Fields Selection Step */}
        {step === 'fields' && (
          <motion.div
            key="fields"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-2xl relative z-10 px-4"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12 border border-slate-200">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 sm:mb-8"
              >
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800 mb-2 sm:mb-3">
                  Configure Fields
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-slate-600">
                  Select which fields best describe your products
                </p>
              </motion.div>
              
              {selectedIndustry === 'Others' ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 text-center"
                >
                  <p className="text-base sm:text-lg text-blue-800 font-semibold mb-2 sm:mb-3">⚙️ Configure Your Fields</p>
                  <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
                    You can add and customize your product fields directly in the app Settings once you complete this setup. This gives you full flexibility to create exactly the catalog you need.
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 mb-4 sm:mb-6">
                    <p className="text-xs sm:text-sm text-blue-700">
                      💡 <strong>Tip:</strong> You can customize these anytime in Settings
                    </p>
                  </div>

                  <div className="space-y-2 mb-6 sm:mb-8 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {INDUSTRY_PRESETS.find(p => p.name === selectedIndustry)?.fields.map((field, idx) => {
                      const fieldKey = `field${idx + 1}`;
                      const isChecked = selectedFields[fieldKey] || false;
                      return (
                        <motion.div
                          key={fieldKey}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ x: 4 }}
                          onClick={() => handleFieldToggle(fieldKey)}
                          className="flex items-start sm:items-center p-2.5 sm:p-3 md:p-4 border border-slate-300 rounded-lg sm:rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all cursor-pointer group gap-2 sm:gap-3 select-none"
                        >
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600 scale-100'
                              : 'border-slate-300 group-hover:border-slate-400 scale-100'
                          }`}>
                            {isChecked && <span className="text-white text-xs sm:text-sm font-semibold">✓</span>}
                          </div>
                          <div className="flex-1 pointer-events-none">
                            <p className="font-semibold text-xs sm:text-sm md:text-base text-slate-800">{field.label}</p>
                            {field.unitOptions && (
                              <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                                {field.unitOptions.slice(0, 2).join(', ')}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex gap-2 sm:gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep('industry')}
                  className="flex-1 border-2 border-slate-300 text-slate-700 font-semibold py-2 px-2 sm:py-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base hover:border-slate-400 hover:bg-slate-100 transition-all"
                >
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white font-semibold py-2 px-2 sm:py-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
                >
                  {isLoading ? '⏳ Setting up...' : '✨ Complete Setup'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}


        {/* Complete Step */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, type: 'spring', stiffness: 150, damping: 20 }}
            className="w-full max-w-lg relative z-10 text-center px-4"
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12 border border-slate-200">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                className="mb-6 sm:mb-8"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 360],
                  }}
                  transition={{ duration: 2 }}
                  className="flex items-center justify-center mx-auto"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/50 p-2">
                    <img
                      src="https://cdn.builder.io/api/v1/image/assets%2F4b59de728c4149beae05f37141fcdb10%2Ff76700758c784ae1b7f01d6405d61f53?format=webp&width=800"
                      alt="CatShare Logo"
                      className="w-16 sm:w-20 md:w-20 object-contain"
                    />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-slate-800 mb-2 sm:mb-4">
                  All Set! 🎉
                </h2>
                <p className="text-slate-600 text-xs sm:text-sm md:text-lg mb-2">
                  Your {selectedIndustry === 'Others' ? 'custom' : selectedIndustry} catalog is ready to go
                </p>
                <p className="text-slate-500 text-xs sm:text-sm md:text-base">
                  Redirecting to your workspace...
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.8);
        }
      `}</style>
    </div>
  );
}
