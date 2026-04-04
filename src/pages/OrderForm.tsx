import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchShareLinkForCustomer, fetchSellerUserIdForToken, type ShareLinkItem } from '../services/shareLinks';
import { normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { resolveShareLinkCurrencyDisplay } from '../utils/currencyUtils';

/** CatShare on Google Play — update if store listing changes. */
const CATSHARE_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.catshare.official';

/** History state key so swipe / hardware back closes the drawer before leaving the page. */
const ORDER_FORM_DRAWER_HISTORY_KEY = 'ofProductDrawer';

type QtyMap = Record<string, number>;

function getQuantityStep(item: ShareLinkItem): number {
  return normalizeOrderQuantityStep(item.quantityStep);
}

function parseItemPriceNumeric(price: ShareLinkItem['price']): number {
  if (price === undefined || price === null || price === '') return NaN;
  const n = parseFloat(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function formatOrderMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatUnitPrice(price: ShareLinkItem['price'], symbol: string): string {
  const n = parseItemPriceNumeric(price);
  if (!Number.isFinite(n)) return String(price ?? '');
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Short label from price unit (e.g. "/ piece" → "pcs"). */
function getOrderUnitLabel(priceUnit: string | undefined): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') {
    return 'units';
  }
  const cleaned = String(priceUnit)
    .replace(/^\s*\/\s*/i, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return 'units';
  if (cleaned === 'piece' || cleaned === 'pieces' || cleaned === 'pc') return 'pieces';
  return cleaned;
}

/** e.g. "24 pcs × ₹48" above subtotal */
function formatLineCalculationDetail(
  q: number,
  item: ShareLinkItem,
  currencySymbol: string
): string | null {
  if (q <= 0) return null;
  const unit = parseItemPriceNumeric(item.price);
  if (!Number.isFinite(unit)) return null;
  const label = getOrderUnitLabel(item.priceUnit);
  const priceStr = formatUnitPrice(item.price, currencySymbol);
  return `${q} ${label} × ${priceStr}`;
}

function isPublicHttpUrl(url: string): boolean {
  const u = url.trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getFieldLabelAndUnitSuffix(
  item: ShareLinkItem,
  n: number
): { label: string; unitSuffix: string } {
  const row = item as unknown as Record<string, string | undefined>;
  const explicitUnit = row[`field${n}Unit`];
  const rawLabel = row[`field${n}Label`];
  if (explicitUnit != null && String(explicitUnit).trim() !== '') {
    return { label: (rawLabel || `Field ${n}`).trim(), unitSuffix: String(explicitUnit).trim() };
  }
  if (rawLabel) {
    const m = rawLabel.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { label: m[1].trim(), unitSuffix: m[2].trim() };
    return { label: rawLabel.trim(), unitSuffix: '' };
  }
  return { label: `Field ${n}`, unitSuffix: '' };
}

function getItemSearchText(item: ShareLinkItem): string {
  const extraFields = Array.from({ length: 4 }, (_, index) => {
    const fieldNumber = index + 1;
    const row = item as unknown as Record<string, string | undefined>;
    return [
      row[`field${fieldNumber}`],
      row[`field${fieldNumber}Label`],
      row[`field${fieldNumber}Unit`],
    ]
      .filter(Boolean)
      .join(' ');
  });

  return [item.name, item.subtitle, item.priceUnit, ...(item.category || []), ...extraFields]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getItemCategories(item: ShareLinkItem): string[] {
  return Array.from(
    new Set(
      (item.category || [])
        .map((category) => String(category).trim())
        .filter(Boolean)
    )
  );
}

// ─── CSS injected once ────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green: #16a34a;
    --green-light: #dcfce7;
    --green-dark: #14532d;
    --text: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --surface: #ffffff;
    --bg: #f8fafc;
    --card-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    --hover-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.06);
    --font: 'Plus Jakarta Sans', system-ui, sans-serif;
    --radius: 16px;
    --radius-sm: 10px;
  }

  body { font-family: var(--font); background: var(--bg); }

  .of-bg {
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--font);
  }

  .of-page {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 0 120px;
  }

  /* ── Header ── */
  .of-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(248,250,252,0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    padding: 16px 20px;
  }

  .of-header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .of-store-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .of-store-icon {
    width: 40px; height: 40px;
    border-radius: 10px;
    background: var(--green);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }

  .of-store-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .of-store-meta { }

  .of-store-name {
    font-size: 16px;
    font-weight: 800;
    color: var(--text);
    letter-spacing: -0.3px;
    line-height: 1.1;
  }

  .of-store-sub {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
    font-weight: 500;
  }

  .of-confirm-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    background: var(--green);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font);
    transition: background 0.18s, transform 0.1s;
    white-space: nowrap;
    letter-spacing: 0.1px;
    box-shadow: 0 2px 8px rgba(22,163,74,0.35);
  }
  .of-confirm-btn:hover { background: #15803d; transform: translateY(-1px); }
  .of-confirm-btn:active { transform: translateY(0); }
  .of-confirm-btn:disabled { background: #94a3b8; box-shadow: none; cursor: not-allowed; transform: none; }

  /* ── Section heading ── */
  .of-toolbar {
    padding: 20px 20px 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .of-section-head {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--muted);
  }

  .of-search {
    position: relative;
  }

  .of-search-input {
    width: 100%;
    min-height: 44px;
    border: 1.5px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    font-family: var(--font);
    padding: 0 40px 0 40px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .of-search-input:focus {
    outline: none;
    border-color: #16a34a;
    box-shadow: 0 0 0 3px rgba(22,163,74,0.1);
  }

  .of-search-icon,
  .of-search-clear {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
  }

  .of-search-icon {
    left: 14px;
    pointer-events: none;
  }

  .of-search-clear {
    right: 12px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }

  .of-search-clear:hover {
    background: #f1f5f9;
    color: #475569;
  }

  .of-category-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .of-category-chip {
    border: 1px solid var(--border);
    background: #fff;
    color: var(--muted);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
  }

  .of-category-chip:hover {
    transform: translateY(-1px);
    border-color: #cbd5e1;
    color: var(--text);
  }

  .of-category-chip.is-active {
    background: var(--green-light);
    border-color: rgba(22,163,74,0.28);
    color: var(--green-dark);
  }

  .of-category-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .of-category-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 3px 8px;
    background: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
  }

  /* ── Items list ── */
  .of-items { display: flex; flex-direction: column; gap: 2px; padding: 0 12px; }

  .of-item-card {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--border);
    overflow: hidden;
    display: flex;
    align-items: stretch;
    transition: box-shadow 0.2s, border-color 0.2s;
    margin-bottom: 8px;
  }
  .of-item-card:hover { box-shadow: var(--hover-shadow); border-color: #cbd5e1; }
  .of-item-card.is-selected {
    border-color: var(--green);
    box-shadow: 0 0 0 2px rgba(22,163,74,0.12), var(--card-shadow);
  }

  /* Image column */
  .of-img-wrap {
    width: 100px;
    flex-shrink: 0;
    cursor: pointer;
    background: #f1f5f9;
    overflow: hidden;
    position: relative;
  }
  .of-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .of-img-ph {
    width: 100%; height: 100%; min-height: 100px;
    display: flex; align-items: center; justify-content: center;
    background: #f1f5f9;
  }

  .of-selected-badge {
    position: absolute;
    top: 8px; left: 8px;
    background: var(--green);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 100px;
  }

  /* Body */
  .of-item-body {
    flex: 1;
    padding: 12px 12px 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    gap: 6px;
  }

  .of-item-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .of-item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }

  /* Product name + subtitle on one row (wrap when needed) */
  .of-item-title-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    line-height: 1.3;
    word-break: break-word;
  }
  .of-item-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }
  .of-item-subtitle-inline {
    font-size: 12px;
    font-weight: 400;
    color: #64748b;
  }

  .of-item-price-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
  }

  .of-price-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin: 0;
    background: var(--green-light);
    border-radius: 6px;
    padding: 2px 7px;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--green-dark);
  }

  .of-step-hint {
    font-size: 9.5px;
    color: #d97706;
    margin: 0;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
    line-height: 1.2;
  }

  .of-item-qty-cluster {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
  }
  .of-qty-inline-row {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 10px;
    min-width: 0;
  }
  .of-step-hint--next-to-qty {
    font-size: 10px;
    flex-shrink: 1;
    min-width: 0;
  }
  .of-step-hint--next-to-qty svg {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
  }

  /* Line math + amount — one horizontal row below qty */
  .of-line-total-below {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .of-line-calc {
    font-size: 10px;
    font-weight: 500;
    color: #94a3b8;
    line-height: 1.2;
    margin: 0;
    letter-spacing: 0.01em;
    min-width: 0;
    flex: 1 1 auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .of-line-sep {
    color: #cbd5e1;
    font-weight: 700;
    flex-shrink: 0;
    user-select: none;
    line-height: 1;
  }
  .of-line-total-val {
    font-size: 15px;
    font-weight: 800;
    color: var(--green-dark);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .of-line-total-na {
    font-size: 14px;
    color: #cbd5e1;
    font-weight: 600;
    flex-shrink: 0;
  }
  .of-subtotal-label {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 600;
    text-transform: lowercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .of-item-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ── Qty control ── */
  .of-qty {
    display: flex;
    align-items: center;
    background: #f1f5f9;
    border-radius: 100px;
    border: 1.5px solid var(--border);
    overflow: hidden;
  }
  .of-qty-btn {
    width: 30px; height: 30px;
    border: none; background: transparent;
    cursor: pointer; font-size: 18px; color: var(--text);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font); line-height: 1;
    transition: background 0.12s;
    flex-shrink: 0;
  }
  .of-qty-btn:hover { background: rgba(0,0,0,0.06); }
  .of-qty-val {
    min-width: 30px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    user-select: none;
    padding: 0 2px;
  }

  .of-view-btn {
    font-size: 12px;
    color: var(--green);
    cursor: pointer;
    font-weight: 600;
    border: none; background: none;
    font-family: var(--font);
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1;
  }
  .of-view-btn:hover { background: var(--green-light); }

  /* ── Empty state ── */
  .of-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--muted);
    font-size: 14px;
  }

  .of-empty strong {
    display: block;
    color: var(--text);
    font-size: 16px;
    margin-bottom: 6px;
  }

  /* ── Summary bar ── */
  .of-summary {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 60;
    display: flex;
    justify-content: center;
    padding: 12px 16px 20px;
    background: linear-gradient(to top, rgba(248,250,252,1) 60%, rgba(248,250,252,0));
    pointer-events: none;
  }

  .of-summary-card {
    width: 100%;
    max-width: 652px;
    background: var(--text);
    border-radius: 16px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.22);
    pointer-events: all;
    cursor: pointer;
    transition: transform 0.15s;
  }
  .of-summary-card:hover { transform: translateY(-2px); }

  .of-summary-left { display: flex; flex-direction: column; gap: 2px; }
  .of-summary-count { font-size: 12px; color: #94a3b8; font-weight: 600; }
  .of-summary-total { font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
  .of-summary-no-price { font-size: 11px; color: #94a3b8; margin-top: 2px; line-height: 1.3; }

  .of-summary-cta {
    display: flex; align-items: center; gap: 7px;
    background: #25d366;
    color: #fff;
    padding: 11px 18px;
    border-radius: 100px;
    font-size: 13px; font-weight: 700;
    font-family: var(--font);
    white-space: nowrap;
    border: none; cursor: pointer;
    box-shadow: 0 2px 12px rgba(37,211,102,0.4);
    transition: background 0.15s;
  }
  .of-summary-cta:hover { background: #1fb859; }

  /* ── Drawer overlay ── */
  .of-overlay {
    position: fixed; inset: 0;
    background: rgba(15,23,42,0.6);
    z-index: 100;
    display: flex; align-items: flex-end; justify-content: center;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .of-drawer {
    background: var(--surface);
    border-radius: 24px 24px 0 0;
    width: 100%; max-width: 680px;
    max-height: 92vh;
    overflow-y: auto;
    animation: slideUp 0.25s cubic-bezier(0.34,1.2,0.64,1);
  }

  .of-drawer-handle {
    width: 36px; height: 4px;
    background: #e2e8f0; border-radius: 2px;
    margin: 12px auto 0;
  }

  .of-drawer-img-wrap { position: relative; }
  .of-drawer-img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #f1f5f9; display: block; }
  .of-drawer-img-ph {
    width: 100%; aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    background: #f1f5f9;
  }

  .of-drawer-close {
    position: absolute; top: 14px; right: 14px;
    width: 34px; height: 34px; border-radius: 50%;
    background: rgba(15,23,42,0.5); border: none;
    cursor: pointer; color: #fff; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font);
    backdrop-filter: blur(4px);
    transition: background 0.15s;
  }
  .of-drawer-close:hover { background: rgba(15,23,42,0.75); }

  .of-drawer-body { padding: 20px 20px 40px; }

  .of-drawer-name {
    font-size: 22px; font-weight: 800; color: var(--text);
    letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 4px;
  }
  .of-drawer-sub {
    font-size: 10px;
    font-weight: 400;
    color: #64748b;
    margin-bottom: 10px;
    line-height: 1.35;
  }

  .of-drawer-price-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .of-drawer-price {
    font-size: 20px; font-weight: 800; color: var(--green-dark);
    background: var(--green-light); padding: 4px 12px; border-radius: 8px;
  }
  .of-detail-table {
    border: 1.5px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    margin: 16px 0;
  }
  .of-detail-row {
    display: flex; justify-content: space-between;
    padding: 11px 14px; font-size: 13.5px;
    border-bottom: 1px solid var(--border);
  }
  .of-detail-row:last-child { border-bottom: none; }
  .of-detail-row:nth-child(even) { background: #f8fafc; }
  .of-detail-label { color: var(--muted); font-weight: 500; }
  .of-detail-val { color: var(--text); font-weight: 600; text-align: right; }

  .of-drawer-qty-section {
    margin-top: 20px;
    padding: 16px;
    background: #f8fafc;
    border-radius: 14px;
    border: 1.5px solid var(--border);
  }
  .of-drawer-qty-label { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
  .of-drawer-qty-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .of-drawer-line-total-wrap { text-align: right; flex-shrink: 0; }
  .of-drawer-line-calc {
    font-size: 9px;
    font-weight: 400;
    color: #94a3b8;
    margin-bottom: 3px;
    line-height: 1.3;
    max-width: 200px;
    word-break: break-word;
    letter-spacing: 0.01em;
  }
  .of-drawer-line-total { font-size: 18px; font-weight: 800; color: var(--green-dark); display: block; }

  .of-drawer-done {
    width: 100%; background: var(--green); color: #fff;
    border: none; border-radius: 100px; padding: 14px;
    font-size: 15px; font-weight: 700; cursor: pointer;
    margin-top: 16px; font-family: var(--font);
    letter-spacing: 0.2px;
    box-shadow: 0 4px 12px rgba(22,163,74,0.3);
    transition: background 0.15s;
  }
  .of-drawer-done:hover { background: #15803d; }

  /* ── Footer ── */
  .of-footer {
    margin: 20px 20px 0;
    padding: 20px;
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--border);
    text-align: center;
  }
  .of-footer-app-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px; }
  .of-footer-link { font-size: 13px; font-weight: 700; color: var(--green); text-decoration: none; }
  .of-footer-link:hover { text-decoration: underline; }
  .of-footer-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }

  /* ── State screens ── */
  .of-state {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 100vh;
    padding: 24px;
    gap: 12px;
  }
  .of-state-icon { font-size: 40px; }
  .of-state-title { font-size: 17px; font-weight: 700; color: var(--text); }
  .of-state-sub { font-size: 14px; color: var(--muted); text-align: center; }
  .of-state-error { color: #dc2626; }

  /* Loading skeleton */
  .of-skeleton-wrap { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .of-skeleton {
    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 12px;
  }
  @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

  /* ── Confirmation Modal ── */
  .of-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(15,23,42,0.6);
    z-index: 200;
    display: flex; align-items: flex-end; justify-content: center;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  }

  .of-modal {
    background: var(--surface);
    border-radius: 24px 24px 0 0;
    width: 100%; max-width: 680px;
    padding: 24px 20px 32px;
    animation: slideUp 0.25s cubic-bezier(0.34,1.2,0.64,1);
  }

  .of-modal-handle {
    width: 36px; height: 4px;
    background: #e2e8f0; border-radius: 2px;
    margin: 0 auto 20px;
  }

  .of-modal-title {
    font-size: 18px; font-weight: 800; color: var(--text);
    margin-bottom: 16px; letter-spacing: -0.3px;
  }

  .of-modal-input-group {
    margin-bottom: 16px;
  }

  .of-modal-label {
    display: block;
    font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    text-transform: uppercase; color: #64748b;
    margin-bottom: 8px;
  }

  .of-modal-input {
    width: 100%;
    padding: 12px 14px;
    font-size: 15px;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    font-family: var(--font);
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .of-modal-input:focus {
    outline: none;
    border-color: #16a34a;
    box-shadow: 0 0 0 3px rgba(22,163,74,0.1);
  }

  .of-modal-required {
    font-size: 11px; color: #dc2626; margin-left: 4px;
  }

  .of-modal-buttons {
    display: flex; gap: 10px; margin-top: 20px;
  }

  .of-modal-btn {
    flex: 1; padding: 12px; border-radius: 12px; border: none;
    font-family: var(--font); font-size: 14px; font-weight: 700;
    cursor: pointer; transition: background 0.15s;
  }

  .of-modal-cancel {
    background: #f1f5f9; color: #64748b;
  }

  .of-modal-cancel:hover { background: #e2e8f0; }

  .of-modal-confirm {
    background: var(--green); color: #fff;
    box-shadow: 0 4px 12px rgba(22,163,74,0.3);
  }

  .of-modal-confirm:hover:not(:disabled) { background: #15803d; }

  .of-modal-confirm:disabled {
    background: #cbd5e1; cursor: not-allowed; box-shadow: none;
  }

  /* Order items in confirmation modal */
  .of-modal-items-section {
    margin: 20px 0; padding-top: 20px; border-top: 1px solid var(--border);
  }

  .of-modal-items-title {
    font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 12px;
  }

  .of-modal-item {
    display: flex; gap: 12px; padding: 10px; background: var(--bg); border-radius: 8px; margin-bottom: 8px;
  }

  .of-modal-item-detail {
    flex: 1; min-width: 0;
  }

  .of-modal-item-name {
    font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 4px;
  }

  .of-modal-item-info {
    font-size: 12px; color: var(--muted); margin-bottom: 2px;
  }

  .of-modal-item-qty {
    font-size: 12px; font-weight: 600; color: var(--green);
  }

  .of-modal-order-summary {
    margin-top: 16px; padding: 12px; background: var(--green-light); border-radius: 8px; border: 1px solid var(--border);
  }

  .of-modal-total-row {
    display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0;
  }

  .of-modal-total-row.final {
    font-weight: 700; font-size: 14px; color: var(--green); border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px;
  }

  @media (max-width: 400px) {
    .of-item-name { font-size: 13px; }
    .of-item-subtitle-inline { font-size: 9px; }
    .of-confirm-btn span.btn-label { display: none; }
  }
`;

function injectCSS() {
  if (document.getElementById('of-styles')) return;
  const el = document.createElement('style');
  el.id = 'of-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ImgIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function WhatsAppIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function QtyControl({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (delta: number) => void;
}) {
  const s = Math.max(1, Math.floor(step) || 1);
  const inc = s > 1 ? s : 1;
  return (
    <div className="of-qty">
      <button type="button" className="of-qty-btn" onClick={() => onChange(-inc)}>−</button>
      <span className="of-qty-val">{value}</span>
      <button type="button" className="of-qty-btn" onClick={() => onChange(inc)}>+</button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0',
      display: 'flex', overflow: 'hidden', marginBottom: 8
    }}>
      <div className="of-skeleton" style={{ width: 100, minHeight: 100, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="of-skeleton" style={{ height: 14, width: '65%', borderRadius: 6 }} />
        <div className="of-skeleton" style={{ height: 11, width: '45%', borderRadius: 6 }} />
        <div className="of-skeleton" style={{ height: 22, width: '30%', borderRadius: 6, marginTop: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="of-skeleton" style={{ height: 32, width: 100, borderRadius: 100 }} />
          <div className="of-skeleton" style={{ height: 22, width: 60, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OrderForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [sellerBusinessName, setSellerBusinessName] = useState('');
  const [sellerLogoUrl, setSellerLogoUrl] = useState('');
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [qty, setQty] = useState<QtyMap>({});
  const [drawerItem, setDrawerItem] = useState<ShareLinkItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  /** Number of drawer entries we pushed onto session history (usually 0 or 1). */
  const drawerHistoryDepthRef = useRef(0);

  const openProductDrawer = useCallback((item: ShareLinkItem) => {
    setDrawerItem(item);
    window.history.pushState({ [ORDER_FORM_DRAWER_HISTORY_KEY]: true }, '', window.location.href);
    drawerHistoryDepthRef.current += 1;
  }, []);

  const closeProductDrawer = useCallback(() => {
    if (drawerHistoryDepthRef.current > 0) {
      window.history.back();
    } else {
      setDrawerItem(null);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setDrawerItem((current) => {
        if (current) {
          drawerHistoryDepthRef.current = Math.max(0, drawerHistoryDepthRef.current - 1);
          return null;
        }
        return current;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => { injectCSS(); }, []);

  useEffect(() => {
    setDrawerItem(null);
    setSearchQuery('');
    setSelectedCategory('all');
    drawerHistoryDepthRef.current = 0;
    // Clear sessionStorage for old token if switching to a new one
    // (This will be handled naturally when token changes and new useEffect fetches new data)
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!token) { setError('Invalid link'); return; }
        const data = await fetchShareLinkForCustomer(token);
        if (cancelled) return;
        if (!data) { setError('This link is invalid or expired.'); return; }
        setSellerWhatsapp(data.sellerWhatsapp);
        setSellerBusinessName((data.sellerBusinessName || '').trim());
        setSellerLogoUrl((data.sellerLogoUrl || '').trim());
        setHeaderLogoFailed(false);
        setCurrencySymbol(
          resolveShareLinkCurrencyDisplay({
            sellerCurrencyCode: data.sellerCurrencyCode,
            sellerCurrencySymbol: data.sellerCurrencySymbol,
            sellerCustomCurrencies: data.sellerCustomCurrencies,
          })
        );
        setCurrencyCode(data.sellerCurrencyCode || 'INR');
        setItems(data.items || []);
        const initial: QtyMap = {};
        (data.items || []).forEach((i) => { initial[i.productId] = 0; });

        // Try to restore qty from sessionStorage
        const savedQty = sessionStorage.getItem(`catshare_order_qty_${token}`);
        if (savedQty) {
          try {
            const restored = JSON.parse(savedQty) as QtyMap;
            // Merge restored qty with initial (in case items list changed)
            (data.items || []).forEach((i) => {
              if (restored[i.productId] !== undefined) {
                initial[i.productId] = restored[i.productId];
              }
            });
          } catch {
            // If JSON parsing fails, just use initial
          }
        }
        setQty(initial);

        // Fetch seller_user_id using public RPC function
        if (token) {
          const sellerId = await fetchSellerUserIdForToken(token);
          if (sellerId) {
            setSellerUserId(sellerId);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load order form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    setHeaderLogoFailed(false);
  }, [sellerLogoUrl]);

  const changeQty = (id: string, delta: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  };

  // Persist qty to sessionStorage whenever it changes
  useEffect(() => {
    if (token && Object.keys(qty).length > 0) {
      sessionStorage.setItem(`catshare_order_qty_${token}`, JSON.stringify(qty));
    }
  }, [qty, token]);

  /** Number of distinct products with qty > 0 (not sum of quantities). */
  const selectedProductCount = useMemo(
    () => items.filter((i) => (qty[i.productId] ?? 0) > 0).length,
    [items, qty]
  );

  const availableCategories = useMemo(() => {
    const categories = items.flatMap((item) => getItemCategories(item));
    return Array.from(new Set(categories));
  }, [items]);

  const hasUncategorizedItems = useMemo(
    () => items.some((item) => getItemCategories(item).length === 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || getItemSearchText(item).includes(query);
      const itemCategories = getItemCategories(item);
      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized'
          ? itemCategories.length === 0
          : itemCategories.includes(selectedCategory));
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  const lineAmounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      const q = qty[i.productId] ?? 0;
      const unit = parseItemPriceNumeric(i.price);
      map[i.productId] = q > 0 && Number.isFinite(unit) ? q * unit : 0;
    });
    return map;
  }, [items, qty]);

  const orderTotalAmount = useMemo(
    () => Object.values(lineAmounts).reduce((a, b) => a + b, 0),
    [lineAmounts]
  );

  const selectionIncludesUnpricedLines = useMemo(
    () => items.some((i) => {
      const q = qty[i.productId] ?? 0;
      return q > 0 && !Number.isFinite(parseItemPriceNumeric(i.price));
    }),
    [items, qty]
  );

  const message = useMemo(() => {
    const selectedItems = items.filter((i) => (qty[i.productId] ?? 0) > 0);
    if (selectedItems.length === 0) return 'No items selected.';

    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const lines: string[] = [];
    lines.push(`🛍️ *New Order — ${date}*`);
    lines.push(`_via CatShare Order Form_`);
    lines.push('');
    lines.push('*Items Ordered:*');

    let total = 0;
    selectedItems.forEach((i, idx) => {
      const q = qty[i.productId] ?? 0;
      const unit = parseItemPriceNumeric(i.price);
      const itemTotal = Number.isFinite(unit) ? unit * q : 0;
      total += itemTotal;

      const subtitlePart = i.subtitle ? ` _(${i.subtitle})_` : '';
      lines.push(`${idx + 1}. *${i.name}*${subtitlePart}`);

      if (Number.isFinite(unit)) {
        const unitLabel = getOrderUnitLabel(i.priceUnit);
        const unitLabelDisplay = q === 1 && unitLabel === 'pcs' ? 'piece' : unitLabel;
        const unitPrice = `${currencySymbol}${unit.toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`;
        const rowTotal = `${currencySymbol}${itemTotal.toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`;
        lines.push(`   ${q} ${unitLabelDisplay} x ${unitPrice} = ${rowTotal}`);
      } else {
        lines.push(`   Qty: ${q}`);
      }

      lines.push('');
    });

    if (total > 0) {
      lines.push(`💰 *Total: ${currencySymbol}${total.toLocaleString('en-IN')}*`);
      lines.push('');
    }

    lines.push('Please confirm availability and share payment details. Thank you!');
    return lines.join('\n');
  }, [items, qty, currencySymbol]);

  const goToConfirmOrder = () => {
    const selectedItems = items.filter((i) => (qty[i.productId] ?? 0) > 0);
    if (selectedItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    // Navigate to confirm page with order data
    navigate(`/o/${token}/confirm`, {
      state: {
        selectedItems,
        qty,
        currencySymbol,
        currencyCode,
        sellerWhatsapp,
        sellerUserId,
        customerName: '',
        customerWhatsapp: '',
        lineAmounts,
        orderTotalAmount,
      },
    });
  };

  // ── Loading ──
  if (loading) return (
    <div className="of-bg">
      <div className="of-page">
        <div className="of-header">
          <div className="of-header-inner">
            <div className="of-store-row">
              <div className="of-store-icon">
                <StoreIcon />
              </div>
              <div>
                <div className="of-skeleton" style={{ height: 14, width: 120, borderRadius: 6 }} />
                <div className="of-skeleton" style={{ height: 10, width: 80, borderRadius: 6, marginTop: 5 }} />
              </div>
            </div>
            <div className="of-skeleton" style={{ height: 38, width: 130, borderRadius: 100 }} />
          </div>
        </div>
        <div style={{ padding: '12px 12px 0' }}>
          <div className="of-skeleton" style={{ height: 11, width: 80, borderRadius: 6, margin: '16px 8px 10px' }} />
        </div>
        <div className="of-skeleton-wrap">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );

 // ── Error / Expired ──
 if (error) {
  const isExpired =
    error.toLowerCase().includes('expir') ||
    error.toLowerCase().includes('invalid') ||
    error.toLowerCase().includes('not found');

  return (
    <div className="of-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        borderRadius: 24,
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        fontFamily: 'var(--font)',
      }}>
        {/* Top accent strip */}
        <div style={{
          height: 6,
          background: isExpired
            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
            : 'linear-gradient(90deg, #ef4444, #dc2626)',
        }} />

        <div style={{ padding: '36px 32px 32px', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72,
            borderRadius: '50%',
            background: isExpired ? '#fef3c7' : '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 32,
          }}>
            {isExpired ? '⏰' : '⚠️'}
          </div>

          {/* Heading */}
          <div style={{
            fontSize: 22, fontWeight: 800, color: '#0f172a',
            letterSpacing: '-0.5px', marginBottom: 10, lineHeight: 1.2,
          }}>
            {isExpired ? 'This link has expired' : 'Link unavailable'}
          </div>

          {/* Subtext */}
          <div style={{
            fontSize: 14, color: '#64748b', lineHeight: 1.6,
            marginBottom: 28,
          }}>
            {isExpired
              ? 'Order links are valid for 24 hours. This one has expired or is no longer active.'
              : error}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f1f5f9', marginBottom: 24 }} />

          {/* Contact seller prompt */}
          <div style={{
            background: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 24,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              What to do next
            </div>
            <div style={{ fontSize: 13.5, color: '#166534', lineHeight: 1.6 }}>
              Contact the seller directly to get an updated order link or place your order via WhatsApp.
            </div>
          </div>

          {/* WhatsApp CTA — only if seller number is known */}
          {sellerWhatsapp ? (
              <button
                onClick={() => window.open(`https://wa.me/${sellerWhatsapp.replace(/[^\d]/g, '')}`, '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#25d366', color: '#fff',
                  padding: '13px 20px', borderRadius: 100,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(37,211,102,0.35)',
                  border: 'none', cursor: 'pointer', width: '100%',
                  fontFamily: 'var(--font)',
                }}
              >
                <WhatsAppIcon size={16} />
                Message Seller on WhatsApp
              </button>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Reach out to the seller for a fresh link.
              </div>
            )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #f1f5f9',
          padding: '14px 20px',
          textAlign: 'center',
          background: '#f8fafc',
        }}>
          
          <button
              onClick={() => window.open(CATSHARE_PLAY_STORE_URL, '_blank')}
              style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
            >
              📲 Get CatShare on Google Play
            </button>
        </div>
      </div>
    </div>
  );
}

  // ── Main ──
  return (
    <div className="of-bg">
      <div className="of-page">

        {/* Sticky header */}
        <div className="of-header">
          <div className="of-header-inner">
            <div className="of-store-row">
              <div className="of-store-icon">
                {sellerLogoUrl && !headerLogoFailed && isPublicHttpUrl(sellerLogoUrl) ? (
                  <img
                    src={sellerLogoUrl}
                    alt=""
                    className="of-store-logo-img"
                    onError={() => setHeaderLogoFailed(true)}
                  />
                ) : (
                  <StoreIcon />
                )}
              </div>
              <div className="of-store-meta">
                <div className="of-store-name">
                  {sellerBusinessName || 'Order Form'}
                </div>
                <div className="of-store-sub">
                  {sellerBusinessName ? 'Order Form' : 'Pick items & confirm via WhatsApp'}
                </div>
              </div>
            </div>
            <button
              className="of-confirm-btn"
              onClick={goToConfirmOrder}
              disabled={selectedProductCount === 0}
            >
              <WhatsAppIcon size={14} />
              <span className="btn-label">Order on WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Section label */}
        <div className="of-toolbar">
          <div className="of-section-head">
            {searchQuery.trim() || selectedCategory !== 'all'
              ? `${filteredItems.length} of ${items.length} item${items.length === 1 ? '' : 's'} shown`
              : `${items.length} item${items.length === 1 ? '' : 's'} available`}
          </div>

          {items.length > 0 && (
            <div className="of-search">
              <span className="of-search-icon" aria-hidden="true">⌕</span>
              <input
                type="text"
                className="of-search-input"
                placeholder="Search items"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search items"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="of-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {availableCategories.length > 0 && (
            <div className="of-category-filters" role="tablist" aria-label="Filter by category">
              <button
                type="button"
                className={`of-category-chip${selectedCategory === 'all' ? ' is-active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`of-category-chip${selectedCategory === category ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
              {hasUncategorizedItems && (
                <button
                  type="button"
                  className={`of-category-chip${selectedCategory === 'uncategorized' ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory('uncategorized')}
                >
                  Uncategorized
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product list */}
        <div className="of-items">
          {items.length === 0 && (
            <div className="of-empty">No items in this order link.</div>
          )}

          {items.length > 0 && filteredItems.length === 0 && (
            <div className="of-empty">
              <strong>No matching items</strong>
              Try a different name or category.
            </div>
          )}

          {filteredItems.map((item) => {
            const q = qty[item.productId] ?? 0;
            const isSelected = q > 0;
            const lineAmt = lineAmounts[item.productId] ?? 0;
            const hasParsedPrice = Number.isFinite(parseItemPriceNumeric(item.price));
            const lineCalcDetail =
              hasParsedPrice && q > 0
                ? formatLineCalculationDetail(q, item, currencySymbol)
                : null;

            return (
              <div
                key={item.productId}
                className={`of-item-card${isSelected ? ' is-selected' : ''}`}
              >
                {/* Image */}
                <div className="of-img-wrap" onClick={() => openProductDrawer(item)}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="of-img" />
                  ) : (
                    <div className="of-img-ph"><ImgIcon /></div>
                  )}
                  {isSelected && <div className="of-selected-badge">✓ Added</div>}
                </div>

                {/* Body */}
                <div className="of-item-body">
                  <div className="of-item-top">
                    <div className="of-item-text">
                      <div className="of-item-title-line">
                        <span className="of-item-name">{item.name}</span>
                        {item.subtitle ? (
                          <span className="of-item-subtitle-inline">({item.subtitle})</span>
                        ) : null}
                      </div>
                      <div className="of-item-price-row">
                        {item.price !== undefined && item.price !== null && item.price !== '' && (
                          <div className="of-price-tag">
                            {formatUnitPrice(item.price, currencySymbol)}
                            {item.priceUnit ? ` ${item.priceUnit}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="of-item-bottom">
                    <div className="of-item-qty-cluster">
                      <div className="of-qty-inline-row">
                        <QtyControl
                          value={q}
                          step={getQuantityStep(item)}
                          onChange={(delta) => changeQty(item.productId, delta)}
                        />
                        {getQuantityStep(item) > 1 ? (
                          <div className="of-step-hint of-step-hint--next-to-qty">
                            <AlertIcon />
                            Pack of {getQuantityStep(item)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="of-view-btn"
                      onClick={() => openProductDrawer(item)}
                    >
                      Details ›
                    </button>
                  </div>

                  {isSelected && (
                    <div className="of-line-total-below" aria-live="polite">
                      <span className="of-subtotal-label">subtotal</span>
                      <span className="of-line-sep" aria-hidden>
                        ·
                      </span>
                      {lineCalcDetail ? (
                        <>
                          <span className="of-line-calc" title={lineCalcDetail}>
                            {lineCalcDetail}
                          </span>
                          <span className="of-line-sep" aria-hidden>
                            ·
                          </span>
                        </>
                      ) : null}
                      {hasParsedPrice ? (
                        <span className="of-line-total-val">
                          {formatOrderMoney(lineAmt, currencySymbol)}
                        </span>
                      ) : (
                        <span className="of-line-total-na">—</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="of-footer">
          <div className="of-footer-app-row">
            <a
              href={CATSHARE_PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="of-footer-link"
            >
              📲 Get CatShare on Google Play
            </a>
          </div>
          <p className="of-footer-desc">
            Create catalogues, share products & take orders — built for small businesses.
          </p>
        </div>
      </div>

      {/* Floating summary bar */}
      {selectedProductCount > 0 && (
        <div className="of-summary">
          <div className="of-summary-card" onClick={goToConfirmOrder}>
            <div className="of-summary-left">
              <span className="of-summary-count">
                {selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected
              </span>
              {orderTotalAmount > 0 ? (
                <span className="of-summary-total">
                  {formatOrderMoney(orderTotalAmount, currencySymbol)}
                </span>
              ) : (
                <span className="of-summary-total">Review order</span>
              )}
              {selectionIncludesUnpricedLines && (
                <span className="of-summary-no-price">
                  Some items don't have a price
                </span>
              )}
            </div>
            <button className="of-summary-cta">
              <WhatsAppIcon size={16} />
              Place Order
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {drawerItem && (() => {
        const dQ = qty[drawerItem.productId] ?? 0;
        const dAmt = lineAmounts[drawerItem.productId] ?? 0;
        const dHasPrice = Number.isFinite(parseItemPriceNumeric(drawerItem.price));
        const drawerCalcDetail =
          dHasPrice && dQ > 0
            ? formatLineCalculationDetail(dQ, drawerItem, currencySymbol)
            : null;
        const fields = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const val = (drawerItem as Record<string, unknown>)[`field${n}`];
          if (val === undefined || val === null || String(val).trim() === '') return null;
          const { label, unitSuffix } = getFieldLabelAndUnitSuffix(drawerItem, n);
          return { label, value: unitSuffix ? `${String(val)} ${unitSuffix}` : String(val) };
        }).filter(Boolean);

        return (
          <div
            ref={overlayRef}
            className="of-overlay"
            onClick={(e) => { if (e.target === overlayRef.current) closeProductDrawer(); }}
          >
            <div className="of-drawer">
              <div className="of-drawer-handle" />

              {/* Image */}
              <div className="of-drawer-img-wrap">
                {drawerItem.imageUrl ? (
                  <img src={drawerItem.imageUrl} alt={drawerItem.name} className="of-drawer-img" />
                ) : (
                  <div className="of-drawer-img-ph"><ImgIcon size={48} /></div>
                )}
                <button type="button" className="of-drawer-close" onClick={() => closeProductDrawer()}>✕</button>
              </div>

              {/* Content */}
              <div className="of-drawer-body">
                <div className="of-drawer-name">{drawerItem.name}</div>
                {drawerItem.subtitle && (
                  <div className="of-drawer-sub">({drawerItem.subtitle})</div>
                )}

                {getItemCategories(drawerItem).length > 0 && (
                  <div className="of-category-row">
                    {getItemCategories(drawerItem).map((category) => (
                      <span key={category} className="of-category-pill">
                        {category}
                      </span>
                    ))}
                  </div>
                )}

                {drawerItem.price !== undefined && drawerItem.price !== '' && (
                  <div className="of-drawer-price-row">
                    <div className="of-drawer-price">
                      {formatUnitPrice(drawerItem.price, currencySymbol)}
                      {drawerItem.priceUnit ? ` ${drawerItem.priceUnit}` : ''}
                    </div>
                  </div>
                )}

                {/* Detail fields table */}
                {fields.length > 0 && (
                  <div className="of-detail-table">
                    {fields.map((f, i) => (
                      <div key={i} className="of-detail-row">
                        <span className="of-detail-label">{f!.label}</span>
                        <span className="of-detail-val">{f!.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quantity section */}
                <div className="of-drawer-qty-section">
                  <div className="of-drawer-qty-label">Select quantity</div>
                  <div className="of-drawer-qty-row">
                    <QtyControl
                      value={dQ}
                      step={getQuantityStep(drawerItem)}
                      onChange={(delta) => changeQty(drawerItem.productId, delta)}
                    />
                    {dQ > 0 && (
                      <div className="of-drawer-line-total-wrap">
                        {drawerCalcDetail && (
                          <div className="of-drawer-line-calc">{drawerCalcDetail}</div>
                        )}
                        <span className="of-drawer-line-total">
                          {dHasPrice ? formatOrderMoney(dAmt, currencySymbol) : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button type="button" className="of-drawer-done" onClick={() => closeProductDrawer()}>
                  Done — {dQ > 0 ? `${dQ} added` : 'close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
