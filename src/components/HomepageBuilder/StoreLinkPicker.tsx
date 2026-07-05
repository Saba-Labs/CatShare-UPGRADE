import { useMemo, useState } from 'react';
import type { WebsiteModeConfig } from '../../types/homepage';
import { buildStoreLinkOptions, groupStoreLinkOptions } from '../../utils/storeLinkOptions';
import { isExternalHref, sanitizeStoreLinkHref } from '../../utils/storefrontHref';
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
  placeholder = 'https://example.com or /collections/all',
  allowCustom = true,
}: StoreLinkPickerProps) {
  const { products, categories, loading } = useBuilderCatalogue();
  const [linkMode, setLinkMode] = useState<'store' | 'external'>(() =>
    isExternalHref(value) ? 'external' : 'store'
  );

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

  const effectiveMode = isExternalHref(value) ? 'external' : linkMode;

  return (
    <div className="store-link-picker">
      <SidebarDropdownField
        ariaLabel="Link destination type"
        value={effectiveMode}
        options={[
          { value: 'store', label: 'Store page' },
          { value: 'external', label: 'External URL' },
        ]}
        onChange={(next) => {
          const mode = next as 'store' | 'external';
          setLinkMode(mode);
          if (mode === 'external' && !isExternalHref(value)) {
            onChange('https://');
          } else if (mode === 'store' && isExternalHref(value)) {
            onChange('/');
          }
        }}
      />

      {effectiveMode === 'store' ? (
        <SidebarDropdownField
          ariaLabel="Choose a store link"
          value={matchedOption?.href || ''}
          options={dropdownOptions}
          placeholder={loading ? 'Loading store links…' : 'Choose store link…'}
          onChange={(next) => {
            if (next) onChange(sanitizeStoreLinkHref(next));
          }}
        />
      ) : null}

      {allowCustom && (
        <input
          type="text"
          className="panel-input"
          value={value}
          onChange={(e) => onChange(sanitizeStoreLinkHref(e.target.value))}
          placeholder={effectiveMode === 'external' ? 'https://…, mailto:…, tel:…' : placeholder}
        />
      )}

      {effectiveMode === 'external' ? (
        <p className="sidebar-field-hint">External links open in a new tab on your live store.</p>
      ) : null}
    </div>
  );
}
