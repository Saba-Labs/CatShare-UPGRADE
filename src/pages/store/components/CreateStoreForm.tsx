import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useCloudWriteGate } from '../../../hooks/useCloudWriteGate';
import { createStore, validateStoreSlug, isStoreSlugAvailable } from '../../../services/storeService';
import { getAllCatalogues } from '../../../config/catalogueConfig';
import { FiAlertCircle, FiCheck, FiArrowRight } from 'react-icons/fi';

interface CreateStoreFormProps {
  onStoreCreated: () => void;
}

export default function CreateStoreForm({ onStoreCreated }: CreateStoreFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const [storeSlug, setStoreSlug] = useState('');
  const [catalogueId, setCatalogueId] = useState('');
  const [loading, setLoading] = useState(false);
  const [slugValidation, setSlugValidation] = useState<'available' | 'taken' | 'invalid' | null>(null);
  const [slugValidating, setSlugValidating] = useState(false);
  const [catalogues, setCatalogues] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    if (user?.uid) {
      const cataloguesList = getAllCatalogues(user.uid);
      if (cataloguesList && cataloguesList.length > 0) {
        setCatalogues(cataloguesList.map((cat) => ({ id: cat.id, label: cat.label })));
        if (cataloguesList.length > 0) {
          setCatalogueId(cataloguesList[0].id);
        }
      }
    }
  }, [user?.uid]);

  const validateSlug = useCallback(
    async (slug: string) => {
      const validation = validateStoreSlug(slug);
      if (!validation.valid) {
        setSlugValidation('invalid');
        return;
      }

      setSlugValidating(true);
      try {
        if (user?.uid) {
          const result = await isStoreSlugAvailable(slug, user.uid);
          setSlugValidation(result.available ? 'available' : 'taken');
        }
      } finally {
        setSlugValidating(false);
      }
    },
    [user?.uid]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (storeSlug.trim()) {
        void validateSlug(storeSlug);
      } else {
        setSlugValidation(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [storeSlug, validateSlug]);

  const handleCreate = async () => {
    if (!user?.uid) {
      showToast('User not authenticated', 'error');
      return;
    }

    if (!storeSlug.trim()) {
      showToast('Please enter a store name', 'error');
      return;
    }

    if (!catalogueId) {
      showToast('Please select a catalogue', 'error');
      return;
    }

    if (slugValidation !== 'available') {
      showToast('Please select an available store name', 'error');
      return;
    }

    if (!guardCloudWrite()) return;

    setLoading(true);
    try {
      const result = await createStore(user.uid, storeSlug, catalogueId);
      if (result.success) {
        showToast('Store created successfully!', 'success');
        onStoreCreated();
      } else {
        showToast(result.error || 'Failed to create store', 'error');
      }
    } catch (error) {
      console.error('Failed to create store:', error);
      showToast('Failed to create store', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canCreate = storeSlug.trim() && catalogueId && slugValidation === 'available' && !loading;

  return (
    <div className="flex flex-col gap-6 md:gap-12">
      {/* Left side - Introduction (hidden on mobile, visible on desktop) */}
      <div className="hidden md:flex md:flex-col md:justify-center">
        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
            Create Your Store
          </h2>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
            Set up your online store in just a few steps. Choose a unique store name and select which products you want to showcase.
          </p>
          <ul className="space-y-3 mt-6">
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm md:text-base text-gray-700 dark:text-gray-300">Unique store name and URL</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm md:text-base text-gray-700 dark:text-gray-300">Choose your product catalogue</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm md:text-base text-gray-700 dark:text-gray-300">Access full store management tools</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Mobile heading (visible only on mobile) */}
      <div className="md:hidden">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Create Your Store
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Set up your online store in just a few steps.
        </p>
      </div>

      {/* Form */}
      <div className="w-full">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
          <div className="space-y-5 sm:space-y-6">
            {/* Store Name / Slug Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
                Store Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={storeSlug}
                  onChange={(e) => setStoreSlug(e.target.value.toLowerCase())}
                  placeholder="my-store"
                  disabled={loading}
                  className="w-full px-4 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-xl text-base text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {/* Slug validation feedback */}
              {storeSlug && (
                <div className="mt-2 flex items-center gap-2">
                  {slugValidating ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                      <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                      Checking availability...
                    </div>
                  ) : slugValidation === 'available' ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs sm:text-sm font-medium">
                      <FiCheck className="h-4 w-4" />
                      Available
                    </div>
                  ) : slugValidation === 'taken' ? (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs sm:text-sm font-medium">
                      <FiAlertCircle className="h-4 w-4" />
                      Name taken, try another
                    </div>
                  ) : slugValidation === 'invalid' ? (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs sm:text-sm font-medium">
                      <FiAlertCircle className="h-4 w-4" />
                      Only lowercase letters, numbers, hyphens (3-50 chars)
                    </div>
                  ) : null}
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This will be your store's public URL
              </p>
            </div>

            {/* Catalogue Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
                Choose Catalogue
              </label>
              <select
                value={catalogueId}
                onChange={(e) => setCatalogueId(e.target.value)}
                disabled={loading || catalogues.length === 0}
                className="w-full px-4 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-xl text-base text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <option value="">Select a catalogue...</option>
                {catalogues.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Select which products you want to display in your store
              </p>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className={`w-full py-4 px-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
                canCreate
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 cursor-pointer'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  Create Store
                  <FiArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {catalogues.length === 0 && !loading && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl p-4">
                <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                  No catalogues found. Please create a catalogue first before creating a store.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
