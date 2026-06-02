import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown } from './builderSidebarIcons';

export type SidebarDropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  groupLabel?: string;
  disabled?: boolean;
};

interface SidebarDropdownFieldProps<T extends string> {
  value: T;
  options: SidebarDropdownOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function SidebarDropdownField<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
}: SidebarDropdownFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = useMemo(() => options.find((opt) => opt.value === value), [options, value]);
  const triggerLabel = active?.label || placeholder || '';
  const renderedGroupLabels = new Set<string>();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className={`sidebar-dropdown ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="sidebar-dropdown__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
      >
        <span className={`sidebar-dropdown__trigger-label${active ? '' : ' is-placeholder'}`}>{triggerLabel}</span>
        <FiChevronDown className="sidebar-dropdown__chevron" aria-hidden />
      </button>

      {open ? (
        <div className="sidebar-dropdown__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => {
            const isActive = opt.value === value;
            const shouldRenderGroupLabel = !!opt.groupLabel && !renderedGroupLabels.has(opt.groupLabel);
            if (opt.groupLabel) renderedGroupLabels.add(opt.groupLabel);
            return (
              <React.Fragment key={opt.value}>
                {shouldRenderGroupLabel ? (
                  <div className="sidebar-dropdown__group-label" aria-hidden>
                    {opt.groupLabel}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={opt.disabled}
                  className={`sidebar-dropdown__option${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="sidebar-dropdown__option-label">{opt.label}</span>
                  {opt.hint ? <small className="sidebar-dropdown__option-hint">{opt.hint}</small> : null}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
