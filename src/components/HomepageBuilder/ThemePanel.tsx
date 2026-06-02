import { ThemeSettings, WebsiteModeConfig } from '../../types/homepage';
import { THEME_PRESETS, FONT_FAMILY_OPTIONS, BUTTON_STYLE_OPTIONS } from '../../config/themePresets';
import SidebarSection from './SidebarSection';
import ColorPickerField from './ColorPickerField';
import { FiDroplet, FiGrid, FiLayers, FiType } from './builderSidebarIcons';
import SidebarDropdownField from './SidebarDropdownField';

interface ThemePanelProps {
  theme: ThemeSettings;
  websiteConfig: WebsiteModeConfig;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
}

const COLOR_FIELDS: Array<{ key: keyof ThemeSettings; label: string; fallback: string }> = [
  { key: 'primaryColor', label: 'Primary', fallback: '#1a73e8' },
  { key: 'textColor', label: 'Text', fallback: '#202124' },
  { key: 'backgroundColor', label: 'Background', fallback: '#ffffff' },
  { key: 'accentColor', label: 'Accent', fallback: '#d93025' },
];

export default function ThemePanel({
  theme,
  websiteConfig,
  onUpdateTheme,
  onUpdateWebsiteConfig,
}: ThemePanelProps) {
  return (
    <div className="sidebar-panel">
      <SidebarSection title="Presets" icon={<FiLayers />} description="One-click site look">
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

      <SidebarSection title="Type" icon={<FiType />} description="Font & buttons">
        <div className="sidebar-field sidebar-field--inline">
          <span className="field-icon" title="Font">
            <FiType aria-hidden />
          </span>
          <div className="panel-select--grow">
            <SidebarDropdownField
              ariaLabel="Font"
              value={theme.fontFamily || FONT_FAMILY_OPTIONS[0].value}
              options={FONT_FAMILY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              onChange={(next) => onUpdateTheme({ fontFamily: next })}
            />
          </div>
        </div>
        <div className="sidebar-field sidebar-field--inline">
          <span className="field-icon" title="Button style">
            <FiGrid aria-hidden />
          </span>
          <div className="panel-select--grow">
            <SidebarDropdownField
              ariaLabel="Button style"
              value={theme.buttonStyle || 'solid'}
              options={BUTTON_STYLE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              onChange={(next) => onUpdateTheme({ buttonStyle: next as ThemeSettings['buttonStyle'] })}
            />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="Colors" icon={<FiDroplet />} description="Brand palette">
        <div className="color-picker-grid">
          {COLOR_FIELDS.map(({ key, label, fallback }) => (
            <ColorPickerField
              key={key}
              compact
              label={label}
              value={(theme[key] as string) || fallback}
              defaultValue={fallback}
              onChange={(hex) => onUpdateTheme({ [key]: hex })}
            />
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="Shop" icon={<FiGrid />} description="Collection & product pages">
        <div className="sidebar-field sidebar-field--inline">
          <span className="field-icon" title="Collection columns">#</span>
          <input
            type="number"
            min={2}
            max={4}
            className="panel-input panel-input--grow"
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
            aria-label="Collection columns"
          />
        </div>
        <label className="sidebar-toggle sidebar-toggle--compact" title="Show product recommendations">
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
          <span>Recommendations</span>
        </label>
      </SidebarSection>
    </div>
  );
}