import { ThemeSettings } from '../../types/homepage';
import { THEME_PRESETS, FONT_FAMILY_OPTIONS, BUTTON_STYLE_OPTIONS } from '../../config/themePresets';
import SidebarSection from './SidebarSection';
import ColorPickerField from './ColorPickerField';
import { FiDroplet, FiGrid, FiLayers, FiType } from './builderSidebarIcons';
import SidebarDropdownField from './SidebarDropdownField';

interface ThemePanelProps {
  theme: ThemeSettings;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
}

const COLOR_FIELDS: Array<{ key: keyof ThemeSettings; label: string; fallback: string }> = [
  { key: 'primaryColor', label: 'Primary', fallback: '#1a73e8' },
  { key: 'textColor', label: 'Text', fallback: '#202124' },
  { key: 'backgroundColor', label: 'Background', fallback: '#ffffff' },
  { key: 'accentColor', label: 'Accent', fallback: '#d93025' },
];

export default function ThemePanel({
  theme,
  onUpdateTheme,
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

    </div>
  );
}