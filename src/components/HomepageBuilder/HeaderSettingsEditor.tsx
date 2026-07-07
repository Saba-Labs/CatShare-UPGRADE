import React from 'react';
import { v4 as uuid } from 'uuid';
import StoreLinkPicker from './StoreLinkPicker';
import ColorPickerField from './ColorPickerField';
import MediaPickerButton from './media/MediaPickerButton';
import SidebarDropdownField from './SidebarDropdownField';
import {
  HEADER_VARIANT_OPTIONS,
  headerColorPresetForVariant,
  headerPresetForVariant,
  normalizeHeaderVariant,
} from '../../config/headerVariants';
import type { WebsiteHeaderVariant, WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';
import {
  getLinkedBrandDisplay,
  useLinkedBusinessProfile,
  withLinkedTaglinePatch,
} from '../../hooks/useLinkedBusinessProfile';
import { syncSiteSettingsPatchToBusinessProfile } from '../../utils/businessProfileStorefront';
import PanelFieldLabel, { SidebarPanelHeading } from './PanelFieldLabel';
import { FiChevronDown, FiChevronUp, FiPlus, FiTrash2, FiType } from './builderSidebarIcons';

interface HeaderSettingsEditorProps {
  siteSettings: WebsiteSiteSettings;
  websiteConfig: WebsiteModeConfig;
  storeId: string;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
}

export default function HeaderSettingsEditor({
  siteSettings,
  websiteConfig,
  storeId,
  onUpdateWebsiteConfig,
}: HeaderSettingsEditorProps) {
  const variant = normalizeHeaderVariant(siteSettings.headerVariant);
  const navItems = siteSettings.navItems || [];
  const businessProfile = useLinkedBusinessProfile();
  const brand = getLinkedBrandDisplay(siteSettings, businessProfile);

  const patch = (patchSettings: Partial<WebsiteSiteSettings>) => {
    const linked = withLinkedTaglinePatch(patchSettings);
    syncSiteSettingsPatchToBusinessProfile(linked);
    onUpdateWebsiteConfig({
      siteSettings: { ...websiteConfig.siteSettings, ...linked },
    });
  };

  const applyVariant = (next: WebsiteHeaderVariant) => {
    if (next === variant) return;
    patch({ ...headerPresetForVariant(next) });
  };

  const headerLayoutHint =
    'Changes how your logo and menu are arranged. Use Colors below for background and text. Click the announcement strip in the preview to edit the top banner.' +
    (variant === 'floating' || variant === 'immersive'
      ? ' Floating and Immersive overlay only when the first homepage block is a hero image (banner, carousel, video, image, etc.). Otherwise the bar stays in normal page flow.'
      : '');

  return (
    <>
      <div className="sidebar-field">
        <PanelFieldLabel label="Header layout" hint={headerLayoutHint} />
        <SidebarDropdownField
          ariaLabel="Header layout"
          value={variant}
          options={HEADER_VARIANT_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
          onChange={applyVariant}
        />
      </div>

      <HeaderLayoutOptions variant={variant} siteSettings={siteSettings} onPatch={patch} />

      <div className="sidebar-panel-divider" />
      <SidebarPanelHeading
        title="Brand"
        hint="Linked to Business Profile (Store → Business). Changes here update your profile and storefront header."
      />
      <div className="sidebar-field sidebar-field--inline">
        <span className="field-icon" title="Site name">
          <FiType aria-hidden />
        </span>
        <input
          className="panel-input panel-input--grow"
          value={brand.websiteName}
          placeholder="Site name"
          onChange={(e) => patch({ websiteName: e.target.value })}
          aria-label="Site name"
        />
      </div>
      <MediaPickerButton
        storeId={storeId}
        assetKey="site-logo"
        label="Logo"
        currentUrl={brand.logoUrl || siteSettings.logoUrl}
        onUrl={(url) => patch({ logoUrl: url })}
      />

      {variant === 'orderform' ? (
        <>
          <div className="sidebar-panel-divider" />
          <SidebarPanelHeading
            title="Store hero text"
            hint="Same as Business Profile → Short about / tagline and Full description. Open/closed badge uses footer settings (Site → Footer). Menu links and search appear in the bar above the hero."
          />
          <div className="sidebar-field">
            <label className="panel-label">Tagline</label>
            <textarea
              className="panel-input panel-input--textarea"
              rows={2}
              value={brand.headerTagline}
              placeholder="Short intro under your store name"
              onChange={(e) => patch({ headerTagline: e.target.value })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Description</label>
            <textarea
              className="panel-input panel-input--textarea"
              rows={3}
              value={brand.headerAbout}
              placeholder="Optional longer text (up to 3 lines on the site)"
              onChange={(e) => patch({ headerAbout: e.target.value })}
            />
          </div>
        </>
      ) : null}

      <div className="sidebar-panel-divider" />
      <SidebarPanelHeading
        title="Menu links"
        hint={
          variant === 'orderform'
            ? 'Shown in the navigation bar above the store hero (and in the compact bar after scroll).'
            : 'Add Home, Shop, or custom pages. Use + on a link to add dropdown options.'
        }
        actions={
          <button
            type="button"
            className="btn-text"
            onClick={() =>
              patch({
                navItems: [...navItems, { id: uuid(), label: 'Link', href: '/' }],
              })
            }
          >
            + Link
          </button>
        }
      />
      {navItems.length === 0 ? (
        <p className="sidebar-empty-hint">No links yet.</p>
      ) : (
        <div className="nav-items-list">
          {navItems.map((item, index) => (
            <div key={item.id} className="sidebar-list-item">
              <input
                className="panel-input"
                value={item.label}
                placeholder="Label"
                onChange={(e) => updateNav(websiteConfig, item.id, { label: e.target.value }, onUpdateWebsiteConfig)}
              />
              <StoreLinkPicker
                value={item.href}
                websiteConfig={websiteConfig}
                onChange={(href) =>
                  updateNav(websiteConfig, item.id, { href: sanitizeHref(href) }, onUpdateWebsiteConfig)
                }
              />
              <div className="sidebar-list-item__actions">
                <button
                  type="button"
                  className="btn-icon-sm"
                  onClick={() => addNavChild(websiteConfig, item.id, onUpdateWebsiteConfig)}
                  title="Add dropdown option"
                >
                  <FiPlus aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-icon-sm"
                  disabled={index === 0}
                  onClick={() => moveNav(websiteConfig, item.id, -1, onUpdateWebsiteConfig)}
                  title="Move up"
                >
                  <FiChevronUp aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-icon-sm"
                  disabled={index === navItems.length - 1}
                  onClick={() => moveNav(websiteConfig, item.id, 1, onUpdateWebsiteConfig)}
                  title="Move down"
                >
                  <FiChevronDown aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-icon-sm danger"
                  onClick={() => removeNav(websiteConfig, item.id, onUpdateWebsiteConfig)}
                  title="Remove"
                >
                  <FiTrash2 aria-hidden />
                </button>
              </div>
              {(item.children || []).length > 0 ? (
                <div className="nav-items-list" style={{ marginTop: 8, paddingLeft: 10 }}>
                  {(item.children || []).map((child) => (
                    <div key={child.id} className="sidebar-list-item">
                      <input
                        className="panel-input"
                        value={child.label}
                        placeholder="Dropdown label"
                        onChange={(e) =>
                          updateNavChild(
                            websiteConfig,
                            item.id,
                            child.id,
                            { label: e.target.value },
                            onUpdateWebsiteConfig
                          )
                        }
                      />
                      <StoreLinkPicker
                        value={child.href}
                        websiteConfig={websiteConfig}
                        onChange={(href) =>
                          updateNavChild(
                            websiteConfig,
                            item.id,
                            child.id,
                            { href: sanitizeHref(href) },
                            onUpdateWebsiteConfig
                          )
                        }
                      />
                      <div className="sidebar-list-item__actions">
                        <button
                          type="button"
                          className="btn-icon-sm danger"
                          onClick={() => removeNavChild(websiteConfig, item.id, child.id, onUpdateWebsiteConfig)}
                          title="Remove dropdown option"
                        >
                          <FiTrash2 aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="sidebar-panel-divider" />
      <SidebarPanelHeading
        title="Colors"
        hint="Background and text colors for the header bar."
        actions={
          <button type="button" className="btn-text" onClick={() => patch(headerColorPresetForVariant(variant))}>
            Reset to style defaults
          </button>
        }
      />
      <div className="color-picker-stack">
        <ColorPickerField
          label="Background"
          value={siteSettings.headerBg || '#ffffff'}
          onChange={(headerBg) => patch({ headerBg })}
        />
        <ColorPickerField
          label="Text"
          value={siteSettings.headerTextColor || '#111827'}
          onChange={(headerTextColor) => patch({ headerTextColor })}
        />
      </div>
    </>
  );
}

function HeaderLayoutOptions({
  variant,
  siteSettings,
  onPatch,
}: {
  variant: WebsiteHeaderVariant;
  siteSettings: WebsiteSiteSettings;
  onPatch: (patch: Partial<WebsiteSiteSettings>) => void;
}) {
  if (variant === 'classic') {
    return (
      <>
        <div className="sidebar-panel-divider" />
        <SidebarPanelHeading
          title="Classic bar options"
          hint="Border is always hidden once the header pins on scroll."
        />
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={siteSettings.headerClassicBorder !== false}
            onChange={(e) => onPatch({ headerClassicBorder: e.target.checked })}
          />
          <span>Show bottom border</span>
        </label>
      </>
    );
  }

  if (variant === 'centered') {
    return (
      <>
        <div className="sidebar-panel-divider" />
        <SidebarPanelHeading
          title="Centered bar options"
          hint="Showcase your logo at the center — adjust size and how the store name appears."
        />
        <div className="sidebar-field">
          <label className="panel-label">Logo size</label>
          <SidebarDropdownField
            ariaLabel="Centered header logo size"
            value={siteSettings.headerCenteredLogoSize || 'medium'}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
              { value: 'xl', label: 'Extra large' },
            ]}
            onChange={(headerCenteredLogoSize) =>
              onPatch({ headerCenteredLogoSize: headerCenteredLogoSize as WebsiteSiteSettings['headerCenteredLogoSize'] })
            }
          />
        </div>
        <div className="sidebar-field">
          <label className="panel-label">Store name</label>
          <SidebarDropdownField
            ariaLabel="Centered header store name layout"
            value={siteSettings.headerCenteredBrandLayout || 'logo-beside'}
            options={[
              { value: 'logo-beside', label: 'Beside logo' },
              { value: 'logo-below', label: 'Below logo' },
              { value: 'logo-only', label: 'Hidden (logo only)' },
            ]}
            onChange={(headerCenteredBrandLayout) =>
              onPatch({
                headerCenteredBrandLayout:
                  headerCenteredBrandLayout as WebsiteSiteSettings['headerCenteredBrandLayout'],
              })
            }
          />
        </div>
        <div className="sidebar-field">
          <label className="panel-label">Logo / menu spacing</label>
          <SidebarDropdownField
            ariaLabel="Centered header spacing"
            value={siteSettings.headerCenteredGap || 'normal'}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'wide', label: 'Wide' },
            ]}
            onChange={(headerCenteredGap) => onPatch({ headerCenteredGap })}
          />
        </div>
      </>
    );
  }

  if (variant === 'floating') {
    const opacity = siteSettings.headerFloatingOpacity ?? 0.92;
    const blur = siteSettings.headerFloatingBlur ?? 12;
    return (
      <>
        <div className="sidebar-panel-divider" />
        <SidebarPanelHeading
          title="Floating bar options"
          hint="The pill overlays hero images at the top of the homepage only. Transparency and blur apply before scroll. Background color comes from Colors below."
        />
        <div className="sidebar-field">
          <label className="panel-label">Bar transparency ({Math.round(opacity * 100)}%)</label>
          <input
            type="range"
            className="panel-input"
            min={0.2}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => onPatch({ headerFloatingOpacity: parseFloat(e.target.value) })}
            aria-label="Floating bar transparency"
          />
        </div>
        <div className="sidebar-field">
          <label className="panel-label">Backdrop blur ({blur}px)</label>
          <input
            type="range"
            className="panel-input"
            min={0}
            max={24}
            step={2}
            value={blur}
            onChange={(e) => onPatch({ headerFloatingBlur: parseInt(e.target.value, 10) })}
            aria-label="Floating bar backdrop blur"
          />
        </div>
        <div className="sidebar-field">
          <label className="panel-label">Corner style</label>
          <SidebarDropdownField
            ariaLabel="Floating bar corner style"
            value={siteSettings.headerFloatingRadius || 'round'}
            options={[
              { value: 'soft', label: 'Soft (8px)' },
              { value: 'round', label: 'Round (12px)' },
              { value: 'pill', label: 'Pill' },
            ]}
            onChange={(headerFloatingRadius) => onPatch({ headerFloatingRadius })}
          />
        </div>
      </>
    );
  }

  if (variant === 'immersive') {
    const tint = siteSettings.headerImmersiveOpacity ?? 0;
    return (
      <>
        <div className="sidebar-panel-divider" />
        <SidebarPanelHeading
          title="Immersive bar options"
          hint="Transparent bar overlays only when the first homepage block is a hero image (banner, carousel, video, image, etc.). Otherwise the bar stays in the normal page flow."
        />
        <div className="sidebar-field">
          <label className="panel-label">Hero tint ({Math.round(tint * 100)}%)</label>
          <input
            type="range"
            className="panel-input"
            min={0}
            max={0.85}
            step={0.05}
            value={tint}
            onChange={(e) => onPatch({ headerImmersiveOpacity: parseFloat(e.target.value) })}
            aria-label="Immersive header hero tint"
          />
        </div>
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={siteSettings.headerImmersiveTextShadow !== false}
            onChange={(e) => onPatch({ headerImmersiveTextShadow: e.target.checked })}
          />
          <span>Text shadow on hero</span>
        </label>
      </>
    );
  }

  if (variant === 'orderform') {
    return (
      <>
        <div className="sidebar-panel-divider" />
        <SidebarPanelHeading
          title="Store hero options"
          hint="Hero compacts to a logo + name bar when you scroll."
        />
        <div className="sidebar-field">
          <label className="panel-label">Hero padding</label>
          <SidebarDropdownField
            ariaLabel="Store hero padding"
            value={siteSettings.headerHeroPadding || 'comfortable'}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ]}
            onChange={(headerHeroPadding) => onPatch({ headerHeroPadding })}
          />
        </div>
      </>
    );
  }

  return null;
}

function sanitizeHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function updateNav(
  websiteConfig: WebsiteModeConfig,
  id: string,
  updates: Partial<{ label: string; href: string; children: WebsiteSiteSettings['navItems'][number]['children'] }>,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    },
  });
}

function addNavChild(
  websiteConfig: WebsiteModeConfig,
  parentId: string,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: [...(item.children || []), { id: uuid(), label: 'Option', href: '/' }],
            }
          : item
      ),
    },
  });
}

function updateNavChild(
  websiteConfig: WebsiteModeConfig,
  parentId: string,
  childId: string,
  updates: Partial<{ label: string; href: string }>,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: (item.children || []).map((child) =>
                child.id === childId ? { ...child, ...updates } : child
              ),
            }
          : item
      ),
    },
  });
}

function removeNavChild(
  websiteConfig: WebsiteModeConfig,
  parentId: string,
  childId: string,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: (item.children || []).filter((child) => child.id !== childId),
            }
          : item
      ),
    },
  });
}

function moveNav(
  websiteConfig: WebsiteModeConfig,
  id: string,
  dir: -1 | 1,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const items = [...(websiteConfig.siteSettings.navItems || [])];
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const next = idx + dir;
  if (next < 0 || next >= items.length) return;
  const [moved] = items.splice(idx, 1);
  items.splice(next, 0, moved);
  onUpdate({ siteSettings: { ...websiteConfig.siteSettings, navItems: items } });
}

function removeNav(
  websiteConfig: WebsiteModeConfig,
  id: string,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).filter((item) => item.id !== id),
    },
  });
}
