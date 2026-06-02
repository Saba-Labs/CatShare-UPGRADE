import { useMemo } from 'react';
import type { WebsiteModeConfig } from '../../types/homepage';
import { buildStoreLinkOptions, groupStoreLinkOptions } from '../../utils/storeLinkOptions';
import { normalizeStorefrontPath } from '../../utils/storefrontHref';
import { useBuilderCatalogue } from './catalogue/BuilderCatalogueContext';
import SidebarDropdownField, { type SidebarDropdownOption } from './SidebarDropdownField';

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
  const dropdownOptions = useMemo(
    () =>
      grouped.flatMap((group) =>
        group.items.map(
          (item): SidebarDropdownOption<string> => ({
            value: item.href,
            label: item.label,
            groupLabel: group.label,
          })
        )
      ),
    [grouped]
  );

  return (
    <div className="store-link-picker">
      <SidebarDropdownField
        ariaLabel="Choose a store link"
        value={matchedOption?.href || ''}
        options={dropdownOptions}
        placeholder={loading ? 'Loading store links…' : 'Choose store link…'}
        onChange={(next) => {
          if (next) onChange(normalizeStorefrontPath(next));
        }}
      />
      {allowCustom && (
        <input
          type="text"
          className="panel-input"
          value={value}
          onChange={(e) => onChange(normalizeStorefrontPath(e.target.value))}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
