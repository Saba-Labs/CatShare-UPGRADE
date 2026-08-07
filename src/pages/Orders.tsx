import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { persistListScroll, useListScrollRestore } from '../hooks/useListScrollRestore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSellerOrders, updateOrderStatus, type Order } from '../services/orderService';
import {
  ORDER_STATUSES,
  getOrderStatusLabel,
  normalizeOrderStatus,
  type OrderStatus,
  type OrderTabFilter,
} from '../types/orderStatus';
import { getAllCatalogues, type Catalogue } from '../config/catalogueConfig';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import { safeGetFromStorage, getStorageKey } from '../utils/safeStorage';
import { readCachedSellerStore } from '../utils/storePageCache';
import { getOrderCatalogueLabel, getOrderCatalogueId } from '../utils/resolveOrderCatalogue';
import { patchCachedOrder, readCachedSellerOrders, writeCachedSellerOrders } from '../utils/storePageCache';
import {
  getRuntimeSellerOrders,
  setRuntimeSellerOrders,
} from '../utils/sellerOrdersListSync';
import { resolveOrderGrandTotal } from '../utils/resolveOrderTotals';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import { productImageDisplayUrl } from '../utils/imageUrl';
import './Orders.css';
import MainAppBottomNav from '../components/MainAppBottomNav';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';

const ORDERS_LIST_SCROLL_KEY = 'ordersListScroll';
const ORDERS_SCREEN_FRESH_MS = 15000;
const ORDERS_ACTIVE_MOBILE_POLL_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = OrderTabFilter;
type StatusType = OrderStatus;
type OrderSourceFilter = 'all' | 'link' | 'manual' | 'store';

const ORDER_TAB_KEYS: TabType[] = [
  'all',
  'pending',
  'processing',
  'shipped',
  'completed',
  'cancelled',
];

const ORDER_SOURCE_FILTERS: { key: OrderSourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'link', label: 'Link' },
  { key: 'manual', label: 'Manual' },
  { key: 'store', label: 'Store' },
];

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  rowTotal?: number;
  category?: string;
  subtitle?: string;
  productId?: string;
  imageUrl?: string;
  imageVersion?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCurrencySymbol(code?: string) {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return '₹';
}

function formatMoney(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function maxCreatedAtIso(orders: Array<Pick<Order, 'created_at'>>): string | null {
  let best: string | null = null;
  for (const o of orders) {
    const t = (o as { created_at?: string | null }).created_at;
    if (!t) continue;
    const s = String(t);
    if (!best || s > best) best = s;
  }
  return best;
}

function maxUpdatedAtIso(orders: Array<Pick<Order, 'updated_at' | 'created_at'>>): string | null {
  let best: string | null = null;
  for (const o of orders) {
    const t = o.updated_at || o.created_at;
    if (!t) continue;
    const s = String(t);
    if (!best || s > best) best = s;
  }
  return best;
}

function mergeOrdersById(base: Order[], incoming: Order[]): Order[] {
  if (!incoming.length) return base;
  const map = new Map<string, Order>();
  for (const o of base) map.set(o.id, o);
  for (const o of incoming) map.set(o.id, o);
  const merged = Array.from(map.values());
  merged.sort(
    (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  );
  return merged;
}

function getStatusConfig(status: string) {
  switch (normalizeOrderStatus(status)) {
    case 'pending':
      return { bg: '#FEF9C3', text: '#854D0E', dot: '#EAB308', label: 'Pending' };
    case 'processing':
      return { bg: '#DBEAFE', text: '#1E40AF', dot: '#2563EB', label: 'Processing' };
    case 'shipped':
      return { bg: '#EDE9FE', text: '#5B21B6', dot: '#6366F1', label: 'Shipped' };
    case 'completed':
      return { bg: '#DCFCE7', text: '#166534', dot: '#16A34A', label: 'Completed' };
    case 'cancelled':
      return { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Cancelled' };
    default:
      return { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8', label: getOrderStatusLabel(status) };
  }
}

function getOrderSourceLabel(source?: string): string {
  switch (source) {
    case 'link':
      return 'Link';
    case 'manual':
      return 'Manual';
    case 'store':
      return 'Store';
    default:
      return 'Unknown';
  }
}

function orderMatchesListFilters(
  order: Order,
  opts: {
    tab: TabType;
    searchQuery: string;
    sourceFilter: OrderSourceFilter;
    catalogueFilter: string;
    catalogueIdByOrderId: Map<string, string | null>;
  }
): boolean {
  if (opts.tab !== 'all' && normalizeOrderStatus(order.status) !== opts.tab) return false;
  if (opts.sourceFilter !== 'all' && order.order_source !== opts.sourceFilter) return false;
  if (opts.catalogueFilter !== 'all') {
    const catalogueId = opts.catalogueIdByOrderId.get(order.id);
    if (catalogueId !== opts.catalogueFilter) return false;
  }
  if (opts.searchQuery) {
    const matchesSearch =
      order.customer_name?.toLowerCase().includes(opts.searchQuery) ||
      (order.items || []).some((it: OrderItem) => it.name?.toLowerCase().includes(opts.searchQuery));
    if (!matchesSearch) return false;
  }
  return true;
}

function FilterSourceIcon({ type }: { type: OrderSourceFilter }) {
  if (type === 'link') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    );
  }
  if (type === 'manual') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  if (type === 'store') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function FilterCatalogueRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`orders-filter-catalogue-row${selected ? ' orders-filter-catalogue-row--active' : ''}`}
      onClick={onClick}
    >
      <span className="orders-filter-radio" aria-hidden>
        <span className="orders-filter-radio-dot" />
      </span>
      <span className="orders-filter-catalogue-label">{label}</span>
    </button>
  );
}

function OrdersFilterPopup({
  open,
  onClose,
  sourceFilter,
  catalogueFilter,
  catalogues,
  onSourceChange,
  onCatalogueChange,
  onClear,
  hasActiveFilters,
}: {
  open: boolean;
  onClose: () => void;
  sourceFilter: OrderSourceFilter;
  catalogueFilter: string;
  catalogues: Catalogue[];
  onSourceChange: (value: OrderSourceFilter) => void;
  onCatalogueChange: (value: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const activeCount =
    (sourceFilter !== 'all' ? 1 : 0) + (catalogueFilter !== 'all' ? 1 : 0);

  return (
    <>
      <div className="orders-filter-backdrop" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal
        aria-label="Filter orders"
        className="orders-filter-sheet"
      >
        <div className="orders-filter-grabber">
          <span />
        </div>

        <div className="orders-filter-header">
          <div className="orders-filter-header-text">
            <h2>Filter orders</h2>
            <p>Narrow your list by source or catalogue</p>
            {activeCount > 0 ? (
              <span className="orders-filter-active-pill">
                <span className="orders-filter-active-pill-dot" />
                {activeCount} active
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="orders-filter-close"
            onClick={onClose}
            aria-label="Close filters"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="orders-filter-body">
          <section>
            <span className="orders-filter-section-label">Order source</span>
            <div className="orders-filter-source-grid">
              {ORDER_SOURCE_FILTERS.map((opt) => {
                const selected = sourceFilter === opt.key;
                const chipLabel = opt.key === 'all' ? 'All sources' : opt.label;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`orders-filter-source-chip${selected ? ' orders-filter-source-chip--active' : ''}`}
                    onClick={() => onSourceChange(opt.key)}
                  >
                    <span className="orders-filter-source-chip-icon">
                      <FilterSourceIcon type={opt.key} />
                    </span>
                    <span className="orders-filter-source-chip-label">{chipLabel}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <span className="orders-filter-section-label">Catalogue</span>
            <div className="orders-filter-card">
              <div className="orders-filter-card-scroll">
                <FilterCatalogueRow
                  label="All catalogues"
                  selected={catalogueFilter === 'all'}
                  onClick={() => onCatalogueChange('all')}
                />
                {catalogues.map((cat) => (
                  <FilterCatalogueRow
                    key={cat.id}
                    label={cat.label}
                    selected={catalogueFilter === cat.id}
                    onClick={() => onCatalogueChange(cat.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="orders-filter-footer">
          {hasActiveFilters ? (
            <button type="button" className="orders-filter-btn-clear" onClick={onClear}>
              Clear all
            </button>
          ) : null}
          <button type="button" className="orders-filter-btn-done" onClick={onClose}>
            Show results
          </button>
        </div>
      </div>
    </>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function IconFilter({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" fill={active ? 'currentColor' : 'none'} opacity={active ? 0.15 : 1} />
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}
function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function getOrderTabTheme(key: OrderTabFilter): {
  label: string;
  hint: string;
  gradient: string;
  shadow: string;
  bannerBg: string;
  bannerBorder: string;
  text: string;
  meta: string;
  indicator: string;
} {
  switch (key) {
    case 'all':
      return {
        label: 'All orders',
        hint: 'Every order across all stages',
        gradient: 'linear-gradient(145deg, #64748b 0%, #334155 100%)',
        shadow: 'rgba(51, 65, 85, 0.4)',
        bannerBg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        bannerBorder: '#e2e8f0',
        text: '#0f172a',
        meta: '#64748b',
        indicator: '#475569',
      };
    case 'pending':
      return {
        label: 'Pending',
        hint: 'New orders waiting for your review',
        gradient: 'linear-gradient(145deg, #fbbf24 0%, #ea580c 100%)',
        shadow: 'rgba(234, 88, 12, 0.45)',
        bannerBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        bannerBorder: '#fde68a',
        text: '#92400e',
        meta: '#b45309',
        indicator: '#d97706',
      };
    case 'processing':
      return {
        label: 'Processing',
        hint: 'Accepted and being prepared',
        gradient: 'linear-gradient(145deg, #60a5fa 0%, #2563eb 100%)',
        shadow: 'rgba(37, 99, 235, 0.45)',
        bannerBg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        bannerBorder: '#bfdbfe',
        text: '#1e40af',
        meta: '#1d4ed8',
        indicator: '#2563eb',
      };
    case 'shipped':
      return {
        label: 'Shipped',
        hint: 'Dispatched and on the way',
        gradient: 'linear-gradient(145deg, #a78bfa 0%, #6366f1 100%)',
        shadow: 'rgba(99, 102, 241, 0.45)',
        bannerBg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
        bannerBorder: '#c4b5fd',
        text: '#5b21b6',
        meta: '#6d28d9',
        indicator: '#6366f1',
      };
    case 'completed':
      return {
        label: 'Completed',
        hint: 'Successfully fulfilled orders',
        gradient: 'linear-gradient(145deg, #4ade80 0%, #16a34a 100%)',
        shadow: 'rgba(22, 163, 74, 0.4)',
        bannerBg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        bannerBorder: '#bbf7d0',
        text: '#166534',
        meta: '#15803d',
        indicator: '#16a34a',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        hint: 'Closed and no longer active',
        gradient: 'linear-gradient(145deg, #fb7185 0%, #e11d48 100%)',
        shadow: 'rgba(225, 29, 72, 0.4)',
        bannerBg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
        bannerBorder: '#fecdd3',
        text: '#9f1239',
        meta: '#be123c',
        indicator: '#e11d48',
      };
    default:
      return getOrderTabTheme('all');
  }
}

function StatusTabGlyph({ tabKey, size = 20 }: { tabKey: OrderTabFilter; size?: number }) {
  const s = size;
  switch (tabKey) {
    case 'all':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="3" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.95" />
          <rect x="13" y="3" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="3" y="13" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.7" />
          <rect x="13" y="13" width="8" height="8" rx="2.5" fill="currentColor" opacity="0.5" />
        </svg>
      );
    case 'pending':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 8.5V18a2 2 0 002 2h10a2 2 0 002-2V8.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 8.5h16l-1.6-3.2A2 2 0 0016.53 4H7.47a2 2 0 00-1.87 1.3L4 8.5z"
            fill="currentColor"
            opacity="0.35"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="7" r="3.25" fill="currentColor" />
          <path d="M12 11v4M10 13h4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'processing':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
            fill="currentColor"
            opacity="0.25"
          />
          <path
            d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M12 12.5V21M12 12.5L4 8M12 12.5l8-4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.65" />
          <path
            d="M9.5 10.5h5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'shipped':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2 4h3l2.2 11h11.3L20 9H7.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="2" y="4" width="5" height="5" rx="1" fill="currentColor" opacity="0.35" />
          <circle cx="7.5" cy="18.5" r="2" fill="currentColor" />
          <circle cx="16.5" cy="18.5" r="2" fill="currentColor" />
          <path d="M1 18.5h3M20 18.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case 'completed':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.25" />
          <path
            d="M8.5 12.2l2.4 2.4 4.8-5.2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 2.8l1.4 2.8 3.1.4-2.2 2.2.5 3.1L12 9.8 9.2 11.3l.5-3.1L7.5 6l3.1-.4L12 2.8z"
            fill="currentColor"
            opacity="0.35"
          />
        </svg>
      );
    case 'cancelled':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.22" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    default:
      return null;
  }
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function IconWhatsApp({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.2 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconPrint() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}
function IconMinus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function getOrderSourceInfoText(source: string): string {
  switch (source) {
    case 'store':
      return 'Placed via Store';
    case 'manual':
      return 'Created manually';
    case 'link':
      return 'Placed via Link';
    default:
      return 'Unknown source';
  }
}

function IconCatalogueMeta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function OrderMetaHit({
  open,
  onToggle,
  onClose,
  trigger,
  icon,
  text,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  trigger: React.ReactNode;
  icon: React.ReactNode;
  text: string;
}) {
  const hitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (hitRef.current && !hitRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={hitRef} className="order-row-meta-hit">
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {trigger}
      </div>
      {open ? (
        <div className="order-row-meta-popover" role="tooltip">
          <span className="order-row-meta-popover__icon" aria-hidden>
            {icon}
          </span>
          <span className="order-row-meta-popover__text">{text}</span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.text,
      fontSize: 11, fontWeight: 700,
      padding: '3px 8px', borderRadius: 100,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Status Selector Dropdown ─────────────────────────────────────────────────
function StatusSelector({
  current,
  onChange,
  onClose,
}: {
  current: string;
  onChange: (s: StatusType) => void;
  onClose: () => void;
}) {
  const statuses: StatusType[] = [...ORDER_STATUSES];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '110%', right: 0,
      background: '#fff', borderRadius: 12, border: '1.5px solid #E2E8F0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 200,
      overflow: 'hidden', minWidth: 160,
    }}>
      {statuses.map((s) => {
        const cfg = getStatusConfig(s);
        const isActive = s === normalizeOrderStatus(current);
        return (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onChange(s); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '10px 14px', border: 'none',
              background: isActive ? cfg.bg : '#fff', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: isActive ? cfg.text : '#374151',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
              {cfg.label}
            </span>
            {isActive && <IconCheck />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Order Row (List View) ────────────────────────────────────────────────────
function OrderRow({
  order,
  currencySymbol,
  catalogueLabel,
  onStatusChange,
  onClick,
}: {
  order: Order;
  currencySymbol: string;
  catalogueLabel?: string | null;
  onStatusChange: (id: string, status: StatusType) => void;
  onClick: () => void;
}) {
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [metaInfoOpen, setMetaInfoOpen] = useState<'source' | 'catalogue' | null>(null);
  const statusCfg = getStatusConfig(order.status);
  const resolvedTotal = resolveOrderGrandTotal(order, order.items || []);
  const total =
    Number.isFinite(resolvedTotal) && (resolvedTotal > 0 || order.total_amount != null)
      ? formatMoney(resolvedTotal, currencySymbol)
      : null;
  const phone = (order as any).customer_whatsapp || (order as any).customerWhatsapp || '';

  const sourceKey =
    order.order_source === 'link' || order.order_source === 'manual' || order.order_source === 'store'
      ? order.order_source
      : 'unknown';

  const toggleMetaInfo = (key: 'source' | 'catalogue') => {
    setShowStatusDrop(false);
    setMetaInfoOpen((prev) => (prev === key ? null : key));
  };

  return (
    <div
      className="order-row-card"
      onClick={onClick}
    >
      {/* Top stripe by status */}
      <div style={{ height: 3, background: statusCfg.dot, borderRadius: '14px 14px 0 0' }} />

      <div style={{ padding: '12px 14px 14px' }}>
        {/* Row 1: Name + Total */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ord-text)', lineHeight: 1.2, marginBottom: 2 }}>
              {order.customer_name}
            </div>
            {phone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ord-text-muted)', fontSize: 12 }}>
                <IconPhone />
                {phone}
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {total ? (
              <div style={{ fontSize: 17, fontWeight: 800, color: '#166534' }}>{total}</div>
            ) : (
              <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>No price</div>
            )}
          </div>
        </div>

        {/* Row 2: Date + meta */}
        <div className="order-row-foot">
          <div className="order-row-date">
            <IconCalendar />
            {formatDate(order.created_at)}
          </div>

          <div className="order-row-foot-tags" onClick={(e) => e.stopPropagation()}>
            {order.order_source ? (
              <OrderMetaHit
                open={metaInfoOpen === 'source'}
                onToggle={() => toggleMetaInfo('source')}
                onClose={() => setMetaInfoOpen(null)}
                icon={<FilterSourceIcon type={sourceKey === 'unknown' ? 'all' : sourceKey} />}
                text={getOrderSourceInfoText(order.order_source)}
                trigger={
                  <button
                    type="button"
                    className="order-row-source-icon"
                    aria-label={getOrderSourceLabel(order.order_source)}
                    aria-expanded={metaInfoOpen === 'source'}
                  >
                    <FilterSourceIcon type={sourceKey === 'unknown' ? 'all' : sourceKey} />
                  </button>
                }
              />
            ) : null}

            {catalogueLabel ? (
              <OrderMetaHit
                open={metaInfoOpen === 'catalogue'}
                onToggle={() => toggleMetaInfo('catalogue')}
                onClose={() => setMetaInfoOpen(null)}
                icon={<IconCatalogueMeta />}
                text={`Made in ${catalogueLabel} catalogue`}
                trigger={
                  <button
                    type="button"
                    className="order-row-catalogue"
                    aria-expanded={metaInfoOpen === 'catalogue'}
                  >
                    {catalogueLabel}
                  </button>
                }
              />
            ) : null}

            <div className="order-row-status-wrap">
              <button
                type="button"
                className="order-row-status-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMetaInfoOpen(null);
                  setShowStatusDrop((v) => !v);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  background: statusCfg.bg,
                  color: statusCfg.text,
                }}
              >
                <span className="order-row-status-dot" style={{ background: statusCfg.dot }} />
                {statusCfg.label}
                <IconChevronDown />
              </button>
              {showStatusDrop ? (
                <StatusSelector
                  current={order.status}
                  onChange={(s) => {
                    onStatusChange(order.id, s);
                    setShowStatusDrop(false);
                  }}
                  onClose={() => setShowStatusDrop(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Qty Row ─────────────────────────────────────────────────────────────
function EditItemRow({
  item,
  onChange,
}: {
  item: OrderItem & { productId?: string; _key: string };
  onChange: (key: string, qty: number) => void;
}) {
  const hasImage = item.imageUrl && /^https?:\/\//i.test(item.imageUrl);
  const thumbSrc =
    hasImage && item.imageUrl
      ? productImageDisplayUrl(item.imageUrl, item.imageVersion)
      : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #F1F5F9', gap: 10,
    }}>
      {/* Image */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        overflow: 'hidden', background: '#F1F5F9', border: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {hasImage ? (
          <img
            key={thumbSrc}
            src={thumbSrc}
            alt={item.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{item.name}</div>
        {item.unitPrice ? (
          <div style={{ fontSize: 12, color: '#64748B' }}>₹{item.unitPrice} / unit</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F1F5F9', borderRadius: 100, border: '1.5px solid #E2E8F0' }}>
        <button
          onClick={() => onChange(item._key, Math.max(0, item.quantity - 1))}
          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
        >
          <IconMinus />
        </button>
        <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
          {item.quantity}
        </span>
        <button
          onClick={() => onChange(item._key, item.quantity + 1)}
          style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
        >
          <IconPlus />
        </button>
      </div>
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState<string>('');

  const toStr = (d: Date) => d.toISOString().split('T')[0];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, '');
    } else {
      if (dateStr < startDate) onChange(dateStr, startDate);
      else onChange(startDate, dateStr);
    }
  };

  const isStart = (d: string) => d === startDate;
  const isEnd = (d: string) => d === endDate;
  const isInRange = (d: string) => {
    const compareEnd = endDate || hoverDate;
    if (!startDate || !compareEnd) return false;
    const [s, e] = startDate < compareEnd ? [startDate, compareEnd] : [compareEnd, startDate];
    return d > s && d < e;
  };
  const isRangeEdge = (d: string) => isStart(d) || isEnd(d);

  const days: (string | null)[] = [];
  const firstDay = firstDayOfMonth(viewYear, viewMonth);
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth(viewYear, viewMonth); i++) {
    days.push(toStr(new Date(viewYear, viewMonth, i)));
  }

  return (
    <div style={{
      position: 'relative', zIndex: 1,
      paddingTop: 14,
      borderTop: '1px solid rgba(255,255,255,0.15)',
      animation: 'slideDown 0.2s ease-out',
    }}>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Month Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          onClick={prevMonth}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.2px' }}>
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day Names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {dayNames.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', padding: '4px 0', letterSpacing: '0.5px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {days.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />;

          const edge = isRangeEdge(dateStr);
          const inRange = isInRange(dateStr);
          const isToday = dateStr === toStr(today);
          const isStartDay = isStart(dateStr);
          const isEndDay = isEnd(dateStr);

          return (
            <div
              key={dateStr}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => { if (startDate && !endDate) setHoverDate(dateStr); }}
              onMouseLeave={() => setHoverDate('')}
              style={{
                position: 'relative',
                height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                background: inRange ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderRadius: isStartDay ? '50% 0 0 50%' : isEndDay ? '0 50% 50% 0' : 0,
              }}
            >
              <div style={{
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: edge ? '#fff' : 'transparent',
                border: isToday && !edge ? '1px solid rgba(255,255,255,0.4)' : 'none',
                fontSize: 12,
                fontWeight: edge ? 700 : 400,
                color: edge ? '#1e40af' : inRange ? '#fff' : 'rgba(255,255,255,0.85)',
                transition: 'all 0.1s',
              }}>
                {new Date(dateStr + 'T00:00:00').getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
          {startDate && endDate
            ? `${formatDate(startDate)} – ${formatDate(endDate)}`
            : startDate
            ? 'Select end date'
            : 'Select start date'}
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => onChange('', '')}
            style={{
              padding: '5px 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 100,
              fontSize: 11, fontFamily: 'inherit',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontWeight: 600,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Orders Component ────────────────────────────────────────────────────
export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLElement | null>(null);
  const { user, supabaseData } = useAuth();
  const { showToast } = useToast();
  const { guardOnline } = useCloudWriteGate();
  const [tab, setTab] = useState<TabType>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ordersFetchSeqRef = useRef(0);
  const initialOrdersLoadCompleteRef = useRef(false);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [tabSwipeShift, setTabSwipeShift] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('all');
  const [catalogueFilter, setCatalogueFilter] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeBackEligible = useRef(false);
  const swipeBackActive = useRef(false);
  const tabSwipeActive = useRef(false);
  const pullToRefreshActive = useRef(false);
  const pullDistanceRef = useRef(0);

  useLayoutEffect(() => {
    if (!user?.uid || user.uid.trim() === '' || user.isAnonymous) return;
    const mem = getRuntimeSellerOrders(user.uid);
    const cached = readCachedSellerOrders(user.uid);
    const seed = mem?.orders?.length ? mem.orders : cached;
    setOrders(seed);
    setLoading(seed.length === 0);
    setError(null);
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.uid.trim() === '') return;
    initialOrdersLoadCompleteRef.current = false;
    void loadOrders({ silent: true, force: true }).finally(() => {
      initialOrdersLoadCompleteRef.current = true;
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;
    setRuntimeSellerOrders(user.uid, orders);
  }, [orders, user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;
    const handler = (evt: Event) => {
      // Prefer the emitted payload (faster, avoids full refetch + stale race).
      const custom = evt as CustomEvent<{ orderId: string; order: Order }>;
      const orderFromEvent = custom?.detail?.order;
      const sellerUid = user.uid;

      if (orderFromEvent?.id) {
        setOrders((prev) => {
          const next = [...prev];
          const idx = next.findIndex((o) => o.id === orderFromEvent.id);
          if (idx >= 0) next[idx] = orderFromEvent;
          else next.unshift(orderFromEvent);
          next.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
          writeCachedSellerOrders(sellerUid, next);
          setRuntimeSellerOrders(sellerUid, next);
          return next;
        });
        return;
      }

      // Fallback: refetch (guarded by fetch sequence to prevent stale overwrite).
      const fetchSeq = ++ordersFetchSeqRef.current;
      void fetchSellerOrders(sellerUid).then(({ data, error }) => {
        if (fetchSeq !== ordersFetchSeqRef.current) return;
        if (!error && data) {
          setOrders(data);
          writeCachedSellerOrders(sellerUid, data);
        }
      });
    };

    window.addEventListener('catshareNewOrder', handler as EventListener);
    return () => window.removeEventListener('catshareNewOrder', handler as EventListener);
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;
    const handler = (evt: Event) => {
      const custom = evt as CustomEvent<{ orderId: string }>;
      const orderId = custom?.detail?.orderId;
      if (!orderId) return;
      const sellerUid = user.uid;
      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        writeCachedSellerOrders(sellerUid, next);
        return next;
      });
    };

    window.addEventListener('catshareOrderRemoved', handler as EventListener);
    return () => window.removeEventListener('catshareOrderRemoved', handler as EventListener);
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Debounce search to reduce filtering work on every keypress.
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(search.trim().toLowerCase()), 220);
    return () => window.clearTimeout(t);
  }, [search]);

  // Handle mobile hardware back button
  useEffect(() => {
    const handleBackButton = async () => {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {
        // Haptics might not be available on web
      }
      navigate(-1);
    };

    let listener: any = null;

    // Only try to add listener on mobile platforms
    const setupListener = async () => {
      try {
        listener = await App.addListener('backButton', handleBackButton);
      } catch (e) {
        // App listener not available (web browser)
      }
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate]);

  const handleTabChange = useCallback(async (newTab: TabType) => {
    if (newTab === tab) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      /* haptics optional on web */
    }
    setTab(newTab);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  // Swipe back from left screen edge
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeBackEligible.current = e.touches[0].clientX <= 28;
    swipeBackActive.current = false;
    setSwipeProgress(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeBackEligible.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;
    const absDeltaY = Math.abs(deltaY);

    if (!swipeBackActive.current) {
      if (deltaX <= 12) return;
      if (absDeltaY > 24 || deltaX <= absDeltaY * 1.6) {
        swipeBackEligible.current = false;
        setSwipeProgress(0);
        return;
      }
      swipeBackActive.current = true;
    }

    const progress = Math.min(Math.max(deltaX, 0) / 110, 1);
    setSwipeProgress(progress);
    e.preventDefault();
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const currentY = e.changedTouches[0].clientY;
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;
    const shouldNavigateBack =
      swipeBackActive.current &&
      swipeBackEligible.current &&
      deltaX > 90 &&
      Math.abs(deltaY) <= 36 &&
      deltaX > Math.abs(deltaY) * 1.8;

    if (shouldNavigateBack) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        /* ignore */
      }
      navigate(-1);
    }

    swipeBackEligible.current = false;
    swipeBackActive.current = false;
    setSwipeProgress(0);
  };

  const handleMainTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    pullToRefreshActive.current =
      !pullRefreshing && !loading && (scrollRef.current?.scrollTop ?? 0) <= 0;
    pullDistanceRef.current = 0;
    setPullDistance(0);
    tabSwipeActive.current = !pullToRefreshActive.current;
    setTabSwipeShift(0);
  };

  const handleMainTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (pullToRefreshActive.current) {
      if (deltaY <= 0 || absDeltaX > absDeltaY * 1.2 || (scrollRef.current?.scrollTop ?? 0) > 0) {
        pullToRefreshActive.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        tabSwipeActive.current = absDeltaX > absDeltaY;
      } else {
        const distance = Math.min(96, deltaY * 0.55);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
        tabSwipeActive.current = false;
        e.preventDefault();
        return;
      }
    }

    if (!tabSwipeActive.current) return;

    if (absDeltaY > 28 && absDeltaY > absDeltaX * 1.2) {
      tabSwipeActive.current = false;
      setTabSwipeShift(0);
      return;
    }

    if (absDeltaX > 14 && absDeltaX > absDeltaY * 1.35) {
      const tabIdx = ORDER_TAB_KEYS.indexOf(tab);
      const atFirst = tabIdx <= 0;
      const atLast = tabIdx >= ORDER_TAB_KEYS.length - 1;
      const resisted = (deltaX > 0 && atFirst) || (deltaX < 0 && atLast);
      const shift = resisted
        ? Math.sign(deltaX) * Math.min(absDeltaX * 0.12, 14)
        : Math.max(-56, Math.min(56, deltaX * 0.28));
      setTabSwipeShift(shift);
    }
  };

  const handleMainTouchEnd = async (e: React.TouchEvent) => {
    const currentY = e.changedTouches[0].clientY;
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (pullToRefreshActive.current) {
      const shouldRefresh =
        pullDistanceRef.current >= 56 &&
        deltaY > 0 &&
        (scrollRef.current?.scrollTop ?? 0) <= 0 &&
        !pullRefreshing &&
        !loading;
      pullToRefreshActive.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      if (shouldRefresh) {
        setPullRefreshing(true);
        try {
          await loadOrders({ force: true });
        } finally {
          setPullRefreshing(false);
        }
      }
      return;
    }

    if (
      tabSwipeActive.current &&
      absDeltaX >= 56 &&
      absDeltaX > absDeltaY * 1.5
    ) {
      const tabIdx = ORDER_TAB_KEYS.indexOf(tab);
      if (deltaX < 0 && tabIdx < ORDER_TAB_KEYS.length - 1) {
        await handleTabChange(ORDER_TAB_KEYS[tabIdx + 1]);
      } else if (deltaX > 0 && tabIdx > 0) {
        await handleTabChange(ORDER_TAB_KEYS[tabIdx - 1]);
      }
    }

    tabSwipeActive.current = false;
    setTabSwipeShift(0);
  };

  const loadOrders = async (opts?: { force?: boolean; silent?: boolean }) => {
    if (!user?.uid || user.uid.trim() === '') {
      setError('User authentication required');
      setLoading(false);
      return;
    }

    // Prevent guest users from loading orders (guest IDs are not valid UUIDs)
    if (user.isAnonymous) {
      setError('Please sign in to view orders');
      showToast('Sign in required to view orders', 'error');
      setLoading(false);
      return;
    }

    const mem = getRuntimeSellerOrders(user.uid);
    const cached = readCachedSellerOrders(user.uid);
    const base = mem?.orders?.length ? mem.orders : cached;
    const cachedNewest = base.length ? maxCreatedAtIso(base) : null;
    const cachedLatestUpdate = base.length ? maxUpdatedAtIso(base) : null;

    if (!opts?.force && base.length > 0 && mem && Date.now() - mem.updatedAt <= ORDERS_SCREEN_FRESH_MS) {
      setOrders(base);
      setLoading(false);
      setError(null);
      return;
    }

    if (base.length === 0) setLoading(true);
    setError(null);

    const fetchSeq = ++ordersFetchSeqRef.current;

    // Incremental: new rows by created_at + edits by updated_at.
    const incremental = !opts?.force && Boolean(cachedNewest);
    const fetchCreated = fetchSellerOrders(
      user.uid,
      incremental ? { createdAfter: cachedNewest! } : undefined
    );
    const fetchUpdated =
      incremental && cachedLatestUpdate
        ? fetchSellerOrders(user.uid, { updatedAfter: cachedLatestUpdate })
        : Promise.resolve({ data: [] as Order[], error: null });

    const [{ data: createdData, error }, { data: updatedData }] = await Promise.all([
      fetchCreated,
      fetchUpdated,
    ]);
    const data = mergeOrdersById(createdData || [], updatedData || []);

    if (fetchSeq !== ordersFetchSeqRef.current) return; // A newer fetch has started; ignore this result.

    if (error) {
      console.error('Failed to load orders:', error);
      const fallback = base.length > 0 ? base : readCachedSellerOrders(user.uid);
      if (fallback.length > 0) {
        setOrders(fallback);
        setError(null);
        if (!opts?.silent) {
          showToast(
            isBrowserOnline() ? 'Could not refresh orders. Showing saved list.' : 'Showing saved orders',
            'info'
          );
        }
      } else {
        setError('Failed to load orders. Please try again.');
        if (!opts?.silent) showToast('Error loading orders', 'error');
      }
    } else {
      const list = data || [];

      if (incremental && base.length > 0) {
        const merged = mergeOrdersById(base, list);
        setOrders(merged);
        writeCachedSellerOrders(user.uid, merged);
        setRuntimeSellerOrders(user.uid, merged);
      } else {
        setOrders(list);
        writeCachedSellerOrders(user.uid, list);
        setRuntimeSellerOrders(user.uid, list);
      }
    }
    setLoading(false);
  };

  const handleDesktopOrderRefresh = async () => {
    if (pullRefreshing || loading) return;
    setPullRefreshing(true);
    try {
      await loadOrders({ force: true });
    } finally {
      setPullRefreshing(false);
    }
  };

  const refreshOrderChanges = useCallback(async () => {
    if (!user?.uid || user.isAnonymous || !initialOrdersLoadCompleteRef.current) return;
    const mem = getRuntimeSellerOrders(user.uid);
    const cached = readCachedSellerOrders(user.uid);
    const base = mem?.orders?.length ? mem.orders : cached;
    const updatedAfter = base.length ? maxUpdatedAtIso(base) : null;
    if (!updatedAfter) return;

    const fetchSeq = ++ordersFetchSeqRef.current;
    const { data, error } = await fetchSellerOrders(user.uid, { updatedAfter });
    if (fetchSeq !== ordersFetchSeqRef.current || error || !data?.length) return;

    setOrders((prev) => {
      const merged = mergeOrdersById(prev.length ? prev : base, data);
      writeCachedSellerOrders(user.uid, merged);
      setRuntimeSellerOrders(user.uid, merged);
      return merged;
    });
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (location.pathname !== '/orders') return;
    void refreshOrderChanges();
  }, [location.pathname, location.key, refreshOrderChanges]);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;

    const refreshNow = () => {
      void loadOrders({ force: true, silent: true });
    };

    const refreshChanges = () => {
      void refreshOrderChanges();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshChanges();
    };

    let resumeListener: { remove: () => Promise<void> } | null = null;
    if (Capacitor.getPlatform() !== 'web') {
      void App.addListener('resume', refreshNow).then((listener) => {
        resumeListener = listener;
      });
    }

    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(
      refreshChanges,
      Capacitor.getPlatform() === 'web' ? ORDERS_ACTIVE_MOBILE_POLL_MS : ORDERS_ACTIVE_MOBILE_POLL_MS
    );

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(intervalId);
      void resumeListener?.remove();
    };
  }, [user?.uid, user?.isAnonymous, refreshOrderChanges]);

  const handleNavigate = async (path: string) => {
    await Haptics.impact({ style: ImpactStyle.Light });
    navigate(path);
  };

  const handleStatusChange = async (id: string, status: StatusType) => {
    if (!guardOnline()) return;
    const previousStatus = orders.find((o) => o.id === id)?.status as StatusType | undefined;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

    const { error } = await updateOrderStatus(id, status);
    if (error) {
      showToast('Failed to update order status', 'error');
      if (previousStatus !== undefined) {
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status: previousStatus } : o))
        );
      }
    } else {
      showToast(`Order marked as ${getOrderStatusLabel(status)}`, 'success');
      if (user?.uid) {
        patchCachedOrder(user.uid, id, { status });
      }
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All orders' },
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const activeTabMeta = tabs.find((t) => t.key === tab);
  const activeTabTheme = tab !== 'all' ? getOrderTabTheme(tab) : null;

  const countForTab = (key: TabType) => {
    if (key === 'all') return orders.length;
    return orders.filter((o) => normalizeOrderStatus(o.status) === key).length;
  };

  const localProducts = useMemo(() => {
    const cloud = supabaseData?.products;
    if (Array.isArray(cloud) && cloud.length > 0) return cloud as ProductWithCatalogueData[];
    if (!user?.uid) return [] as ProductWithCatalogueData[];
    return safeGetFromStorage(getStorageKey('products', user.uid), []) as ProductWithCatalogueData[];
  }, [supabaseData?.products, user?.uid]);

  const catalogues = useMemo(() => getAllCatalogues(user?.uid), [user?.uid]);

  const storeCatalogueId = useMemo(
    () => (user?.uid ? readCachedSellerStore(user.uid)?.catalogueId ?? null : null),
    [user?.uid]
  );

  const catalogueLabelByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      const label = getOrderCatalogueLabel(order, localProducts, catalogues, storeCatalogueId);
      if (label) map.set(order.id, label);
    }
    return map;
  }, [orders, localProducts, catalogues, storeCatalogueId]);

  const catalogueIdByOrderId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const order of orders) {
      map.set(
        order.id,
        getOrderCatalogueId(order, localProducts, catalogues, storeCatalogueId)
      );
    }
    return map;
  }, [orders, localProducts, catalogues, storeCatalogueId]);

  const listFilterOpts = useMemo(
    () => ({ tab, searchQuery, sourceFilter, catalogueFilter, catalogueIdByOrderId }),
    [tab, searchQuery, sourceFilter, catalogueFilter, catalogueIdByOrderId]
  );

  const hasActiveListFilters = sourceFilter !== 'all' || catalogueFilter !== 'all';

  const filteredOrders = useMemo(
    () => orders.filter((o) => orderMatchesListFilters(o, listFilterOpts)),
    [orders, listFilterOpts]
  );

  // Summary stats
  const stats = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => normalizeOrderStatus(o.status) === 'pending').length,
      processing: orders.filter((o) => normalizeOrderStatus(o.status) === 'processing').length,
      shipped: orders.filter((o) => normalizeOrderStatus(o.status) === 'shipped').length,
      completed: orders.filter(o => o.status === 'completed').length,
      revenue: orders
        .filter(o => o.status === 'completed' && o.total_amount)
        .reduce((s, o) => s + (o.total_amount || 0), 0),
    }),
    [orders]
  );
  const symbol = useMemo(() => (orders[0] ? getCurrencySymbol(orders[0].currency_code) : '₹'), [orders]);

  // Calculate sales within date range
  const filteredSales = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'completed' && o.total_amount)
        .filter((o) => orderMatchesListFilters(o, { ...listFilterOpts, tab: 'all' }))
        .filter(o => {
          if (!dateRangeStart && !dateRangeEnd) return true;
          const orderDate = new Date(o.created_at || '').getTime();
          const startTime = dateRangeStart ? new Date(dateRangeStart).getTime() : 0;
          const endTime = dateRangeEnd ? new Date(dateRangeEnd).getTime() + 86400000 : Infinity; // Add 1 day to end date
          return orderDate >= startTime && orderDate <= endTime;
        })
        .reduce((s, o) => s + (o.total_amount || 0), 0),
    [orders, dateRangeStart, dateRangeEnd, listFilterOpts]
  );

  const shouldRestoreScroll =
    location.pathname === '/orders' && !loading && !(error && orders.length === 0);
  useListScrollRestore(ORDERS_LIST_SCROLL_KEY, scrollRef, {
    active: shouldRestoreScroll,
    contentLength: shouldRestoreScroll ? filteredOrders.length : 0,
  });

  return (
    <div
      className="orders-page-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--ord-bg)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        position: 'relative',
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe back visual indicator */}
      {swipeProgress > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.2)',
            opacity: swipeProgress * 0.3,
            zIndex: 35,
            pointerEvents: 'none',
            transition: swipeProgress === 0 ? 'opacity 0.2s ease-out' : 'none',
          }}
        />
      )}

      {/* Swipe back arrow indicator */}
      {swipeProgress > 0.2 && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: 30,
            transform: `translateY(-50%) scale(${0.8 + swipeProgress * 0.4})`,
            zIndex: 36,
            pointerEvents: 'none',
            opacity: Math.min(swipeProgress * 2, 1),
            transition: 'none',
          }}
        >
          <IconChevronLeft />
        </div>
      )}

      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto 0', height: 40, background: '#0F172A', zIndex: 50 }} />

      {/* Toolbar + tabs (fixed height, not sticky — list scrolls below) */}
      <div
        className="orders-page-header"
        style={{
          flexShrink: 0,
          background: 'var(--ord-surface)',
          borderBottom: '1px solid var(--ord-border)',
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
          marginTop: 40,
        }}
      >
        <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: 52, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 16, top: 14, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ord-text)', letterSpacing: '-0.4px', transition: 'opacity 0.15s ease, visibility 0.15s ease', opacity: showSearch ? 0 : 1, visibility: showSearch ? 'hidden' : 'visible' }}>Orders</div>
          </div>

          {/* Create Order Button */}
          <button
            onClick={() => {
              persistListScroll(ORDERS_LIST_SCROLL_KEY, scrollRef.current);
              handleNavigate('/create-order');
            }}
            style={{
              padding: '8px 14px',
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginRight: 8,
              transition: 'opacity 0.15s ease, visibility 0.15s ease',
              transitionDelay: showSearch ? '0s' : '0.3s',
              opacity: showSearch ? 0 : 1,
              visibility: showSearch ? 'hidden' : 'visible',
              pointerEvents: showSearch ? 'none' : 'auto',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#2563EB';
            }}
          >
            + New Order
          </button>

          {/* Expanding Search Box */}
          <div
            style={{
              transition: 'all 0.3s ease-out',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              width: showSearch ? 320 : 0,
              opacity: showSearch ? 1 : 0,
              transform: showSearch ? 'scale(1)' : 'scale(0.95)',
              marginRight: showSearch ? 8 : 0,
              height: 36,
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '0 12px 0 12px',
                  paddingRight: 32,
                  fontSize: 14,
                  border: '1px solid var(--ord-input-border)',
                  borderRadius: 6,
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                  background: 'var(--ord-input-bg)',
                  color: 'var(--ord-text)',
                  backdropFilter: 'blur(4px)',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'all 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 2px #3B82F6';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9CA3AF',
                    fontSize: 18,
                    padding: 0,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Fixed Icons Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <button
              type="button"
              className="orders-desktop-refresh"
              onClick={() => void handleDesktopOrderRefresh()}
              disabled={pullRefreshing || loading}
              title="Refresh orders"
              aria-label="Refresh orders"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={pullRefreshing ? 'orders-desktop-refresh__icon--spinning' : undefined}
              >
                <path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10" />
                <path d="M3 4v6h6" />
                <path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14" />
                <path d="M21 20v-6h-6" />
              </svg>
            </button>
            <button
              onClick={() => setShowFilters(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: showFilters || hasActiveListFilters ? '#2563EB' : 'var(--ord-icon)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#2563EB'}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = showFilters || hasActiveListFilters ? '#2563EB' : 'var(--ord-icon)';
              }}
              title="Filter"
            >
              <IconFilter active={hasActiveListFilters} />
              {hasActiveListFilters ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#2563EB',
                    border: '1.5px solid #fff',
                  }}
                />
              ) : null}
            </button>
            <button
              onClick={() => setShowSearch((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--ord-icon)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ord-text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ord-icon)'}
              title="Search"
            >
              <IconSearch />
            </button>
          </div>
        </div>

        {/* Status tabs — gradient icon chips */}
        <div className="orders-status-tabs">
          {tabs.map((t) => {
            const count = countForTab(t.key);
            const isActive = tab === t.key;
            const theme = getOrderTabTheme(t.key);
            return (
              <button
                key={t.key}
                type="button"
                title={t.label}
                aria-label={`${t.label}${count > 0 ? `, ${count}` : ''}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleTabChange(t.key)}
                className={`orders-status-tab${isActive ? ' orders-status-tab--active' : ''}`}
              >
                <div
                  className="orders-status-tab__icon"
                  style={
                    isActive
                      ? {
                          background: theme.gradient,
                          boxShadow: `0 6px 14px ${theme.shadow}`,
                        }
                      : undefined
                  }
                >
                  <StatusTabGlyph tabKey={t.key} size={20} />
                </div>
                {(count > 0 || isActive) ? (
                  <span
                    className="orders-status-tab__count"
                    style={
                      isActive
                        ? {
                            background: theme.bannerBorder,
                            color: theme.indicator,
                          }
                        : undefined
                    }
                  >
                    {count}
                  </span>
                ) : null}
                <span
                  className="orders-status-tab__indicator"
                  style={isActive ? { background: theme.indicator } : undefined}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Status banner — own row in layout so list never slides underneath */}
      {tab !== 'all' && activeTabMeta && activeTabTheme && !loading && (
        <div
          key={tab}
          className="orders-status-banner"
          style={{
            flexShrink: 0,
            marginTop: 0,
            marginBottom: 0,
            borderRadius: 0,
            borderLeft: 'none',
            borderRight: 'none',
            background: activeTabTheme.bannerBg,
            borderColor: activeTabTheme.bannerBorder,
            borderBottom: `1px solid ${activeTabTheme.bannerBorder}`,
          }}
        >
          <div
            className="orders-status-banner__icon"
            style={{ background: activeTabTheme.gradient }}
          >
            <StatusTabGlyph tabKey={tab} size={20} />
          </div>
          <p className="orders-status-banner__title" style={{ color: activeTabTheme.text }}>
            {activeTabMeta.label}
            <span className="orders-status-banner__sep" style={{ color: activeTabTheme.meta }}>
              {' · '}
            </span>
            <span className="orders-status-banner__count" style={{ color: activeTabTheme.meta }}>
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
            </span>
          </p>
        </div>
      )}

      {/* Content */}
      <main
        ref={scrollRef}
        className="orders-main-scroll"
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 70 }}
      >
        {(pullDistance > 0 || pullRefreshing) && (
          <div
            className="orders-pull-refresh"
            style={{ height: pullRefreshing ? 48 : Math.max(pullDistance, 1) }}
            role="status"
            aria-live="polite"
          >
            <div
              className={`orders-pull-refresh__indicator${pullRefreshing ? ' is-refreshing' : ''}`}
              style={!pullRefreshing ? { transform: `rotate(${Math.min(pullDistance / 56, 1) * 180}deg)` } : undefined}
              aria-hidden
            >
              ↓
            </div>
            <span>{pullRefreshing ? 'Refreshing orders…' : pullDistance >= 56 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        )}
        <div
          className="orders-main-shift"
          style={{
            transform: tabSwipeShift ? `translateX(${tabSwipeShift}px)` : undefined,
            transition: tabSwipeShift === 0 ? 'transform 0.22s cubic-bezier(0.34, 1.1, 0.64, 1)' : 'none',
          }}
        >
        {/* Sales Box at Top of Scrollable Content (All tab only) */}
        {tab === 'all' && (
          <div style={{
            background: 'var(--ord-surface)',
            borderBottom: '1px solid var(--ord-border)',
            padding: '16px 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* Sales Card */}
            <div style={{
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
              borderRadius: '16px',
              padding: '24px',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 10px 30px rgba(37, 99, 235, 0.15)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Background accent */}
              <div style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 500, letterSpacing: '0.3px' }}>Total Sales Revenue</div>
                  <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', marginTop: 4 }}>
                    {formatMoney(filteredSales, symbol)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', alignSelf: 'stretch' }}>
                  <button
                    onClick={() => setShowDateFilters(!showDateFilters)}
                    style={{
                      width: 28, height: 28,
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '50%',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.15)';
                    }}
                  >
                    <svg
                      width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      style={{
                        transition: 'transform 0.2s ease',
                        transform: showDateFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {(dateRangeStart || dateRangeEnd) && (
                <div style={{
                  fontSize: 12,
                  opacity: 0.8,
                  fontWeight: 500,
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {dateRangeStart && dateRangeEnd
                    ? `${formatDate(dateRangeStart)} to ${formatDate(dateRangeEnd)}`
                    : dateRangeStart
                    ? `From ${formatDate(dateRangeStart)}`
                    : `Until ${formatDate(dateRangeEnd)}`
                  }
                </div>
              )}

              {/* Collapsible Date Range Filter */}
              {showDateFilters && (
                <DateRangePicker
                  startDate={dateRangeStart}
                  endDate={dateRangeEnd}
                  onChange={(start, end) => {
                    setDateRangeStart(start);
                    setDateRangeEnd(end);
                  }}
                />
              )}
            </div>
          </div>
        )}

        <div className="orders-list-body">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>Loading orders…</span>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, padding: 24 }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626' }}>{error}</div>
              {user?.isAnonymous ? (
                <button onClick={() => handleNavigate('/login')} style={{
                  padding: '10px 20px', borderRadius: 100, border: 'none',
                  background: '#3B82F6', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>Sign In</button>
              ) : (
                <button onClick={() => void loadOrders({ force: true })} style={{
                  padding: '10px 20px', borderRadius: 100, border: 'none',
                  background: '#3B82F6', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>Retry</button>
              )}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 8, padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>{searchQuery || hasActiveListFilters ? '🔍' : '📦'}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ord-text)' }}>
                {searchQuery || hasActiveListFilters
                  ? 'No matching orders'
                  : `No ${tab !== 'all' && activeTabMeta ? activeTabMeta.label.toLowerCase() : ''} orders yet`}
              </div>
              <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
                {searchQuery || hasActiveListFilters
                  ? 'Try changing your search or filters'
                  : 'Orders will appear here when customers place them'}
              </div>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                currencySymbol={symbol}
                catalogueLabel={catalogueLabelByOrderId.get(order.id)}
                onStatusChange={handleStatusChange}
                onClick={async () => {
                  await Haptics.impact({ style: ImpactStyle.Light });
                  persistListScroll(ORDERS_LIST_SCROLL_KEY, scrollRef.current);
                  navigate(`/orders/${order.id}`);
                }}
              />
            ))
          )}
        </div>
        </div>
      </main>

      <OrdersFilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        sourceFilter={sourceFilter}
        catalogueFilter={catalogueFilter}
        catalogues={catalogues}
        onSourceChange={setSourceFilter}
        onCatalogueChange={setCatalogueFilter}
        onClear={() => {
          setSourceFilter('all');
          setCatalogueFilter('all');
        }}
        hasActiveFilters={hasActiveListFilters}
      />

      <MainAppBottomNav active="orders" />
    </div>
  );
}
