import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import type { WhatsAppCountryOption } from '../data/whatsappCountryCodes';
import { WHATSAPP_COUNTRY_OPTIONS } from '../data/whatsappCountryCodes';

function optionKey(o: WhatsAppCountryOption): string {
  return `${o.iso2}::${o.dial}`;
}

type Props = {
  valueDial: string;
  /** Stable selection when multiple countries share the same dial (e.g. +1) */
  valueKey: string;
  onChange: (dial: string, key: string) => void;
  disabled?: boolean;
};

export function WhatsAppCountryPicker({ valueDial, valueKey, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => {
    if (valueKey) {
      const found = WHATSAPP_COUNTRY_OPTIONS.find((o) => optionKey(o) === valueKey);
      if (found) return found;
    }
    return WHATSAPP_COUNTRY_OPTIONS.find((o) => o.dial === valueDial) ?? null;
  }, [valueDial, valueKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WHATSAPP_COUNTRY_OPTIONS;
    return WHATSAPP_COUNTRY_OPTIONS.filter((o) => {
      const dialDigits = o.dial.replace(/\D/g, '');
      return (
        o.name.toLowerCase().includes(q) ||
        o.dial.toLowerCase().includes(q) ||
        o.iso2.toLowerCase().includes(q) ||
        dialDigits.includes(q.replace(/\D/g, ''))
      );
    });
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const select = (o: WhatsAppCountryOption) => {
    onChange(o.dial, optionKey(o));
    close();
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-[min(100%,280px)] shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left transition-all shadow-sm disabled:opacity-50"
      >
        <span className="text-xl leading-none shrink-0" aria-hidden>
          {selected?.flag ?? '🌐'}
        </span>
        <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
          {selected ? (
            <>
              <span className="text-gray-500 font-normal">{selected.name}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="tabular-nums text-blue-700">{selected.dial}</span>
            </>
          ) : (
            <span className="text-gray-400 font-normal">Select country</span>
          )}
        </span>
        <FiChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-[200] mt-2 left-0 right-0 rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/80 overflow-hidden flex flex-col max-h-[min(420px,70vh)]">
          <div className="p-2 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="Clear search"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-2 px-1">
              {filtered.length} countries · WhatsApp uses your full international number
            </p>
          </div>

          <div ref={listRef} className="overflow-y-auto overscroll-contain flex-1 min-h-0 py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8 px-4">No countries match “{query}”</p>
            ) : (
              filtered.map((o) => {
                const k = optionKey(o);
                const isActive =
                  (valueKey !== '' && valueKey === k) ||
                  (valueKey === '' &&
                    valueDial === o.dial &&
                    selected?.iso2 === o.iso2 &&
                    selected?.dial === o.dial);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => select(o)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <span className="text-xl shrink-0 w-8 text-center" aria-hidden>
                      {o.flag}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium">{o.name}</span>
                    <span className="tabular-nums text-gray-600 shrink-0 font-semibold">{o.dial}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
