import ColorPickerField from './ColorPickerField';
import { footerColorPresetForVariant } from '../../config/footerVariants';
import type { WebsiteFooterVariant, WebsiteSiteSettings } from '../../types/homepage';

interface FooterColorFieldsProps {
  siteSettings: WebsiteSiteSettings;
  variant: WebsiteFooterVariant;
  onPatch: (patch: Partial<WebsiteSiteSettings>) => void;
  /** Show card/accent/border pickers (default true). */
  advanced?: boolean;
}

export default function FooterColorFields({
  siteSettings,
  variant,
  onPatch,
  advanced = true,
}: FooterColorFieldsProps) {
  return (
    <>
      <div className="sidebar-panel-header footer-colors-header">
        <span className="panel-label">Footer colors</span>
        <button type="button" className="btn-text" onClick={() => onPatch(footerColorPresetForVariant(variant))}>
          Reset for layout
        </button>
      </div>
      <p className="panel-hint">Updates the footer in the preview immediately.</p>
      <div className="color-picker-stack">
        <ColorPickerField
          label="Background"
          value={siteSettings.footerBg || '#ffffff'}
          onChange={(footerBg) => onPatch({ footerBg })}
        />
        <ColorPickerField
          label="Text"
          value={siteSettings.footerTextColor || '#1a1a1a'}
          onChange={(footerTextColor) => onPatch({ footerTextColor })}
        />
        <ColorPickerField
          label="Accent"
          value={siteSettings.footerAccentColor || '#1a6b4a'}
          onChange={(footerAccentColor) => onPatch({ footerAccentColor })}
        />
        {advanced ? (
          <>
            <ColorPickerField
              label="Card background"
              value={siteSettings.footerColBg || '#f2f2f0'}
              defaultValue="#f2f2f0"
              allowCssColor
              onChange={(footerColBg) => onPatch({ footerColBg })}
            />
            <ColorPickerField
              label="Accent badge background"
              value={siteSettings.footerAccentBg || '#e8f4ef'}
              defaultValue="#e8f4ef"
              allowCssColor
              onChange={(footerAccentBg) => onPatch({ footerAccentBg })}
            />
            <ColorPickerField
              label="Borders"
              value={siteSettings.footerBorderColor || 'rgba(0, 0, 0, 0.08)'}
              defaultValue="rgba(0, 0, 0, 0.08)"
              allowCssColor
              onChange={(footerBorderColor) => onPatch({ footerBorderColor })}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
