import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCloudWriteGate } from '../../hooks/useCloudWriteGate';
import { getPersistedAuthUserId } from '../../utils/authUserId';
import { getSellerStore, getStoreProducts, updateStoreCheckoutSettings, updateStoreMinimumOrderValue, normalizeStoreMinimumOrderValueInput } from '../../services/storeService';
import type { ProductWithCatalogueData } from '../../config/catalogueProductUtils';
import { getWebsiteProductImageUrl } from '../../utils/websiteStorefront';
import { readCachedSellerStore } from '../../utils/storePageCache';
import StoreLayout, { STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS } from './components/StoreLayout';
import StoreSaveBar from './components/StoreSaveBar';
import PageHeader from './components/PageHeader';
import SettingsCard from './components/SettingsCard';
import ToggleSwitch from './components/ToggleSwitch';
import MinimumOrderValueField from './components/MinimumOrderValueField';
import CheckoutRulesSection from './components/CheckoutRulesSection';
import InfoTooltipButton from './components/InfoTooltipButton';
import {
  DEFAULT_CHECKOUT_SETTINGS,
  disableExpiredCouponRules,
  isAutoDiscountRuleType,
  isCouponRuleType,
  normalizeCheckoutSettings,
  type CheckoutExperienceSettings,
  type CheckoutTheme,
  type StoreCheckoutSettings,
} from '../../types/checkoutSettings';
import {
  STORE_CHIP_CLASS,
  STORE_FIELD_CLASS,
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
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        {description ? (
          <InfoTooltipButton text={description} label={`${title} information`} />
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
  const [minimumOrderValue, setMinimumOrderValue] = useState('0');
  const [originalMinimumOrderValue, setOriginalMinimumOrderValue] = useState('0');
  const [minimumOrderError, setMinimumOrderError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productCategoryOptions, setProductCategoryOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);

  const applyLoadedCheckoutSettings = useCallback(
    (raw: StoreCheckoutSettings) => {
      const normalized = normalizeCheckoutSettings(raw);
      const { settings: withExpiryApplied, disabledLabels } = disableExpiredCouponRules(normalized);
      setSettings(withExpiryApplied);
      setOriginalSettings(normalized);
      if (disabledLabels.length > 0) {
        showToast(
          `Expired coupon${disabledLabels.length === 1 ? '' : 's'} turned off: ${disabledLabels.join(', ')}. Save checkout settings to keep this change.`,
          'warning'
        );
      }
    },
    [showToast]
  );

  useLayoutEffect(() => {
    if (!sellerId) return;
    const cached = readCachedSellerStore(sellerId);
    if (cached) {
      const loaded = normalizeCheckoutSettings(cached.checkoutSettings);
      const mov =
        cached.minimumOrderValue != null ? String(cached.minimumOrderValue) : '0';
      const { settings: withExpiryApplied } = disableExpiredCouponRules(loaded);
      setSettings(withExpiryApplied);
      setOriginalSettings(loaded);
      setMinimumOrderValue(mov);
      setOriginalMinimumOrderValue(mov);
      setProductCategoryOptions(cached.productCategories ?? []);
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
    void getStoreProducts(sellerId).then((productsResult) => {
      if (productsResult.success && productsResult.products) {
        setProductOptions(
          productsResult.products.map((product: ProductWithCatalogueData) => ({
            id: product.id,
            name: product.name?.trim() || 'Untitled product',
            subtitle: product.subtitle?.trim() || undefined,
            imageUrl: getWebsiteProductImageUrl(product),
          }))
        );
      }
    });

    if (!result.success || !result.data) {
      if (cached) {
        const loaded = normalizeCheckoutSettings(cached.checkoutSettings);
        const mov =
          cached.minimumOrderValue != null ? String(cached.minimumOrderValue) : '0';
        const { settings: withExpiryApplied } = disableExpiredCouponRules(loaded);
        setSettings(withExpiryApplied);
        setOriginalSettings(loaded);
        setMinimumOrderValue(mov);
        setOriginalMinimumOrderValue(mov);
        setProductCategoryOptions(cached.productCategories ?? []);
      } else {
        showToast(result.error || 'Failed to load checkout settings', 'error');
      }
      setLoading(false);
      return;
    }

    applyLoadedCheckoutSettings(result.data.checkoutSettings);
    const mov =
      result.data.minimumOrderValue != null ? String(result.data.minimumOrderValue) : '0';
    setMinimumOrderValue(mov);
    setOriginalMinimumOrderValue(mov);
    setProductCategoryOptions(result.data.productCategories ?? []);
    setLoading(false);
  }, [sellerId, showToast, applyLoadedCheckoutSettings]);

  useEffect(() => {
    if (authLoading && !sellerId) return;
    void loadSettings();
  }, [authLoading, sellerId, loadSettings]);

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(originalSettings) ||
    minimumOrderValue !== originalMinimumOrderValue;
  const canSave = hasChanges && !saving && !minimumOrderError;

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

    if (minimumOrderValue !== originalMinimumOrderValue) {
      const normalized = normalizeStoreMinimumOrderValueInput(minimumOrderValue);
      if (normalized.ok === false) {
        setMinimumOrderError(normalized.error);
        showToast(normalized.error, 'error');
        return;
      }
    }

    setSaving(true);
    const failures: string[] = [];

    if (minimumOrderValue !== originalMinimumOrderValue) {
      const normalized = normalizeStoreMinimumOrderValueInput(minimumOrderValue);
      if (normalized.ok) {
        const movResult = await updateStoreMinimumOrderValue(sellerId, normalized.value);
        if (!movResult.success) {
          failures.push(movResult.error || 'Failed to update minimum order value');
        } else if (movResult.data) {
          const mov =
            movResult.data.minimumOrderValue != null
              ? String(movResult.data.minimumOrderValue)
              : '0';
          setMinimumOrderValue(mov);
          setOriginalMinimumOrderValue(mov);
        }
      }
    }

    if (JSON.stringify(settings) !== JSON.stringify(originalSettings)) {
      const result = await updateStoreCheckoutSettings(sellerId, settings);
      if (!result.success || !result.data) {
        failures.push(result.error || 'Failed to save checkout settings');
      } else {
        const saved = normalizeCheckoutSettings(result.data.checkoutSettings);
        setSettings(saved);
        setOriginalSettings(saved);
      }
    }

    setSaving(false);

    if (failures.length > 0) {
      showToast(failures[0], 'error');
      return;
    }

    setMinimumOrderError(undefined);
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
        <PageHeader title="Checkout Settings" />
        <div className="animate-pulse space-y-6 py-4 max-w-3xl">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className={`${STORE_SCROLL_SAVE_BOTTOM_PADDING_CLASS} max-w-3xl`}>
        <PageHeader
          title="Checkout Settings"
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
            title="Order summary"
            info="How totals appear to customers during checkout."
          >
            <ToggleRow
              title="Show price breakdown"
              description="Display shipping, tax, and discount lines in the order summary."
              checked={settings.showBreakdown}
              onChange={(showBreakdown) => patchSettings({ showBreakdown })}
              disabled={saving}
            />
          </SettingsCard>

          <SettingsCard
            title="Minimum order value"
            info="Cart total required before customers can place an order."
          >
            <MinimumOrderValueField
              value={minimumOrderValue}
              onChange={(value) => {
                setMinimumOrderValue(value);
                if (minimumOrderError) setMinimumOrderError(undefined);
              }}
              disabled={saving}
              error={minimumOrderError}
              linkedNote="Leave at 0 for no minimum. Synced with Store settings → Customer experience."
            />
          </SettingsCard>

          <SettingsCard
            title="Shipping Charges"
            info="Configure delivery fees, packing charges, and free-shipping thresholds."
          >
            <CheckoutRulesSection
              category="shipping"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              presetFilter={(preset) =>
                !preset.type.startsWith('coupon_') &&
                !preset.type.startsWith('discount_') &&
                !preset.type.startsWith('tax_') &&
                preset.type !== 'cod_charge'
              }
              ruleFilter={(rule) => rule.type !== 'cod_charge'}
            />
          </SettingsCard>

          <SettingsCard
            title="Coupons"
            info={
              couponRuleCount > 0
                ? `${couponRuleCount} active coupon rule${couponRuleCount === 1 ? '' : 's'}. Create codes customers enter at checkout.`
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
                categoryOptions={productCategoryOptions}
                productOptions={productOptions}
                presetFilter={(preset) => preset.type.startsWith('coupon_')}
                ruleFilter={(rule) => isCouponRuleType(rule.type)}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            title="Discount Rules"
            info={
              discountRuleCount > 0
                ? `${discountRuleCount} automatic discount rule${discountRuleCount === 1 ? '' : 's'} active. Applied without coupon codes when orders qualify.`
                : 'Apply automatic order discounts without coupon codes.'
            }
          >
            <CheckoutRulesSection
              category="discount"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              presetFilter={(preset) =>
                preset.type.startsWith('discount_') ||
                (preset.type === 'custom' && preset.category === 'discount')
              }
              ruleFilter={(rule) =>
                isAutoDiscountRuleType(rule.type) ||
                (rule.type === 'custom' && rule.category === 'discount')
              }
            />
          </SettingsCard>

          <SettingsCard
            title="Taxes"
            info="Configure GST, VAT, and other tax rules applied at checkout."
          >
            <CheckoutRulesSection
              category="tax"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
            />
          </SettingsCard>

          <SettingsCard
            title="Cash on Delivery Charges"
            info="One COD fee applies when customers choose cash on delivery."
          >
            <CheckoutRulesSection
              category="shipping"
              rules={settings.rules}
              onChange={(rules) => patchSettings({ rules })}
              disabled={saving}
              presetFilter={(preset) => preset.type === 'cod_charge'}
              ruleFilter={(rule) => rule.type === 'cod_charge'}
              maxRules={1}
              addRuleLabel="Add COD charge"
            />
          </SettingsCard>

          <SettingsCard
            title="Gift Notes"
            info="Let customers include a gift message with their order."
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
            info="Collect special instructions from customers during checkout."
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
            title="Address Validation"
            info="Validate customer shipping details before order submission."
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
            info="Link to your legal and customer policy pages shown during checkout."
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
            info="Customize the message customers see after placing an order."
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

      <StoreSaveBar
        hasChanges={hasChanges}
        saving={saving}
        canSave={canSave}
        onSave={() => void handleSave()}
      />
    </StoreLayout>
  );
}
