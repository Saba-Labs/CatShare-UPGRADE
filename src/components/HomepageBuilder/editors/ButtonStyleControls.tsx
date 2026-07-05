import ColorPickerField from '../ColorPickerField';
import SidebarDropdownField from '../SidebarDropdownField';
import type { BuilderButtonStyleSettings, BuilderButtonRadius, BuilderButtonShadow } from '../../../utils/buttonStyleUtils';

interface ButtonStyleControlsProps {
  settings: BuilderButtonStyleSettings;
  onChange: (patch: Partial<BuilderButtonStyleSettings>) => void;
  showColor?: boolean;
}

export default function ButtonStyleControls({
  settings,
  onChange,
  showColor = true,
}: ButtonStyleControlsProps) {
  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Button style</label>
        <SidebarDropdownField
          ariaLabel="Button style"
          value={settings.buttonStyle || 'solid'}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'outline', label: 'Outline' },
            { value: 'soft', label: 'Soft fill' },
          ]}
          onChange={(next) => onChange({ buttonStyle: next as BuilderButtonStyleSettings['buttonStyle'] })}
        />
      </div>

      {showColor ? (
        <ColorPickerField
          label="Button color"
          value={settings.buttonColor || '#2563eb'}
          defaultValue="#2563eb"
          onChange={(buttonColor) => onChange({ buttonColor })}
        />
      ) : null}

      <div className="panel-section">
        <label className="panel-label">Shadow</label>
        <SidebarDropdownField
          ariaLabel="Button shadow"
          value={settings.buttonShadow || 'soft'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'soft', label: 'Soft' },
            { value: 'medium', label: 'Medium' },
            { value: 'strong', label: 'Strong' },
          ]}
          onChange={(next) => onChange({ buttonShadow: next as BuilderButtonShadow })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Corners</label>
        <SidebarDropdownField
          ariaLabel="Button corner style"
          value={settings.buttonRadius || 'theme'}
          options={[
            { value: 'theme', label: 'Theme default' },
            { value: 'sharp', label: 'Sharp' },
            { value: 'round', label: 'Round' },
            { value: 'pill', label: 'Pill' },
          ]}
          onChange={(next) => onChange({ buttonRadius: next as BuilderButtonRadius })}
        />
      </div>
    </>
  );
}
