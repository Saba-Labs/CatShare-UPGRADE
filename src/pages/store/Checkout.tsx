import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { getSellerStore, updateStoreCheckoutSettings } from '../../services/storeService';
import { readCachedSellerStore } from '../../utils/storePageCache';
import StoreLayout from './components/StoreLayout';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import CheckoutRulesSection from './components/CheckoutRulesSection';
import {
  DEFAULT_CHECKOUT_SETTINGS,
  normalizeCheckoutSettings,
  type CheckoutExperienceSettings,
  type CheckoutTheme,
  type StoreCheckoutSettings,
} from '../../types/checkoutSettings';
import {
  STORE_CHIP_CLASS,
  STORE_FIELD_CLASS,
  STORE_SAVE_BTN_DISABLED,
  STORE_SAVE_BTN_ENABLED,
} from './storeTypography';

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        {description ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        ) : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const sellerId = user?.uid ?? getPersistedAuthUserId() ?? '';

  const [settings, setSettings] = useState<StoreCheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<StoreCheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedSellerStore(sellerId);
    if (cached) {
      const loaded = normalizeCheckoutSettings(cached.checkoutSettings);
      setSettings(loaded);
      setOriginalSettings(loaded);
      setLoading(false);
    }
  }, [sellerId]);

  const loadSettings = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const cached = readCachedSellerStore(sellerId);
    if (!cached) {
      setLoading(true);
    }

    const result = await getSellerStore(sellerId);
    if (!result.success || !result.data) {
      if (cached) {
        const loaded = normalizeCheckoutSettings(cached.checkoutSettings);
        setSettings(loaded);
        setOriginalSettings(loaded);
      } else {
        showToast(result.error || 'Failed to load checkout settings', 'error');
      }
      setLoading(false);
      return;
    }

    const loaded = normalizeCheckoutSettings(result.data.checkoutSettings);
    setSettings(loaded);
    setOriginalSettings(loaded);
    setLoading(false);
  }, [sellerId, showToast]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadSettings();
  }, [authLoading, sellerId, loadSettings]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const canSave = hasChanges && !saving;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const patchSettings = (patch: Partial<StoreCheckoutSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const patchExperience = (patch: Partial<CheckoutExperienceSettings>) => {
    setSettings((prev) => ({
      ...prev,
      experience: { ...prev.experience, ...patch },
    }));
  };

  const handleSave = async () => {
    if (!sellerId || !guardCloudWrite()) return;

    setSaving(true);
    const result = await updateStoreCheckoutSettings(sellerId, settings);
    setSaving(false);

    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to save checkout settings', 'error');
      return;
    }

    const saved = normalizeCheckoutSettings(result.data.checkoutSettings);
    setSettings(saved);
    setOriginalSettings(saved);
    showToast('Checkout settings saved', 'success');
  };

  const couponRuleCount = useMemo(
    () => settings.rules.filter((rule) => rule.enabled && rule.type.startsWith('coupon_')).length,
    [settings.rules]
  );

  const discountRuleCount = useMemo(
    () =>
      settings.rules.filter(
        (rule) =>
          rule.enabled &&
          rule.category === 'discount' &&
          !rule.type.startsWith('coupon_')
      ).length,
    [settings.rules]
  );

  if (loading || authLoading) {
    return (
      <StoreLayout>
        <div className="animate-pulse space-y-6 py-8 max-w-3xl">
          <div className="h-12 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 max-w-3xl">
        <PageHeader
          title="Checkout Settings"
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
            title="Payment Methods"
            description="Choose which payment options customers can use at checkout."
          >
            <div className="space-y-4 divide-y divide-gray-200 dark:divide-gray-800">
              <ToggleRow
                title="Online / Prepaid Payments"
                description="Allow customers to pay online via connected payment gateways."
                checked={settings.enablePrepaid}
                onChange={(enablePrepaid) => patchSettings({ enablePrepaid })}
                disabled={saving}
              />
              <div className="pt-4">
                <ToggleRow
                  title="Cash on Delivery"
                  description="Let customers pay when the order is delivered."
                  checked={settings.enableCod}
                  onChange={(enableCod) => patchSettings({ enableCod })}
                  disabled={saving}
                />
              </div>
              <div className="pt-4">
                <ToggleRow
                  title="Show price breakdown"
                  description="Display shipping, tax, and discount lines in the order summary."
                  checked={settings.showBreakdown}
                  onChange={(showBreakdown) => patchSettings({ showBreakdown })}
                  disabled={saving}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Shipping Charges"
            description="Configure delivery fees and free-shipping thresholds."
          >
            <CheckoutRulesSection
              category="shipping"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              presetFilter={(preset) =>
                !preset.type.startsWith('coupon_') &&
                !preset.type.startsWith('discount_') &&
                !preset.type.startsWith('tax_')
              }
              emptyHint="Add flat shipping, percentage shipping, packing, or free-shipping rules."
            />
          </SettingsCard>

          <SettingsCard
            title="Coupons"
            description={
              couponRuleCount > 0
                ? `${couponRuleCount} active coupon rule${couponRuleCount === 1 ? '' : 's'}`
                : 'Create coupon codes customers can apply at checkout.'
            }
          >
            <div className="space-y-4">
              <ToggleRow
                title="Allow coupon entry"
                description="Show a coupon code field during checkout."
                checked={settings.allowCouponEntry}
                onChange={(allowCouponEntry) => patchSettings({ allowCouponEntry })}
                disabled={saving}
              />
              <CheckoutRulesSection
                category="discount"
                rules={settings.rules}
                onChange={(rules) => patchSettings({ rules })}
                disabled={saving}
                presetFilter={(preset) => preset.type.startsWith('coupon_')}
                emptyHint="Add percentage or flat coupon rules with unique codes."
              />
            </div>
          </SettingsCard>

          <SettingsCard
            title="Discount Rules"
            description={
              discountRuleCount > 0
                ? `${discountRuleCount} automatic discount rule${discountRuleCount === 1 ? '' : 's'} active`
                : 'Apply automatic order discounts without coupon codes.'
            }
          >
            <CheckoutRulesSection
              category="discount"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              presetFilter={(preset) =>
                preset.type.startsWith('discount_') || (preset.type === 'custom' && preset.category === 'discount')
              }
              emptyHint="Add automatic percentage or flat order discounts."
            />
          </SettingsCard>

          <SettingsCard
            title="Taxes"
            description="Configure GST, VAT, and other tax rules applied at checkout."
          >
            <CheckoutRulesSection
              category="tax"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              emptyHint="Add GST, CGST/SGST, IGST, VAT, or custom tax rules."
            />
          </SettingsCard>

          <SettingsCard
            title="Cash on Delivery Charges"
            description="Add COD fees that apply only when customers choose cash on delivery."
          >
            <CheckoutRulesSection
              category="shipping"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              presetFilter={(preset) => preset.type === 'cod_charge'}
              emptyHint="Add a COD surcharge rule for cash on delivery orders."
            />
          </SettingsCard>

          <SettingsCard
            title="Gift Notes"
            description="Let customers include a gift message with their order."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable gift notes"
                description="Show a gift message field during checkout."
                checked={settings.experience.enableGiftNotes}
                onChange={(enableGiftNotes) => patchExperience({ enableGiftNotes })}
                disabled={saving}
              />
              {settings.experience.enableGiftNotes ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Gift note placeholder
                  </label>
                  <input
                    type="text"
                    value={settings.experience.giftNotesPlaceholder}
                    disabled={saving}
                    onChange={(e) => patchExperience({ giftNotesPlaceholder: e.target.value })}
                    className={STORE_FIELD_CLASS}
                  />
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Order Notes"
            description="Collect special instructions from customers during checkout."
          >
            <div className="space-y-4">
              <ToggleRow
                title="Enable order notes"
                description="Show a notes field for delivery or product instructions."
                checked={settings.experience.enableOrderNotes}
                onChange={(enableOrderNotes) => patchExperience({ enableOrderNotes })}
                disabled={saving}
              />
              {settings.experience.enableOrderNotes ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Order notes placeholder
                  </label>
                  <input
                    type="text"
                    value={settings.experience.orderNotesPlaceholder}
                    disabled={saving}
                    onChange={(e) => patchExperience({ orderNotesPlaceholder: e.target.value })}
                    className={STORE_FIELD_CLASS}
                  />
                </div>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Customer Access"
            description="Control whether guests can checkout or login is required."
          >
            <div className="space-y-4 divide-y divide-gray-200 dark:divide-gray-800">
              <ToggleRow
                title="Allow guest checkout"
                description="Customers can place orders without creating an account."
                checked={settings.experience.allowGuestCheckout}
                onChange={(allowGuestCheckout) =>
                  patchExperience({
                    allowGuestCheckout,
                    requireLoginBeforeCheckout: allowGuestCheckout
                      ? settings.experience.requireLoginBeforeCheckout
                      : false,
                  })
                }
                disabled={saving || settings.experience.requireLoginBeforeCheckout}
              />
              <div className="pt-4">
                <ToggleRow
                  title="Require login before checkout"
                  description="Customers must sign in before completing an order."
                  checked={settings.experience.requireLoginBeforeCheckout}
                  onChange={(requireLoginBeforeCheckout) =>
                    patchExperience({
                      requireLoginBeforeCheckout,
                      allowGuestCheckout: requireLoginBeforeCheckout
                        ? false
                        : settings.experience.allowGuestCheckout,
                    })
                  }
                  disabled={saving}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Address Validation"
            description="Validate customer shipping details before order submission."
          >
            <ToggleRow
              title="Validate shipping address"
              description="Check pincode, phone, and required address fields at checkout."
              checked={settings.experience.validateAddress}
              onChange={(validateAddress) => patchExperience({ validateAddress })}
              disabled={saving}
            />
          </SettingsCard>

          <SettingsCard
            title="Policies"
            description="Link to your legal and customer policy pages shown during checkout."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ['termsUrl', 'Terms & Conditions'],
                ['privacyUrl', 'Privacy Policy'],
                ['returnPolicyUrl', 'Return Policy'],
                ['refundPolicyUrl', 'Refund Policy'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {label}
                  </label>
                  <input
                    type="url"
                    value={settings.experience[key]}
                    disabled={saving}
                    onChange={(e) => patchExperience({ [key]: e.target.value })}
                    className={STORE_FIELD_CLASS}
                    placeholder="https://"
                  />
                </div>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Order Confirmation"
            description="Customize the message customers see after placing an order."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Confirmation title
                </label>
                <input
                  type="text"
                  value={settings.experience.orderConfirmationTitle}
                  disabled={saving}
                  onChange={(e) => patchExperience({ orderConfirmationTitle: e.target.value })}
                  className={STORE_FIELD_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Confirmation message
                </label>
                <textarea
                  value={settings.experience.orderConfirmationMessage}
                  disabled={saving}
                  onChange={(e) => patchExperience({ orderConfirmationMessage: e.target.value })}
                  rows={3}
                  className={STORE_FIELD_CLASS}
                />
              </div>
              <ToggleRow
                title="Show order summary on confirmation"
                description="Display ordered items and totals on the confirmation screen."
                checked={settings.experience.showOrderSummaryOnConfirmation}
                onChange={(showOrderSummaryOnConfirmation) =>
                  patchExperience({ showOrderSummaryOnConfirmation })
                }
                disabled={saving}
              />
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

      {hasChanges ? (
        <div className="hidden md:block fixed bottom-20 right-6 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
          You have unsaved changes
        </div>
      ) : null}
    </StoreLayout>
  );
}
