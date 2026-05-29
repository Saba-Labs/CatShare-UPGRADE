import { useMemo } from 'react';
import type { WebsiteModeConfig } from '../../types/homepage';
import { buildStoreLinkOptions, groupStoreLinkOptions } from '../../utils/storeLinkOptions';
import { useBuilderCatalogue } from './catalogue/BuilderCatalogueContext';

interface StoreLinkPickerProps {
  value: string;
  onChange: (href: string) => void;
  websiteConfig?: WebsiteModeConfig;
  placeholder?: string;
  /** Show the text field for custom URLs (default true). */
  allowCustom?: boolean;
}

export default function StoreLinkPicker({
  value,
  onChange,
  websiteConfig,
  placeholder = 'Or enter a custom path or https://…',
  allowCustom = true,
}: StoreLinkPickerProps) {
  const { products, categories, loading } = useBuilderCatalogue();

  const options = useMemo(
    () =>
      buildStoreLinkOptions({
        customPages: websiteConfig?.pages.custom?.map((p) => ({ title: p.title, slug: p.slug })),
        products,
        categories,
      }),
    [websiteConfig?.pages.custom, products, categories]
  );

  const grouped = useMemo(() => groupStoreLinkOptions(options), [options]);

  const matchedOption = options.find((o) => o.href === value);

  return (
    <div className="store-link-picker">
      <select
        className="panel-select"
        value={matchedOption?.href || ''}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        aria-label="Choose a store link"
      >
        <option value="">{loading ? 'Loading store links…' : 'Choose store link…'}</option>
        {grouped.map((group) => (
          <optgroup key={group.group} label={group.label}>
            {group.items.map((item) => (
              <option key={item.id} value={item.href}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {allowCustom && (
        <input
          type="text"
          className="panel-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
