import React from 'react';
import { HomepageSection, ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { v4 as uuid } from 'uuid';
import { getSiteTheme } from '../../utils/websiteSiteTheme';
import TextSectionEditor from './editors/TextSectionEditor';
import CarouselSectionEditor from './editors/CarouselSectionEditor';
import GenericSectionEditor from './editors/GenericSectionEditor';
import TestimonialsSectionEditor from './editors/TestimonialsSectionEditor';
import StoreLinkPicker from './StoreLinkPicker';
import FooterSettingsEditor from './FooterSettingsEditor';
import ColorPickerField from './ColorPickerField';

interface PropertiesPanelProps {
  selectedSectionId: string | null;
  sections: (HomepageSection & { id: string })[];
  theme: ThemeSettings;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  activeTab: 'theme' | 'header' | 'footer' | 'home' | 'collection' | 'product';
  storeId: string;
  editingPageId: string;
  onSelectEditingPage: (pageId: string) => void;
}

export default function PropertiesPanel({
  selectedSectionId,
  sections,
  theme,
  onUpdateSection,
  onUpdateTheme,
  websiteConfig,
  onUpdateWebsiteConfig,
  activeTab,
  storeId,
  editingPageId,
  onSelectEditingPage,
}: PropertiesPanelProps) {
  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const customPages = websiteConfig.pages.custom || [];

  const addCustomPage = () => {
    const nextIndex = customPages.length + 1;
    const pageId = uuid();
    const title = `Page ${nextIndex}`;
    const slug = `page-${nextIndex}`;
    onUpdateWebsiteConfig({
      pages: {
        ...websiteConfig.pages,
        custom: [
          ...customPages,
          {
            id: pageId,
            title,
            slug,
            layout: {
              sections: [],
              theme: { ...getSiteTheme(websiteConfig) },
            },
          },
        ],
      },
      siteSettings: {
        ...websiteConfig.siteSettings,
        navItems: [
          ...websiteConfig.siteSettings.navItems,
          { id: uuid(), label: title, href: `/${slug}` },
        ],
      },
    });
    onSelectEditingPage(pageId);
  };

  if (activeTab === 'header') {
    return (
      <div className="properties-panel">
        <div className="panel-header">Header Settings</div>
        <div className="panel-content">
          <div className="panel-section">
            <label className="panel-label">Website Name</label>
            <input className="panel-input" value={websiteConfig.siteSettings.websiteName || ''} onChange={(e) => onUpdateWebsiteConfig({ siteSettings: { ...websiteConfig.siteSettings, websiteName: e.target.value } as any })} />
          </div>
          <div className="panel-section">
            <label className="panel-label">Announcement</label>
            <input className="panel-input" value={websiteConfig.siteSettings.announcementText || ''} onChange={(e) => onUpdateWebsiteConfig({ siteSettings: { ...websiteConfig.siteSettings, announcementText: e.target.value, showAnnouncement: true } as any })} />
          </div>
          <div className="panel-section">
            <label className="panel-label">Pages</label>
            <button type="button" className="btn-secondary" onClick={addCustomPage}>Add page</button>
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <label className="panel-checkbox">
                <input
                  type="radio"
                  checked={editingPageId === 'home'}
                  onChange={() => onSelectEditingPage('home')}
                />
                <span>Edit Home</span>
              </label>
              {customPages.map((page) => (
                <div key={page.id} style={{ display: 'grid', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                  <label className="panel-checkbox">
                    <input
                      type="radio"
                      checked={editingPageId === page.id}
                      onChange={() => onSelectEditingPage(page.id)}
                    />
                    <span>Edit this page</span>
                  </label>
                  <input
                    className="panel-input"
                    value={page.title}
                    onChange={(e) => updateCustomPage(websiteConfig, page.id, { title: e.target.value }, onUpdateWebsiteConfig)}
                    placeholder="Page title"
                  />
                  <input
                    className="panel-input"
                    value={page.slug}
                    onChange={(e) => updateCustomPage(websiteConfig, page.id, { slug: slugifyPage(e.target.value) }, onUpdateWebsiteConfig)}
                    placeholder="Page slug"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeCustomPage(websiteConfig, page.id, onUpdateWebsiteConfig, editingPageId, onSelectEditingPage)}
                  >
                    Remove page
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-section">
            <label className="panel-label">Navigation Menu</label>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onUpdateWebsiteConfig({
                siteSettings: {
                  ...websiteConfig.siteSettings,
                  navItems: [
                    ...(websiteConfig.siteSettings.navItems || []),
                    { id: uuid(), label: 'New link', href: '/' },
                  ],
                },
              })}
            >
              Add nav item
            </button>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {(websiteConfig.siteSettings.navItems || []).map((item) => (
                <div key={item.id} style={{ display: 'grid', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                  <input
                    className="panel-input"
                    value={item.label}
                    onChange={(e) => updateNavItem(websiteConfig, item.id, { label: e.target.value }, onUpdateWebsiteConfig)}
                    placeholder="Menu label"
                  />
                  <StoreLinkPicker
                    value={item.href}
                    websiteConfig={websiteConfig}
                    onChange={(href) => updateNavItem(websiteConfig, item.id, { href: sanitizeHref(href) }, onUpdateWebsiteConfig)}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeNavItem(websiteConfig, item.id, onUpdateWebsiteConfig)}
                  >
                    Remove link
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => moveNavItem(websiteConfig, item.id, -1, onUpdateWebsiteConfig)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => moveNavItem(websiteConfig, item.id, 1, onUpdateWebsiteConfig)}
                    >
                      Move down
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'footer') {
    return (
      <div className="properties-panel">
        <div className="panel-header">Footer</div>
        <div className="panel-content sidebar-panel-sections">
          <FooterSettingsEditor
            siteSettings={websiteConfig.siteSettings}
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
          />
        </div>
      </div>
    );
  }

  if (activeTab === 'collection') {
    return (
      <div className="properties-panel">
        <div className="panel-header">Collection Template</div>
        <div className="panel-content">
          <div className="panel-section">
            <label className="panel-label">Columns</label>
            <input type="number" min={2} max={4} className="panel-input" value={websiteConfig.templates.collection.columns} onChange={(e) => onUpdateWebsiteConfig({ templates: { ...websiteConfig.templates, collection: { ...websiteConfig.templates.collection, columns: Math.min(4, Math.max(2, Number(e.target.value) || 2)) } } as any })} />
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'product') {
    return (
      <div className="properties-panel">
        <div className="panel-header">Product Template</div>
        <div className="panel-content">
          <div className="panel-section">
            <label className="panel-label">Show Recommendations</label>
            <input type="checkbox" checked={websiteConfig.templates.product.showRecommendations} onChange={(e) => onUpdateWebsiteConfig({ templates: { ...websiteConfig.templates, product: { ...websiteConfig.templates.product, showRecommendations: e.target.checked } } as any })} />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedSection || activeTab !== 'home') {
    return (
      <div className="properties-panel">
        <div className="panel-header">Theme Settings</div>
        <div className="panel-content color-picker-stack">
          <ColorPickerField
            label="Primary"
            value={theme.primaryColor || '#2563eb'}
            defaultValue="#2563eb"
            onChange={(primaryColor) => onUpdateTheme({ primaryColor })}
          />
          <ColorPickerField
            label="Text"
            value={theme.textColor || '#1f2937'}
            defaultValue="#1f2937"
            onChange={(textColor) => onUpdateTheme({ textColor })}
          />
          <ColorPickerField
            label="Background"
            value={theme.backgroundColor || '#ffffff'}
            onChange={(backgroundColor) => onUpdateTheme({ backgroundColor })}
          />
          <ColorPickerField
            label="Accent"
            value={theme.accentColor || '#dc2626'}
            defaultValue="#dc2626"
            onChange={(accentColor) => onUpdateTheme({ accentColor })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="panel-header">Section Settings</div>
      <div className="panel-content">
        {selectedSection.type === 'text' && (
          <TextSectionEditor
            section={selectedSection as any}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}

        {selectedSection.type === 'carousel' && (
          <CarouselSectionEditor
            section={selectedSection as any}
            storeId={storeId}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}

        {selectedSection.type === 'testimonials' && (
          <TestimonialsSectionEditor
            section={selectedSection as any}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}

        {/* Generic editor for other section types */}
        {!['text', 'carousel', 'testimonials'].includes(selectedSection.type) && (
          <GenericSectionEditor
            section={selectedSection}
            storeId={storeId}
            websiteConfig={websiteConfig}
            onUpdate={(updates) => onUpdateSection(selectedSectionId, updates)}
          />
        )}
      </div>
    </div>
  );
}

function slugifyPage(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function updateCustomPage(
  websiteConfig: WebsiteModeConfig,
  pageId: string,
  updates: Partial<{ title: string; slug: string }>,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  const nextCustomPages = (websiteConfig.pages.custom || []).map((page) => (page.id === pageId ? { ...page, ...updates } : page));
  const updatedPage = nextCustomPages.find((page) => page.id === pageId);
  const nextNavItems = websiteConfig.siteSettings.navItems.map((item) => {
    const previousHref = `/${(websiteConfig.pages.custom || []).find((page) => page.id === pageId)?.slug || ''}`;
    if (item.href === previousHref && updatedPage) {
      return { ...item, label: updatedPage.title, href: `/${updatedPage.slug}` };
    }
    return item;
  });
  onUpdateWebsiteConfig({
    pages: {
      ...websiteConfig.pages,
      custom: nextCustomPages,
    },
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: nextNavItems,
    },
  });
}

function removeCustomPage(
  websiteConfig: WebsiteModeConfig,
  pageId: string,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void,
  editingPageId: string,
  onSelectEditingPage: (pageId: string) => void
) {
  const page = (websiteConfig.pages.custom || []).find((item) => item.id === pageId);
  const nextCustomPages = (websiteConfig.pages.custom || []).filter((item) => item.id !== pageId);
  const nextNavItems = websiteConfig.siteSettings.navItems.filter((item) => item.href !== `/${page?.slug || ''}`);
  onUpdateWebsiteConfig({
    pages: {
      ...websiteConfig.pages,
      custom: nextCustomPages,
    },
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: nextNavItems,
    },
  });
  if (editingPageId === pageId) onSelectEditingPage('home');
}

function sanitizeHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function updateNavItem(
  websiteConfig: WebsiteModeConfig,
  navItemId: string,
  updates: Partial<{ label: string; href: string }>,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  onUpdateWebsiteConfig({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).map((item) =>
        item.id === navItemId ? { ...item, ...updates } : item
      ),
    },
  });
}

function removeNavItem(
  websiteConfig: WebsiteModeConfig,
  navItemId: string,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  onUpdateWebsiteConfig({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: (websiteConfig.siteSettings.navItems || []).filter((item) => item.id !== navItemId),
    },
  });
}

function moveNavItem(
  websiteConfig: WebsiteModeConfig,
  navItemId: string,
  direction: -1 | 1,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  const items = [...(websiteConfig.siteSettings.navItems || [])];
  const currentIndex = items.findIndex((item) => item.id === navItemId);
  if (currentIndex < 0) return;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return;
  const [moved] = items.splice(currentIndex, 1);
  items.splice(nextIndex, 0, moved);
  onUpdateWebsiteConfig({
    siteSettings: {
      ...websiteConfig.siteSettings,
      navItems: items,
    },
  });
}
