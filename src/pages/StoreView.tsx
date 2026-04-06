import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStoreBySlug } from '../services/storeService';
import { isProductEnabledForCatalogue, getCatalogueData, normalizeOrderQuantityStep } from '../config/catalogueProductUtils';
import { getAllCatalogues } from '../config/catalogueConfig';
import { createOrder, type OrderItem } from '../services/orderService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';

/* ─── Inlined styles ──────────────────────────────────────────────────────── */
const inlineStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --font: 'DM Sans', system-ui, sans-serif;
    --font-display: 'DM Serif Display', Georgia, serif;
    --ink: #0a0a0a;
    --ink-2: #3d3d3d;
    --ink-3: #767676;
    --ink-4: #a3a3a3;
    --surface: #ffffff;
    --surface-2: #f7f6f3;
    --surface-3: #f0ede7;
    --border: #e8e4dd;
    --border-strong: #ccc8c0;
    --accent: #1a1a1a;
    --accent-green: #1a6b3a;
    --accent-green-bg: #e8f5ed;
    --accent-green-text: #0f4525;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 18px;
    --radius-xl: 24px;
    --radius-full: 999px;
    --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    --shadow-float: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sv-root {
    font-family: var(--font);
    background: var(--surface-2);
    min-height: 100vh;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Page shell ── */
  .sv-page {
    max-width: 520px;
    margin: 0 auto;
    min-height: 100vh;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* ── Header ── */
  .sv-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 14px 16px;
  }
  .sv-header-inner {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sv-back-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--transition), border-color var(--transition);
  }
  .sv-back-btn:hover { background: var(--surface-2); border-color: var(--border-strong); }

  .sv-store-identity {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .sv-logo-wrap {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .sv-logo-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .sv-store-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.2px;
  }
  .sv-store-step {
    font-size: 12px;
    color: var(--ink-3);
    font-weight: 400;
    letter-spacing: 0.1px;
  }
  .sv-header-cta {
    flex-shrink: 0;
    height: 36px;
    padding: 0 18px;
    border-radius: var(--radius-full);
    background: var(--ink);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    font-family: var(--font);
    letter-spacing: 0.1px;
    transition: opacity var(--transition), transform var(--transition);
    white-space: nowrap;
  }
  .sv-header-cta:hover:not(:disabled) { opacity: 0.85; }
  .sv-header-cta:active:not(:disabled) { transform: scale(0.97); }
  .sv-header-cta:disabled { opacity: 0.38; cursor: not-allowed; }

  /* ── Store hero strip ── */
  .sv-hero {
    background: var(--ink);
    color: #fff;
    padding: 22px 20px 18px;
  }
  .sv-hero-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    margin-bottom: 6px;
  }
  .sv-hero-title {
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 1.1;
    color: #fff;
    letter-spacing: -0.5px;
  }
  .sv-hero-title em { font-style: italic; color: rgba(255,255,255,0.65); }

  /* ── Toolbar ── */
  .sv-toolbar {
    padding: 16px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sv-count-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sv-count-label {
    font-size: 12px;
    color: var(--ink-3);
    font-weight: 500;
    letter-spacing: 0.2px;
  }

  /* ── Search ── */
  .sv-search-wrap {
    position: relative;
  }
  .sv-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 16px;
    color: var(--ink-4);
    pointer-events: none;
    line-height: 1;
  }
  .sv-search-input {
    width: 100%;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: var(--surface-2);
    color: var(--ink);
    font-size: 13.5px;
    font-family: var(--font);
    padding: 0 36px 0 36px;
    outline: none;
    transition: border-color var(--transition), background var(--transition);
  }
  .sv-search-input:focus { border-color: var(--border-strong); background: var(--surface); }
  .sv-search-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--surface-3);
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--ink-3);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  /* ── Category pills ── */
  .sv-cats {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .sv-cats::-webkit-scrollbar { display: none; }
  .sv-cat-pill {
    flex-shrink: 0;
    height: 30px;
    padding: 0 14px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink-2);
    font-size: 12.5px;
    font-weight: 500;
    font-family: var(--font);
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }
  .sv-cat-pill:hover { border-color: var(--border-strong); background: var(--surface-2); }
  .sv-cat-pill.is-active {
    background: var(--ink);
    border-color: var(--ink);
    color: #fff;
  }

  /* ── Product list ── */
  .sv-items {
    padding: 0 16px 120px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Product card ── */
  .sv-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    display: flex;
    overflow: hidden;
    transition: border-color var(--transition), box-shadow var(--transition);
    position: relative;
  }
  .sv-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-card); }
  .sv-card.is-selected {
    border-color: var(--ink);
    box-shadow: 0 0 0 1px var(--ink);
  }

  .sv-card-img-wrap {
    width: 110px;
    min-height: 110px;
    flex-shrink: 0;
    position: relative;
    background: var(--surface-2);
    cursor: pointer;
  }
  .sv-card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .sv-card-img-ph {
    width: 100%;
    height: 100%;
    min-height: 110px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3);
  }
  .sv-added-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: var(--ink);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-full);
    letter-spacing: 0.3px;
  }

  .sv-card-body {
    flex: 1;
    padding: 14px 14px 12px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .sv-card-name {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.3;
    letter-spacing: -0.2px;
  }
  .sv-card-sub {
    font-size: 12px;
    color: var(--ink-3);
    font-weight: 400;
    margin-top: 1px;
  }
  .sv-card-price {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    margin-top: 6px;
    letter-spacing: -0.3px;
  }
  .sv-card-price-unit {
    font-size: 11.5px;
    font-weight: 400;
    color: var(--ink-3);
    margin-left: 2px;
  }

  .sv-card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    gap: 8px;
  }
  .sv-details-btn {
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-3);
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font);
    padding: 4px 0;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }
  .sv-details-btn:hover { color: var(--ink); }

  /* ── Qty control ── */
  .sv-qty {
    display: inline-flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-full);
    overflow: hidden;
    background: var(--surface);
  }
  .sv-qty-btn {
    width: 30px;
    height: 30px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 17px;
    color: var(--ink-2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition);
    font-family: var(--font);
    line-height: 1;
  }
  .sv-qty-btn:hover { background: var(--surface-2); }
  .sv-qty-val {
    min-width: 30px;
    text-align: center;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink);
    padding: 0 2px;
  }

  /* ── Subtotal strip ── */
  .sv-subtotal {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px dashed var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px;
  }
  .sv-subtotal-calc {
    font-size: 11.5px;
    color: var(--ink-3);
  }
  .sv-subtotal-val {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.3px;
  }

  /* ── Pack hint ── */
  .sv-pack-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #7c5f00;
    background: #fef9ec;
    border: 1px solid #f5e49e;
    border-radius: var(--radius-full);
    padding: 3px 9px;
    margin-top: 6px;
  }

  /* ── Empty states ── */
  .sv-empty {
    text-align: center;
    padding: 48px 24px;
    color: var(--ink-3);
  }
  .sv-empty-icon {
    font-size: 36px;
    margin-bottom: 12px;
    opacity: 0.5;
  }
  .sv-empty strong {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-2);
    margin-bottom: 6px;
  }
  .sv-empty p { font-size: 13px; line-height: 1.5; }

  /* ── Skeleton ── */
  @keyframes sv-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .sv-skel {
    background: linear-gradient(90deg, var(--surface-3) 25%, var(--border) 50%, var(--surface-3) 75%);
    background-size: 800px 100%;
    animation: sv-shimmer 1.4s infinite linear;
    border-radius: 6px;
  }
  .sv-skel-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    display: flex;
    overflow: hidden;
    min-height: 110px;
  }

  /* ── Floating cart bar ── */
  .sv-cart-bar {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 520px;
    padding: 12px 16px 20px;
    background: transparent;
    pointer-events: none;
    z-index: 200;
  }
  .sv-cart-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--ink);
    border-radius: var(--radius-xl);
    padding: 12px 12px 12px 18px;
    box-shadow: var(--shadow-float);
    pointer-events: all;
    gap: 12px;
    cursor: pointer;
  }
  .sv-cart-left {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sv-cart-count {
    font-size: 12px;
    color: rgba(255,255,255,0.55);
    font-weight: 500;
  }
  .sv-cart-total {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.5px;
  }
  .sv-cart-btn {
    flex-shrink: 0;
    height: 38px;
    padding: 0 20px;
    border-radius: var(--radius-full);
    background: #fff;
    color: var(--ink);
    font-size: 13.5px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    font-family: var(--font);
    letter-spacing: 0.1px;
    transition: opacity var(--transition);
  }
  .sv-cart-btn:hover { opacity: 0.88; }
  .sv-cart-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Customer step ── */
  .sv-form-section {
    padding: 0 16px;
  }
  .sv-form-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .sv-field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 7px;
  }
  .sv-field input {
    width: 100%;
    height: 46px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-family: var(--font);
    padding: 0 14px;
    outline: none;
    transition: border-color var(--transition);
  }
  .sv-field input:focus { border-color: var(--ink); }
  .sv-field input::placeholder { color: var(--ink-4); }

  .sv-order-summary-box {
    background: var(--surface-2);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sv-order-summary-label {
    font-size: 11.5px;
    color: var(--ink-3);
    font-weight: 500;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .sv-order-summary-detail {
    font-size: 13px;
    color: var(--ink-2);
  }
  .sv-order-summary-total {
    font-size: 24px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.8px;
  }

  /* ── Review step ── */
  .sv-review-items {
    padding: 0 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sv-review-info-card {
    margin: 0 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px 18px;
    margin-bottom: 10px;
  }
  .sv-review-info-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.7px;
    margin-bottom: 8px;
  }
  .sv-review-name {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.3px;
  }
  .sv-review-phone {
    font-size: 13px;
    color: var(--ink-3);
    margin-top: 3px;
  }
  .sv-review-total-bar {
    margin: 0 16px 120px;
    background: var(--ink);
    border-radius: var(--radius-lg);
    padding: 18px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-float);
  }
  .sv-review-total-label {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
    margin-bottom: 3px;
  }
  .sv-review-total-val {
    font-size: 26px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -1px;
  }
  .sv-edit-items-btn {
    height: 36px;
    padding: 0 16px;
    border-radius: var(--radius-full);
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: background var(--transition);
    white-space: nowrap;
  }
  .sv-edit-items-btn:hover { background: rgba(255,255,255,0.2); }

  /* ── Drawer overlay ── */
  .sv-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 300;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .sv-drawer {
    background: var(--surface);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    animation: sv-drawer-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  }
  @keyframes sv-drawer-up {
    from { transform: translateY(60px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .sv-drawer-handle {
    width: 40px;
    height: 4px;
    background: var(--border-strong);
    border-radius: var(--radius-full);
    margin: 10px auto 0;
  }
  .sv-drawer-img-wrap {
    position: relative;
    width: 100%;
    height: 220px;
    background: var(--surface-2);
    margin-top: 12px;
    overflow: hidden;
  }
  .sv-drawer-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sv-drawer-img-ph {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3);
  }
  .sv-drawer-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    background: rgba(255,255,255,0.9);
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 14px;
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  .sv-drawer-body {
    padding: 18px 20px 32px;
  }
  .sv-drawer-name {
    font-size: 21px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.5px;
    line-height: 1.2;
  }
  .sv-drawer-subtitle {
    font-size: 13.5px;
    color: var(--ink-3);
    margin-top: 3px;
  }
  .sv-drawer-cat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .sv-drawer-cat-pill {
    height: 24px;
    padding: 0 10px;
    border-radius: var(--radius-full);
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-size: 11.5px;
    color: var(--ink-2);
    font-weight: 500;
  }
  .sv-drawer-price {
    font-size: 24px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.7px;
    margin-top: 14px;
  }
  .sv-drawer-price span {
    font-size: 14px;
    font-weight: 400;
    color: var(--ink-3);
    margin-left: 4px;
  }

  .sv-detail-table {
    margin-top: 18px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .sv-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    font-size: 13px;
    gap: 16px;
  }
  .sv-detail-row:not(:last-child) { border-bottom: 1px solid var(--border); }
  .sv-detail-row:nth-child(even) { background: var(--surface-2); }
  .sv-detail-label { color: var(--ink-3); font-weight: 500; }
  .sv-detail-val { color: var(--ink); font-weight: 600; text-align: right; }

  .sv-drawer-qty-section {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
  }
  .sv-drawer-qty-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.7px;
    margin-bottom: 12px;
  }
  .sv-drawer-qty-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .sv-drawer-total-wrap {
    text-align: right;
  }
  .sv-drawer-calc {
    font-size: 12px;
    color: var(--ink-3);
    margin-bottom: 2px;
  }
  .sv-drawer-total {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.6px;
  }
  .sv-drawer-done {
    width: 100%;
    height: 48px;
    border-radius: var(--radius-full);
    background: var(--ink);
    color: #fff;
    border: none;
    font-size: 15px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    margin-top: 18px;
    transition: opacity var(--transition);
    letter-spacing: 0.1px;
  }
  .sv-drawer-done:hover { opacity: 0.87; }

  /* ── Section heading ── */
  .sv-section-head {
    padding: 18px 16px 4px;
  }
  .sv-section-head h2 {
    font-family: var(--font-display);
    font-size: 22px;
    color: var(--ink);
    letter-spacing: -0.3px;
    font-weight: 400;
  }

  /* ── Page footer ── */
  .sv-footer {
    padding: 24px 20px 40px;
    text-align: center;
    border-top: 1px solid var(--border);
    margin-top: 8px;
  }
  .sv-footer-text {
    font-size: 12px;
    color: var(--ink-4);
    line-height: 1.6;
  }

  /* ── Error / loading screens ── */
  .sv-fullscreen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--surface-2);
    font-family: var(--font);
  }
  .sv-error-card {
    background: var(--surface);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border);
    overflow: hidden;
    max-width: 400px;
    width: 100%;
  }
  .sv-error-stripe {
    height: 5px;
    background: linear-gradient(90deg, #e8c840, #e84040);
  }
  .sv-error-body {
    padding: 36px 28px 28px;
    text-align: center;
  }
  .sv-error-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-full);
    background: #fef2f2;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 18px;
    font-size: 28px;
  }
  .sv-error-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.4px;
    margin-bottom: 8px;
  }
  .sv-error-desc {
    font-size: 13.5px;
    color: var(--ink-3);
    line-height: 1.6;
    margin-bottom: 24px;
  }
  .sv-go-home-btn {
    width: 100%;
    height: 46px;
    border-radius: var(--radius-full);
    background: var(--ink);
    color: #fff;
    border: none;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: opacity var(--transition);
  }
  .sv-go-home-btn:hover { opacity: 0.85; }
`;

/* ─── Types ───────────────────────────────────────────────────────────────── */
type Step = 'products' | 'customer' | 'review';

/* ─── Icons ──────────────────────────────────────────────────────────────── */
function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function StoreIconSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function ImgPhIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#c8c4bc" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function PackIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-4 0v2M8 7V5a2 2 0 00-4 0v2" />
    </svg>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getOrderUnitLabel(priceUnit: string | undefined): string {
  if (!priceUnit || String(priceUnit).trim() === '' || priceUnit === 'None') return 'unit';
  const cleaned = String(priceUnit).replace(/^\s*\/\s*/i, '').trim().toLowerCase();
  if (!cleaned) return 'unit';
  if (cleaned === 'piece' || cleaned === 'pieces' || cleaned === 'pc') return 'pc';
  return cleaned;
}

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatCalc(qty: number, price: number, priceUnit: string | undefined, symbol: string): string | null {
  if (qty <= 0 || !Number.isFinite(price)) return null;
  return `${qty} ${getOrderUnitLabel(priceUnit)} × ${formatMoney(price, symbol)}`;
}

function isPublicUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

function getCategories(p: ProductWithCatalogueData): string[] {
  return Array.from(new Set((p.category || []).map((c: string) => String(c).trim()).filter(Boolean)));
}

function getSearchText(p: ProductWithCatalogueData): string {
  const extras = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const row = p as unknown as Record<string, string | undefined>;
    return [row[`field${n}`], row[`field${n}Label`], row[`field${n}Unit`]].filter(Boolean).join(' ');
  });
  return [p.name, p.subtitle, ...(p.category || []), ...extras].filter(Boolean).join(' ').toLowerCase();
}

function getFieldLabelUnit(p: ProductWithCatalogueData, n: number): { label: string; unitSuffix: string } {
  const row = p as unknown as Record<string, string | undefined>;
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

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function QtyControl({ value, step, onChange }: { value: number; step: number; onChange: (d: number) => void }) {
  const s = normalizeOrderQuantityStep(step);
  return (
    <div className="sv-qty">
      <button type="button" className="sv-qty-btn" onClick={() => onChange(-s)}>−</button>
      <span className="sv-qty-val">{value}</span>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(s)}>+</button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="sv-skel-card">
      <div className="sv-skel" style={{ width: 110, minHeight: 110, flexShrink: 0, borderRadius: 0 }} />
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sv-skel" style={{ height: 14, width: '60%' }} />
        <div className="sv-skel" style={{ height: 11, width: '40%' }} />
        <div className="sv-skel" style={{ height: 20, width: '28%', marginTop: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="sv-skel" style={{ height: 30, width: 100, borderRadius: 999 }} />
          <div className="sv-skel" style={{ height: 18, width: 55 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function StoreView() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<Step>('products');
  const [store, setStore] = useState<any>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<ProductWithCatalogueData[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [drawerProduct, setDrawerProduct] = useState<ProductWithCatalogueData | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ── Data loading ── */
  useEffect(() => {
    const loadStore = async () => {
      if (!slug) { setStoreError('Store slug not found'); setStoreLoading(false); return; }
      setStoreLoading(true);
      const result = await getStoreBySlug(slug);
      if (!result.success || !result.data) {
        setStoreError(result.error || 'Store not found');
      } else {
        setStore(result.data);
      }
      setStoreLoading(false);
    };
    loadStore();
  }, [slug]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!store?.sellerUserId) return;
      setProductsLoading(true);
      try {
        const client = getSupabaseClient();
        const { data: products, error } = await client
          .from('products').select('*').eq('user_id', store.sellerUserId).order('position', { ascending: true });
        if (error) { setAllProducts([]); }
        else if (products) {
          setAllProducts(products.map((p: any) => ({
            id: p.product_id,
            name: p.name,
            subtitle: p.data?.subtitle || '',
            category: p.data?.category || [],
            image: p.data?.image,
            imageUrl: p.data?.image,
            ...p.data,
          })));
        }
      } catch { setAllProducts([]); }
      finally { setProductsLoading(false); }
    };
    loadProducts();
  }, [store?.sellerUserId]);

  /* ── Derived data ── */
  const catalogues = useMemo(() => getAllCatalogues(null), []);
  const currencySymbol = useMemo(() => getSymbolForCurrencyCode(store?.sellerCurrencyCode || 'INR'), [store?.sellerCurrencyCode]);
  const catalogue = useMemo(() => catalogues.find((c) => c.id === store?.catalogueId) || null, [catalogues, store?.catalogueId]);

  const storeProducts = useMemo(() => {
    if (!store?.catalogueId) return [];
    return allProducts.filter((p) => isProductEnabledForCatalogue(p, store.catalogueId));
  }, [store, allProducts]);

  const availableCategories = useMemo(() => Array.from(new Set(storeProducts.flatMap(getCategories))), [storeProducts]);
  const hasUncategorized = useMemo(() => storeProducts.some((p) => getCategories(p).length === 0), [storeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return storeProducts.filter((p) => {
      const matchSearch = !q || getSearchText(p).includes(q);
      const cats = getCategories(p);
      const matchCat = selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized' ? cats.length === 0 : cats.includes(selectedCategory));
      return matchSearch && matchCat;
    });
  }, [searchQuery, selectedCategory, storeProducts]);

  const orderSummary = useMemo(() => {
    if (!store || !catalogue) return { items: [], total: 0 };
    const items: any[] = [];
    let total = 0;
    selectedProducts.forEach((quantity, productId) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product) return;
      const catData = getCatalogueData(product, store.catalogueId);
      const unitPrice = parseFloat(catData[catalogue.priceField] || '0') || 0;
      const rowTotal = unitPrice * quantity;
      items.push({ productId, name: product.name, quantity, unitPrice, rowTotal, priceUnit: catData[catalogue.priceUnitField], category: product.category?.[0], imageUrl: product.image || product.imageUrl, quantityStep: catData.orderQuantityStep, subtitle: product.subtitle });
      total += rowTotal;
    });
    return { items, total };
  }, [selectedProducts, store, catalogue, allProducts]);

  const selectedProductCount = useMemo(
    () => Array.from(selectedProducts.values()).filter((q) => q > 0).length,
    [selectedProducts]
  );

  /* ── Handlers ── */
  const changeQty = (productId: string, delta: number, step: number) => {
    const s = normalizeOrderQuantityStep(step);
    const current = selectedProducts.get(productId) || 0;
    const next = Math.max(0, current + delta);
    const rounded = Math.round(next / s) * s;
    const map = new Map(selectedProducts);
    if (rounded <= 0) map.delete(productId);
    else map.set(productId, rounded);
    setSelectedProducts(map);
  };

  const handleBack = useCallback(() => {
    if (drawerProduct) { setDrawerProduct(null); return; }
    if (step === 'review') { setStep('customer'); return; }
    if (step === 'customer') { setStep('products'); return; }
    window.history.back();
  }, [drawerProduct, step]);

  const handlePrimaryAction = () => {
    if (step === 'products') {
      if (selectedProducts.size === 0) { alert('Please add at least one product'); return; }
      setStep('customer'); return;
    }
    if (step === 'customer') {
      if (!customerName.trim()) { alert('Please enter your name'); return; }
      setStep('review'); return;
    }
    void handlePlaceOrder();
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) { alert('Please enter your name'); return; }
    if (!store) { alert('Store information not available'); return; }
    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = [];
      if (catalogue) {
        selectedProducts.forEach((quantity, productId) => {
          const product = allProducts.find((p) => p.id === productId);
          if (product) {
            const catData = getCatalogueData(product, store.catalogueId);
            const unitPrice = parseFloat(catData[catalogue.priceField] || '0') || 0;
            orderItems.push({ productId, name: product.name, quantity, unitPrice, rowTotal: unitPrice * quantity, category: product.category?.[0], subtitle: product.subtitle, priceUnit: catData[catalogue.priceUnitField], imageUrl: product.image || product.imageUrl, quantityStep: catData.orderQuantityStep });
          }
        });
      }
      if (orderItems.length === 0) { alert('No products selected'); setIsSubmitting(false); return; }
      setSupabaseRlsUserId(store.sellerUserId);
      const { error } = await createOrder(store.sellerUserId, '', customerName.trim(), orderItems, orderSummary.total, store.sellerCurrencyCode || 'INR', customerWhatsapp.trim() || undefined, 'store');
      if (error) { alert('Failed to save order. Please try again.'); }
      else { alert('Order placed successfully! The seller will contact you soon.'); navigate('/'); }
    } catch { alert('Error placing order. Please try again.'); }
    finally { setSupabaseRlsUserId(null); setIsSubmitting(false); }
  };

  const primaryButtonLabel = step === 'products' ? 'Continue' : step === 'customer' ? 'Review Order' : isSubmitting ? 'Placing…' : 'Place Order';
  const primaryButtonDisabled = step === 'products' ? selectedProductCount === 0 : step === 'customer' ? !customerName.trim() : isSubmitting;
  const storeDisplayName = store?.storeSlug ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1) : 'Store';

  /* ── Loading screen ── */
  if (storeLoading) {
    return (
      <>
        <style>{inlineStyles}</style>
        <div className="sv-root">
          <div className="sv-page">
            <div className="sv-header">
              <div className="sv-header-inner">
                <div className="sv-skel" style={{ width: 36, height: 36, borderRadius: 999 }} />
                <div className="sv-store-identity">
                  <div className="sv-skel" style={{ width: 38, height: 38, borderRadius: 8 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="sv-skel" style={{ height: 13, width: 110 }} />
                    <div className="sv-skel" style={{ height: 10, width: 70 }} />
                  </div>
                </div>
                <div className="sv-skel" style={{ height: 36, width: 90, borderRadius: 999 }} />
              </div>
            </div>
            <div className="sv-skel" style={{ height: 88, borderRadius: 0 }} />
            <div style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="sv-skel" style={{ height: 40, borderRadius: 999 }} />
            </div>
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Error screen ── */
  if (storeError || !store) {
    return (
      <>
        <style>{inlineStyles}</style>
        <div className="sv-fullscreen">
          <div className="sv-error-card">
            <div className="sv-error-stripe" />
            <div className="sv-error-body">
              <div className="sv-error-icon">⚠️</div>
              <div className="sv-error-title">Store unavailable</div>
              <div className="sv-error-desc">{storeError || 'This store could not be found.'}</div>
              <button className="sv-go-home-btn" onClick={() => navigate('/')}>Back to home</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Main render ── */
  return (
    <>
      <style>{inlineStyles}</style>
      <div className="sv-root">
        <div className="sv-page">

          {/* Header */}
          <div className="sv-header">
            <div className="sv-header-inner">
              <button type="button" className="sv-back-btn" onClick={handleBack} aria-label="Go back">
                <IconArrowLeft />
              </button>
              <div className="sv-store-identity">
                <div className="sv-logo-wrap">
                  {store?.sellerLogoUrl && !logoFailed && isPublicUrl(store.sellerLogoUrl)
                    ? <img src={store.sellerLogoUrl} alt="" onError={() => setLogoFailed(true)} />
                    : <StoreIconSvg />}
                </div>
                <div>
                  <div className="sv-store-name">{storeDisplayName}</div>
                  <div className="sv-store-step">
                    {step === 'products' ? 'Browse & select' : step === 'customer' ? 'Your details' : 'Review order'}
                  </div>
                </div>
              </div>
              <button className="sv-header-cta" onClick={handlePrimaryAction} disabled={primaryButtonDisabled}>
                {primaryButtonLabel}
              </button>
            </div>
          </div>

          {/* Hero strip — only on products step */}
          {step === 'products' && (
            <div className="sv-hero">
              <div className="sv-hero-label">Order Form</div>
              <div className="sv-hero-title">{storeDisplayName}<em>'s Store</em></div>
            </div>
          )}

          {/* ── Products step ── */}
          {step === 'products' && (
            <>
              <div className="sv-toolbar">
                <div className="sv-count-row">
                  <span className="sv-count-label">
                    {searchQuery.trim() || selectedCategory !== 'all'
                      ? `${filteredProducts.length} of ${storeProducts.length} items shown`
                      : `${storeProducts.length} item${storeProducts.length === 1 ? '' : 's'} available`}
                  </span>
                </div>
                {storeProducts.length > 0 && (
                  <div className="sv-search-wrap">
                    <span className="sv-search-icon" aria-hidden>⌕</span>
                    <input
                      type="text"
                      className="sv-search-input"
                      placeholder="Search items…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button type="button" className="sv-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear">×</button>
                    )}
                  </div>
                )}
                {availableCategories.length > 0 && (
                  <div className="sv-cats">
                    <button type="button" className={`sv-cat-pill${selectedCategory === 'all' ? ' is-active' : ''}`} onClick={() => setSelectedCategory('all')}>All</button>
                    {availableCategories.map((cat) => (
                      <button key={cat} type="button" className={`sv-cat-pill${selectedCategory === cat ? ' is-active' : ''}`} onClick={() => setSelectedCategory(cat)}>{cat}</button>
                    ))}
                    {hasUncategorized && (
                      <button type="button" className={`sv-cat-pill${selectedCategory === 'uncategorized' ? ' is-active' : ''}`} onClick={() => setSelectedCategory('uncategorized')}>Other</button>
                    )}
                  </div>
                )}
              </div>

              <div className="sv-items">
                {productsLoading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}

                {!productsLoading && storeProducts.length === 0 && (
                  <div className="sv-empty">
                    <div className="sv-empty-icon">🛍️</div>
                    <strong>No items yet</strong>
                    <p>Products will appear here once the seller adds them.</p>
                  </div>
                )}

                {!productsLoading && storeProducts.length > 0 && filteredProducts.length === 0 && (
                  <div className="sv-empty">
                    <div className="sv-empty-icon">🔍</div>
                    <strong>No matches found</strong>
                    <p>Try a different search term or category.</p>
                  </div>
                )}

                {!productsLoading && filteredProducts.map((product) => {
                  const quantity = selectedProducts.get(product.id) || 0;
                  const isSelected = quantity > 0;
                  const catData = catalogue ? getCatalogueData(product, store.catalogueId) : null;
                  const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;
                  const priceUnit = catalogue && catData ? catData[catalogue.priceUnitField] : undefined;
                  const qStep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
                  const lineTotal = price * quantity;
                  const calcDetail = quantity > 0 ? formatCalc(quantity, price, priceUnit, currencySymbol) : null;

                  return (
                    <div key={product.id} className={`sv-card${isSelected ? ' is-selected' : ''}`}>
                      <div className="sv-card-img-wrap" onClick={() => setDrawerProduct(product)}>
                        {isPublicUrl(product.image || product.imageUrl)
                          ? <img src={String(product.image || product.imageUrl)} alt={product.name} className="sv-card-img" />
                          : <div className="sv-card-img-ph"><ImgPhIcon /></div>}
                        {isSelected && <div className="sv-added-badge">✓ Added</div>}
                      </div>

                      <div className="sv-card-body">
                        <div className="sv-card-name">{product.name}</div>
                        {product.subtitle && <div className="sv-card-sub">({product.subtitle})</div>}
                        {price > 0 && (
                          <div className="sv-card-price">
                            {formatMoney(price, currencySymbol)}
                            {priceUnit && <span className="sv-card-price-unit">/ {getOrderUnitLabel(priceUnit)}</span>}
                          </div>
                        )}

                        <div className="sv-card-actions">
                          <QtyControl value={quantity} step={qStep} onChange={(d) => changeQty(product.id, d, qStep)} />
                          <button type="button" className="sv-details-btn" onClick={() => setDrawerProduct(product)}>Details ›</button>
                        </div>

                        {qStep > 1 && (
                          <div className="sv-pack-hint">
                            <PackIcon /> Pack of {qStep}
                          </div>
                        )}

                        {isSelected && (
                          <div className="sv-subtotal">
                            {calcDetail && <span className="sv-subtotal-calc">{calcDetail}</span>}
                            <span className="sv-subtotal-val">{formatMoney(lineTotal, currencySymbol)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sv-footer">
                <p className="sv-footer-text">Add the items you want, then tap Continue to proceed with your order.</p>
              </div>
            </>
          )}

          {/* ── Customer step ── */}
          {step === 'customer' && (
            <>
              <div className="sv-section-head"><h2>Your details</h2></div>
              <div style={{ height: 12 }} />
              <div className="sv-form-section">
                <div className="sv-form-card">
                  <div className="sv-field">
                    <label>Your Name *</label>
                    <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter your full name" autoFocus />
                  </div>
                  <div className="sv-field">
                    <label>WhatsApp Number</label>
                    <input type="text" value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} placeholder="+91 98xxxxxxxx" />
                  </div>
                  <div className="sv-order-summary-box">
                    <div>
                      <div className="sv-order-summary-label">Order summary</div>
                      <div className="sv-order-summary-detail">{selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected</div>
                    </div>
                    <div className="sv-order-summary-total">{formatMoney(orderSummary.total, currencySymbol)}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Review step ── */}
          {step === 'review' && (
            <>
              <div className="sv-section-head"><h2>Review order</h2></div>
              <div style={{ height: 12 }} />
              <div className="sv-review-items">
                {orderSummary.items.map((item: any) => {
                  const calcDetail = formatCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol);
                  return (
                    <div key={item.productId} className="sv-card is-selected">
                      <div className="sv-card-img-wrap">
                        {isPublicUrl(item.imageUrl)
                          ? <img src={item.imageUrl} alt={item.name} className="sv-card-img" />
                          : <div className="sv-card-img-ph"><ImgPhIcon /></div>}
                      </div>
                      <div className="sv-card-body">
                        <div className="sv-card-name">{item.name}</div>
                        {item.subtitle && <div className="sv-card-sub">({item.subtitle})</div>}
                        {item.unitPrice > 0 && (
                          <div className="sv-card-price">
                            {formatMoney(item.unitPrice, currencySymbol)}
                            {item.priceUnit && <span className="sv-card-price-unit">/ {getOrderUnitLabel(item.priceUnit)}</span>}
                          </div>
                        )}
                        <div className="sv-subtotal" style={{ marginTop: 12 }}>
                          {calcDetail && <span className="sv-subtotal-calc">{calcDetail}</span>}
                          <span className="sv-subtotal-val">{formatMoney(item.rowTotal, currencySymbol)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sv-review-info-card">
                <div className="sv-review-info-label">Customer details</div>
                <div className="sv-review-name">{customerName}</div>
                {customerWhatsapp && <div className="sv-review-phone">{customerWhatsapp}</div>}
              </div>

              <div className="sv-review-total-bar">
                <div>
                  <div className="sv-review-total-label">Total amount</div>
                  <div className="sv-review-total-val">{formatMoney(orderSummary.total, currencySymbol)}</div>
                </div>
                <button type="button" className="sv-edit-items-btn" onClick={() => setStep('products')}>Edit items</button>
              </div>
            </>
          )}
        </div>

        {/* ── Floating cart bar ── */}
        {step === 'products' && selectedProductCount > 0 && (
          <div className="sv-cart-bar">
            <div className="sv-cart-inner" onClick={handlePrimaryAction}>
              <div className="sv-cart-left">
                <span className="sv-cart-count">{selectedProductCount} item{selectedProductCount === 1 ? '' : 's'}</span>
                <span className="sv-cart-total">{formatMoney(orderSummary.total, currencySymbol)}</span>
              </div>
              <button type="button" className="sv-cart-btn">Continue →</button>
            </div>
          </div>
        )}

        {(step === 'customer' || step === 'review') && (
          <div className="sv-cart-bar">
            <div className="sv-cart-inner">
              <div className="sv-cart-left">
                <span className="sv-cart-count">{selectedProductCount} item{selectedProductCount === 1 ? '' : 's'}</span>
                <span className="sv-cart-total">{formatMoney(orderSummary.total, currencySymbol)}</span>
              </div>
              <button type="button" className="sv-cart-btn" onClick={handlePrimaryAction} disabled={primaryButtonDisabled}>{primaryButtonLabel}</button>
            </div>
          </div>
        )}

        {/* ── Product detail drawer ── */}
        {drawerProduct && (() => {
          const catData = catalogue ? getCatalogueData(drawerProduct, store.catalogueId) : null;
          const price = catalogue && catData ? parseFloat(catData[catalogue.priceField] || '0') || 0 : 0;
          const priceUnit = catalogue && catData ? catData[catalogue.priceUnitField] : undefined;
          const qStep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
          const quantity = selectedProducts.get(drawerProduct.id) || 0;
          const lineTotal = price * quantity;
          const calcDetail = quantity > 0 ? formatCalc(quantity, price, priceUnit, currencySymbol) : null;
          const fields = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const value = (drawerProduct as Record<string, unknown>)[`field${n}`];
            if (value == null || String(value).trim() === '') return null;
            const { label, unitSuffix } = getFieldLabelUnit(drawerProduct, n);
            return { label, value: unitSuffix ? `${String(value)} ${unitSuffix}` : String(value) };
          }).filter(Boolean) as Array<{ label: string; value: string }>;

          return (
            <div ref={overlayRef} className="sv-overlay" onClick={(e) => { if (e.target === overlayRef.current) setDrawerProduct(null); }}>
              <div className="sv-drawer">
                <div className="sv-drawer-handle" />
                <div className="sv-drawer-img-wrap">
                  {isPublicUrl(drawerProduct.image || drawerProduct.imageUrl)
                    ? <img src={String(drawerProduct.image || drawerProduct.imageUrl)} alt={drawerProduct.name} className="sv-drawer-img" />
                    : <div className="sv-drawer-img-ph"><ImgPhIcon size={48} /></div>}
                  <button type="button" className="sv-drawer-close" onClick={() => setDrawerProduct(null)}>✕</button>
                </div>

                <div className="sv-drawer-body">
                  <div className="sv-drawer-name">{drawerProduct.name}</div>
                  {drawerProduct.subtitle && <div className="sv-drawer-subtitle">({drawerProduct.subtitle})</div>}

                  {getCategories(drawerProduct).length > 0 && (
                    <div className="sv-drawer-cat-row">
                      {getCategories(drawerProduct).map((cat) => (
                        <span key={cat} className="sv-drawer-cat-pill">{cat}</span>
                      ))}
                    </div>
                  )}

                  {price > 0 && (
                    <div className="sv-drawer-price">
                      {formatMoney(price, currencySymbol)}
                      {priceUnit && <span>/ {getOrderUnitLabel(priceUnit)}</span>}
                    </div>
                  )}

                  {fields.length > 0 && (
                    <div className="sv-detail-table">
                      {fields.map((f) => (
                        <div key={`${f.label}-${f.value}`} className="sv-detail-row">
                          <span className="sv-detail-label">{f.label}</span>
                          <span className="sv-detail-val">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="sv-drawer-qty-section">
                    <div className="sv-drawer-qty-label">Quantity</div>
                    <div className="sv-drawer-qty-row">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <QtyControl value={quantity} step={qStep} onChange={(d) => changeQty(drawerProduct.id, d, qStep)} />
                        {qStep > 1 && (
                          <div className="sv-pack-hint"><PackIcon /> Pack of {qStep}</div>
                        )}
                      </div>
                      <div className="sv-drawer-total-wrap">
                        {calcDetail && <div className="sv-drawer-calc">{calcDetail}</div>}
                        <div className="sv-drawer-total">{formatMoney(lineTotal, currencySymbol)}</div>
                      </div>
                    </div>
                    <button type="button" className="sv-drawer-done" onClick={() => setDrawerProduct(null)}>Done</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}