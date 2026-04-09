import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStoreBySlug, getStoreProducts, sortProductsBySupabaseRowOrder, type StorePublic } from '../services/storeService';
import {
  isProductEnabledForCatalogue,
  isProductInStockForCatalogue,
  getCatalogueData,
  normalizeOrderQuantityStep,
  type CatalogueData,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import { getAllCatalogues, type Catalogue } from '../config/catalogueConfig';
import { createOrder, type OrderItem } from '../services/orderService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';
import { getFieldsDefinition } from '../config/fieldConfig';

/* ─────────────────────────────────────────────────────────────────────────────
   INLINE STYLES — clean, professional light storefront
───────────────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

:root {
  --f-head: 'DM Serif Display', Georgia, serif;
  --f-body: 'DM Sans', system-ui, sans-serif;
  --c-bg: #f7f7f5;
  --c-surface: #ffffff;
  --c-surface2: #f2f2f0;
  --c-surface3: #e8e8e5;
  --c-border: rgba(0,0,0,0.08);
  --c-border2: rgba(0,0,0,0.14);
  --c-text: #1a1a1a;
  --c-text2: #555555;
  --c-text3: #999999;
  --c-accent: #1a6b4a;
  --c-accent-light: #e8f4ef;
  --c-accent-dark: #145538;
  --c-white: #ffffff;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 22px;
  --r-full: 999px;
  --trans: 0.18s cubic-bezier(0.4,0,0.2,1);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
}

.sv { font-family: var(--f-body); background: var(--c-bg); min-height: 100vh; color: var(--c-text); -webkit-font-smoothing: antialiased; }
.sv-page { max-width: 480px; margin: 0 auto; min-height: 100vh; position: relative; overflow-x: hidden; }

/* ── Hero ── */
.sv-hero { position: relative; background: var(--c-surface); border-bottom: 1px solid var(--c-border); }
.sv-hero-bg { display: none; }
.sv-hero-inner { padding: 24px 20px 22px; }
.sv-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.sv-logo { width: 54px; height: 54px; border-radius: var(--r-md); background: var(--c-surface2); border: 1px solid var(--c-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: var(--shadow-sm); }
.sv-logo img { width: 100%; height: 100%; object-fit: cover; }
.sv-open-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--c-accent-light); border: 1px solid rgba(26,107,74,0.2); border-radius: var(--r-full); padding: 5px 12px; font-size: 11px; font-weight: 600; color: var(--c-accent); font-family: var(--f-body); letter-spacing: 0.3px; }
.sv-open-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); animation: sv-pulse 2.5s infinite; }
@keyframes sv-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }
.sv-store-name { font-family: var(--f-head); font-size: 28px; font-weight: 400; color: var(--c-text); line-height: 1.1; letter-spacing: -0.3px; margin-bottom: 5px; }
.sv-store-tagline { font-size: 13.5px; color: var(--c-text2); line-height: 1.55; max-width: 300px; font-weight: 400; }
.sv-store-desc { font-size: 12px; color: var(--c-text3); line-height: 1.5; max-width: 320px; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sv-biz-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.sv-biz-chip { display: inline-flex; align-items: center; gap: 5px; background: var(--c-surface2); border: 1px solid var(--c-border); border-radius: var(--r-full); padding: 5px 11px; font-size: 12px; color: var(--c-text2); font-family: var(--f-body); text-decoration: none; transition: border-color var(--trans), color var(--trans), background var(--trans); font-weight: 500; }
.sv-biz-chip:hover { border-color: var(--c-border2); color: var(--c-text); background: var(--c-surface3); }
.sv-socials { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
.sv-social-btn { width: 34px; height: 34px; border-radius: var(--r-sm); background: var(--c-surface2); border: 1px solid var(--c-border); display: flex; align-items: center; justify-content: center; text-decoration: none; color: var(--c-text2); transition: all var(--trans); cursor: pointer; font-size: 11px; font-weight: 700; font-style: normal; font-family: var(--f-body); }
.sv-social-btn:hover { background: var(--c-surface3); border-color: var(--c-border2); color: var(--c-text); }

/* ── Sticky nav ── */
.sv-nav { position: sticky; top: 0; z-index: 80; background: rgba(247,247,245,0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--c-border); padding: 11px 14px; display: flex; flex-direction: column; gap: 9px; }
.sv-nav-row { display: flex; align-items: center; gap: 10px; }
.sv-count-label { flex: 1; font-size: 12px; color: var(--c-text3); font-weight: 500; }
.sv-search-wrap { position: relative; }
.sv-search-input { width: 100%; height: 38px; background: var(--c-surface); border: 1px solid var(--c-border2); border-radius: var(--r-full); color: var(--c-text); font-size: 13px; font-family: var(--f-body); padding: 0 34px 0 36px; outline: none; transition: border-color var(--trans), box-shadow var(--trans); }
.sv-search-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(26,107,74,0.08); }
.sv-search-input::placeholder { color: var(--c-text3); }
.sv-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--c-text3); pointer-events: none; }
.sv-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; background: var(--c-surface3); border: none; cursor: pointer; font-size: 12px; color: var(--c-text2); display: flex; align-items: center; justify-content: center; }
.sv-cats { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 1px; }
.sv-cats::-webkit-scrollbar { display: none; }
.sv-cat { flex-shrink: 0; height: 28px; padding: 0 13px; border-radius: var(--r-full); border: 1px solid var(--c-border2); background: var(--c-surface); color: var(--c-text2); font-size: 12px; font-weight: 500; font-family: var(--f-body); cursor: pointer; transition: all var(--trans); white-space: nowrap; }
.sv-cat:hover { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-light); }
.sv-cat.active { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-white); font-weight: 600; }

/* ── 2-col grid ── */
.sv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 12px 140px; }

/* ── Product card ── */
.sv-pcard { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); overflow: hidden; display: flex; flex-direction: column; transition: border-color var(--trans), box-shadow var(--trans); position: relative; box-shadow: var(--shadow-sm); }
.sv-pcard:hover { border-color: var(--c-border2); box-shadow: var(--shadow-md); }
.sv-pcard.selected { border-color: var(--c-accent); box-shadow: 0 0 0 1.5px var(--c-accent), var(--shadow-md); }

.sv-pcard-img-wrap { width: 100%; aspect-ratio: 1/1; background: var(--c-surface2); position: relative; overflow: hidden; cursor: pointer; flex-shrink: 0; }
.sv-pcard-img-wrap img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transition: transform 0.35s ease; display: block; }
.sv-pcard-img-wrap:hover img { transform: scale(1.05); }
.sv-pcard-img-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.sv-pcard-sel { position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; border-radius: 50%; background: var(--c-accent); display: flex; align-items: center; justify-content: center; z-index: 2; box-shadow: 0 1px 4px rgba(0,0,0,0.18); }

.sv-pcard-body { padding: 10px 10px 5px; display: flex; flex-direction: column; gap: 2px; }
.sv-pcard-name { font-family: var(--f-body); font-size: 13px; font-weight: 600; color: var(--c-text); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sv-pcard-sub { font-size: 11px; color: var(--c-text3); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; font-weight: 400; }
.sv-pcard-price { font-family: var(--f-body); font-size: 14px; font-weight: 700; color: var(--c-text); letter-spacing: -0.2px; margin-top: 5px; }
.sv-pcard-price-unit { font-size: 10px; font-weight: 400; color: var(--c-text3); margin-left: 1px; }

.sv-pcard-footer { padding: 7px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
.sv-pcard-actions { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.sv-details-btn { font-size: 11px; color: var(--c-accent); background: none; border: none; cursor: pointer; font-family: var(--f-body); padding: 0; font-weight: 500; letter-spacing: 0.1px; }
.sv-details-btn:hover { text-decoration: underline; text-underline-offset: 2px; }

.sv-pcard-subtotal { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--c-accent-light); border-radius: var(--r-sm); border: 1px solid rgba(26,107,74,0.15); margin: 0 10px 10px; }
.sv-pcard-subtotal-calc { font-size: 10.5px; color: var(--c-text3); }
.sv-pcard-subtotal-val { font-size: 13px; font-weight: 700; color: var(--c-accent); font-family: var(--f-body); }

/* ── Qty ── */
.sv-qty { display: inline-flex; align-items: center; background: var(--c-surface2); border: 1px solid var(--c-border2); border-radius: var(--r-full); overflow: hidden; }
.sv-qty-btn { width: 28px; height: 28px; border: none; background: none; cursor: pointer; font-size: 16px; color: var(--c-text2); display: flex; align-items: center; justify-content: center; transition: background var(--trans), color var(--trans); font-family: var(--f-body); line-height: 1; }
.sv-qty-btn:hover { background: var(--c-surface3); color: var(--c-text); }
.sv-qty-val { min-width: 26px; text-align: center; font-size: 13px; font-weight: 600; color: var(--c-text); font-family: var(--f-body); }
.sv-qty.accent { background: var(--c-accent); border-color: var(--c-accent); }
.sv-qty.accent .sv-qty-btn { color: rgba(255,255,255,0.85); }
.sv-qty.accent .sv-qty-btn:hover { background: rgba(0,0,0,0.12); color: white; }
.sv-qty.accent .sv-qty-val { color: white; }

.sv-pack-hint { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: #8a6a00; background: #fffbeb; border: 1px solid #f0d060; border-radius: var(--r-full); padding: 3px 8px; font-weight: 500; }

/* ── Floating cart ── */
.sv-cart { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; padding: 12px 14px 24px; pointer-events: none; z-index: 200; }
.sv-cart-inner { display: flex; align-items: center; justify-content: space-between; background: var(--c-text); border-radius: var(--r-xl); padding: 10px 10px 10px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1); pointer-events: all; gap: 12px; cursor: pointer; animation: sv-cart-in 0.28s cubic-bezier(0.34,1.4,0.64,1); }
@keyframes sv-cart-in { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
.sv-cart-info { display: flex; flex-direction: column; gap: 1px; }
.sv-cart-count { font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 500; }
.sv-cart-total { font-family: var(--f-body); font-size: 19px; font-weight: 700; color: white; letter-spacing: -0.4px; }
.sv-cart-cta { flex-shrink: 0; height: 40px; padding: 0 18px; border-radius: var(--r-full); background: var(--c-accent); color: white; font-size: 13px; font-weight: 600; font-family: var(--f-body); border: none; cursor: pointer; letter-spacing: 0.1px; transition: opacity var(--trans); white-space: nowrap; }
.sv-cart-cta:hover { opacity: 0.88; }

/* ── Seller WhatsApp FAB (public contact) ── */
.sv-fab-wa { position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: calc(20px + env(safe-area-inset-bottom)); z-index: 210; width: 56px; height: 56px; border-radius: 50%; background: #25d366; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(37, 211, 102, 0.45); transition: transform 0.2s ease, box-shadow 0.2s ease; text-decoration: none; pointer-events: all; }
.sv-fab-wa:hover { transform: scale(1.06); box-shadow: 0 6px 22px rgba(37, 211, 102, 0.55); }
.sv-fab-wa:active { transform: scale(0.96); }
.sv-fab-wa--above-cart { bottom: calc(108px + env(safe-area-inset-bottom)); }

/* ── Morphing panel ── */
.sv-panel { position: fixed; inset: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: var(--c-bg); z-index: 120; display: flex; flex-direction: column; animation: sv-panel-in 0.3s cubic-bezier(0.32,0.72,0,1); overflow-y: auto; }
@keyframes sv-panel-in { from{transform:translateX(-50%) translateY(100%)} to{transform:translateX(-50%) translateY(0)} }

.sv-panel-header { position: sticky; top: 0; z-index: 10; background: rgba(247,247,245,0.96); backdrop-filter: blur(12px); border-bottom: 1px solid var(--c-border); padding: 13px 16px; display: flex; align-items: center; gap: 13px; }
.sv-panel-back { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--c-border2); background: var(--c-surface); color: var(--c-text2); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all var(--trans); box-shadow: var(--shadow-sm); }
.sv-panel-back:hover { background: var(--c-surface2); color: var(--c-text); }
.sv-panel-title-wrap { flex: 1; }
.sv-panel-title { font-family: var(--f-body); font-size: 15px; font-weight: 600; color: var(--c-text); letter-spacing: -0.1px; }
.sv-panel-subtitle { font-size: 12px; color: var(--c-text3); margin-top: 1px; }
.sv-panel-cta { flex-shrink: 0; height: 36px; padding: 0 18px; border-radius: var(--r-full); background: var(--c-accent); color: white; font-size: 13px; font-weight: 600; font-family: var(--f-body); border: none; cursor: pointer; transition: opacity var(--trans), transform var(--trans); white-space: nowrap; box-shadow: 0 2px 8px rgba(26,107,74,0.25); }
.sv-panel-cta:hover:not(:disabled) { opacity: 0.88; }
.sv-panel-cta:active:not(:disabled) { transform: scale(0.97); }
.sv-panel-cta:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Step bar ── */
.sv-steps { display: flex; align-items: center; padding: 16px 16px 0; }
.sv-step-item { display: flex; align-items: center; gap: 7px; }
.sv-step-num { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; font-family: var(--f-body); flex-shrink: 0; transition: all var(--trans); }
.sv-step-num.done { background: var(--c-accent); color: white; }
.sv-step-num.active { background: var(--c-text); color: white; }
.sv-step-num.idle { background: var(--c-surface3); color: var(--c-text3); }
.sv-step-label { font-size: 11px; font-weight: 500; }
.sv-step-label.done,.sv-step-label.active { color: var(--c-text); }
.sv-step-label.idle { color: var(--c-text3); }
.sv-step-line { flex: 1; height: 1px; background: var(--c-border2); margin: 0 8px; }
.sv-step-line.done { background: var(--c-accent); }

/* ── Form ── */
.sv-form-body { padding: 16px 16px 0; display: flex; flex-direction: column; gap: 14px; }
.sv-field label { display: block; font-size: 11px; font-weight: 600; color: var(--c-text3); text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 7px; font-family: var(--f-body); }
.sv-field input { width: 100%; height: 48px; background: var(--c-surface); border: 1px solid var(--c-border2); border-radius: var(--r-md); color: var(--c-text); font-size: 15px; font-family: var(--f-body); padding: 0 16px; outline: none; transition: border-color var(--trans), box-shadow var(--trans); }
.sv-field input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(26,107,74,0.08); }
.sv-field input::placeholder { color: var(--c-text3); }
.sv-order-pill { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: var(--shadow-sm); }
.sv-order-pill-label { font-size: 11.5px; color: var(--c-text3); margin-bottom: 2px; font-weight: 500; }
.sv-order-pill-detail { font-size: 13px; color: var(--c-text2); font-weight: 500; }
.sv-order-pill-total { font-family: var(--f-body); font-size: 24px; font-weight: 700; color: var(--c-text); letter-spacing: -0.8px; }

/* ── Review ── */
.sv-review-list { padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 9px; }
.sv-rcard { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); overflow: visible; display: flex; box-shadow: var(--shadow-sm); align-items: center; gap: 12px; padding: 12px; }
.sv-rcard-img { width: 80px; height: 80px; flex-shrink: 0; background: var(--c-surface2); overflow: hidden; position: relative; }
.sv-rcard-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.sv-rcard-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.sv-rcard-body { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; }
.sv-rcard-name { font-family: var(--f-body); font-size: 13.5px; font-weight: 600; color: var(--c-text); }
.sv-rcard-sub { font-size: 11px; color: var(--c-text3); margin-top: 2px; }
.sv-rcard-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.sv-rcard-calc { font-size: 11.5px; color: var(--c-text3); }
.sv-rcard-total { font-family: var(--f-body); font-size: 14px; font-weight: 700; color: var(--c-accent); }
.sv-review-customer { margin: 0 16px 14px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: 16px 18px; box-shadow: var(--shadow-sm); }
.sv-review-customer-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--c-text3); margin-bottom: 8px; font-family: var(--f-body); }
.sv-review-customer-name { font-family: var(--f-body); font-size: 17px; font-weight: 600; color: var(--c-text); }
.sv-review-customer-phone { font-size: 13px; color: var(--c-text3); margin-top: 3px; }
.sv-review-total-bar { margin: 0 16px 32px; background: var(--c-accent); border-radius: var(--r-xl); padding: 20px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.sv-review-total-label { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 3px; font-family: var(--f-body); }
.sv-review-total-val { font-family: var(--f-body); font-size: 28px; font-weight: 700; color: white; letter-spacing: -1px; }
.sv-edit-btn { flex-shrink: 0; height: 36px; padding: 0 16px; border-radius: var(--r-full); background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.25); color: white; font-size: 12.5px; font-weight: 600; font-family: var(--f-body); cursor: pointer; transition: background var(--trans); white-space: nowrap; }
.sv-edit-btn:hover { background: rgba(255,255,255,0.28); }

/* ── Drawer ── */
.sv-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 300; display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(2px); }
.sv-drawer { background: var(--c-surface); border-radius: var(--r-xl) var(--r-xl) 0 0; width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto; animation: sv-drawer-up 0.26s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 -4px 32px rgba(0,0,0,0.12); }
@keyframes sv-drawer-up { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
.sv-drawer-handle { width: 36px; height: 4px; background: var(--c-surface3); border-radius: var(--r-full); margin: 12px auto 0; }
.sv-drawer-img-wrap { width: 100%; background: var(--c-surface); position: relative; margin-top: 14px; padding: 0; box-sizing: border-box; }
.sv-drawer-img-wrap img { display: block; width: 100%; height: auto; }
.sv-drawer-img-ph { width: 100%; min-height: 180px; display: flex; align-items: center; justify-content: center; }
.sv-drawer-close { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.88); border: 1px solid var(--c-border2); cursor: pointer; color: var(--c-text); font-size: 13px; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); }
.sv-drawer-body { padding: 18px 20px 36px; }
.sv-drawer-name { font-family: var(--f-head); font-size: 22px; font-weight: 400; color: var(--c-text); letter-spacing: -0.3px; line-height: 1.2; }
.sv-drawer-sub { font-size: 13px; color: var(--c-text3); margin-top: 3px; }
.sv-drawer-cats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.sv-drawer-cat { height: 22px; padding: 0 10px; border-radius: var(--r-full); background: var(--c-accent-light); border: 1px solid rgba(26,107,74,0.15); font-size: 11px; color: var(--c-accent); font-weight: 500; display: inline-flex; align-items: center; }
.sv-drawer-price { font-family: var(--f-body); font-size: 24px; font-weight: 700; color: var(--c-text); letter-spacing: -0.6px; margin-top: 14px; }
.sv-drawer-price span { font-size: 13px; font-weight: 400; color: var(--c-text3); margin-left: 4px; }
.sv-detail-table { margin-top: 18px; border: 1px solid var(--c-border); border-radius: var(--r-md); overflow: hidden; }
.sv-detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 13px; gap: 16px; }
.sv-detail-row:not(:last-child) { border-bottom: 1px solid var(--c-border); }
.sv-detail-row:nth-child(even) { background: var(--c-surface2); }
.sv-detail-lbl { color: var(--c-text3); font-weight: 500; }
.sv-detail-val { color: var(--c-text); font-weight: 600; text-align: right; }
.sv-drawer-qty-section { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--c-border); }
.sv-drawer-qty-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--c-text3); margin-bottom: 12px; font-family: var(--f-body); }
.sv-drawer-qty-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.sv-drawer-total-wrap { text-align: right; }
.sv-drawer-calc { font-size: 12px; color: var(--c-text3); margin-bottom: 3px; }
.sv-drawer-total { font-family: var(--f-body); font-size: 22px; font-weight: 700; color: var(--c-accent); letter-spacing: -0.6px; }
.sv-drawer-done { width: 100%; height: 50px; border-radius: var(--r-full); background: var(--c-accent); color: white; border: none; font-size: 15px; font-weight: 600; font-family: var(--f-body); cursor: pointer; margin-top: 20px; transition: opacity var(--trans); box-shadow: 0 2px 12px rgba(26,107,74,0.3); }
.sv-drawer-done:hover { opacity: 0.88; }

/* ── Empty ── */
.sv-empty { grid-column: 1/-1; text-align: center; padding: 48px 24px; }
.sv-empty-icon { font-size: 38px; margin-bottom: 12px; opacity: 0.45; }
.sv-empty strong { display: block; font-family: var(--f-body); font-size: 15px; font-weight: 600; color: var(--c-text2); margin-bottom: 6px; }
.sv-empty p { font-size: 13px; color: var(--c-text3); line-height: 1.55; }

/* ── Skeleton ── */
@keyframes sv-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
.sv-skel { background: linear-gradient(90deg,var(--c-surface2) 25%,var(--c-surface3) 50%,var(--c-surface2) 75%); background-size: 800px 100%; animation: sv-shimmer 1.5s infinite linear; border-radius: 6px; }
.sv-skel-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); overflow: hidden; box-shadow: var(--shadow-sm); }

/* ── Error / loading ── */
.sv-fullscreen { min-height: 100vh; background: var(--c-bg); display: flex; align-items: center; justify-content: center; padding: 24px; font-family: var(--f-body); }
.sv-error-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-xl); overflow: hidden; max-width: 380px; width: 100%; box-shadow: var(--shadow-lg); }
.sv-error-stripe { height: 3px; background: linear-gradient(90deg,var(--c-accent),#4caf88); }
.sv-error-body { padding: 36px 28px 28px; text-align: center; }
.sv-error-icon { width: 60px; height: 60px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; font-size: 26px; }
.sv-error-title { font-family: var(--f-head); font-size: 20px; font-weight: 400; color: var(--c-text); letter-spacing: -0.2px; margin-bottom: 8px; }
.sv-error-desc { font-size: 13.5px; color: var(--c-text3); line-height: 1.6; margin-bottom: 24px; }
.sv-error-btn { width: 100%; height: 48px; border-radius: var(--r-full); background: var(--c-accent); color: white; border: none; font-size: 14px; font-weight: 600; font-family: var(--f-body); cursor: pointer; transition: opacity var(--trans); }
.sv-error-btn:hover { opacity: 0.88; }

.sv-offline-icon { width: 60px; height: 60px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; font-size: 28px; }
.sv-offline-title { font-family: var(--f-head); font-size: 20px; font-weight: 400; color: var(--c-text); letter-spacing: -0.2px; margin-bottom: 8px; }
.sv-offline-desc { font-size: 13.5px; color: var(--c-text3); line-height: 1.6; margin-bottom: 24px; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
type Step = 'products' | 'customer' | 'review';

function unitLabel(u?: string): string {
  if (!u || String(u).trim() === '' || u === 'None') return 'unit';
  const c = String(u).replace(/^\s*\/\s*/i, '').trim().toLowerCase();
  if (!c) return 'unit';
  if (c === 'piece' || c === 'pieces' || c === 'pc') return 'pc';
  return c;
}
function fmt(n: number, sym: string) { return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }
function fmtCalc(qty: number, price: number, u: string | undefined, sym: string): string | null {
  if (qty <= 0 || !Number.isFinite(price)) return null;
  return `${qty} ${unitLabel(u)} × ${fmt(price, sym)}`;
}
function isPublicUrl(url?: string): boolean {
  if (!url) return false;
  try { const p = new URL(url.trim()); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; }
}

function webHref(raw: string): string {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Storefront can show synced data: URLs; grid uses <img> with https or data:image only. */
function isDisplayableImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith('data:image/')) return true;
  return isPublicUrl(t);
}

/**
 * Prefer cloud HTTPS URL (imageUrl) over `image`, which may be a local filesystem path after sync.
 */
function pickProductImageSrc(p: ProductWithCatalogueData | Record<string, unknown>): string | undefined {
  const r = p as Record<string, unknown>;
  const asSrc = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s) || s.startsWith('data:image/')) return s;
    return undefined;
  };
  for (const k of ['imageUrl', 'image_url', 'thumbnailUrl', 'thumbnail_url', 'image'] as const) {
    const u = asSrc(r[k]);
    if (u) return u;
  }
  return undefined;
}

/**
 * Public store visitors may not have the seller's custom catalogue in localStorage.
 * When catalogue config is missing, still read price from product.catalogueData using price1…price10.
 * If merged catalogue row has empty prices but the product still has top-level price fields (legacy), use those.
 */
function getStorefrontPriceAndUnit(
  catData: CatalogueData | null | undefined,
  catalogue: Catalogue | null,
  product?: ProductWithCatalogueData | null
): { price: number; priceUnit?: string } {
  const fromCat = (): { price: number; priceUnit?: string } => {
    if (!catData) return { price: 0 };
    if (catalogue) {
      const raw = catData[catalogue.priceField as keyof CatalogueData];
      const price = parseFloat(String(raw ?? '')) || 0;
      const priceUnit = catData[catalogue.priceUnitField as keyof CatalogueData] as string | undefined;
      return { price, priceUnit };
    }
    for (let n = 1; n <= 10; n++) {
      const pk = `price${n}` as keyof CatalogueData;
      const price = parseFloat(String(catData[pk] ?? '')) || 0;
      if (price > 0) {
        const uk = `price${n}Unit` as keyof CatalogueData;
        return { price, priceUnit: catData[uk] as string | undefined };
      }
    }
    return { price: 0 };
  };

  const r = fromCat();
  if (r.price > 0 || !product) return r;

  const pr = product as Record<string, unknown>;
  if (catalogue) {
    const top = pr[catalogue.priceField];
    const price = parseFloat(String(top ?? '')) || 0;
    if (price > 0) {
      return { price, priceUnit: pr[catalogue.priceUnitField] as string | undefined };
    }
  }
  for (let n = 1; n <= 10; n++) {
    const price = parseFloat(String(pr[`price${n}`] ?? '')) || 0;
    if (price > 0) {
      return { price, priceUnit: pr[`price${n}Unit`] as string | undefined };
    }
  }
  return r;
}
function getCats(p: ProductWithCatalogueData): string[] {
  return Array.from(new Set((p.category || []).map((c: string) => String(c).trim()).filter(Boolean)));
}
function srchText(p: ProductWithCatalogueData): string {
  const ex = Array.from({ length: 10 }, (_, i) => { const n = i + 1; const r = p as unknown as Record<string, string | undefined>; return [r[`field${n}`], r[`field${n}Label`], r[`field${n}Unit`]].filter(Boolean).join(' '); });
  return [p.name, p.subtitle, ...(p.category || []), ...ex].filter(Boolean).join(' ').toLowerCase();
}
function fieldLU(p: ProductWithCatalogueData, n: number): { label: string; unitSuffix: string } {
  const r = p as unknown as Record<string, string | undefined>;
  const eu = r[`field${n}Unit`];

  // Get field label from fieldsDefinition
  const fieldDefinition = getFieldsDefinition();
  const fieldConfig = fieldDefinition.fields.find(f => f.key === `field${n}`);
  const label = fieldConfig?.label || `Field ${n}`;

  // Get unit suffix - exclude "None" and empty strings
  const unitSuffix = eu && String(eu).trim() !== '' && String(eu).trim() !== 'None' ? String(eu).trim() : '';

  return { label, unitSuffix };
}

/* ─────────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────────── */
const IconBack = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
const IconStore = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: '#aaa' }}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>;
const IconImg = ({ size = 28 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;
const IconCheck = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconLoc = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconPhone = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 010 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" /></svg>;
const IconMail = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
const IconLink = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
const IconWA = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.374 0 0 5.373 0 12c0 2.096.544 4.142 1.577 5.94L.057 23.882l6.066-1.59A11.955 11.955 0 0012 24c6.626 0 12-5.374 12-12S18.626 0 12 0zm0 21.818a9.819 9.819 0 01-5.003-1.372l-.359-.214-3.72.975.993-3.624-.235-.373A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>;
const IconWAFab = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.374 0 0 5.373 0 12c0 2.096.544 4.142 1.577 5.94L.057 23.882l6.066-1.59A11.955 11.955 0 0012 24c6.626 0 12-5.374 12-12S18.626 0 12 0zm0 21.818a9.819 9.819 0 01-5.003-1.372l-.359-.214-3.72.975.993-3.624-.235-.373A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>;

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */
function QtyControl({ value, step, onChange, accent = false }: { value: number; step: number; onChange: (d: number) => void; accent?: boolean }) {
  const s = normalizeOrderQuantityStep(step);
  return (
    <div className={`sv-qty${accent ? ' accent' : ''}`}>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(-s)}>−</button>
      <span className="sv-qty-val">{value}</span>
      <button type="button" className="sv-qty-btn" onClick={() => onChange(s)}>+</button>
    </div>
  );
}

function StepBar({ current }: { current: 'customer' | 'review' }) {
  const done = current === 'review';
  return (
    <div className="sv-steps">
      <div className="sv-step-item">
        <div className="sv-step-num done"><IconCheck /></div>
        <span className="sv-step-label done">Items</span>
      </div>
      <div className="sv-step-line done" />
      <div className="sv-step-item">
        <div className={`sv-step-num ${done ? 'done' : 'active'}`}>{done ? <IconCheck /> : '2'}</div>
        <span className={`sv-step-label ${done ? 'done' : 'active'}`}>Details</span>
      </div>
      <div className={`sv-step-line ${done ? 'done' : ''}`} />
      <div className="sv-step-item">
        <div className={`sv-step-num ${done ? 'active' : 'idle'}`}>3</div>
        <span className={`sv-step-label ${done ? 'active' : 'idle'}`}>Review</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="sv-skel-card">
      <div className="sv-skel" style={{ width: '100%', aspectRatio: '1/1', borderRadius: 0 }} />
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="sv-skel" style={{ height: 13, width: '70%' }} />
        <div className="sv-skel" style={{ height: 11, width: '45%' }} />
        <div className="sv-skel" style={{ height: 17, width: '55%', marginTop: 4 }} />
        <div className="sv-skel" style={{ height: 28, width: '80%', borderRadius: 999, marginTop: 4 }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function StoreView() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<Step>('products');
  const [store, setStore] = useState<StorePublic | null>(null);
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
  const drawerRef = useRef<HTMLDivElement>(null);

  // Scroll drawer to top when product is selected
  useEffect(() => {
    if (drawerProduct && drawerRef.current) {
      drawerRef.current.scrollTop = 0;
    }
  }, [drawerProduct]);

  useEffect(() => {
    if (!slug) { setStoreError('Store not found'); setStoreLoading(false); return; }
    setStoreLoading(true);
    getStoreBySlug(slug).then((r) => { if (!r.success || !r.data) setStoreError(r.error || 'Store not found'); else setStore(r.data); setStoreLoading(false); });
  }, [slug]);

  useEffect(() => {
    setLogoFailed(false);
  }, [store?.sellerLogoUrl]);

  useEffect(() => {
    if (!store?.sellerUserId) return;
    if (store.isLive === false) {
      setAllProducts([]);
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    getStoreProducts(store.sellerUserId).then((result) => {
      if (result.success && result.products) {
        setAllProducts(result.products);
      }
      setProductsLoading(false);
    });
  }, [store?.sellerUserId, store?.isLive]);

  const catalogues = useMemo(() => getAllCatalogues(null), []);
  const currencySymbol = useMemo(() => getSymbolForCurrencyCode(store?.sellerCurrencyCode || 'INR'), [store?.sellerCurrencyCode]);
  const catalogue = useMemo(() => catalogues.find((c) => c.id === store?.catalogueId) || null, [catalogues, store?.catalogueId]);

  /** Same order as `public.products.position` (int8), even if RPC returns rows out of order. */
  const productsInTableOrder = useMemo(
    () => sortProductsBySupabaseRowOrder(allProducts),
    [allProducts]
  );

  const storeProducts = useMemo(() => {
    if (!store?.catalogueId) return [];

    const inStock = (p: ProductWithCatalogueData) =>
      isProductInStockForCatalogue(p, store.catalogueId, catalogue);

    const enabledProducts = productsInTableOrder.filter((p) => isProductEnabledForCatalogue(p, store.catalogueId));

    const enabledInStock = enabledProducts.filter(inStock);

    if (enabledInStock.length > 0) return enabledInStock;

    if (enabledProducts.length === 0 && productsInTableOrder.length > 0) {
      return productsInTableOrder.filter(inStock);
    }

    return enabledInStock;
  }, [store?.catalogueId, productsInTableOrder, catalogue]);
  const availableCategories = useMemo(() => Array.from(new Set(storeProducts.flatMap(getCats))), [storeProducts]);
  const hasUncategorized = useMemo(() => storeProducts.some((p) => getCats(p).length === 0), [storeProducts]);
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return storeProducts.filter((p) => {
      const cats = getCats(p);
      return (!q || srchText(p).includes(q)) && (selectedCategory === 'all' || (selectedCategory === 'uncategorized' ? cats.length === 0 : cats.includes(selectedCategory)));
    });
  }, [searchQuery, selectedCategory, storeProducts]);

  const orderSummary = useMemo(() => {
    if (!store?.catalogueId) return { items: [] as any[], total: 0 };
    const items: any[] = []; let total = 0;
    selectedProducts.forEach((quantity, productId) => {
      const product = allProducts.find((p) => p.id === productId); if (!product) return;
      const catData = getCatalogueData(product, store.catalogueId);
      const { price: unitPrice, priceUnit } = getStorefrontPriceAndUnit(catData, catalogue, product);
      const rowTotal = unitPrice * quantity;
      items.push({
        productId,
        name: product.name,
        quantity,
        unitPrice,
        rowTotal,
        priceUnit,
        imageUrl: pickProductImageSrc(product),
        subtitle: product.subtitle,
      });
      total += rowTotal;
    });
    return { items, total };
  }, [selectedProducts, store, catalogue, allProducts]);

  const selectedProductCount = useMemo(() => Array.from(selectedProducts.values()).filter((q) => q > 0).length, [selectedProducts]);

  /** Digits for wa.me — same bar as hero chip (any digits); wa.me prefers full country code. */
  const sellerWhatsappDigits = useMemo(() => {
    const w = store?.whatsapp?.trim();
    if (!w) return '';
    const d = w.replace(/\D/g, '');
    return d.length > 0 ? d : '';
  }, [store?.whatsapp]);

  const changeQty = (productId: string, delta: number, qstep: number) => {
    const s = normalizeOrderQuantityStep(qstep);
    const current = selectedProducts.get(productId) || 0;
    const rounded = Math.round(Math.max(0, current + delta) / s) * s;
    const map = new Map(selectedProducts);
    map.set(productId, rounded);
    setSelectedProducts(map);
  };

  const handleBack = useCallback(() => {
    if (drawerProduct) { setDrawerProduct(null); return; }
    if (step !== 'products') { setStep(step === 'review' ? 'customer' : 'products'); return; }
    window.history.back();
  }, [drawerProduct, step]);

  // Filter out 0-quantity items for final submission
  const reviewSummary = useMemo(() => {
    return {
      items: orderSummary.items.filter(item => item.quantity > 0),
      total: orderSummary.items
        .filter(item => item.quantity > 0)
        .reduce((sum, item) => sum + item.rowTotal, 0),
    };
  }, [orderSummary]);

  const handlePlaceOrder = async () => {
    if (!store?.catalogueId) return;
    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = [];
      reviewSummary.items.forEach((item) => {
        const product = allProducts.find((p) => p.id === item.productId); if (!product) return;
        const catData = getCatalogueData(product, store.catalogueId);
        const { price: unitPrice, priceUnit } = getStorefrontPriceAndUnit(catData, catalogue, product);
        orderItems.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          rowTotal: item.rowTotal,
          category: product.category?.[0],
          subtitle: product.subtitle,
          priceUnit,
          imageUrl: item.imageUrl,
          quantityStep: catData.orderQuantityStep,
        });
      });
      setSupabaseRlsUserId(store.sellerUserId);
      const { error } = await createOrder(store.sellerUserId, '', customerName.trim(), orderItems, reviewSummary.total, store.sellerCurrencyCode || 'INR', customerWhatsapp.trim() || undefined, 'store');
      if (error) alert('Failed to place order. Please try again.');
      else {
        alert('Order placed! The seller will contact you soon.');
        setStep('products');
        setSelectedProducts(new Map());
        setCustomerName('');
        setCustomerWhatsapp('');
        setDrawerProduct(null);
        setSearchQuery('');
        setSelectedCategory('all');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch { alert('Error placing order. Please try again.'); }
    finally {
      setSupabaseRlsUserId(null);
      void getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) setSupabaseRlsUserId(session.user.id);
      });
      setIsSubmitting(false);
    }
  };

  const handlePanelAction = () => {
    if (step === 'customer') { if (!customerName.trim()) { alert('Please enter your name'); return; } setStep('review'); }
    else void handlePlaceOrder();
  };

  const storeDisplayName = useMemo(() => {
    const slugTitle = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const name = store?.sellerBusinessName?.trim();
    if (name) return name;
    return store?.storeSlug ? slugTitle(store.storeSlug) : 'Store';
  }, [store?.sellerBusinessName, store?.storeSlug]);

  const heroSubtitle = useMemo(() => {
    if (!store) return { primary: null as string | null, secondary: null as string | null };
    const a = store.sellerAbout?.trim() || '';
    const t = store.tagline?.trim() || '';
    const d = store.sellerDescription?.trim() || '';
    if (a) return { primary: a, secondary: d && d !== a ? d : null };
    if (t) return { primary: t, secondary: d && d !== t ? d : null };
    if (d) return { primary: d, secondary: null };
    return { primary: null, secondary: null };
  }, [store]);

  const displayPhone = store?.sellerPhone?.trim() || store?.phone?.trim();
  const displayLocation = store?.sellerAddress?.trim() || store?.location?.trim();
  const displayEmail = store?.sellerEmail?.trim();

  /* ── Loading ── */
  if (storeLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="sv"><div className="sv-page">
          <div className="sv-hero"><div className="sv-hero-bg" /><div className="sv-hero-inner">
            <div className="sv-hero-top">
              <div className="sv-skel" style={{ width: 54, height: 54, borderRadius: 12 }} />
              <div className="sv-skel" style={{ width: 88, height: 28, borderRadius: 999 }} />
            </div>
            <div className="sv-skel" style={{ height: 32, width: '50%', marginBottom: 8 }} />
            <div className="sv-skel" style={{ height: 13, width: '72%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <div className="sv-skel" style={{ height: 29, width: 95, borderRadius: 999 }} />
              <div className="sv-skel" style={{ height: 29, width: 120, borderRadius: 999 }} />
            </div>
          </div></div>
          <div className="sv-nav"><div className="sv-skel" style={{ height: 38, borderRadius: 999 }} /></div>
          <div className="sv-grid"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        </div></div>
      </>
    );
  }

  /* ── Error ── */
  if (storeError || !store) {
    return (
      <>
        <style>{CSS}</style>
        <div className="sv sv-fullscreen">
          <div className="sv-error-card">
            <div className="sv-error-stripe" />
            <div className="sv-error-body">
              <div className="sv-error-icon">⚠️</div>
              <div className="sv-error-title">Store unavailable</div>
              <div className="sv-error-desc">{storeError || 'This store could not be found.'}</div>
              <button className="sv-error-btn" onClick={() => navigate('/')}>Go home</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Seller paused storefront (no product fetch) ── */
  if (store.isLive === false) {
    const pausedName =
      store.sellerBusinessName?.trim() ||
      (store.storeSlug ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1) : 'This store');
    return (
      <>
        <style>{CSS}</style>
        <div className="sv sv-fullscreen">
          <div className="sv-error-card">
            <div className="sv-error-stripe" style={{ background: 'linear-gradient(90deg,#94a3b8,#64748b)' }} />
            <div className="sv-error-body">
              <div className="sv-offline-icon" aria-hidden>🌙</div>
              <div className="sv-offline-title">Store is paused</div>
              <div className="sv-offline-desc">
                {pausedName} is temporarily closed. Please check back later or contact the seller through their other channels if you need help.
              </div>
              <button type="button" className="sv-error-btn" onClick={() => navigate('/')}>
                Go home
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Social links ── */
  type SocialLink = { label: string; url: string; icon: React.ReactNode };
  const siteWeb = (store.sellerWebsite || store.website)?.trim();
  const socialLinks: SocialLink[] = [
    store.instagram && { label: 'Instagram', url: store.instagram, icon: 'IG' },
    store.twitter && { label: 'Twitter/X', url: store.twitter, icon: '𝕏' },
    store.facebook && { label: 'Facebook', url: store.facebook, icon: 'FB' },
    siteWeb && { label: 'Website', url: webHref(siteWeb), icon: <IconLink /> },
  ].filter(Boolean) as SocialLink[];

  /* ── Main render ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="sv">
        <div className="sv-page">

          {/* ══ STORE HERO ══ */}
          <div className="sv-hero">
            <div className="sv-hero-bg" />
            <div className="sv-hero-inner">
              <div className="sv-hero-top">
                <div className="sv-logo">
                  {store?.sellerLogoUrl && !logoFailed && isPublicUrl(store.sellerLogoUrl)
                    ? <img src={store.sellerLogoUrl} alt={storeDisplayName} onError={() => setLogoFailed(true)} />
                    : <IconStore />}
                </div>
                <div className="sv-open-badge">
                  <div className="sv-open-dot" />
                  Open now
                </div>
              </div>

              <div className="sv-store-name">{storeDisplayName}</div>
              {heroSubtitle.primary ? <div className="sv-store-tagline">{heroSubtitle.primary}</div> : null}
              {heroSubtitle.secondary ? <div className="sv-store-desc">{heroSubtitle.secondary}</div> : null}

              <div className="sv-biz-chips">
                {displayLocation ? <span className="sv-biz-chip"><IconLoc />{displayLocation}</span> : null}
                {displayPhone ? <a className="sv-biz-chip" href={`tel:${displayPhone}`}><IconPhone />{displayPhone}</a> : null}
                {displayEmail ? (
                  <a className="sv-biz-chip" href={`mailto:${displayEmail}`}><IconMail />{displayEmail}</a>
                ) : null}
                {store.whatsapp && (
                  <a className="sv-biz-chip" href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                    <IconWA />WhatsApp
                  </a>
                )}
              </div>

              {socialLinks.length > 0 && (
                <div className="sv-socials">
                  {socialLinks.map((s) => (
                    <a key={s.label} className="sv-social-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label}>
                      {s.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══ STICKY SEARCH + FILTER NAV ══ */}
          <div className="sv-nav">
            <div className="sv-nav-row">
              <span className="sv-count-label">
                {searchQuery.trim() || selectedCategory !== 'all'
                  ? `${filteredProducts.length} of ${storeProducts.length} items`
                  : `${storeProducts.length} item${storeProducts.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {storeProducts.length > 0 && (
              <div className="sv-search-wrap">
                <span className="sv-search-icon">⌕</span>
                <input className="sv-search-input" type="text" placeholder="Search items…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && <button className="sv-search-clear" onClick={() => setSearchQuery('')}>×</button>}
              </div>
            )}
            {availableCategories.length > 0 && (
              <div className="sv-cats">
                <button className={`sv-cat${selectedCategory === 'all' ? ' active' : ''}`} onClick={() => setSelectedCategory('all')}>All</button>
                {availableCategories.map((cat) => (
                  <button key={cat} className={`sv-cat${selectedCategory === cat ? ' active' : ''}`} onClick={() => setSelectedCategory(cat)}>{cat}</button>
                ))}
                {hasUncategorized && (
                  <button className={`sv-cat${selectedCategory === 'uncategorized' ? ' active' : ''}`} onClick={() => setSelectedCategory('uncategorized')}>Other</button>
                )}
              </div>
            )}
          </div>

          {/* ══ 2-COL PRODUCT GRID ══ */}
          <div className="sv-grid">
            {productsLoading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
            {!productsLoading && storeProducts.length === 0 && (
              <div className="sv-empty"><div className="sv-empty-icon">🛍️</div><strong>No items yet</strong><p>Products will appear here once the seller adds them.</p></div>
            )}
            {!productsLoading && storeProducts.length > 0 && filteredProducts.length === 0 && (
              <div className="sv-empty"><div className="sv-empty-icon">🔍</div><strong>Nothing found</strong><p>Try a different search or category.</p></div>
            )}
            {!productsLoading && filteredProducts.map((product) => {
              const quantity = selectedProducts.get(product.id) || 0;
              const isSelected = quantity > 0;
              const catData = store.catalogueId ? getCatalogueData(product, store.catalogueId) : null;
              const { price, priceUnit } = getStorefrontPriceAndUnit(catData, catalogue, product);
              const qstep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
              const imgUrl = pickProductImageSrc(product);
              const calcDetail = quantity > 0 ? fmtCalc(quantity, price, priceUnit, currencySymbol) : null;
              return (
                <div key={product.id} className={`sv-pcard${isSelected ? ' selected' : ''}`}>
                  <div className="sv-pcard-img-wrap" onClick={() => setDrawerProduct(product)}>
                    {isDisplayableImageUrl(imgUrl)
                      ? <img src={String(imgUrl)} alt={product.name} />
                      : <div className="sv-pcard-img-ph"><IconImg size={32} /></div>}
                    {isSelected && <div className="sv-pcard-sel"><IconCheck /></div>}
                  </div>
                  <div className="sv-pcard-body">
                    <div className="sv-pcard-name">{product.name}</div>
                    {product.subtitle && <div className="sv-pcard-sub">{product.subtitle}</div>}
                    {price > 0 && (
                      <div className="sv-pcard-price">
                        {fmt(price, currencySymbol)}
                        {priceUnit && <span className="sv-pcard-price-unit">/{unitLabel(priceUnit)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="sv-pcard-footer">
                    <div className="sv-pcard-actions">
                      <QtyControl value={quantity} step={qstep} onChange={(d) => changeQty(product.id, d, qstep)} accent={isSelected} />
                      <button className="sv-details-btn" onClick={() => setDrawerProduct(product)}>Details</button>
                    </div>
                    {qstep > 1 && <div className="sv-pack-hint">📦 Pack of {qstep}</div>}
                  </div>
                  {isSelected && (
                    <div className="sv-pcard-subtotal">
                      {calcDetail && <span className="sv-pcard-subtotal-calc">{calcDetail}</span>}
                      <span className="sv-pcard-subtotal-val">{fmt(price * quantity, currencySymbol)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ══ FLOATING CART BAR ══ */}
          {selectedProductCount > 0 && step === 'products' && (
            <div className="sv-cart">
              <div className="sv-cart-inner" onClick={() => setStep('customer')}>
                <div className="sv-cart-info">
                  <span className="sv-cart-count">{selectedProductCount} item{selectedProductCount === 1 ? '' : 's'} selected</span>
                  <span className="sv-cart-total">{fmt(orderSummary.total, currencySymbol)}</span>
                </div>
                <button type="button" className="sv-cart-cta">Place Order →</button>
              </div>
            </div>
          )}
        </div>

        {/* ══ MORPHING PANEL — steps 2 & 3 ══ */}
        {(step === 'customer' || step === 'review') && (
          <div className="sv-panel">
            <div className="sv-panel-header">
              <button type="button" className="sv-panel-back" onClick={handleBack} aria-label="Go back">
                <IconBack />
              </button>
              <div className="sv-panel-title-wrap">
                <div className="sv-panel-title">{step === 'customer' ? 'Your details' : 'Review order'}</div>
                <div className="sv-panel-subtitle">{step === 'customer' ? 'Almost there — just a few details' : 'Confirm everything looks right'}</div>
              </div>
              <button className="sv-panel-cta" onClick={handlePanelAction} disabled={step === 'customer' ? !customerName.trim() : isSubmitting}>
                {step === 'customer' ? 'Review →' : isSubmitting ? 'Placing…' : 'Confirm'}
              </button>
            </div>

            <div style={{ padding: '16px 16px 0' }}>
              <StepBar current={step} />
            </div>

            {step === 'customer' && (
              <div className="sv-form-body">
                <div className="sv-field">
                  <label>Your Name *</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter your full name" autoFocus />
                </div>
                <div className="sv-field">
                  <label>WhatsApp Number</label>
                  <input type="text" value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} placeholder="+91 98xxxxxxxx" />
                </div>

                {/* Order Items with Quantity Controls */}
                {orderSummary.items.length > 0 && (
                  <>
                    <div style={{ marginTop: 8, paddingBottom: 8 }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--c-text3)', marginBottom: 10, fontFamily: 'var(--f-body)' }}>
                        Your Items
                      </div>
                      <div className="sv-review-list">
                        {orderSummary.items.map((item: any) => {
                          const catData = store?.catalogueId ? getCatalogueData(allProducts.find(p => p.id === item.productId), store.catalogueId) : null;
                          const qstep = catData ? normalizeOrderQuantityStep(catData.orderQuantityStep) : 1;
                          const cd = fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol);
                          return (
                            <div key={item.productId} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'flex', boxShadow: 'var(--shadow-sm)', flexDirection: 'column', gap: 10, padding: '12px', opacity: item.quantity === 0 ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ width: 80, height: 80, flexShrink: 0, background: 'var(--c-surface2)', overflow: 'hidden', position: 'relative', borderRadius: 'var(--r-md)' }}>
                                  {isDisplayableImageUrl(item.imageUrl)
                                    ? <img src={item.imageUrl} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconImg size={24} /></div>}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>{item.name}</div>
                                    {item.subtitle && <div style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{item.subtitle}</div>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <QtyControl value={item.quantity} step={qstep} onChange={(delta) => changeQty(item.productId, delta, qstep)} accent={item.quantity > 0} />
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-accent)' }}>{fmt(item.rowTotal, currencySymbol)}</span>
                                  </div>
                                </div>
                              </div>
                              {cd && (
                                <div style={{ fontSize: '11.5px', color: 'var(--c-text3)', paddingTop: 4, borderTop: '1px solid var(--c-border)' }}>
                                  {cd}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="sv-order-pill">
                      <div>
                        <div className="sv-order-pill-label">Total</div>
                        <div className="sv-order-pill-detail">{orderSummary.items.length} item{orderSummary.items.length === 1 ? '' : 's'}</div>
                      </div>
                      <div className="sv-order-pill-total">{fmt(orderSummary.total, currencySymbol)}</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 'review' && (
              <>
                <div className="sv-review-list">
                  {reviewSummary.items.map((item: any) => {
                    const cd = fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol);
                    return (
                      <div key={item.productId} className="sv-rcard">
                        <div style={{ width: 80, height: 80, flexShrink: 0, background: 'var(--c-surface2)', overflow: 'hidden', position: 'relative', borderRadius: 'var(--r-md)' }}>
                          {isDisplayableImageUrl(item.imageUrl)
                            ? <img src={item.imageUrl} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconImg size={24} /></div>}
                        </div>
                        <div className="sv-rcard-body">
                          <div><div className="sv-rcard-name">{item.name}</div>{item.subtitle && <div className="sv-rcard-sub">{item.subtitle}</div>}</div>
                          <div className="sv-rcard-bottom">{cd && <span className="sv-rcard-calc">{cd}</span>}<span className="sv-rcard-total">{fmt(item.rowTotal, currencySymbol)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="sv-review-customer">
                  <div className="sv-review-customer-label">Ordering as</div>
                  <div className="sv-review-customer-name">{customerName}</div>
                  {customerWhatsapp && <div className="sv-review-customer-phone">{customerWhatsapp}</div>}
                </div>
                <div className="sv-review-total-bar">
                  <div>
                    <div className="sv-review-total-label">Total amount</div>
                    <div className="sv-review-total-val">{fmt(reviewSummary.total, currencySymbol)}</div>
                  </div>
                  <button type="button" className="sv-edit-btn" onClick={() => setStep('customer')}>Edit items</button>
                </div>
              </>
            )}
          </div>
        )}

        {sellerWhatsappDigits && !drawerProduct && (step === 'products' || step === 'customer' || step === 'review') && (
          <a
            className={`sv-fab-wa${step === 'products' && selectedProductCount > 0 ? ' sv-fab-wa--above-cart' : ''}`}
            href={`https://wa.me/${sellerWhatsappDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with seller on WhatsApp"
          >
            <IconWAFab />
          </a>
        )}

        {/* ══ PRODUCT DETAIL DRAWER ══ */}
        {drawerProduct && (() => {
          const catData = store.catalogueId ? getCatalogueData(drawerProduct, store.catalogueId) : null;
          const { price, priceUnit } = getStorefrontPriceAndUnit(catData, catalogue, drawerProduct);
          const qstep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
          const quantity = selectedProducts.get(drawerProduct.id) || 0;
          const calcDetail = quantity > 0 ? fmtCalc(quantity, price, priceUnit, currencySymbol) : null;
          const fields = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const value = (drawerProduct as Record<string, unknown>)[`field${n}`];
            if (value == null || String(value).trim() === '') return null;
            const { label, unitSuffix } = fieldLU(drawerProduct, n);
            return { label, value: unitSuffix ? `${String(value)} ${unitSuffix}` : String(value) };
          }).filter(Boolean) as Array<{ label: string; value: string }>;
          const imgUrl = pickProductImageSrc(drawerProduct);
          return (
            <div ref={overlayRef} className="sv-overlay" onClick={(e) => { if (e.target === overlayRef.current) setDrawerProduct(null); }}>
              <div ref={drawerRef} className="sv-drawer">
                <div className="sv-drawer-handle" />
                <div className="sv-drawer-img-wrap">
                  {isDisplayableImageUrl(imgUrl)
                    ? <img src={String(imgUrl)} alt={drawerProduct.name} />
                    : <div className="sv-drawer-img-ph"><IconImg size={48} /></div>}
                  <button className="sv-drawer-close" onClick={() => setDrawerProduct(null)}>✕</button>
                </div>
                <div className="sv-drawer-body">
                  <div className="sv-drawer-name">{drawerProduct.name}</div>
                  {drawerProduct.subtitle && <div className="sv-drawer-sub">{drawerProduct.subtitle}</div>}
                  {getCats(drawerProduct).length > 0 && (
                    <div className="sv-drawer-cats">{getCats(drawerProduct).map((c) => <span key={c} className="sv-drawer-cat">{c}</span>)}</div>
                  )}
                  <div className="sv-drawer-price">
                    {price > 0 ? (
                      <>
                        {fmt(price, currencySymbol)}
                        {priceUnit && <span>/ {unitLabel(priceUnit)}</span>}
                      </>
                    ) : (
                      <span style={{ color: 'var(--c-text3)', fontWeight: 400 }}>Price on request</span>
                    )}
                  </div>
                  {fields.length > 0 && (
                    <div className="sv-detail-table">
                      {fields.map((f) => <div key={`${f.label}-${f.value}`} className="sv-detail-row"><span className="sv-detail-lbl">{f.label}</span><span className="sv-detail-val">{f.value}</span></div>)}
                    </div>
                  )}
                  <div className="sv-drawer-qty-section">
                    <div className="sv-drawer-qty-label">Quantity</div>
                    <div className="sv-drawer-qty-row">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <QtyControl value={quantity} step={qstep} onChange={(d) => changeQty(drawerProduct.id, d, qstep)} accent={quantity > 0} />
                        {qstep > 1 && <div className="sv-pack-hint">📦 Pack of {qstep}</div>}
                      </div>
                      <div className="sv-drawer-total-wrap">
                        {calcDetail && <div className="sv-drawer-calc">{calcDetail}</div>}
                        <div className="sv-drawer-total">{fmt(price * quantity, currencySymbol)}</div>
                      </div>
                    </div>
                    <button className="sv-drawer-done" onClick={() => setDrawerProduct(null)}>Done</button>
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
