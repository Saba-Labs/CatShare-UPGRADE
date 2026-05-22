import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useState, useMemo, useRef } from 'react';
import {
  getSellerStore,
  createStore,
  updateStoreSlug,
  updateStoreCatalogue,
  updateStoreViewMode,
  updateStoreLiveStatus,
  updateStoreWhatsapp,
  updateStoreMinimumOrderValue,
  normalizeStoreWhatsappInput,
  normalizeStoreMinimumOrderValueInput,
  deleteStore,
  validateStoreSlug,
  type Store,
} from '../services/storeService';
import { getAllCatalogues } from '../config/catalogueConfig';
import { buildStorefrontUrl, getStorefrontRootHost } from '../utils/storefrontDomain';
import { syncUserSettings } from '../services/supabaseSync';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import { uploadProductImageToR2 } from '../services/r2Upload';
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from '../utils/safeStorage';
import { isBrowserOnline } from '../utils/cloudWritePolicy';
import {
  type BusinessProfile,
  EMPTY_BUSINESS_PROFILE,
  businessProfileFromUserSettings,
} from '../config/businessProfile';
import MainAppBottomNav from '../components/MainAppBottomNav';
import {
  hasSellerStoreRowFetched,
  invalidateSellerStoreSessionFetch,
  markSellerStoreRowFetched,
} from '../utils/catalogueSessionHydration';
import { Capacitor } from '@capacitor/core';
import HomepageBuilder from '../components/HomepageBuilder/HomepageBuilder';

const BUSINESS_LOGO_PRODUCT_ID = 'business-logo';
const STORE_FETCH_TIMEOUT_MS = 14_000;
const sellerStoreCacheKey = (uid: string) => getStorageKey('sellerStore', uid);

/* ─── Icons ─────────────────────────────────────────────── */
const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);
const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const IconX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const IconStore = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M3 9l1-5h16l1 5" />
    <path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0" />
    <path d="M5 9v11h14V9" />
    <path d="M10 14h4v6H10z" />
  </svg>
);
const IconExternalLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

/* ─── CSS ─── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  /* Scoped reset; :where() keeps specificity 0 so Tailwind on MainAppBottomNav (py-2.5 etc.) still applies. */
  :where(.store-root) *,
  :where(.store-root) *::before,
  :where(.store-root) *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:rgb(224, 238, 243);
    --card: #FFFFFF;
    --border: #E2E8F0;
    --border-focus: #2563EB;
    --text-primary: #0F172A;
    --text-secondary: #64748B;
    --text-muted: #94A3B8;
    --accent: #2563EB;
    --accent-hover: #1D4ED8;
    --green: #1A7A4A;
    --green-bg: #F0FAF5;
    --green-border: #C3E8D5;
    --green-dot: #34C97A;
    --red: #C0392B;
    --red-bg: #FDF4F3;
    --red-border: #F5C6C2;
    --amber: #92641A;
    --amber-bg: #FDF8EE;
    --shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04);
    --shadow-lg: 0 8px 28px rgba(15,23,42,0.12);
    --radius: 16px;
    --radius-sm: 10px;
    --radius-xs: 8px;
    --font: 'DM Sans', system-ui, sans-serif;
    --mono: 'DM Mono', 'Menlo', monospace;
  }

  /* Do not set body font-family — it leaked to fixed UI outside .store-root (offline banner). DM Sans stays on .store-root */
  body { background: var(--bg); -webkit-font-smoothing: antialiased; }

  .store-root {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--bg);
    font-family: var(--font);
  }

  .status-bar {
    position: fixed;
    inset: 0 0 auto 0;
    height: 40px;
    background: #0F172A;
    z-index: 60;
  }

  /* ── Header ── */
  .header {
    position: sticky;
    top: 40px;
    z-index: 50;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    border-bottom: 1px solid var(--border);
  }
  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
  }
  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 8px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1px;
    transition: all 0.2s;
  }
  .live-pill.on {
    background: var(--green-bg);
    color: var(--green);
    border: 1px solid var(--green-border);
  }
  .live-pill.off {
    background: #F5F3F0;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.7;
  }
  .live-pill.on .live-dot {
    background: var(--green-dot);
    opacity: 1;
    animation: pulse-green 2s ease-in-out infinite;
  }
  @keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52,201,122,0.4); }
    50% { box-shadow: 0 0 0 3px rgba(52,201,122,0.1); }
  }

  /* ── Main ── */
  .main {
    flex: 1;
    padding: 16px 16px 100px;
    margin-top: 40px;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }

  /* ── Store URL banner ── */
  .url-banner {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    margin-bottom: 10px;
    box-shadow: var(--shadow);
  }
  .url-banner-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 0;
  }
  .url-banner-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .url-banner-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .url-text {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .url-text svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }
  .url-text:hover { color: var(--accent); }
  .url-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    margin-left: auto;
  }
  @media (max-width: 380px) {
    .url-text { font-size: 11px; }
  }
  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border);
    background: #F7F5F2;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .icon-btn:hover {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    transform: scale(1.04);
  }
  .icon-btn:active { transform: scale(0.97); }

  /* ── Toggle card ── */
  .toggle-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    box-shadow: var(--shadow);
    transition: border-color 0.2s, background 0.2s;
  }
  .toggle-card.on {
    border-color: var(--green-border);
    background: var(--green-bg);
  }
  .toggle-label-group {}
  .toggle-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }
  .toggle-sub {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .toggle-card.on .toggle-sub { color: var(--green); }

  /* iOS-style switch */
  .switch { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .slider {
    position: absolute; inset: 0;
    background: #D6D0CA;
    border-radius: 26px;
    cursor: pointer;
    transition: background 0.22s;
  }
  .slider::before {
    content: '';
    position: absolute;
    width: 20px; height: 20px;
    left: 3px; top: 3px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    transition: transform 0.22s cubic-bezier(.34,1.56,.64,1);
  }
  input:checked + .slider { background: var(--green-dot); }
  input:checked + .slider::before { transform: translateX(22px); }
  .switch.pending .slider { cursor: wait; opacity: 0.7; }

  /* ── Info cards ── */
  .cards-group {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .info-row {
    padding: 14px 16px;
    position: relative;
  }
  .info-row + .info-row {
    border-top: 1px solid var(--border);
  }
  .info-row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .field-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .edit-trigger {
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.15s;
    margin: -6px -6px -6px 0;
    outline: none;
    box-shadow: none;
  }
  .edit-icon-swap {
    position: relative;
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .edit-icon-swap .icon-layer {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: opacity 280ms ease, transform 480ms cubic-bezier(.22,1.4,.36,1);
    transform-origin: 50% 55%;
    will-change: transform, opacity;
  }
  .edit-icon-swap .icon-edit {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  .edit-icon-swap .icon-check {
    opacity: 0;
    transform: scale(0.35) rotate(-135deg);
  }
  .edit-trigger.active .edit-icon-swap .icon-edit {
    opacity: 0;
    transform: scale(0.35) rotate(135deg);
  }
  .edit-trigger.active .edit-icon-swap .icon-check {
    opacity: 1;
    transform: scale(1.12) rotate(0deg);
  }
  .edit-trigger:active .edit-icon-swap .icon-layer {
    transform: scale(0.86);
  }
  .edit-trigger.active .edit-icon-swap .icon-check {
    animation: check-pop 520ms cubic-bezier(.16,1.4,.3,1);
  }
  .edit-trigger:not(.active) .edit-icon-swap .icon-edit {
    animation: pencil-pop 520ms cubic-bezier(.16,1.4,.3,1);
  }
  @keyframes check-pop {
    0% { transform: scale(0.28) rotate(-150deg); }
    55% { transform: scale(1.24) rotate(8deg); }
    100% { transform: scale(1.12) rotate(0deg); }
  }
  @keyframes pencil-pop {
    0% { transform: scale(0.28) rotate(150deg); }
    55% { transform: scale(1.24) rotate(-8deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  .edit-trigger:hover {
    background: #F0EDE9;
    color: var(--text-primary);
  }
  .edit-trigger.active {
    background: transparent;
    color: var(--accent);
  }
  .edit-trigger.active:hover {
    background: transparent;
    color: var(--accent);
  }
  .edit-trigger:focus,
  .edit-trigger:focus-visible {
    outline: none;
    box-shadow: none;
  }
  .field-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .field-value.mono { font-family: var(--mono); font-size: 13.5px; }
  .field-value.muted { color: var(--text-muted); font-weight: 400; }

  /* Inline edit */
  .edit-area { padding-top: 2px; }
  .inline-input-wrap {
    position: relative;
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }
  .inline-input-wrap::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 1.5px;
    background: var(--border-focus);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.2s ease;
  }
  .inline-input-wrap:focus-within::after { transform: scaleX(1); }
  .inline-input-wrap.has-error::after { background: var(--red); transform: scaleX(1); }
  .inline-input {
    width: 100%;
    padding: 4px 0 6px;
    border: none !important;
    background: transparent !important;
    font-size: 14px;
    font-weight: 500;
    font-family: var(--font);
    color: var(--text-primary) !important;
    outline: none !important;
    box-shadow: none !important;
    appearance: none;
    -webkit-appearance: none;
  }
  .inline-input::-webkit-outer-spin-button,
  .inline-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .inline-input[type=number] { -moz-appearance: textfield; }
  .inline-input.mono { font-family: var(--mono); font-size: 13.5px; }
  .inline-input::placeholder { color: var(--text-muted); font-weight: 400; }
  .inline-input:-webkit-autofill {
    -webkit-text-fill-color: var(--text-primary);
    -webkit-box-shadow: 0 0 0px 1000px transparent inset;
  }
  .error-msg {
    font-size: 12px;
    color: var(--red);
    margin-top: 6px;
  }

  /* Select inside edit */
  .inline-select-wrap {
    position: relative;
    border-bottom: 1.5px solid var(--border);
    padding-right: 22px;
  }
  .inline-select-wrap.open {
    border-bottom-color: var(--border-focus);
  }
  .inline-select-wrap svg {
    position: absolute;
    right: 0; top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--text-muted);
    width: 16px;
    height: 16px;
  }
  .inline-select {
    width: 100%;
    padding: 4px 0 6px;
    border: none !important;
    border-radius: 0;
    background: transparent !important;
    font-size: 14px;
    font-weight: 500;
    font-family: var(--font);
    color: var(--text-primary) !important;
    outline: none !important;
    box-shadow: none !important;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    cursor: pointer;
    text-align: left;
  }
  .inline-select-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    max-height: 220px;
    overflow-y: auto;
    z-index: 40;
    padding: 4px;
  }
  .inline-select-option {
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 10px 11px;
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font);
    cursor: pointer;
  }
  .inline-select-option:hover {
    background: #F1F5F9;
  }
  .inline-select-option.active {
    background: #EFF6FF;
    color: #1D4ED8;
    font-weight: 600;
  }

  /* Slug suggestions */
  .sug-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .sug-chip {
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: #F7F5F2;
    font-size: 12px;
    font-weight: 500;
    font-family: var(--mono);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }
  .sug-chip:hover {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }

  /* ── Create form ── */
  .create-hero {
    text-align: center;
    padding: 32px 8px 28px;
  }
  .create-icon-wrap {
    width: 72px; height: 72px;
    background: var(--accent);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 18px;
    color: white;
  }
  .create-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.4px;
    margin-bottom: 8px;
  }
  .create-sub {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.55;
    max-width: 280px;
    margin: 0 auto;
  }

  .form-field { margin-bottom: 16px; }
  .form-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-family: var(--font);
    margin-bottom: 8px;
  }
  .form-label em { color: var(--red); font-style: normal; }

  .slug-field-wrap {
    display: flex;
    align-items: stretch;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--card);
    transition: border-color 0.15s;
  }
  .slug-field-wrap:focus-within { border-color: var(--accent); }
  .slug-field-wrap.err { border-color: var(--red); }
  .slug-prefix-text {
    padding: 11px 10px 11px 13px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-muted);
    background: #F7F5F2;
    border-right: 1.5px solid var(--border);
    white-space: nowrap;
    display: flex;
    align-items: center;
  }
  .slug-text-input {
    flex: 1;
    padding: 11px 13px;
    border: none;
    outline: none;
    font-size: 14px;
    font-family: var(--font);
    background: transparent;
    color: var(--text-primary);
    min-width: 0;
  }
  .slug-text-input::placeholder { color: var(--text-muted); }

  .select-field-wrap {
    position: relative;
  }
  .select-field-wrap svg {
    position: absolute;
    right: 12px; top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--text-muted);
  }
  .form-select {
    width: 100%;
    padding: 11px 38px 11px 13px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font);
    background: var(--card);
    color: var(--text-primary);
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .form-select:focus { border-color: var(--accent); }
  .form-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 5px;
    line-height: 1.45;
  }

  .submit-btn {
    width: 100%;
    padding: 14px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--accent);
    color: white;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font);
    letter-spacing: -0.1px;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .submit-btn:not(:disabled):hover { background: var(--accent-hover); }
  .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── Delete zone ── */
  .delete-zone { margin-top: 4px; }
  .delete-trigger {
    width: 100%;
    padding: 13px;
    border-radius: var(--radius);
    border: 1px solid var(--red-border);
    background: var(--red-bg);
    color: var(--red);
    font-size: 13.5px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: all 0.15s;
    box-shadow: var(--shadow);
  }
  .delete-trigger:hover {
    background: #FBE8E6;
    border-color: #EEA8A1;
    color: #A93226;
  }
  .confirm-box {
    background: var(--red-bg);
    border: 1px solid var(--red-border);
    border-radius: var(--radius);
    padding: 18px;
    box-shadow: var(--shadow);
  }
  .confirm-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--red);
    margin-bottom: 6px;
  }
  .confirm-body {
    font-size: 13px;
    color: #8B2E2E;
    margin-bottom: 14px;
    line-height: 1.5;
  }
  .confirm-btns { display: flex; gap: 8px; }

  /* ── Editor zone ── */
  .editor-zone { margin-top: 4px; }
  .editor-trigger {
    width: 100%;
    padding: 13px;
    border-radius: var(--radius);
    border: 1px solid #D0D7E2;
    background: #F8F9FB;
    color: #0F172A;
    font-size: 13.5px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: all 0.15s;
    box-shadow: var(--shadow);
  }
  .editor-trigger:hover {
    background: #EEF2F8;
    border-color: #B5BFD0;
    color: #0a0e1f;
  }
  .confirm-yes {
    flex: 1;
    padding: 11px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--red);
    color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .confirm-yes:disabled { opacity: 0.55; cursor: not-allowed; }
  .confirm-no {
    flex: 1;
    padding: 11px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--red-border);
    background: white;
    color: var(--red);
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font);
    cursor: pointer;
    transition: background 0.15s;
  }
  .confirm-no:hover { background: #FEF0EE; }

  /* ── Loader ── */
  .loader { display: flex; justify-content: center; align-items: center; height: 200px; }
  .spinner {
    width: 26px; height: 26px;
    border-radius: 50%;
    border: 2.5px solid var(--border);
    border-top-color: var(--text-primary);
    animation: spin 0.65s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Divider between card groups ── */
  .gap { margin-bottom: 10px; }
  .business-card {
    background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 72%);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px 16px;
    margin-bottom: 10px;
    box-shadow: var(--shadow);
  }
  .business-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  .business-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.1px;
    color: var(--text-primary);
  }
  .business-sub {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
  }
  .business-chevron {
    width: 18px;
    height: 18px;
    color: var(--text-secondary);
    transition: transform .2s ease;
    flex-shrink: 0;
  }
  .business-chevron.open { transform: rotate(180deg); }
  .business-body {
    margin-top: 10px;
  }
  .business-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .business-logo-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .business-logo-preview {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    border: 1px dashed var(--border);
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .business-logo-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .business-logo-empty {
    font-size: 10px;
    color: var(--text-muted);
  }
  .business-logo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .business-chip-btn {
    height: 30px;
    padding: 0 11px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
  }
  .business-chip-btn.primary {
    background: #0F172A;
    border-color: #0F172A;
    color: #fff;
  }
  .business-chip-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .business-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .business-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.55px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .business-input,
  .business-textarea {
    width: 100%;
    border: 0 !important;
    border-bottom: 1px solid var(--border) !important;
    border-radius: 0 !important;
    background: transparent !important;
    color: var(--text-primary);
    font-family: var(--font);
    outline: none !important;
    padding: 5px 0 7px;
    transition: border-color .18s ease;
    box-shadow: none !important;
    appearance: none;
    -webkit-appearance: none;
  }
  .business-input {
    font-size: 14px;
    font-weight: 500;
  }
  .business-textarea {
    font-size: 13.5px;
    resize: vertical;
    min-height: 58px;
  }
  .business-input::placeholder,
  .business-textarea::placeholder {
    color: var(--text-muted);
  }
  .business-input:focus,
  .business-input:focus-visible,
  .business-textarea:focus {
    border-bottom-color: var(--accent);
    outline: none !important;
    box-shadow: none !important;
  }
  .business-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }
  .business-save {
    height: 34px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid #1E293B;
    background: #0F172A;
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: opacity .15s ease, transform .12s ease;
  }
  .business-save:hover { opacity: 0.94; }
  .business-save:active { transform: translateY(1px); }
  .business-save:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

export default function StorePage() {
  const navigate = useNavigate();
  const { user, supabaseData, refreshSupabaseData } = useAuth();
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingField, setEditingField] = useState<'slug' | 'catalogue' | 'view' | 'whatsapp' | 'minimumOrder' | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [liveTogglePending, setLiveTogglePending] = useState(false);

  const [formSlug, setFormSlug] = useState('');
  const [formCatalogue, setFormCatalogue] = useState('');
  const [formViewMode, setFormViewMode] = useState<'grid' | 'list'>('grid');
  const [slugError, setSlugError] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formMinimumOrder, setFormMinimumOrder] = useState('');
  const [catalogueMenuOpen, setCatalogueMenuOpen] = useState(false);
  const catalogueMenuRef = useRef<HTMLDivElement | null>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [showHomepageBuilder, setShowHomepageBuilder] = useState(false);

  const catalogues = useMemo(() => getAllCatalogues(user?.uid), [user?.uid]);

  const applyStoreState = (nextStore: Store) => {
    setStore(nextStore);
    setFormWhatsapp(nextStore.storeWhatsapp || '');
    setFormMinimumOrder(nextStore.minimumOrderValue != null ? String(nextStore.minimumOrderValue) : '');
    setFormViewMode(nextStore.viewMode === 'list' ? 'list' : 'grid');
    setShowCreateForm(false);
    setIsLive(nextStore.isLive);
  };

  useEffect(() => {
    if (!user?.uid || user.uid.trim() === '' || user.isAnonymous) return;
    const cacheKey = sellerStoreCacheKey(user.uid);
    if (store) {
      safeSetInStorage(cacheKey, store);
    }
  }, [store, user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.uid.trim() === '' || user.isAnonymous) return;
    const cached = safeGetFromStorage<Store | null>(sellerStoreCacheKey(user.uid), null);
    if (!cached) return;
    applyStoreState(cached);
    setLoading(false);
  }, [user?.uid, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid || user.uid.trim() === '') return;
    if (user.isAnonymous) {
      setLoading(false);
      setStore(null);
      setShowCreateForm(true);
      return;
    }

    let cancelled = false;
    const uid = user.uid;
    const load = async () => {
      const cacheKey = sellerStoreCacheKey(uid);
      if (hasSellerStoreRowFetched(uid)) {
        const cachedSkip = safeGetFromStorage<Store | null>(cacheKey, null);
        if (cachedSkip) {
          applyStoreState(cachedSkip);
          setLoading(false);
          return;
        }
      }

      const cached = safeGetFromStorage<Store | null>(cacheKey, null);
      if (!cached) {
        setLoading(true);
      }

      type StoreResult = Awaited<ReturnType<typeof getSellerStore>>;
      const result = await Promise.race<StoreResult>([
        getSellerStore(uid),
        new Promise<StoreResult>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Store fetch timed out' }), STORE_FETCH_TIMEOUT_MS)
        ),
      ]);

      if (cancelled) return;

      if (result.success && result.data) {
        applyStoreState(result.data);
        safeSetInStorage(cacheKey, result.data);
        markSellerStoreRowFetched(uid);
      } else {
        const fallback = cached ?? safeGetFromStorage<Store | null>(cacheKey, null);
        if (fallback) {
          applyStoreState(fallback);
          markSellerStoreRowFetched(uid);
          showToast(
            isBrowserOnline() ? 'Could not refresh store. Showing saved settings.' : 'Showing saved store settings',
            'info'
          );
        } else {
          setStore(null);
          setShowCreateForm(true);
        }
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.isAnonymous, showToast]);

  useEffect(() => {
    if (editingField !== 'catalogue') setCatalogueMenuOpen(false);
    if (editingField !== 'view') setViewMenuOpen(false);
  }, [editingField]);

  useEffect(() => {
    setBusinessProfile(businessProfileFromUserSettings(supabaseData?.userSettings));
  }, [supabaseData?.userSettings]);

  useEffect(() => {
    if (!catalogueMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!catalogueMenuRef.current) return;
      const target = event.target as Node;
      if (!catalogueMenuRef.current.contains(target)) setCatalogueMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCatalogueMenuOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [catalogueMenuOpen]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!viewMenuRef.current) return;
      const target = event.target as Node;
      if (!viewMenuRef.current.contains(target)) setViewMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewMenuOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [viewMenuOpen]);

  const validateAndSetSlug = (slug: string) => {
    setFormSlug(slug);
    const v = validateStoreSlug(slug);
    if (!v.valid) { setSlugError(v.error || ''); setSlugSuggestions([]); }
    else { setSlugError(''); setSlugSuggestions([]); }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    const v = validateStoreSlug(formSlug);
    if (!v.valid) { setSlugError(v.error || 'Check the link name and try again'); return; }
    if (!formCatalogue) { showToast('Please choose which products to show in your store', 'error'); return; }
    setIsSubmitting(true);
    const result = await createStore(user.uid, formSlug, formCatalogue);
    if (result.success && result.data) {
      setStore(result.data);
      setIsLive(result.data.isLive);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setFormMinimumOrder(result.data.minimumOrderValue != null ? String(result.data.minimumOrderValue) : '');
      setShowCreateForm(false);
      setFormSlug(''); setFormCatalogue('');
      try {
        safeSetInStorage(sellerStoreCacheKey(user.uid), result.data);
      } catch {
        /* ignore */
      }
      markSellerStoreRowFetched(user.uid);
      showToast('Store created!', 'success');
      // Save catalogues so public storefront can read correct price fields
      try {
        await syncUserSettings(user.uid, {
          data: { cataloguesDefinition: getAllCatalogues(user.uid) },
        });
      } catch { /* non-critical */ }
    } else {
      if (result.suggestedSlugs?.length) { setSlugError(result.error || 'That name is already taken'); setSlugSuggestions(result.suggestedSlugs); }
      else setSlugError(result.error || 'Failed to create store');
      showToast(result.error || 'Failed to create store', 'error');
    }
    setIsSubmitting(false);
  };

  const handleUpdateSlug = async (newSlug: string) => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    const v = validateStoreSlug(newSlug);
    if (!v.valid) { showToast(v.error || 'Check the link name and try again', 'error'); return; }
    setIsSubmitting(true);
    const result = await updateStoreSlug(user.uid, newSlug);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setFormMinimumOrder(result.data.minimumOrderValue != null ? String(result.data.minimumOrderValue) : '');
      setEditingField(null);
      showToast('Store link updated', 'success');
    } else {
      showToast(result.suggestedSlugs ? `${result.error} Try: ${result.suggestedSlugs.join(', ')}` : (result.error || 'Failed'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleUpdateCatalogue = async (catId: string) => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    setIsSubmitting(true);
    const result = await updateStoreCatalogue(user.uid, catId);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setFormMinimumOrder(result.data.minimumOrderValue != null ? String(result.data.minimumOrderValue) : '');
      setEditingField(null);
      showToast('Products list updated', 'success');
      // Save catalogues so public storefront can read correct price fields
      try {
        await syncUserSettings(user.uid, {
          data: { cataloguesDefinition: getAllCatalogues(user.uid) },
        });
      } catch { /* non-critical */ }
    } else showToast(result.error || 'Failed', 'error');
    setIsSubmitting(false);
  };

  const handleUpdateViewMode = async (nextViewMode: 'grid' | 'list') => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    setIsSubmitting(true);
    const result = await updateStoreViewMode(user.uid, nextViewMode);
    if (result.success && result.data) {
      setStore(result.data);
      setFormViewMode(result.data.viewMode === 'list' ? 'list' : 'grid');
      setEditingField(null);
      showToast(nextViewMode === 'grid' ? 'Store view set to Grid' : 'Store view set to List', 'success');
    } else {
      showToast(result.error || 'Failed', 'error');
    }
    setIsSubmitting(false);
  };

  const handleSaveWhatsapp = async () => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    const n = normalizeStoreWhatsappInput(formWhatsapp);
    if (n.ok === false) { showToast(n.error, 'error'); return; }
    setIsSubmitting(true);
    const result = await updateStoreWhatsapp(user.uid, n.value);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setEditingField(null);
      showToast(n.value ? 'WhatsApp updated' : 'WhatsApp removed', 'success');
    } else showToast(result.error || 'Failed to save', 'error');
    setIsSubmitting(false);
  };

  const handleSaveMinimumOrder = async () => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    const normalized = normalizeStoreMinimumOrderValueInput(formMinimumOrder);
    if (normalized.ok === false) { showToast(normalized.error, 'error'); return; }
    setIsSubmitting(true);
    const result = await updateStoreMinimumOrderValue(user.uid, normalized.value);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setFormMinimumOrder(result.data.minimumOrderValue != null ? String(result.data.minimumOrderValue) : '');
      setEditingField(null);
      showToast(normalized.value != null ? 'Minimum order updated' : 'Minimum order removed', 'success');
    } else showToast(result.error || 'Failed to save', 'error');
    setIsSubmitting(false);
  };

  const handleInlineSave = async () => {
    if (!editingField) return;
    if (editingField === 'slug') await handleUpdateSlug(formSlug);
    else if (editingField === 'catalogue') await handleUpdateCatalogue(formCatalogue);
    else if (editingField === 'view') await handleUpdateViewMode(formViewMode);
    else if (editingField === 'whatsapp') await handleSaveWhatsapp();
    else if (editingField === 'minimumOrder') await handleSaveMinimumOrder();
  };

  const handleLiveToggle = async () => {
    if (!user?.uid || liveTogglePending) return;
    if (!guardCloudWrite()) return;
    const prev = isLive;
    const next = !prev;
    setIsLive(next);
    setLiveTogglePending(true);
    const result = await updateStoreLiveStatus(user.uid, next);
    setLiveTogglePending(false);
    if (result.success && result.data) {
      setStore(result.data);
      setIsLive(result.data.isLive);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setFormMinimumOrder(result.data.minimumOrderValue != null ? String(result.data.minimumOrderValue) : '');
      showToast(next ? 'Store is now live' : 'Store paused', next ? 'success' : 'info');
    } else {
      setIsLive(prev);
      showToast(result.error || 'Could not update store status', 'error');
    }
  };

  const updateBusiness = (patch: Partial<BusinessProfile>) => {
    setBusinessProfile((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveBusinessProfile = async () => {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    setBusinessSaving(true);
    const result = await syncUserSettings(user.uid, {
      data: { businessProfile: { ...businessProfile } },
    });
    if (result.success) {
      try {
        localStorage.setItem('businessProfile', JSON.stringify(businessProfile));
      } catch {
        /* ignore local storage errors */
      }
      await refreshSupabaseData();
      const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
      if (strictOnline) {
        window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
      }
      showToast('Business profile saved', 'success');
    } else {
      showToast(result.error || 'Failed to save business profile', 'error');
    }
    setBusinessSaving(false);
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'error');
      return;
    }
    setLogoUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const { url } = await uploadProductImageToR2({
        productId: BUSINESS_LOGO_PRODUCT_ID,
        dataUrl,
      });
      updateBusiness({ logoUrl: url });
      showToast('Logo uploaded — tap Save business profile', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Logo upload failed';
      showToast(msg, 'error');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const storefrontRootHost = getStorefrontRootHost();
  const storeUrl = store ? buildStorefrontUrl(store.storeSlug) : '';
  const getCatName = (id: string) => catalogues.find(c => c.id === id)?.label || id;

  /* ── Helper: render a single info row ── */
  const renderInfoRow = (
    field: 'slug' | 'catalogue' | 'view' | 'whatsapp' | 'minimumOrder',
    label: string,
    displayValue: React.ReactNode,
    editContent: React.ReactNode,
    onEditStart: () => void,
  ) => {
    const isEditing = editingField === field;
    return (
      <div className="info-row">
        <div className="info-row-head">
          <span className="field-label">{label}</span>
          <button
            type="button"
            className={`edit-trigger${isEditing ? ' active' : ''}`}
            aria-label={isEditing ? `Save ${label}` : `Edit ${label}`}
            onClick={() => {
              if (isEditing) { void handleInlineSave(); return; }
              onEditStart();
            }}
          >
            <span className="edit-icon-swap" aria-hidden>
              <span className="icon-layer icon-edit"><IconEdit /></span>
              <span className="icon-layer icon-check"><IconCheck /></span>
            </span>
          </button>
        </div>
        {isEditing ? (
          <div className="edit-area">
            {editContent}
          </div>
        ) : displayValue}
      </div>
    );
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="store-root">
        <div className="status-bar" />

        <div className="header">
          <span className="header-title">My Store</span>
          {store && (
            <span className={`live-pill ${isLive ? 'on' : 'off'}`}>
              <span className="live-dot" />
              {isLive ? 'Live' : 'Offline'}
            </span>
          )}
        </div>

        <main className="main">
          {loading ? (
            <div className="loader"><div className="spinner" /></div>
          ) : !store ? (
            /* ── Create form ── */
            <div>
              <div className="create-hero">
                <div className="create-icon-wrap"><IconStore /></div>
                <h2 className="create-title">Set up your store</h2>
                <p className="create-sub">Share a simple link with customers so they can browse and order.</p>
              </div>

              <form onSubmit={handleCreateStore}>
                <div className="form-field">
                  <label className="form-label">Store link <em>*</em></label>
                  <div className={`slug-field-wrap${slugError ? ' err' : ''}`}>
                    <span className="slug-prefix-text">https://</span>
                    <input
                      type="text"
                      className="slug-text-input"
                      value={formSlug}
                      onChange={e => validateAndSetSlug(e.target.value)}
                      placeholder="my-bakery"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                  {slugError && <div className="error-msg">{slugError}</div>}
                  {slugSuggestions.length > 0 && (
                    <div className="sug-row">
                      {slugSuggestions.map(s => (
                        <button key={s} type="button" className="sug-chip" onClick={() => validateAndSetSlug(s)}>{s}</button>
                      ))}
                    </div>
                  )}
                  <div className="form-hint">
                    Only letters, numbers and hyphens. Your live link: https://{formSlug || 'your-store'}.{storefrontRootHost}
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">Products to show <em>*</em></label>
                  <div className="select-field-wrap">
                    <select className="form-select" value={formCatalogue} onChange={e => setFormCatalogue(e.target.value)}>
                      <option value="">— Choose a product list —</option>
                      {catalogues.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <IconChevron />
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSubmitting || !formSlug || !formCatalogue || !!slugError}
                >
                  {isSubmitting ? 'Creating…' : 'Create store →'}
                </button>
              </form>
            </div>
          ) : (
            /* ── Store details ── */
            <div>
              {/* URL banner */}
              <div className="url-banner gap">
                <div className="url-banner-head">
                  <div className="url-banner-label">Store link</div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Copy store link"
                    onClick={() => { navigator.clipboard.writeText(storeUrl); showToast('Link copied!', 'success'); }}
                  >
                    <IconCopy />
                  </button>
                </div>
                <div className="url-banner-row">
                  <a
                    className="url-text"
                    href={storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!Capacitor.isNativePlatform()) return;
                      e.preventDefault();
                      void import('@capacitor/browser').then(({ Browser }) =>
                        Browser.open({ url: storeUrl, toolbarColor: '#ffffff' })
                      );
                    }}
                  >
                    {storeUrl}
                    <IconExternalLink />
                  </a>
                </div>
              </div>

              {/* Live toggle */}
              <div className={`toggle-card gap ${isLive ? 'on' : ''}`}>
                <div className="toggle-label-group">
                  <div className="toggle-title">{isLive ? 'Store is live' : 'Store is offline'}</div>
                  <div className="toggle-sub">
                    {isLive ? 'Customers can browse and order' : 'Hidden from customers'}
                  </div>
                </div>
                <label className={`switch${liveTogglePending ? ' pending' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isLive}
                    disabled={liveTogglePending}
                    onChange={() => void handleLiveToggle()}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* Info fields */}
              <div className="cards-group gap">
                {/* Link name */}
                {renderInfoRow(
                  'slug',
                  'Link name',
                  <div className="field-value mono">{store.storeSlug}</div>,
                  <>
                    <div className={`inline-input-wrap${slugError ? ' has-error' : ''}`}>
                      <input
                        type="text"
                        className="inline-input mono"
                        value={formSlug}
                        autoFocus
                        autoCapitalize="none"
                        autoCorrect="off"
                        onChange={e => validateAndSetSlug(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleInlineSave(); } }}
                      />
                    </div>
                    {slugError && <div className="error-msg">{slugError}</div>}
                    {slugSuggestions.length > 0 && (
                      <div className="sug-row">
                        {slugSuggestions.map(s => (
                          <button key={s} type="button" className="sug-chip" onClick={() => validateAndSetSlug(s)}>{s}</button>
                        ))}
                      </div>
                    )}
                  </>,
                  () => { setEditingField('slug'); setFormSlug(store.storeSlug); setSlugError(''); },
                )}

                {/* Products */}
                {renderInfoRow(
                  'catalogue',
                  'Products shown',
                  <div className="field-value">{getCatName(store.catalogueId)}</div>,
                  <div className={`inline-select-wrap${catalogueMenuOpen ? ' open' : ''}`} ref={catalogueMenuRef}>
                    <button
                      type="button"
                      className="inline-select"
                      onClick={() => setCatalogueMenuOpen(v => !v)}
                    >
                      {getCatName(formCatalogue)}
                    </button>
                    <IconChevron />
                    {catalogueMenuOpen && (
                      <div className="inline-select-menu">
                        {catalogues.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={`inline-select-option${formCatalogue === c.id ? ' active' : ''}`}
                            onClick={() => {
                              setFormCatalogue(c.id);
                              setCatalogueMenuOpen(false);
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>,
                  () => { setEditingField('catalogue'); setFormCatalogue(store.catalogueId); },
                )}

                {/* View mode */}
                {renderInfoRow(
                  'view',
                  'View',
                  <div className="field-value">{store.viewMode === 'list' ? 'List' : 'Grid'}</div>,
                  <div className={`inline-select-wrap${viewMenuOpen ? ' open' : ''}`} ref={viewMenuRef}>
                    <button
                      type="button"
                      className="inline-select"
                      onClick={() => setViewMenuOpen((v) => !v)}
                    >
                      {formViewMode === 'list' ? 'List' : 'Grid'}
                    </button>
                    <IconChevron />
                    {viewMenuOpen && (
                      <div className="inline-select-menu">
                        <button
                          type="button"
                          className={`inline-select-option${formViewMode === 'grid' ? ' active' : ''}`}
                          onClick={() => {
                            setFormViewMode('grid');
                            setViewMenuOpen(false);
                          }}
                        >
                          Grid
                        </button>
                        <button
                          type="button"
                          className={`inline-select-option${formViewMode === 'list' ? ' active' : ''}`}
                          onClick={() => {
                            setFormViewMode('list');
                            setViewMenuOpen(false);
                          }}
                        >
                          List
                        </button>
                      </div>
                    )}
                  </div>,
                  () => {
                    setEditingField('view');
                    setFormViewMode(store.viewMode === 'list' ? 'list' : 'grid');
                  },
                )}

                {/* WhatsApp */}
                {renderInfoRow(
                  'whatsapp',
                  'WhatsApp for customers',
                  <div className={`field-value${store.storeWhatsapp ? '' : ' muted'}`}>
                    {store.storeWhatsapp || 'Not set'}
                  </div>,
                  <div className="inline-input-wrap">
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="inline-input"
                      placeholder="+91 98xxxxxxxx"
                      value={formWhatsapp}
                      autoFocus
                      onChange={e => setFormWhatsapp(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleInlineSave(); } }}
                    />
                  </div>,
                  () => { setEditingField('whatsapp'); setFormWhatsapp(store.storeWhatsapp || ''); },
                )}

                {/* Minimum order */}
                {renderInfoRow(
                  'minimumOrder',
                  'Minimum order value',
                  <div className={`field-value${store.minimumOrderValue != null ? '' : ' muted'}`}>
                    {store.minimumOrderValue != null ? `₹${store.minimumOrderValue}` : 'Not set'}
                  </div>,
                  <div className="inline-input-wrap">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="inline-input"
                      placeholder="e.g. 500"
                      value={formMinimumOrder}
                      autoFocus
                      onChange={e => setFormMinimumOrder(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleInlineSave(); } }}
                    />
                  </div>,
                  () => {
                    setEditingField('minimumOrder');
                    setFormMinimumOrder(store.minimumOrderValue != null ? String(store.minimumOrderValue) : '');
                  },
                )}
              </div>

              <div className="business-card">
                <button
                  type="button"
                  className="business-head"
                  onClick={() => setBusinessProfileOpen((v) => !v)}
                  aria-expanded={businessProfileOpen}
                >
                  <div>
                    <div className="business-title">Business profile</div>
                    <div className="business-sub">Shown in store footer, links and shared content</div>
                  </div>
                  <span className={`business-chevron${businessProfileOpen ? ' open' : ''}`}>
                    <IconChevron />
                  </span>
                </button>
                {businessProfileOpen && (
                <div className="business-body">
                <div className="business-grid">
                  <div className="business-field">
                    <label className="business-label">Logo</label>
                    <div className="business-logo-row">
                      <div className="business-logo-preview">
                        {businessProfile.logoUrl ? (
                          <img src={businessProfile.logoUrl} alt="" />
                        ) : (
                          <span className="business-logo-empty">No logo</span>
                        )}
                      </div>
                      <div className="business-logo-actions">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFile}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="business-chip-btn primary"
                          disabled={logoUploading || businessSaving || isSubmitting}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          {logoUploading ? 'Uploading…' : 'Upload'}
                        </button>
                        {businessProfile.logoUrl ? (
                          <button
                            type="button"
                            className="business-chip-btn"
                            disabled={logoUploading || businessSaving || isSubmitting}
                            onClick={() => updateBusiness({ logoUrl: '' })}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="business-field">
                    <label className="business-label">Business name</label>
                    <input
                      className="business-input"
                      type="text"
                      value={businessProfile.businessName || ''}
                      onChange={(e) => updateBusiness({ businessName: e.target.value })}
                      placeholder="Your business name"
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Address</label>
                    <textarea
                      className="business-textarea"
                      value={businessProfile.address || ''}
                      onChange={(e) => updateBusiness({ address: e.target.value })}
                      placeholder="Street, city, postal code"
                      rows={2}
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Business email</label>
                    <input
                      className="business-input"
                      type="email"
                      value={businessProfile.email || ''}
                      onChange={(e) => updateBusiness({ email: e.target.value })}
                      placeholder="orders@yourstore.com"
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Short about</label>
                    <textarea
                      className="business-textarea"
                      value={businessProfile.about || ''}
                      onChange={(e) => updateBusiness({ about: e.target.value })}
                      placeholder="A short tagline for customers"
                      rows={2}
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Full description</label>
                    <textarea
                      className="business-textarea"
                      value={businessProfile.description || ''}
                      onChange={(e) => updateBusiness({ description: e.target.value })}
                      placeholder="Policies, what you offer, delivery notes..."
                      rows={3}
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Business phone</label>
                    <input
                      className="business-input"
                      type="tel"
                      value={businessProfile.phone || ''}
                      onChange={(e) => updateBusiness({ phone: e.target.value })}
                      placeholder="Customer-facing phone"
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Website</label>
                    <input
                      className="business-input"
                      type="url"
                      value={businessProfile.website || ''}
                      onChange={(e) => updateBusiness({ website: e.target.value.trim() })}
                      placeholder="https://"
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Instagram</label>
                    <input
                      className="business-input"
                      type="url"
                      value={businessProfile.instagram || ''}
                      onChange={(e) => updateBusiness({ instagram: e.target.value.trim() })}
                      placeholder="https://instagram.com/yourstore"
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Facebook</label>
                    <input
                      className="business-input"
                      type="url"
                      value={businessProfile.facebook || ''}
                      onChange={(e) => updateBusiness({ facebook: e.target.value.trim() })}
                      placeholder="https://facebook.com/yourstore"
                    />
                  </div>
                  <div className="business-field">
                    <label className="business-label">Twitter / X</label>
                    <input
                      className="business-input"
                      type="url"
                      value={businessProfile.twitter || ''}
                      onChange={(e) => updateBusiness({ twitter: e.target.value.trim() })}
                      placeholder="https://x.com/yourstore"
                    />
                  </div>
                </div>
                <div className="business-actions">
                  <button
                    type="button"
                    className="business-save"
                    disabled={businessSaving || isSubmitting}
                    onClick={() => void handleSaveBusinessProfile()}
                  >
                    {businessSaving ? 'Saving…' : 'Save business profile'}
                  </button>
                </div>
                </div>
                )}
              </div>

              {/* Homepage Editor */}
              <div className="editor-zone gap">
                <button
                  type="button"
                  className="editor-trigger"
                  onClick={() => navigate('/store/homepage')}
                >
                  <IconEdit /> Edit homepage
                </button>
              </div>

              {/* Delete */}
              <div className="delete-zone">
                {!confirmDelete ? (
                  <button className="delete-trigger" onClick={() => setConfirmDelete(true)}>
                    <IconTrash /> Delete store
                  </button>
                ) : (
                  <div className="confirm-box">
                    <div className="confirm-title">Delete this store?</div>
                    <p className="confirm-body">This can't be undone. Your store link will stop working for customers right away.</p>
                    <div className="confirm-btns">
                      <button className="confirm-yes" disabled={isSubmitting} onClick={handleDeleteStore}>
                        {isSubmitting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button className="confirm-no" onClick={() => setConfirmDelete(false)}>Keep it</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <MainAppBottomNav active="store" />
      </div>
    </>
  );

  async function handleDeleteStore() {
    if (!user?.uid) return;
    if (!guardCloudWrite()) return;
    setIsSubmitting(true);
    const result = await deleteStore(user.uid);
    if (result.success) {
      setStore(null); setShowCreateForm(true); setConfirmDelete(false);
      localStorage.removeItem(sellerStoreCacheKey(user.uid));
      invalidateSellerStoreSessionFetch(user.uid);
      showToast('Store deleted', 'success');
    } else showToast(result.error || 'Failed', 'error');
    setIsSubmitting(false);
  }
}
