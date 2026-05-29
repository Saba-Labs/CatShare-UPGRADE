import { ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { THEME_PRESETS, FONT_FAMILY_OPTIONS, BUTTON_STYLE_OPTIONS } from '../../config/themePresets';
import SidebarSection from './SidebarSection';

interface ThemePanelProps {
  theme: ThemeSettings;
  websiteConfig: WebsiteModeConfig;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
}

export default function ThemePanel({
  theme,
  websiteConfig,
  onUpdateTheme,
  onUpdateWebsiteConfig,
}: ThemePanelProps) {
  return (
    <div className="sidebar-panel">
      <SidebarSection
        title="Theme presets"
        description="Applies to your entire site — home, shop, checkout, and all pages."
      >
        <div className="theme-preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="theme-preset-card"
              onClick={() => onUpdateTheme(preset.theme)}
              title={preset.name}
            >
              <span className="theme-preset-swatch" style={{ background: preset.swatch }} />
              <span className="theme-preset-name">{preset.name}</span>
            </button>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="Typography & buttons">
        <div className="sidebar-field">
          <label className="panel-label">Font</label>
          <select
            className="panel-select"
            value={theme.fontFamily || FONT_FAMILY_OPTIONS[0].value}
            onChange={(e) => onUpdateTheme({ fontFamily: e.target.value })}
          >
            {FONT_FAMILY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sidebar-field">
          <label className="panel-label">Button style</label>
          <select
            className="panel-select"
            value={theme.buttonStyle || 'solid'}
            onChange={(e) => onUpdateTheme({ buttonStyle: e.target.value as ThemeSettings['buttonStyle'] })}
          >
            {BUTTON_STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </SidebarSection>

      <SidebarSection title="Colors">
        <div className="sidebar-color-grid">
          <div className="sidebar-field">
            <label className="panel-label">Primary</label>
            <input
              type="color"
              className="panel-input panel-input--color"
              value={theme.primaryColor || '#1a73e8'}
              onChange={(e) => onUpdateTheme({ primaryColor: e.target.value })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Text</label>
            <input
              type="color"
              className="panel-input panel-input--color"
              value={theme.textColor || '#202124'}
              onChange={(e) => onUpdateTheme({ textColor: e.target.value })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Page background</label>
            <input
              type="color"
              className="panel-input panel-input--color"
              value={theme.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdateTheme({ backgroundColor: e.target.value })}
            />
          </div>
          <div className="sidebar-field">
            <label className="panel-label">Accent</label>
            <input
              type="color"
              className="panel-input panel-input--color"
              value={theme.accentColor || '#d93025'}
              onChange={(e) => onUpdateTheme({ accentColor: e.target.value })}
            />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="Store templates" description="Collection and product page defaults.">
        <div className="sidebar-field">
          <label className="panel-label">Collection columns</label>
          <input
            type="number"
            min={2}
            max={4}
            className="panel-input"
            value={websiteConfig.templates.collection.columns}
            onChange={(e) =>
              onUpdateWebsiteConfig({
                templates: {
                  ...websiteConfig.templates,
                  collection: {
                    ...websiteConfig.templates.collection,
                    columns: Math.min(4, Math.max(2, Number(e.target.value) || 2)) as 2 | 3 | 4,
                  },
                },
              })
            }
          />
        </div>
        <label className="sidebar-toggle">
          <input
            type="checkbox"
            checked={websiteConfig.templates.product.showRecommendations}
            onChange={(e) =>
              onUpdateWebsiteConfig({
                templates: {
                  ...websiteConfig.templates,
                  product: { ...websiteConfig.templates.product, showRecommendations: e.target.checked },
                },
              })
            }
          />
          <span>Show product recommendations</span>
        </label>
      </SidebarSection>
    </div>
  );
}
