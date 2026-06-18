import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { syncUserSettings } from '../../services/supabaseSync';
import { uploadProductImageToR2 } from '../../services/r2Upload';
import {
  EMPTY_BUSINESS_PROFILE,
  businessProfileFromUserSettings,
  parseBusinessProfile,
  type BusinessProfile as BusinessProfileData,
} from '../../config/businessProfile';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';

const BUSINESS_LOGO_PRODUCT_ID = 'business-logo';

const fieldClassName =
  'w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

function loadBusinessProfileFromCache(
  userSettings: Parameters<typeof businessProfileFromUserSettings>[0]
): BusinessProfileData {
  const fromSettings = businessProfileFromUserSettings(userSettings);
  const hasDetail = [
    fromSettings.businessName,
    fromSettings.address,
    fromSettings.email,
    fromSettings.phone,
    fromSettings.website,
    fromSettings.logoUrl,
    fromSettings.about,
    fromSettings.description,
  ].some((s) => typeof s === 'string' && s.trim().length > 0);

  if (hasDetail) return fromSettings;

  try {
    const raw = localStorage.getItem('businessProfile');
    if (raw) return parseBusinessProfile(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return fromSettings;
}

export default function BusinessProfile() {
  const { user, supabaseData, refreshSupabaseData } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<BusinessProfileData>(EMPTY_BUSINESS_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<BusinessProfileData>(EMPTY_BUSINESS_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const loadProfile = useCallback(() => {
    const loaded = loadBusinessProfileFromCache(supabaseData?.userSettings);
    setProfile(loaded);
    setOriginalProfile(loaded);
    setLoading(false);
  }, [supabaseData?.userSettings]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(originalProfile);
  const canSave = hasChanges && !saving && !logoUploading;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const updateProfile = (patch: Partial<BusinessProfileData>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
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
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const { url } = await uploadProductImageToR2({
        productId: BUSINESS_LOGO_PRODUCT_ID,
        dataUrl,
      });
      updateProfile({ logoUrl: url });
      showToast('Logo uploaded — save to apply on your storefront', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Logo upload failed';
      showToast(msg, 'error');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;

    setSaving(true);
    const result = await syncUserSettings(user.uid, {
      data: { businessProfile: { ...profile } },
    });

    if (!result.success) {
      setSaving(false);
      showToast(result.error || 'Failed to save business profile', 'error');
      return;
    }

    try {
      localStorage.setItem('businessProfile', JSON.stringify(profile));
    } catch {
      /* ignore */
    }

    await refreshSupabaseData();
    const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
    if (strictOnline) {
      window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
    }

    setOriginalProfile({ ...profile });
    setSaving(false);
    showToast('Business profile saved', 'success');
  };

  if (loading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-80 rounded-2xl bg-gray-200 dark:bg-gray-800" />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 max-w-3xl">
        <PageHeader
          title="Business Profile"
          sticky
          actions={(
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className={`hidden sm:inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        />

        <div className="space-y-6">
          <SettingsCard
            title="Brand Identity"
            description="Your logo and business name appear in the store header, footer, and PDFs."
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Logo
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="h-20 w-20 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
                    {profile.logoUrl ? (
                      <img
                        src={profile.logoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">No logo</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleLogoFile(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={logoUploading || saving}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {logoUploading ? 'Uploading…' : 'Upload logo'}
                    </button>
                    {profile.logoUrl ? (
                      <button
                        type="button"
                        disabled={logoUploading || saving}
                        onClick={() => updateProfile({ logoUrl: '' })}
                        className="inline-flex items-center rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="business-name" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Business name
                </label>
                <input
                  id="business-name"
                  type="text"
                  value={profile.businessName}
                  disabled={saving}
                  onChange={(e) => updateProfile({ businessName: e.target.value })}
                  placeholder="Your business name"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label htmlFor="business-about" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Short about / tagline
                </label>
                <textarea
                  id="business-about"
                  value={profile.about}
                  disabled={saving}
                  onChange={(e) => updateProfile({ about: e.target.value })}
                  placeholder="A short tagline for customers"
                  rows={2}
                  className={fieldClassName}
                />
              </div>

              <div>
                <label htmlFor="business-description" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Full description
                </label>
                <textarea
                  id="business-description"
                  value={profile.description}
                  disabled={saving}
                  onChange={(e) => updateProfile({ description: e.target.value })}
                  placeholder="Policies, what you offer, delivery notes…"
                  rows={3}
                  className={fieldClassName}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Contact Information"
            description="Shown in your store footer and customer-facing materials."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="business-address" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Address
                </label>
                <textarea
                  id="business-address"
                  value={profile.address}
                  disabled={saving}
                  onChange={(e) => updateProfile({ address: e.target.value })}
                  placeholder="Street, city, postal code"
                  rows={2}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="business-email" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Business email
                </label>
                <input
                  id="business-email"
                  type="email"
                  value={profile.email}
                  disabled={saving}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  placeholder="orders@yourstore.com"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="business-phone" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Business phone
                </label>
                <input
                  id="business-phone"
                  type="tel"
                  value={profile.phone}
                  disabled={saving}
                  onChange={(e) => updateProfile({ phone: e.target.value })}
                  placeholder="Customer-facing phone"
                  className={fieldClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="business-website" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Website
                </label>
                <input
                  id="business-website"
                  type="url"
                  value={profile.website}
                  disabled={saving}
                  onChange={(e) => updateProfile({ website: e.target.value.trim() })}
                  placeholder="https://"
                  className={fieldClassName}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Social Links"
            description="Optional links shown on your public storefront."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="business-instagram" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Instagram
                </label>
                <input
                  id="business-instagram"
                  type="url"
                  value={profile.instagram}
                  disabled={saving}
                  onChange={(e) => updateProfile({ instagram: e.target.value.trim() })}
                  placeholder="https://instagram.com/yourstore"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="business-facebook" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Facebook
                </label>
                <input
                  id="business-facebook"
                  type="url"
                  value={profile.facebook}
                  disabled={saving}
                  onChange={(e) => updateProfile({ facebook: e.target.value.trim() })}
                  placeholder="https://facebook.com/yourstore"
                  className={fieldClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="business-twitter" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Twitter / X
                </label>
                <input
                  id="business-twitter"
                  type="url"
                  value={profile.twitter}
                  disabled={saving}
                  onChange={(e) => updateProfile({ twitter: e.target.value.trim() })}
                  placeholder="https://x.com/yourstore"
                  className={fieldClassName}
                />
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-4 z-[55]">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`w-full py-3 rounded-xl font-medium transition-colors ${
            !canSave
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`px-6 py-3 rounded-xl font-medium transition-all shadow-lg ${
            !canSave
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-xl'
          }`}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </StoreLayout>
  );
}
