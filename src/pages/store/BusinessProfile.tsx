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
import {
  STORE_FIELD_CLASS,
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from './storeTypography';

const BUSINESS_LOGO_PRODUCT_ID = 'business-logo';

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
                <div className="relative">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleLogoFile(e)}
                    className="hidden"
                  />

                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Logo Preview - Centered on mobile */}
                    <div className="flex flex-col items-center lg:items-start">
                      <div className="relative group h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden flex items-center justify-center shadow-sm group-hover:shadow-lg transition-all duration-200 cursor-pointer"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {profile.logoUrl ? (
                          <>
                            <img
                              src={profile.logoUrl}
                              alt="Business Logo"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <svg className="w-6 h-6 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center px-3">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tap to upload</span>
                          </div>
                        )}
                      </div>
                      {profile.logoUrl && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2.5 font-medium">Current logo</p>
                      )}
                    </div>

                    {/* Upload/Action Buttons - Full width on mobile, flex on desktop */}
                    <div className="flex-grow">
                      <div className="space-y-2.5">
                        <div>
                          <button
                            type="button"
                            disabled={logoUploading || saving}
                            onClick={() => logoInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                          >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>{logoUploading ? 'Uploading…' : 'Upload logo'}</span>
                          </button>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 px-1 leading-relaxed">
                          PNG, JPG or GIF (up to 5MB)
                        </p>

                        {profile.logoUrl ? (
                          <button
                            type="button"
                            disabled={logoUploading || saving}
                            onClick={() => updateProfile({ logoUrl: '' })}
                            className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Remove logo</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
                  className={STORE_FIELD_CLASS}
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
          className={canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>

      <div className="hidden md:block fixed bottom-6 right-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={`${canSave ? STORE_SAVE_BTN_ENABLED : STORE_SAVE_BTN_DISABLED} shadow-lg`}
        >
          {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </StoreLayout>
  );
}
