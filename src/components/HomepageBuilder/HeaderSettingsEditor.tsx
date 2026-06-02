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
} from '../../config/headerVariants';
import type { WebsiteHeaderVariant, WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';
import { FiChevronDown, FiChevronUp, FiLink, FiPlus, FiTrash2, FiType } from './builderSidebarIcons';

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
  const variant = siteSettings.headerVariant || 'classic';
  const navItems = siteSettings.navItems || [];

  const patch = (patchSettings: Partial<WebsiteSiteSettings>) => {
    onUpdateWebsiteConfig({
      siteSettings: { ...websiteConfig.siteSettings, ...patchSettings },
    });
  };

  const applyVariant = (next: WebsiteHeaderVariant) => {
    if (next === variant) return;
    patch({ ...headerPresetForVariant(next) });
  };

  return (
    <>
      <div className="sidebar-field">
        <label className="panel-label">Header layout</label>
        <SidebarDropdownField
          ariaLabel="Header layout"
          value={variant}
          options={HEADER_VARIANT_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
          onChange={applyVariant}
        />
        <p className="panel-hint">
          Changes how your logo and menu are arranged. Use Colors below for background and text. Click the announcement strip in the preview to edit the top banner.
        </p>
      </div>

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Brand</h3>
      </div>
      <div className="sidebar-field sidebar-field--inline">
        <span className="field-icon" title="Site name">
          <FiType aria-hidden />
        </span>
        <input
          className="panel-input panel-input--grow"
          value={siteSettings.websiteName || ''}
          placeholder="Site name"
          onChange={(e) => patch({ websiteName: e.target.value })}
          aria-label="Site name"
        />
      </div>
      <MediaPickerButton
        storeId={storeId}
        assetKey="site-logo"
        label="Logo"
        currentUrl={siteSettings.logoUrl}
        onUrl={(url) => patch({ logoUrl: url })}
      />

      {variant === 'orderform' ? (
        <>
          <div className="sidebar-panel-divider" />
          <div className="sidebar-panel-header">
            <h3>Store hero text</h3>
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Tagline</label>
            <textarea
              className="panel-input panel-input--textarea"
              rows={2}
              value={siteSettings.headerTagline || ''}
              placeholder="Short intro under your store name"
              onChange={(e) => patch({ headerTagline: e.target.value })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Description</label>
            <textarea
              className="panel-input panel-input--textarea"
              rows={3}
              value={siteSettings.headerAbout || ''}
              placeholder="Optional longer text (up to 3 lines on the site)"
              onChange={(e) => patch({ headerAbout: e.target.value })}
            />
          </div>
          <p className="panel-hint">
            Open/closed badge uses the same settings as the footer (Site → Footer). Menu links are hidden with this layout.
          </p>
        </>
      ) : null}

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Menu links</h3>
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
      </div>
      {variant === 'orderform' ? (
        <p className="panel-hint">Not shown with the OrderForm store hero layout.</p>
      ) : navItems.length === 0 ? (
        <p className="panel-hint">No links yet — add Home, Shop, or custom pages.</p>
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
      <div className="sidebar-panel-header">
        <h3>Colors</h3>
        <button type="button" className="btn-text" onClick={() => patch(headerColorPresetForVariant(variant))}>
          Reset to style defaults
        </button>
      </div>
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
