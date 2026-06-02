import React from 'react';
import { v4 as uuid } from 'uuid';
import StoreLinkPicker from './StoreLinkPicker';
import FooterColorFields from './FooterColorFields';
import SidebarDropdownField from './SidebarDropdownField';
import {
  FOOTER_COLUMN_PRESETS,
  FOOTER_VARIANT_OPTIONS,
  footerPresetForVariant,
} from '../../config/footerVariants';
import type { WebsiteFooterVariant, WebsiteModeConfig, WebsiteSiteSettings } from '../../types/homepage';

interface FooterSettingsEditorProps {
  siteSettings: WebsiteSiteSettings;
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  embedded?: boolean;
  /** Hide color pickers when shown in a separate Colors section (e.g. footer quick panel). */
  hideColors?: boolean;
}

export default function FooterSettingsEditor({
  siteSettings,
  websiteConfig,
  onUpdateWebsiteConfig,
  hideColors = false,
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

  return (
    <>
      <div className="sidebar-field">
        <label className="panel-label">Footer layout</label>
        <SidebarDropdownField
          ariaLabel="Footer layout"
          value={variant}
          options={FOOTER_VARIANT_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
          onChange={applyVariant}
        />
        <p className="panel-hint">
          Changes the structure of your footer (columns, cards, centered, or split row).
        </p>
      </div>

      <div className="sidebar-field">
        <label className="panel-label">Footer width</label>
        <SidebarDropdownField
          ariaLabel="Footer width"
          value={siteSettings.footerWidth === 'full' ? 'full' : 'boxed'}
          options={[
            { value: 'boxed', label: 'Boxed', hint: 'Card with side margins' },
            { value: 'full', label: 'Full width', hint: 'Edge to edge' },
          ]}
          onChange={(next) => patch({ footerWidth: next })}
        />
        <p className="panel-hint">Boxed matches the OrderForm card look; full width spans the entire page.</p>
      </div>

      {!hideColors ? (
        <>
          <div className="sidebar-panel-divider" />
          <FooterColorFields siteSettings={siteSettings} variant={variant} onPatch={patch} />
        </>
      ) : null}

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
