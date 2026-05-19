import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getStoreBySlug, getStoreProducts, sortProductsBySupabaseRowOrder, type StorePublic } from '../services/storeService';
import {
  isProductEnabledForCatalogue,
  isProductInStockForCatalogue,
  getCatalogueData,
  normalizeOrderQuantityStep,
  type CatalogueData,
  type ProductWithCatalogueData,
} from '../config/catalogueProductUtils';
import {
  ensureCataloguesForStorefront,
  inferCatalogueStubFromRowData,
  type Catalogue,
} from '../config/catalogueConfig';
import { createOrder, type OrderItem } from '../services/orderService';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';
import { getFieldsDefinition, isFieldVisibleOnSurface } from '../config/fieldConfig';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { getProductImageUrls, getPrimaryImageIndex } from '../utils/productImages';
import ProductImageGallery from '../components/ProductImageGallery';
import ProductVariantsDisplay from '../components/ProductVariantsDisplay';
import {
  formatVariantSelectionSummary,
  getProductVariantGroups,
  isVariantSelectionComplete,
} from '../utils/productVariants';
import { getStorePathFallbackBaseUrl, resolveStoreSlugFromHostname } from '../utils/storefrontDomain';
import { resolveListOfferEffective } from '../utils/offerPriceUtils';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import './OrderForm.css';

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

.sv { font-family: var(--f-body); background: var(--c-bg); min-height: 100vh; color: var(--c-text); -webkit-font-smoothing: antialiased; position: relative; }
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
.sv-footer { margin: 14px 12px 80px; padding: 14px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); }
.sv-footer-title { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--c-text3); margin-bottom: 10px; }
.sv-footer .sv-biz-chips { margin-top: 0; }
.sv-footer .sv-socials { margin-top: 10px; }
.sv-footer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.sv-footer-brand { font-family: var(--f-head); font-size: 22px; line-height: 1.1; letter-spacing: -0.3px; color: var(--c-text); }
.sv-footer-note { font-size: 12px; color: var(--c-text3); margin-top: 4px; line-height: 1.5; max-width: 520px; }
.sv-footer-status { display: inline-flex; align-items: center; gap: 6px; background: var(--c-accent-light); border: 1px solid rgba(26,107,74,0.2); border-radius: var(--r-full); padding: 5px 11px; font-size: 11px; font-weight: 600; color: var(--c-accent); white-space: nowrap; }
.sv-footer-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.sv-footer-col { background: var(--c-surface2); border: 1px solid var(--c-border); border-radius: var(--r-md); padding: 12px; }
.sv-footer-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--c-text2); margin-bottom: 8px; }
.sv-footer-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.sv-footer-item { font-size: 12px; color: var(--c-text2); line-height: 1.45; }
.sv-footer-link { color: var(--c-text2); text-decoration: none; border-bottom: 1px dashed transparent; transition: border-color var(--trans), color var(--trans); }
.sv-footer-link:hover { color: var(--c-text); border-bottom-color: var(--c-border2); }
.sv-footer-muted { font-size: 11px; color: var(--c-text3); margin-top: 10px; text-align: center; }

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
.sv-list { display: flex; flex-direction: column; gap: 8px; padding: 12px 12px 140px; }

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
.sv-price-strike {
  text-decoration: line-through;
  font-size: 0.75em;
  opacity: 0.75;
  font-weight: 600;
  margin-left: 6px;
}

.sv-pcard-footer { padding: 7px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
.sv-pcard-actions { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.sv-details-btn { font-size: 11px; color: var(--c-accent); background: none; border: none; cursor: pointer; font-family: var(--f-body); padding: 0; font-weight: 500; letter-spacing: 0.1px; }
.sv-details-btn:hover { text-decoration: underline; text-underline-offset: 2px; }

.sv-pcard-subtotal { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--c-accent-light); border-radius: var(--r-sm); border: 1px solid rgba(26,107,74,0.15); margin: 0 10px 10px; }
.sv-pcard-subtotal-calc { font-size: 10.5px; color: var(--c-text3); }
.sv-pcard-subtotal-val { font-size: 13px; font-weight: 700; color: var(--c-accent); font-family: var(--f-body); }

/* List mode uses OrderForm.css (of-item-card). Preserve storefront page background if shared with OrderForm styles. */
body { background: var(--c-bg); }
.sv-of-items--store.of-items { padding: 12px 12px 140px; }

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
.sv-cart-inner { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; background: var(--c-text); border-radius: var(--r-xl); padding: 10px 10px 10px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1); pointer-events: all; column-gap: 12px; row-gap: 2px; cursor: pointer; animation: sv-cart-in 0.28s cubic-bezier(0.34,1.4,0.64,1); }
@keyframes sv-cart-in { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
.sv-cart-info { display: flex; flex-direction: column; gap: 1px; }
.sv-cart-count { font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 500; }
.sv-cart-total { font-family: var(--f-body); font-size: 19px; font-weight: 700; color: white; letter-spacing: -0.4px; }
.sv-cart-note { font-size: 10.5px; color: rgba(255,255,255,0.72); font-weight: 500; margin-top: 1px; }
.sv-cart-note--below { grid-column: 1 / -1; margin-top: 2px; padding-right: 10px; text-align: left; }
.sv-cart-cta { flex-shrink: 0; justify-self: end; align-self: start; height: 40px; padding: 0 18px; border-radius: var(--r-full); background: var(--c-accent); color: white; font-size: 13px; font-weight: 600; font-family: var(--f-body); border: none; cursor: pointer; letter-spacing: 0.1px; transition: opacity var(--trans); white-space: nowrap; }
.sv-cart-cta:hover { opacity: 0.88; }
.sv-cart-cta:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Seller WhatsApp FAB (public contact) ── */
.sv-fab-wa { position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: calc(20px + env(safe-area-inset-bottom)); z-index: 210; width: 56px; height: 56px; border-radius: 50%; background: #25d366; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(37, 211, 102, 0.45); transition: transform 0.2s ease, box-shadow 0.2s ease; text-decoration: none; pointer-events: all; }
.sv-fab-wa:hover { transform: scale(1.06); box-shadow: 0 6px 22px rgba(37, 211, 102, 0.55); }
.sv-fab-wa:active { transform: scale(0.96); }
.sv-fab-wa--above-cart { bottom: calc(108px + env(safe-area-inset-bottom)); }

/* ── Morphing panel ── */
.sv-panel { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; background: var(--c-bg); z-index: 120; display: flex; flex-direction: column; animation: sv-panel-in 0.3s cubic-bezier(0.32,0.72,0,1); overflow-y: auto; }
@keyframes sv-panel-in { from{opacity: 0} to{opacity: 1} }

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
.sv-phone-group { display: flex; gap: 10px; align-items: flex-end; }
.sv-phone-group-country { flex: 0 0 110px; }
.sv-phone-group-country select { width: 100%; height: 48px; background: var(--c-surface); border: 1px solid var(--c-border2); border-radius: var(--r-md); color: var(--c-text); font-size: 14px; font-family: var(--f-body); padding: 0 12px; outline: none; transition: border-color var(--trans), box-shadow var(--trans); cursor: pointer; }
.sv-phone-group-country select:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(26,107,74,0.08); }
.sv-phone-group-number { flex: 1; }
.sv-phone-group-number input { width: 100%; height: 48px; background: var(--c-surface); border: 1px solid var(--c-border2); border-radius: var(--r-md); color: var(--c-text); font-size: 15px; font-family: var(--f-body); padding: 0 16px; outline: none; transition: border-color var(--trans), box-shadow var(--trans); }
.sv-phone-group-number input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(26,107,74,0.08); }
.sv-phone-group-number input::placeholder { color: var(--c-text3); }
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
.sv-drawer-img-wrap--gallery { aspect-ratio: 1; max-height: min(72vh, 440px); }
.sv-drawer-img-wrap--gallery .sv-store-gallery { height: 100%; }
.sv-drawer-img-ph { width: 100%; min-height: 180px; display: flex; align-items: center; justify-content: center; }
.sv-pcard-img-wrap .sv-store-gallery,
.of-img-wrap .sv-store-gallery { position: absolute; inset: 0; height: 100%; }
.sv-pcard-img-wrap .sv-store-gallery > div,
.of-img-wrap .sv-store-gallery > div { height: 100%; }
.sv-drawer-close { position: absolute; top: 10px; right: 10px; z-index: 20; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.88); border: 1px solid var(--c-border2); cursor: pointer; color: var(--c-text); font-size: 13px; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); }
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

/* ── Desktop responsiveness ── */
@media (min-width: 900px) {
  .sv-page {
    max-width: 1200px;
    padding: 20px 20px 36px;
  }

  .sv-hero {
    border: 1px solid var(--c-border);
    border-radius: var(--r-xl);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .sv-hero-inner {
    padding: 28px 30px 24px;
  }

  .sv-store-name {
    font-size: 34px;
  }

  .sv-store-tagline,
  .sv-store-desc {
    max-width: 760px;
  }

  .sv-nav {
    top: 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    margin-top: 14px;
    margin-bottom: 12px;
    box-shadow: var(--shadow-sm);
  }

  .sv-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    padding: 8px 0 160px;
  }

  .sv-of-items--store.of-items {
    padding: 8px 12px 160px;
  }

  .sv-footer {
    margin: 18px 0 10px;
    padding: 16px 18px;
  }

  .sv-footer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .sv-cart {
    max-width: 1200px;
    padding-left: 24px;
    padding-right: 24px;
  }
}

@media (min-width: 1200px) {
  .sv-footer-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .sv-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
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
function fmtCalc(qty: number, price: number, u: string | undefined, sym: string, qstep: number = 1): string | null {
  if (qty <= 0 || !Number.isFinite(price)) return null;
  return `${qty} ${unitLabel(u)} × ${fmt(price, sym)}`;
}

/** Same logic as OrderForm `getOrderUnitLabel` for list-row parity */
function getOrderFormUnitLabel(priceUnit: string | undefined): string {
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

/** Same shape as OrderForm `formatLineCalculationDetail` (storefront uses numeric unit price). */
function formatStorefrontLineCalculationDetail(
  q: number,
  unitPrice: number,
  priceUnit: string | undefined,
  currencySymbol: string
): string | null {
  if (q <= 0) return null;
  if (!Number.isFinite(unitPrice)) return null;
  const label = getOrderFormUnitLabel(priceUnit);
  const priceStr = fmt(unitPrice, currencySymbol);
  return `${q} ${label} × ${priceStr}`;
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

/** Cache-bust HTTPS product images; leave data URLs unchanged. */
function displayStoreProductImage(p: ProductWithCatalogueData | Record<string, unknown>): string | undefined {
  const raw = pickProductImageSrc(p);
  if (!raw) return undefined;
  if (raw.startsWith('data:image/')) return raw;
  const r = p as Record<string, unknown>;
  const v = r.imageVersion ?? r.image_version;
  const ver = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return productImageDisplayUrl(raw, ver);
}

function getStoreProductGalleryProps(p: ProductWithCatalogueData | Record<string, unknown>) {
  const urls = getProductImageUrls(p);
  const primaryIndex = getPrimaryImageIndex(p);
  const r = p as Record<string, unknown>;
  const v = r.imageVersion ?? r.image_version;
  const primaryImageVersion =
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return { urls, primaryIndex, primaryImageVersion };
}

function StoreProductImageArea({
  product,
  variant,
}: {
  product: ProductWithCatalogueData;
  variant: 'card' | 'drawer';
}) {
  const { urls, primaryIndex, primaryImageVersion } = getStoreProductGalleryProps(product);
  const fallback = displayStoreProductImage(product);

  if (urls.length > 1) {
    return (
      <ProductImageGallery
        urls={urls}
        primaryIndex={primaryIndex}
        primaryImageVersion={primaryImageVersion}
        fillContainer
        objectFit={variant === 'card' ? 'cover' : 'contain'}
        showPrimaryBadge={false}
        className="sv-store-gallery"
      />
    );
  }

  if (isDisplayableImageUrl(fallback)) {
    return (
      <img
        key={String(fallback)}
        src={String(fallback)}
        alt={product.name}
        style={
          variant === 'card'
            ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
            : { display: 'block', width: '100%', height: 'auto' }
        }
      />
    );
  }

  return (
    <div className={variant === 'card' ? 'sv-pcard-img-ph' : 'sv-drawer-img-ph'}>
      <IconImg size={variant === 'card' ? 32 : 48} />
    </div>
  );
}

/**
 * Public store visitors may not have the seller's custom catalogue in localStorage.
 * When catalogue config is missing, still read price from product.catalogueData using price1…price10.
 * If merged catalogue row has empty prices but the product still has top-level price fields (legacy), use those.
 * `price` is always the unit price buyers pay (sale price when offer is set). `listPrice` + `showOffer` drive UI.
 */
function getStorefrontPriceAndUnit(
  catData: CatalogueData | null | undefined,
  catalogue: Catalogue | null,
  product?: ProductWithCatalogueData | null
): { price: number; priceUnit?: string; listPrice?: number; showOffer: boolean } {
  const pr = product as Record<string, unknown> | null | undefined;

  const pack = (
    res: ReturnType<typeof resolveListOfferEffective>,
    priceUnit: string | undefined
  ): { price: number; priceUnit?: string; listPrice?: number; showOffer: boolean } => {
    const unit = Number.isFinite(res.effectiveUnitPrice) ? res.effectiveUnitPrice : 0;
    const pay = unit > 0 ? unit : res.listPrice;
    return {
      price: pay,
      priceUnit,
      listPrice: res.showStrikeout ? res.listPrice : undefined,
      showOffer: res.showStrikeout,
    };
  };

  // Linked catalogue row is the source of truth for the store: empty price → 0 (do not fall through to legacy top-level prices).
  if (catalogue && catData) {
    const res = resolveListOfferEffective(catData, catalogue.priceField, pr ?? null);
    const priceUnit = catData[catalogue.priceUnitField as keyof CatalogueData] as string | undefined;
    return pack(res, priceUnit);
  }

  if (catData && !catalogue) {
    for (let n = 1; n <= 10; n++) {
      const pf = `price${n}`;
      const res = resolveListOfferEffective(catData, pf, pr ?? null);
      if (res.effectiveUnitPrice > 0 || res.listPrice > 0) {
        const uk = `price${n}Unit` as keyof CatalogueData;
        return pack(res, catData[uk] as string | undefined);
      }
    }
  }

  if (catalogue && pr) {
    const res = resolveListOfferEffective(catData ?? ({} as CatalogueData), catalogue.priceField, pr);
    const priceUnit =
      (catData?.[catalogue.priceUnitField as keyof CatalogueData] as string | undefined) ??
      (pr[catalogue.priceUnitField] as string | undefined);
    if (res.effectiveUnitPrice > 0 || res.listPrice > 0) {
      return pack(res, priceUnit);
    }
  }

  if (pr) {
    for (let n = 1; n <= 10; n++) {
      const res = resolveListOfferEffective(catData ?? ({} as CatalogueData), `price${n}`, pr);
      if (res.effectiveUnitPrice > 0 || res.listPrice > 0) {
        return pack(res, pr[`price${n}Unit`] as string | undefined);
      }
    }
  }

  return { price: 0, priceUnit: undefined, showOffer: false };
}
function getCats(p: ProductWithCatalogueData): string[] {
  return Array.from(new Set((p.category || []).map((c: string) => String(c).trim()).filter(Boolean)));
}
function srchText(p: ProductWithCatalogueData): string {
  const ex = Array.from({ length: 10 }, (_, i) => { const n = i + 1; const r = p as unknown as Record<string, string | undefined>; return [r[`field${n}`], r[`field${n}Label`], r[`field${n}Unit`]].filter(Boolean).join(' '); });
  return [p.name, p.subtitle, ...(p.category || []), ...ex].filter(Boolean).join(' ').toLowerCase();
}
/**
 * Public store: detail text may live on `catalogueData[storeCatalogueId]`, top-level (Master), or another slice.
 * Anonymous / partial RPC payloads sometimes omit the linked slice — scan so deploy matches seller localhost.
 */
function pickStorefrontDetailField(
  product: ProductWithCatalogueData,
  preferredCatalogueId: string | undefined,
  n: number
): { text: string; unitSuffix: string } | null {
  const key = `field${n}`;
  const unitKey = `field${n}Unit`;
  const tryRow = (row: Record<string, unknown> | null | undefined): { text: string; unitSuffix: string } | null => {
    if (!row || typeof row !== 'object') return null;
    const v = row[key];
    if (v == null || String(v).trim() === '') return null;
    const u = row[unitKey];
    const unitSuffix =
      u != null && String(u).trim() !== '' && String(u).trim() !== 'None' ? String(u).trim() : '';
    return { text: String(v).trim(), unitSuffix };
  };

  const cid = String(preferredCatalogueId ?? '').trim();
  if (cid) {
    const primary = getCatalogueData(product, cid) as unknown as Record<string, unknown>;
    const a = tryRow(primary);
    if (a) return a;
  }
  const top = tryRow(product as unknown as Record<string, unknown>);
  if (top) return top;
  const map = product.catalogueData;
  if (map && typeof map === 'object') {
    const ids = Object.keys(map).sort((x, y) => {
      if (x === 'cat1') return -1;
      if (y === 'cat1') return 1;
      return x.localeCompare(y);
    });
    for (const id of ids) {
      const sub = map[id];
      if (!sub || typeof sub !== 'object') continue;
      const b = tryRow(sub as Record<string, unknown>);
      if (b) return b;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────────── */
const IconBack = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
const IconStore = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: '#aaa' }}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>;
const IconImg = ({ size = 28 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;
/** OrderForm list placeholder icon */
function ImgIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
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
const IconCheck = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconLoc = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconPhone = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 010 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" /></svg>;
const IconMail = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
const IconLink = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
const IconInstagram = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3.5" y="3.5" width="17" height="17" rx="5" ry="5" /><circle cx="12" cy="12" r="4.1" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
const IconTwitterX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.244 2H21l-6.02 6.88L22 22h-5.563l-4.36-5.89L6.92 22H4.16l6.44-7.36L2 2h5.704l3.94 5.31L18.244 2zm-.968 18.21h1.54L6.87 3.69H5.217L17.276 20.21z" /></svg>;
const IconFacebook = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.89h2.77l-.44 2.9h-2.33V22c4.78-.75 8.43-4.91 8.43-9.93z" /></svg>;
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

/** Same markup/classes as OrderForm `QtyControl` (list storefront rows). */
function OrderFormQtyControl({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (delta: number) => void;
}) {
  const s = Math.max(1, Math.floor(normalizeOrderQuantityStep(step)) || 1);
  const inc = s > 1 ? s : 1;
  return (
    <div className="of-qty">
      <button type="button" className="of-qty-btn" onClick={() => onChange(-inc)}>−</button>
      <span className="of-qty-val">{value}</span>
      <button type="button" className="of-qty-btn" onClick={() => onChange(inc)}>+</button>
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
  const location = useLocation();
  const { guardOnline } = useCloudWriteGate();
  const { slug } = useParams<{ slug: string }>();
  const hostSlug = useMemo(() => resolveStoreSlugFromHostname(), []);
  const effectiveSlug = slug || hostSlug || null;

  // Canonical URL: when subdomain already identifies the store, keep path at "/".
  useEffect(() => {
    if (!hostSlug || !slug) return;
    if (hostSlug !== slug) return;
    if (location.pathname === '/') return;
    navigate('/', { replace: true });
  }, [hostSlug, slug, location.pathname, navigate]);

  const [step, setStep] = useState<Step>('products');
  const [store, setStore] = useState<StorePublic | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<ProductWithCatalogueData[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsappCountry, setCustomerWhatsappCountry] = useState('+91');
  const [customerWhatsappNumber, setCustomerWhatsappNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [drawerProduct, setDrawerProduct] = useState<ProductWithCatalogueData | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, Record<string, string>>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathFallbackSentRef = useRef(false);
  /** Latest slug for tab-visibility refetch (avoid stale closure). */
  const effectiveSlugRef = useRef(effectiveSlug);
  effectiveSlugRef.current = effectiveSlug;

  // Scroll drawer to top when product is selected
  useEffect(() => {
    if (drawerProduct && drawerRef.current) {
      drawerRef.current.scrollTop = 0;
    }
  }, [drawerProduct]);

  useEffect(() => {
    if (!effectiveSlug) { setStoreError('Store not found'); setStoreLoading(false); return; }
    setStoreLoading(true);
    getStoreBySlug(effectiveSlug).then((r) => { if (!r.success || !r.data) setStoreError(r.error || 'Store not found'); else setStore(r.data); setStoreLoading(false); });
  }, [effectiveSlug]);

  /** If the SPA loads on a seller subdomain but the store cannot be loaded, send users to the path-based URL on the public app host (edge middleware handles the hard 403 case). */
  useEffect(() => {
    if (storeLoading || !storeError || !hostSlug || slug) return;
    if (pathFallbackSentRef.current) return;
    const base = getStorePathFallbackBaseUrl();
    const normalizeHost = (h: string) => h.trim().toLowerCase().replace(/\.+$/, '');
    let targetHost = '';
    try {
      targetHost = normalizeHost(new URL(base).hostname);
    } catch {
      return;
    }
    if (!targetHost || targetHost === normalizeHost(window.location.hostname)) return;
    pathFallbackSentRef.current = true;
    window.location.replace(`${base}/store/${encodeURIComponent(hostSlug)}${window.location.search || ''}`);
  }, [storeLoading, storeError, hostSlug, slug]);

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
    const cats = ensureCataloguesForStorefront(store.cataloguesDefinition, store.catalogueId);
    getStoreProducts(store.sellerUserId, cats).then((result) => {
      if (result.success && result.products) {
        setAllProducts(result.products);
      }
      setProductsLoading(false);
    });
  }, [store?.sellerUserId, store?.isLive, store?.catalogueId, store?.cataloguesDefinition]);

  /** Temporary diagnostics: set `VITE_DEBUG_STOREFRONT=true` (or run dev) and check console for catalogue merge issues. Remove when done. */
  useEffect(() => {
    const on =
      import.meta.env.DEV === true || String(import.meta.env.VITE_DEBUG_STOREFRONT || '') === 'true';
    if (!on || !store) return;
    console.warn('[StoreView] catalogueId:', store.catalogueId);
    console.warn('[StoreView] cataloguesDefinition length:', store.cataloguesDefinition?.length ?? 0, store.cataloguesDefinition);
  }, [store]);

  /** Re-hit Supabase when user returns to the tab or restores from bfcache — no local product/store cache in StoreView. */
  useEffect(() => {
    const reloadFromCloud = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const slug = effectiveSlugRef.current;
      if (!slug) return;
      void getStoreBySlug(slug).then((r) => {
        if (!r.success || !r.data) return;
        setStoreError(null);
        setStore(r.data);
        if (r.data.sellerUserId && r.data.isLive !== false) {
          setProductsLoading(true);
          const cats = ensureCataloguesForStorefront(r.data.cataloguesDefinition, r.data.catalogueId);
          void getStoreProducts(r.data.sellerUserId, cats).then((result) => {
            if (result.success && result.products) {
              setAllProducts(result.products);
            }
            setProductsLoading(false);
          });
        } else {
          setAllProducts([]);
          setProductsLoading(false);
        }
      });
    };

    const onVisibility = () => reloadFromCloud();
    const onPageShow = (e: Event) => {
      if ((e as PageTransitionEvent).persisted) reloadFromCloud();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const catalogues = useMemo(
    () => ensureCataloguesForStorefront(store?.cataloguesDefinition, store?.catalogueId),
    [store?.cataloguesDefinition, store?.catalogueId]
  );
  const currencySymbol = useMemo(() => getSymbolForCurrencyCode(store?.sellerCurrencyCode || 'INR'), [store?.sellerCurrencyCode]);

  /** Same order as `public.products.position` (int8), even if RPC returns rows out of order. */
  const productsInTableOrder = useMemo(
    () => sortProductsBySupabaseRowOrder(allProducts),
    [allProducts]
  );

  /** Prefer cloud definition; if custom `cat…` id is missing there, infer `priceField` from `catalogueData[id]` on a real product row (matches Supabase JSON). */
  const catalogue = useMemo((): Catalogue | null => {
    const id = store?.catalogueId;
    if (!id) return null;
    const fromDef = catalogues.find((c) => c.id === id);
    if (fromDef) return fromDef;
    const sample = productsInTableOrder.find((p) => {
      const cd = p.catalogueData?.[id];
      return cd != null && typeof cd === 'object';
    });
    const raw = sample?.catalogueData?.[id] as Record<string, unknown> | undefined;
    return inferCatalogueStubFromRowData(id, raw);
  }, [catalogues, store?.catalogueId, productsInTableOrder]);

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
      const quantityStep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
      const rowTotal = unitPrice * quantity;
      const pr = product as Record<string, unknown>;
      const iv = pr.imageVersion ?? pr.image_version;
      items.push({
        productId,
        name: product.name,
        quantity,
        unitPrice,
        rowTotal,
        priceUnit,
        quantityStep,
        imageUrl: pickProductImageSrc(product),
        imageVersion: typeof iv === 'number' && Number.isFinite(iv) ? iv : undefined,
        subtitle: product.subtitle,
        variantSummary: formatVariantSelectionSummary(
          getProductVariantGroups(product),
          variantSelections[productId]
        ),
      });
      total += rowTotal;
    });
    return { items, total };
  }, [selectedProducts, store, catalogue, allProducts, variantSelections]);

  const selectedProductCount = useMemo(() => Array.from(selectedProducts.values()).filter((q) => q > 0).length, [selectedProducts]);
  const minimumOrderValue = useMemo(() => {
    const n = store?.minimumOrderValue;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  }, [store?.minimumOrderValue]);
  const minimumOrderMet = orderSummary.total >= minimumOrderValue;
  const remainingToMinimum = Math.max(0, minimumOrderValue - orderSummary.total);

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
    for (const item of reviewSummary.items) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) continue;
      const groups = getProductVariantGroups(product);
      if (
        groups.length > 0 &&
        !isVariantSelectionComplete(groups, variantSelections[item.productId])
      ) {
        alert(`Please choose all variants for "${item.name}" before placing the order.`);
        setDrawerProduct(product);
        setStep('products');
        return;
      }
    }
    if (minimumOrderValue > 0 && reviewSummary.total < minimumOrderValue) {
      alert(
        `Minimum order value is ${fmt(minimumOrderValue, currencySymbol)}. Please add ${fmt(
          minimumOrderValue - reviewSummary.total,
          currencySymbol
        )} more to place the order.`
      );
      return;
    }
    if (!guardOnline()) return;
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
          imageVersion: item.imageVersion,
          quantityStep: catData.orderQuantityStep,
          variantSummary: item.variantSummary || undefined,
        });
      });
      setSupabaseRlsUserId(store.sellerUserId);
      const fullWhatsappNumber = customerWhatsappNumber.trim() ? `${customerWhatsappCountry}${customerWhatsappNumber.trim()}` : undefined;
      const { error } = await createOrder(store.sellerUserId, '', customerName.trim(), orderItems, reviewSummary.total, store.sellerCurrencyCode || 'INR', fullWhatsappNumber, 'store');
      if (error) alert('Failed to place order. Please try again.');
      else {
        alert('Order placed! The seller will contact you soon.');
        setStep('products');
        setSelectedProducts(new Map());
        setCustomerName('');
        setCustomerWhatsappCountry('+91');
        setCustomerWhatsappNumber('');
        setDrawerProduct(null);
        setVariantSelections({});
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
    if (minimumOrderValue > 0 && orderSummary.total < minimumOrderValue) {
      alert(
        `Minimum order value is ${fmt(minimumOrderValue, currencySymbol)}. Please add ${fmt(
          minimumOrderValue - orderSummary.total,
          currencySymbol
        )} more.`
      );
      return;
    }
    if (step === 'customer') {
      if (!customerName.trim()) { alert('Please enter your name'); return; }
      if (!customerWhatsappNumber.trim()) { alert('Please enter your WhatsApp number'); return; }
      setStep('review');
    }
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
  const ig = store.instagram?.trim();
  const tw = store.twitter?.trim();
  const fb = store.facebook?.trim();
  const siteWeb = (store.sellerWebsite || store.website)?.trim();
  const socialLinks: SocialLink[] = [
    ig && { label: 'Instagram', url: webHref(ig), icon: <IconInstagram /> },
    tw && { label: 'Twitter/X', url: webHref(tw), icon: <IconTwitterX /> },
    fb && { label: 'Facebook', url: webHref(fb), icon: <IconFacebook /> },
    siteWeb && { label: 'Website', url: webHref(siteWeb), icon: <IconLink /> },
  ].filter(Boolean) as SocialLink[];

  const hasFooterDetails = Boolean(
    displayLocation ||
    displayPhone ||
    displayEmail ||
    store?.whatsapp ||
    socialLinks.length > 0
  );
  const storefrontViewMode: 'grid' | 'list' = store.viewMode === 'list' ? 'list' : 'grid';

  const renderStoreFooter = () => (
    <footer className="sv-footer">
      <div className="sv-footer-head">
        <div>
          <div className="sv-footer-brand">{storeDisplayName}</div>
          {heroSubtitle.primary ? <div className="sv-footer-note">{heroSubtitle.primary}</div> : null}
        </div>
        <div className="sv-footer-status">
          <span className="sv-open-dot" />
          Open now
        </div>
      </div>

      <div className="sv-footer-grid">
        <section className="sv-footer-col">
          <div className="sv-footer-col-title">Location</div>
          <ul className="sv-footer-list">
            <li className="sv-footer-item">
              {displayLocation || 'Address not provided'}
            </li>
          </ul>
        </section>

        <section className="sv-footer-col">
          <div className="sv-footer-col-title">Contact</div>
          <ul className="sv-footer-list">
            {displayPhone ? (
              <li className="sv-footer-item">
                <a className="sv-footer-link" href={`tel:${displayPhone}`}>Call: {displayPhone}</a>
              </li>
            ) : null}
            {displayEmail ? (
              <li className="sv-footer-item">
                <a className="sv-footer-link" href={`mailto:${displayEmail}`}>Email: {displayEmail}</a>
              </li>
            ) : null}
            {store.whatsapp ? (
              <li className="sv-footer-item">
                <a
                  className="sv-footer-link"
                  href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp: {store.whatsapp}
                </a>
              </li>
            ) : null}
            {!displayPhone && !displayEmail && !store.whatsapp ? (
              <li className="sv-footer-item">Contact details not provided</li>
            ) : null}
          </ul>
        </section>

        <section className="sv-footer-col">
          <div className="sv-footer-col-title">Store Info</div>
          <ul className="sv-footer-list">
            <li className="sv-footer-item">Currency: {store.sellerCurrencyCode || 'INR'}</li>
            {minimumOrderValue > 0 ? (
              <li className="sv-footer-item">Minimum order: {fmt(minimumOrderValue, currencySymbol)}</li>
            ) : null}
            <li className="sv-footer-item">
              {storeProducts.length} item{storeProducts.length === 1 ? '' : 's'} listed
            </li>
            <li className="sv-footer-item">
              {availableCategories.length} categor{availableCategories.length === 1 ? 'y' : 'ies'}
            </li>
          </ul>
        </section>

        <section className="sv-footer-col">
          <div className="sv-footer-col-title">Follow</div>
          {socialLinks.length > 0 ? (
            <div className="sv-socials">
              {socialLinks.map((s) => (
                <a key={s.label} className="sv-social-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label}>
                  {s.icon}
                </a>
              ))}
            </div>
          ) : (
            <ul className="sv-footer-list">
              <li className="sv-footer-item">No social links added</li>
            </ul>
          )}
        </section>
      </div>

      <div className="sv-footer-muted">Powered by CatShare storefront</div>
    </footer>
  );

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

          {/* ══ PRODUCT LISTING (grid / OrderForm-style list) ══ */}
          <div className={storefrontViewMode === 'list' ? 'of-items sv-of-items--store' : 'sv-grid'}>
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
              const { price, priceUnit, listPrice, showOffer } = getStorefrontPriceAndUnit(catData, catalogue, product);
              const qstep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
              const imgUrl = displayStoreProductImage(product);
              const hasParsedPrice = Number.isFinite(price);
              const lineAmt = quantity > 0 && hasParsedPrice ? quantity * price : 0;
              const lineCalcDetail =
                hasParsedPrice && quantity > 0
                  ? formatStorefrontLineCalculationDetail(quantity, price, priceUnit, currencySymbol)
                  : null;

              if (storefrontViewMode === 'list') {
                return (
                  <div
                    key={product.id}
                    className={`of-item-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <div className="of-img-wrap" onClick={() => setDrawerProduct(product)}>
                      <StoreProductImageArea product={product} variant="card" />
                      {isSelected ? <div className="of-selected-badge">✓ Added</div> : null}
                    </div>

                    <div className="of-item-body">
                      <div className="of-item-top">
                        <div className="of-item-text">
                          <div className="of-item-title-line">
                            <span className="of-item-name">{product.name}</span>
                            {product.subtitle ? (
                              <span className="of-item-subtitle-inline">({product.subtitle})</span>
                            ) : null}
                          </div>
                          <div className="of-item-price-row">
                            {Number.isFinite(price) ? (
                              <div className="of-price-tag">
                                {fmt(price, currencySymbol)}
                                {showOffer && listPrice != null && listPrice > 0 ? (
                                  <span className="sv-price-strike">{fmt(listPrice, currencySymbol)}</span>
                                ) : null}
                                {priceUnit ? ` ${priceUnit}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="of-item-bottom">
                        <div className="of-item-qty-cluster">
                          <div className="of-qty-inline-row">
                            <OrderFormQtyControl
                              value={quantity}
                              step={qstep}
                              onChange={(d) => changeQty(product.id, d, qstep)}
                            />
                            {qstep > 1 ? (
                              <div className="of-step-hint of-step-hint--next-to-qty">
                                <AlertIcon />
                                Pack of {qstep}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="of-view-btn"
                          onClick={() => setDrawerProduct(product)}
                        >
                          Details ›
                        </button>
                      </div>

                      {isSelected ? (
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
                            <span className="of-line-total-val">{fmt(lineAmt, currencySymbol)}</span>
                          ) : (
                            <span className="of-line-total-na">—</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }

              const calcDetail = quantity > 0 ? fmtCalc(quantity, price, priceUnit, currencySymbol, qstep) : null;
              return (
                <div
                  key={product.id}
                  className={`sv-pcard${isSelected ? ' selected' : ''}`}
                >
                  <div className="sv-pcard-img-wrap" onClick={() => setDrawerProduct(product)}>
                    <StoreProductImageArea product={product} variant="card" />
                    {isSelected && <div className="sv-pcard-sel"><IconCheck /></div>}
                  </div>
                  <div className="sv-pcard-body">
                    <div className="sv-pcard-name">{product.name}</div>
                    {product.subtitle && <div className="sv-pcard-sub">{product.subtitle}</div>}
                    {Number.isFinite(price) && (
                      <div className="sv-pcard-price">
                        {fmt(price, currencySymbol)}
                        {showOffer && listPrice != null && listPrice > 0 ? (
                          <span className="sv-price-strike">{fmt(listPrice, currencySymbol)}</span>
                        ) : null}
                        {priceUnit && <span className="sv-pcard-price-unit">/{unitLabel(priceUnit)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="sv-pcard-footer">
                    <div className="sv-pcard-actions">
                      <QtyControl
                        value={quantity}
                        step={qstep}
                        onChange={(d) => {
                          const hasVariants = getProductVariantGroups(product).length > 0;
                          if (hasVariants && quantity === 0) {
                            setDrawerProduct(product);
                          } else {
                            changeQty(product.id, d, qstep);
                          }
                        }}
                        accent={isSelected}
                      />
                      <button type="button" className="sv-details-btn" onClick={() => setDrawerProduct(product)}>Details</button>
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

          {hasFooterDetails && renderStoreFooter()}

          {/* ══ FLOATING CART BAR ══ */}
          {selectedProductCount > 0 && step === 'products' && (
            <div className="sv-cart">
              <div
                className="sv-cart-inner"
                onClick={() => {
                  if (!minimumOrderMet && minimumOrderValue > 0) return;
                  setStep('customer');
                }}
              >
                <div className="sv-cart-info">
                  <span className="sv-cart-count">{selectedProductCount} item{selectedProductCount === 1 ? '' : 's'}</span>
                  <span className="sv-cart-total">{fmt(orderSummary.total, currencySymbol)}</span>
                </div>
                <button type="button" className="sv-cart-cta" disabled={!minimumOrderMet && minimumOrderValue > 0}>
                  {!minimumOrderMet && minimumOrderValue > 0 ? 'Minimum not reached' : 'Place Order →'}
                </button>
                {minimumOrderValue > 0 && !minimumOrderMet ? (
                  <span className="sv-cart-note sv-cart-note--below">
                    Add {fmt(remainingToMinimum, currencySymbol)} more to place order
                  </span>
                ) : null}
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
              <button
                className="sv-panel-cta"
                onClick={handlePanelAction}
                disabled={
                  step === 'customer'
                    ? !customerName.trim() || !customerWhatsappNumber.trim() || (minimumOrderValue > 0 && !minimumOrderMet)
                    : isSubmitting || (minimumOrderValue > 0 && !minimumOrderMet)
                }
              >
                {step === 'customer' ? 'Review →' : isSubmitting ? 'Placing…' : 'Confirm'}
              </button>
            </div>

            <div style={{ padding: '16px 16px 0' }}>
              <StepBar current={step} />
            </div>

            {step === 'customer' && (
              <div className="sv-form-body">
                {(!customerName.trim() || !customerWhatsappNumber.trim()) && (
                  <div style={{ padding: '8px 12px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: '#856404' }}>
                    ⚠️ Name and WhatsApp should be filled to continue
                  </div>
                )}
                {minimumOrderValue > 0 && !minimumOrderMet && (
                  <div style={{ padding: '8px 12px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: '#856404' }}>
                    ⚠️ Minimum order is {fmt(minimumOrderValue, currencySymbol)}. Add {fmt(remainingToMinimum, currencySymbol)} more to continue.
                  </div>
                )}
                <div className="sv-field">
                  <label>Your Name *</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter your full name" autoFocus />
                </div>
                <div className="sv-field">
                  <label>WhatsApp Number *</label>
                  <div className="sv-phone-group">
                    <div className="sv-phone-group-country">
  <input
    type="text"
    value={customerWhatsappCountry}
    onChange={(e) => {
      const val = e.target.value.replace(/[^\d+]/g, '');
      setCustomerWhatsappCountry(val.startsWith('+') ? val : '+' + val.replace(/\+/g, ''));
    }}
    placeholder="+91"
    maxLength={5}
    inputMode="tel"
    style={{ textAlign: 'center' }}
  />
</div>
                    <div className="sv-phone-group-number">
                      <input type="text" value={customerWhatsappNumber} onChange={(e) => setCustomerWhatsappNumber(e.target.value.replace(/\D/g, ''))} placeholder="98xxxxxxxx" inputMode="numeric" />
                    </div>
                  </div>
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
                          const cd = item.quantity > 0 ? fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol, item.quantityStep) : null;
                          return (
                            <div key={item.productId} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'flex', boxShadow: 'var(--shadow-sm)', flexDirection: 'column', gap: 10, padding: '12px', opacity: item.quantity === 0 ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ width: 80, height: 80, flexShrink: 0, background: 'var(--c-surface2)', overflow: 'hidden', position: 'relative', borderRadius: 'var(--r-md)' }}>
                                  {(() => {
                                    const src = productImageDisplayUrl(item.imageUrl, item.imageVersion);
                                    return isDisplayableImageUrl(src)
                                      ? <img key={src} src={src} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconImg size={24} /></div>;
                                  })()}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>{item.name}</div>
                                    {item.subtitle && <div style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{item.subtitle}</div>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <QtyControl value={item.quantity} step={qstep} onChange={(delta) => changeQty(item.productId, delta, qstep)} accent={item.quantity > 0} />
                                  </div>
                                </div>
                              </div>
                              {cd && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '11.5px', color: 'var(--c-text3)', paddingTop: 4, borderTop: '1px solid var(--c-border)' }}>
                                  <span>{cd}</span>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-accent)' }}>
                                    {fmt(item.rowTotal, currencySymbol)}
                                  </span>
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
              <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="sv-review-list" style={{ padding: 0, margin: 0 }}>
                  {reviewSummary.items.map((item: any) => {
                    const cd = fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol, item.quantityStep);
                    return (
                      <div key={item.productId} className="sv-rcard">
                        <div style={{ width: 80, height: 80, flexShrink: 0, background: 'var(--c-surface2)', overflow: 'hidden', position: 'relative', borderRadius: 'var(--r-md)' }}>
                          {(() => {
                            const src = productImageDisplayUrl(item.imageUrl, item.imageVersion);
                            return isDisplayableImageUrl(src)
                              ? <img key={src} src={src} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconImg size={24} /></div>;
                          })()}
                        </div>
                        <div className="sv-rcard-body">
                          <div><div className="sv-rcard-name">{item.name}</div>{item.subtitle && <div className="sv-rcard-sub">{item.subtitle}</div>}{item.variantSummary && <div className="sv-rcard-sub">{item.variantSummary}</div>}</div>
                          <div className="sv-rcard-bottom">{cd && <span className="sv-rcard-calc">{cd}</span>}<span className="sv-rcard-total">{fmt(item.rowTotal, currencySymbol)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="sv-review-customer">
                  <div className="sv-review-customer-label">Ordering as</div>
                  <div className="sv-review-customer-name">{customerName}</div>
                  {customerWhatsappNumber && <div className="sv-review-customer-phone">{customerWhatsappCountry} {customerWhatsappNumber}</div>}
                </div>
                <div className="sv-review-total-bar">
                  <div>
                    <div className="sv-review-total-label">Total amount</div>
                    <div className="sv-review-total-val">{fmt(reviewSummary.total, currencySymbol)}</div>
                  </div>
                  <button type="button" className="sv-edit-btn" onClick={() => setStep('customer')}>Edit items</button>
                </div>
              </div>
            )}
            {hasFooterDetails && renderStoreFooter()}
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
          const fieldDefinition = getFieldsDefinition();
          const catData = store.catalogueId ? getCatalogueData(drawerProduct, store.catalogueId) : null;
          /** Default `fieldConfig` has field1–10 `enabled: false`; guests have no seller localStorage. When the seller is logged in on the same device, `fieldsDefinition` may set `visibility.onlineStore: false` — still show any slot that has catalogue/product text so the public store matches what buyers see when logged out. */
          const visibleStoreFieldNumbers = new Set(
            fieldDefinition.fields
              .filter((f) => {
                if (!f.key.startsWith('field')) return false;
                const n = Number(String(f.key).replace('field', ''));
                if (!Number.isFinite(n) || n < 1 || n > 10) return false;
                const picked = pickStorefrontDetailField(drawerProduct, store.catalogueId, n);
                if (picked) return true;
                return f.enabled === true && isFieldVisibleOnSurface(f, 'onlineStore');
              })
              .map((f) => Number(String(f.key).replace('field', '')))
              .filter((n) => Number.isFinite(n))
          );
          const { price, priceUnit, listPrice, showOffer } = getStorefrontPriceAndUnit(catData, catalogue, drawerProduct);
          const qstep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
          const quantity = selectedProducts.get(drawerProduct.id) || 0;
          const calcDetail = quantity > 0 ? fmtCalc(quantity, price, priceUnit, currencySymbol, qstep) : null;
          const fields = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            if (!visibleStoreFieldNumbers.has(n)) return null;
            const picked = pickStorefrontDetailField(drawerProduct, store.catalogueId, n);
            if (!picked) return null;
            const label = fieldDefinition.fields.find((f) => f.key === `field${n}`)?.label || `Field ${n}`;
            const value = picked.unitSuffix ? `${picked.text} ${picked.unitSuffix}` : picked.text;
            return { label, value };
          }).filter(Boolean) as Array<{ label: string; value: string }>;
          const gallery = getStoreProductGalleryProps(drawerProduct);
          return (
            <div ref={overlayRef} className="sv-overlay" onClick={(e) => { if (e.target === overlayRef.current) setDrawerProduct(null); }}>
              <div ref={drawerRef} className="sv-drawer">
                <div className="sv-drawer-handle" />
                <div className={`sv-drawer-img-wrap${gallery.urls.length > 1 ? ' sv-drawer-img-wrap--gallery' : ''}`}>
                  <StoreProductImageArea product={drawerProduct} variant="drawer" />
                  <button className="sv-drawer-close" onClick={() => setDrawerProduct(null)}>✕</button>
                </div>
                <div className="sv-drawer-body">
                  <div className="sv-drawer-name">{drawerProduct.name}</div>
                  {drawerProduct.subtitle && <div className="sv-drawer-sub">{drawerProduct.subtitle}</div>}
                  {getCats(drawerProduct).length > 0 && (
                    <div className="sv-drawer-cats">{getCats(drawerProduct).map((c) => <span key={c} className="sv-drawer-cat">{c}</span>)}</div>
                  )}
                  <div className="sv-drawer-price">
                    {Number.isFinite(price) ? (
                      <>
                        {fmt(price, currencySymbol)}
                        {showOffer && listPrice != null && listPrice > 0 ? (
                          <span className="sv-price-strike">{fmt(listPrice, currencySymbol)}</span>
                        ) : null}
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
                  {getProductVariantGroups(drawerProduct).length > 0 && (
                    <ProductVariantsDisplay
                      groups={getProductVariantGroups(drawerProduct)}
                      mode="select"
                      selection={variantSelections[drawerProduct.id] ?? {}}
                      onSelect={(groupId, option) => {
                        setVariantSelections((prev) => ({
                          ...prev,
                          [drawerProduct.id]: {
                            ...(prev[drawerProduct.id] ?? {}),
                            [groupId]: option,
                          },
                        }));
                      }}
                    />
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
