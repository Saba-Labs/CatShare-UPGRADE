import type { WebsiteModeConfig } from '../../../types/homepage';
import StoreLinkPicker from '../StoreLinkPicker';

interface ButtonLinkFieldProps {
  label?: string;
  value: string;
  onChange: (href: string) => void;
  websiteConfig?: WebsiteModeConfig;
}

export default function ButtonLinkField({
  label = 'Button Link',
  value,
  onChange,
  websiteConfig,
}: ButtonLinkFieldProps) {
  return (
    <div className="panel-section">
      <label className="panel-label">{label}</label>
      <StoreLinkPicker value={value} onChange={onChange} websiteConfig={websiteConfig} />
    </div>
  );
}
