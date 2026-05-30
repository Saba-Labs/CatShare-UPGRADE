import React from 'react';
import { v4 as uuid } from 'uuid';
import StoreLinkPicker from './StoreLinkPicker';
import ColorPickerField from './ColorPickerField';
import {
  FOOTER_COLUMN_PRESETS,
  FOOTER_VARIANT_OPTIONS,
  footerColorPresetForVariant,
  footerPresetForVariant,
} from '../../config/footerVariants';
import type { WebsiteFooterVariant, WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';

interface FooterSettingsEditorProps {
  siteSettings: WebsiteSiteSettings;
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  embedded?: boolean;
}

export default function FooterSettingsEditor({
  siteSettings,
  websiteConfig,
  onUpdateWebsiteConfig,
}: FooterSettingsEditorProps) {
  const variant = siteSettings.footerVariant || 'classic';
  const columns = siteSettings.footerColumns || [];

  const patch = (patchSettings: Partial<WebsiteSiteSettings>) => {
    onUpdateWebsiteConfig({
      siteSettings: { ...websiteConfig.siteSettings, ...patchSettings },
    });
  };

  /** Layout/toggles only — custom colors are kept unless user resets them. */
  const applyVariant = (next: WebsiteFooterVariant) => {
    if (next === variant) return;
    const preset = footerPresetForVariant(next);
    patch({
      footerVariant: next,
      footerShowOpenBadge: preset.footerShowOpenBadge,
      footerOpenBadgeLabel: preset.footerOpenBadgeLabel,
      footerShowLocation: preset.footerShowLocation,
      footerShowContact: preset.footerShowContact,
      footerShowStoreInfo: preset.footerShowStoreInfo,
      footerShowFollow: preset.footerShowFollow,
    });
  };

  const applyPresetColors = () => {
    patch(footerColorPresetForVariant(variant));
  };

  return (
    <>
      <div className="sidebar-field">
        <label className="panel-label">Footer layout</label>
        <select
          className="panel-input"
          value={variant}
          onChange={(e) => applyVariant(e.target.value as WebsiteFooterVariant)}
        >
          {FOOTER_VARIANT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} — {opt.description}
            </option>
          ))}
        </select>
        <p className="panel-hint">
          Changes the structure of your footer (columns, cards, centered, or split row). Use Colors below for background and text.
        </p>
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Tagline</label>
        <textarea
          className="panel-input"
          rows={2}
          value={siteSettings.footerDescription || ''}
          placeholder="Short line under your store name"
          onChange={(e) => patch({ footerDescription: e.target.value })}
        />
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Open badge label</label>
        <input
          className="panel-input"
          value={siteSettings.footerOpenBadgeLabel || ''}
          placeholder="Open now"
          onChange={(e) => patch({ footerOpenBadgeLabel: e.target.value })}
        />
      </div>
      <label className="sidebar-toggle">
        <input
          type="checkbox"
          checked={siteSettings.footerShowOpenBadge !== false}
          onChange={(e) => patch({ footerShowOpenBadge: e.target.checked })}
        />
        <span>Show open badge</span>
      </label>

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Contact overrides</h3>
      </div>
      <p className="panel-hint">Leave blank to use your business profile. These appear in the footer cards.</p>
      <div className="sidebar-panel-section">
        <label className="panel-label">Address</label>
        <textarea
          className="panel-input"
          rows={2}
          value={siteSettings.footerLocationText || ''}
          placeholder="From business profile"
          onChange={(e) => patch({ footerLocationText: e.target.value })}
        />
      </div>
      <div className="sidebar-panel-section">
        <label className="panel-label">Phone</label>
        <input
          className="panel-input"
          value={siteSettings.footerPhoneText || ''}
          placeholder="From business profile"
          onChange={(e) => patch({ footerPhoneText: e.target.value })}
        />
      </div>
      <div className="sidebar-panel-section">
        <label className="panel-label">Email</label>
        <input
          className="panel-input"
          value={siteSettings.footerEmailText || ''}
          placeholder="From business profile"
          onChange={(e) => patch({ footerEmailText: e.target.value })}
        />
      </div>

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Sections</h3>
      </div>
      {(
        [
          ['footerShowLocation', 'Location', siteSettings.footerShowLocation !== false],
          ['footerShowContact', 'Contact', siteSettings.footerShowContact !== false],
          ['footerShowStoreInfo', 'Store info', siteSettings.footerShowStoreInfo !== false],
          ['footerShowFollow', 'Follow / social', siteSettings.footerShowFollow !== false],
        ] as const
      ).map(([key, label, checked]) => (
        <div key={key} className="sidebar-panel-section panel-checkbox">
          <input
            type="checkbox"
            id={`footer-${key}`}
            checked={checked}
            onChange={(e) => patch({ [key]: e.target.checked })}
          />
          <label htmlFor={`footer-${key}`}>{label}</label>
        </div>
      ))}

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Link columns</h3>
        <button
          type="button"
          className="btn-text"
          onClick={() =>
            patch({
              footerColumns: [
                ...columns,
                { title: 'New column', links: [{ id: uuid(), label: 'Link', href: '/' }] },
              ],
            })
          }
        >
          + Column
        </button>
      </div>
      <p className="panel-hint">
        Add groups like Shop, Customer care, or Legal — each column shows a title and a vertical list of links in your footer.
      </p>
      <div className="footer-column-presets">
        {FOOTER_COLUMN_PRESETS.map((preset) => {
          const exists = columns.some(
            (c) => c.title.trim().toLowerCase() === preset.title.trim().toLowerCase()
          );
          return (
            <button
              key={preset.id}
              type="button"
              className="btn-secondary btn-sm"
              disabled={exists}
              title={exists ? 'Column already added' : undefined}
              onClick={() =>
                patch({
                  footerColumns: [
                    ...columns,
                    {
                      title: preset.title,
                      links: preset.links.map((l) => ({ id: uuid(), label: l.label, href: l.href })),
                    },
                  ],
                })
              }
            >
              + {preset.title}
            </button>
          );
        })}
      </div>
      {columns.map((column, colIndex) => (
        <div key={`footer-col-${colIndex}`} className="footer-column-editor">
          <div className="footer-column-editor-header">
            <input
              className="panel-input"
              value={column.title}
              placeholder="Group title"
              onChange={(e) => updateColumnTitle(siteSettings, colIndex, e.target.value, onUpdateWebsiteConfig)}
            />
            <button
              type="button"
              className="btn-icon-sm danger"
              onClick={() => removeColumn(siteSettings, colIndex, onUpdateWebsiteConfig)}
            >
              ×
            </button>
          </div>
          <div className="nav-items-list">
            {column.links.map((link, linkIndex) => (
              <div key={link.id} className="sidebar-list-item">
                <input
                  className="panel-input"
                  value={link.label}
                  placeholder="Label"
                  onChange={(e) =>
                    updateFooterLink(siteSettings, colIndex, link.id, { label: e.target.value }, onUpdateWebsiteConfig)
                  }
                />
                <StoreLinkPicker
                  value={link.href}
                  websiteConfig={websiteConfig}
                  onChange={(href) =>
                    updateFooterLink(
                      siteSettings,
                      colIndex,
                      link.id,
                      { href: sanitizeHref(href) },
                      onUpdateWebsiteConfig
                    )
                  }
                />
                <div className="sidebar-list-item__actions">
                  <button
                    type="button"
                    className="btn-icon-sm"
                    disabled={linkIndex === 0}
                    onClick={() => moveFooterLink(siteSettings, colIndex, link.id, -1, onUpdateWebsiteConfig)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-icon-sm"
                    disabled={linkIndex === column.links.length - 1}
                    onClick={() => moveFooterLink(siteSettings, colIndex, link.id, 1, onUpdateWebsiteConfig)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-icon-sm danger"
                    onClick={() => removeFooterLink(siteSettings, colIndex, link.id, onUpdateWebsiteConfig)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-text footer-column-add-link"
            onClick={() => addFooterLink(siteSettings, colIndex, onUpdateWebsiteConfig)}
          >
            + Add link
          </button>
        </div>
      ))}

      <div className="sidebar-panel-divider" />
      <div className="sidebar-panel-header">
        <h3>Colors</h3>
        <button type="button" className="btn-text" onClick={applyPresetColors}>
          Reset to style defaults
        </button>
      </div>
      <p className="panel-hint">Changes apply to the site footer in the preview and on your live store after you publish.</p>
      <div className="color-picker-stack">
        <ColorPickerField
          label="Background"
          value={siteSettings.footerBg || '#ffffff'}
          onChange={(footerBg) => patch({ footerBg })}
        />
        <ColorPickerField
          label="Text"
          value={siteSettings.footerTextColor || '#1a1a1a'}
          onChange={(footerTextColor) => patch({ footerTextColor })}
        />
        <ColorPickerField
          label="Card background"
          value={siteSettings.footerColBg || '#f2f2f0'}
          defaultValue="#f2f2f0"
          allowCssColor
          onChange={(footerColBg) => patch({ footerColBg })}
        />
        <ColorPickerField
          label="Accent"
          value={siteSettings.footerAccentColor || '#1a6b4a'}
          onChange={(footerAccentColor) => patch({ footerAccentColor })}
        />
        <ColorPickerField
          label="Accent badge background"
          value={siteSettings.footerAccentBg || '#e8f4ef'}
          defaultValue="#e8f4ef"
          allowCssColor
          onChange={(footerAccentBg) => patch({ footerAccentBg })}
        />
        <ColorPickerField
          label="Borders"
          value={siteSettings.footerBorderColor || 'rgba(0, 0, 0, 0.08)'}
          defaultValue="rgba(0, 0, 0, 0.08)"
          allowCssColor
          onChange={(footerBorderColor) => patch({ footerBorderColor })}
        />
      </div>

      <p className="panel-hint panel-hint--static">
        “Powered by CatShare” always appears at the bottom of your site footer and links to catshare.app. It cannot be removed or edited.
      </p>
    </>
  );
}

function sanitizeHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function withColumns(
  siteSettings: WebsiteSiteSettings,
  cols: WebsiteSiteSettings['footerColumns']
): Partial<WebsiteModeConfig> {
  return { siteSettings: { ...siteSettings, footerColumns: cols } };
}

function updateColumnTitle(
  siteSettings: WebsiteSiteSettings,
  colIndex: number,
  title: string,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const columns = [...(siteSettings.footerColumns || [])];
  if (!columns[colIndex]) return;
  columns[colIndex] = { ...columns[colIndex], title };
  onUpdate(withColumns(siteSettings, columns));
}

function removeColumn(
  siteSettings: WebsiteSiteSettings,
  colIndex: number,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  onUpdate(withColumns(siteSettings, (siteSettings.footerColumns || []).filter((_, i) => i !== colIndex)));
}

function addFooterLink(
  siteSettings: WebsiteSiteSettings,
  colIndex: number,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const columns = [...(siteSettings.footerColumns || [])];
  if (!columns[colIndex]) return;
  columns[colIndex] = {
    ...columns[colIndex],
    links: [...columns[colIndex].links, { id: uuid(), label: 'Link', href: '/' }],
  };
  onUpdate(withColumns(siteSettings, columns));
}

function updateFooterLink(
  siteSettings: WebsiteSiteSettings,
  colIndex: number,
  linkId: string,
  updates: Partial<{ label: string; href: string }>,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const columns = [...(siteSettings.footerColumns || [])];
  if (!columns[colIndex]) return;
  columns[colIndex] = {
    ...columns[colIndex],
    links: columns[colIndex].links.map((link) => (link.id === linkId ? { ...link, ...updates } : link)),
  };
  onUpdate(withColumns(siteSettings, columns));
}

function moveFooterLink(
  siteSettings: WebsiteSiteSettings,
  colIndex: number,
  linkId: string,
  dir: -1 | 1,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const columns = [...(siteSettings.footerColumns || [])];
  if (!columns[colIndex]) return;
  const links = [...columns[colIndex].links];
  const idx = links.findIndex((l) => l.id === linkId);
  if (idx < 0) return;
  const next = idx + dir;
  if (next < 0 || next >= links.length) return;
  const [moved] = links.splice(idx, 1);
  links.splice(next, 0, moved);
  columns[colIndex] = { ...columns[colIndex], links };
  onUpdate(withColumns(siteSettings, columns));
}

function removeFooterLink(
  siteSettings: WebsiteSiteSettings,
  colIndex: number,
  linkId: string,
  onUpdate: (u: Partial<WebsiteModeConfig>) => void
) {
  const columns = [...(siteSettings.footerColumns || [])];
  if (!columns[colIndex]) return;
  columns[colIndex] = {
    ...columns[colIndex],
    links: columns[colIndex].links.filter((link) => link.id !== linkId),
  };
  onUpdate(withColumns(siteSettings, columns));
}
