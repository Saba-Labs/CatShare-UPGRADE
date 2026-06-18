import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getStoreBySlug, getStoreProducts, sortProductsBySupabaseRowOrder, type StorePublic } from '../services/storeService';
import { fetchSellerCheckoutFeatures, type SellerCheckoutFeatures } from '../services/shareLinks';
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
import { buildOrderTrackingUrl } from '../services/orderTrackingService';
import OrderPlacedSuccessModal from '../components/OrderPlacedSuccessModal';
import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import { getSymbolForCurrencyCode } from '../utils/currencyUtils';
import { getFieldsDefinition, isFieldVisibleOnSurface } from '../config/fieldConfig';
import { productImageDisplayUrl } from '../utils/imageUrl';
import { getProductImageUrls, getPrimaryImageIndex } from '../utils/productImages';
import { normalizeProductCategories, buildStorefrontCategoryFilterList } from '../utils/productCategoryUtils';
import {
  applyMaxProducts,
  filterProductsByBehaviorScope,
  productImageAspectRatio,
  productsPerRowCount,
  resolveBehaviorCatalogueId,
  resolveStoreBehaviorSettings,
  sortStorefrontProducts,
} from '../utils/storefrontBehavior';
import ProductImageGallery from '../components/ProductImageGallery';
import ProductVariantsDisplay from '../components/ProductVariantsDisplay';
import {
  formatVariantSelectionSummary,
  generateVariantCombinationId,
  getAllVariantCombinations,
  getProductVariantGroups,
  isVariantSelectionComplete,
  getVariantCombinationData,
  getVariantLegacyInStock,
} from '../utils/productVariants';
import {
  getStorePathFallbackBaseUrl,
  isPlatformAppHostname,
  resolveStoreSlugFromHostname,
} from '../utils/storefrontDomain';
import { getStoreSlugByCustomHostname } from '../services/storeService';
import {
  activeCartLines,
  cartLinesForProduct,
  getCartLineQty,
  productHasCartLines,
  removeZeroQtyLinesForProduct,
  setCartLineQty,
  setCartLineQtyById,
  totalCartLineCount,
  type OrderCartLine,
} from '../utils/orderCartLines';
import {
  applyQuantityDelta,
  getProductOrderQuantityRules,
} from '../utils/quantityPricingUtils';
import {
  formatQuantitySlabTable,
  getStorefrontPriceAndUnit,
} from '../components/Storefront/storefrontOrderHelpers';
import { useCloudWriteGate } from '../hooks/useCloudWriteGate';
import { getPublishedHomepageConfig } from '../services/homepageService';
import '../components/HomepageBuilder/sites-theme-button.css';
import { HomepageLayout } from '../types/homepage';
import WebsiteRuntime from '../components/WebsiteBuilder/WebsiteRuntime';
import { WebsiteOrderBridgeProvider, type WebsiteOrderBridgeValue } from '../components/WebsiteBuilder/WebsiteOrderBridge';
import { collectionPagePath, findProductByHandle, parseStorefrontProductHandle, productPagePath, resolveStoreWhatsapp, storeBasePath } from '../utils/websiteStorefront';
import StoreProductOrderPanel from '../components/Storefront/StoreProductOrderPanel';
import '../components/Storefront/store-product-order-page.css';
import { buildWebsiteThemeVars } from '../utils/websiteThemeVars';
import { computeCheckoutTotals } from '../utils/checkoutTotals';
import { normalizeStoreIntegrationFlags } from '../types/storeIntegrationFlags';
import {
  beginStoreRazorpayCheckout,
  openStoreRazorpayCheckout,
} from '../services/storePaymentApi';
import { getStorefrontInventory } from '../services/inventoryService';
import {
  buildInventoryAvailabilityMap,
  getAvailableQty,
  isCatalogueInventoryTracked,
  isInStockWithInventory,
  isLowStock,
  type InventoryAvailabilityMap,
} from '../utils/inventoryAvailability';
import { normalizeCheckoutSettings } from '../types/checkoutSettings';
import { isVariantOptionInStock } from '../utils/catalogueWarehouseStock';
import CheckoutBreakdown from '../components/Storefront/CheckoutBreakdown';
import { normalizeHomepageLayoutForWebsiteMode } from '../config/homepageBuilderConfig';
import '../components/Storefront/storefront-checkout.css';
import {
  IconAlertTriangle,
  IconImage,
  IconSearch,
  IconShoppingBag,
  IconX,
  PackHint,
  MoqHint,
} from '../components/Storefront/StorefrontIcons';
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
.sv-page.website-mode-full { max-width: none; width: 100%; margin: 0; padding: 0; }

/* ── Hero ── */
.sv-hero { position: relative; background: var(--c-surface); border-bottom: 1px solid var(--c-border); }
.sv-hero-bg { display: none; }
.sv-hero-inner { padding: 24px 20px 22px; }
.sv-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.sv-logo { width: 54px; height: 54px; border-radius: var(--r-md); background: var(--c-surface2); border: 1px solid var(--c-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: var(--shadow-sm); }
.sv-logo img { width: 100%; height: 100%; object-fit: cover; }
.sv-open-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--c-accent-light); border: 1px solid rgba(26,107,74,0.2); border-radius: var(--r-full); padding: 5px 12px; font-size: 11px; font-weight: 600; color: var(--c-accent); font-family: var(--f-body); letter-spacing: 0.3px; }
.sv-open-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); animation: sv-pulse 2.5s infinite; }
@keyframes sv-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(16, 185, 129, 0.7)} 50%{box-shadow:0 0 0 6px rgba(16, 185, 129, 0)} }
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
.sv-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--c-text3); pointer-events: none; display: flex; align-items: center; justify-content: center; }
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
.sv-pcard-stock { position: absolute; bottom: 8px; left: 8px; z-index: 2; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: var(--r-full); background: rgba(15,23,42,0.72); color: #fff; letter-spacing: 0.02em; }
.sv-pcard-stock--oos { background: rgba(185,28,28,0.88); }
.sv-pcard-img-wrap img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transition: transform 0.35s ease; display: block; }
.sv-pcard-img-wrap:hover img { transform: scale(1.05); }
.sv-pcard-img-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.sv-pcard-sel { position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; border-radius: 50%; background: var(--c-accent); display: flex; align-items: center; justify-content: center; z-index: 2; box-shadow: 0 1px 4px rgba(0,0,0,0.18); }
.sv-pcard-body { padding: 10px 10px 5px; display: flex; flex-direction: column; gap: 2px; }
.sv-pcard-name { font-family: var(--f-body); font-size: 13px; font-weight: 600; color: var(--c-text); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sv-pcard-sub { font-size: 11px; color: var(--c-text3); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; font-weight: 400; }
.sv-pcard-variant-summary { font-size: 11px; color: var(--c-accent); font-weight: 500; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
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

.sv-pack-hint { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: #8a6a00; background: #fffbeb; border: 1px solid #f0d060; border-radius: var(--r-full); padding: 3px 8px; font-weight: 500; }

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

.sv-checkout-breakdown { margin-top: 12px; padding: 12px 14px; background: var(--c-surface2); border-radius: var(--r-md); border: 1px solid var(--c-border2); }
.sv-checkout-breakdown-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--c-text2); padding: 4px 0; }
.sv-checkout-breakdown-row--grand { margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--c-border2); font-size: 15px; font-weight: 700; color: var(--c-text); }
.sv-checkout-breakdown-row .is-discount { color: var(--c-accent, #1a7a4a); }
.sv-checkout-breakdown-note { font-size: 11px; color: var(--c-accent, #1a7a4a); margin-top: 4px; }
.sv-payment-options { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.sv-payment-opt { flex: 1; min-width: 120px; padding: 10px 12px; border-radius: var(--r-md); border: 1.5px solid var(--c-border2); background: var(--c-surface); font-size: 13px; font-weight: 600; cursor: pointer; text-align: center; }
.sv-payment-opt.is-active { border-color: var(--c-accent); background: color-mix(in srgb, var(--c-accent) 8%, white); color: var(--c-accent); }
.sv-coupon-row { display: flex; gap: 8px; margin-top: 6px; }
.sv-coupon-row input { flex: 1; }
.sv-coupon-apply { padding: 0 14px; border-radius: var(--r-md); border: none; background: var(--c-accent); color: #fff; font-weight: 600; font-size: 13px; cursor: pointer; }
.sv-coupon-apply:disabled { opacity: 0.5; cursor: not-allowed; }

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
.sv-phone-group-country input,
.sv-phone-group-country select { width: 100%; height: 48px; background: var(--c-surface); border: 1px solid var(--c-border2); border-radius: var(--r-md); color: var(--c-text); font-size: 14px; font-family: var(--f-body); padding: 0 12px; outline: none; transition: border-color var(--trans), box-shadow var(--trans); }
.sv-phone-group-country input { text-align: center; }
.sv-phone-group-country select { cursor: pointer; }
.sv-phone-group-country input:focus,
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
.sv-drawer-img-wrap--thumbs { display: flex; flex-direction: column; }
.sv-drawer-img-wrap--thumbs.sv-drawer-img-wrap--gallery { aspect-ratio: unset; max-height: min(78vh, 520px); }
.sv-drawer-img-wrap--thumbs .sv-store-gallery { flex: 1; min-height: 0; }
.sv-drawer-img-ph { width: 100%; min-height: 180px; display: flex; align-items: center; justify-content: center; }
.sv-pcard-img-wrap .sv-store-gallery,
.of-img-wrap .sv-store-gallery { position: absolute; inset: 0; height: 100%; }
.sv-pcard-img-wrap .sv-store-gallery > div,
.of-img-wrap .sv-store-gallery > div { height: 100%; }
.sv-drawer-close { position: absolute; top: 10px; right: 10px; z-index: 20; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.88); border: 1px solid var(--c-border2); cursor: pointer; color: var(--c-text); font-size: 13px; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); }
.sv-drawer-body { padding: 18px 20px 36px; }
.sv-drawer-name { font-family: var(--f-head); font-size: 22px; font-weight: 400; color: var(--c-text); letter-spacing: -0.3px; line-height: 1.2; }
.sv-drawer-sub { font-size: 13px; color: var(--c-text3); margin-top: 3px; }
.sv-drawer-variant-summary { font-size: 13px; color: var(--c-accent); font-weight: 500; margin-top: 4px; }
.sv-variant-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; margin-bottom: 12px; }
.sv-variant-pill { display: inline-flex; align-items: center; background: var(--c-accent-light); border: 1px solid rgba(26,107,74,0.2); border-radius: var(--r-full); padding: 3px 10px; font-size: 12px; font-weight: 500; color: var(--c-accent); }
.sv-drawer-cats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.sv-drawer-cat { height: 22px; padding: 0 10px; border-radius: var(--r-full); background: var(--c-surface3); border: 1px solid var(--c-border2); font-size: 11px; color: var(--c-text2); font-weight: 500; display: inline-flex; align-items: center; }
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

/* ── Catalog product page (classic store, non-website mode) ── */
.sv-catalog-product-page {
  min-height: 100%;
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
}

.sv-catalog-product-top {
  position: sticky;
  top: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(247,247,245,0.96);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--c-border);
}

.sv-catalog-product-back {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--c-border2);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.sv-catalog-product-top-meta {
  min-width: 0;
}

.sv-catalog-product-top-meta .sv-store-name {
  font-size: 15px;
  font-weight: 600;
}

.sv-catalog-product-content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px;
}

@media (min-width: 900px) {
  .sv-catalog-product-content {
    padding: 24px 32px 40px;
  }
}

/* ── Empty ── */
.sv-empty { grid-column: 1/-1; text-align: center; padding: 48px 24px; }
.sv-empty-icon { display: flex; justify-content: center; margin-bottom: 12px; color: var(--c-text3); opacity: 0.45; }
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
.sv-error-icon { width: 60px; height: 60px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
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

  .sv-page.website-mode-full {
    max-width: none;
    width: 100%;
    margin: 0;
    padding: 0;
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
        showThumbnails={variant === 'drawer'}
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

function getCats(p: ProductWithCatalogueData): string[] {
  return normalizeProductCategories(p.category);
}
function srchText(p: ProductWithCatalogueData): string {
  const ex = Array.from({ length: 10 }, (_, i) => { const n = i + 1; const r = p as unknown as Record<string, string | undefined>; return [r[`field${n}`], r[`field${n}Label`], r[`field${n}Unit`]].filter(Boolean).join(' '); });
  return [p.name, p.subtitle, ...normalizeProductCategories(p.category), ...ex].filter(Boolean).join(' ').toLowerCase();
}
/**
 * Public store: detail text may live on `catalogueData[storeCatalogueId]`, top-level (Master), or another slice.
 * Anonymous / partial RPC payloads sometimes omit the linked slice — scan so deploy matches seller localhost.
 */
function pickStorefrontDetailField(
  product: ProductWithCatalogueData,
  preferredCatalogueId: string | undefined,
  n: number
): { text: string; unitSuffix: string; label: string | null } | null {
  const key = `field${n}`;
  const unitKey = `field${n}Unit`;
  const labelKey = `field${n}Label`;
  const tryRow = (row: Record<string, unknown> | null | undefined): { text: string; unitSuffix: string; label: string | null } | null => {
    if (!row || typeof row !== 'object') return null;
    const v = row[key];
    if (v == null || String(v).trim() === '') return null;
    const u = row[unitKey];
    const unitSuffix =
      u != null && String(u).trim() !== '' && String(u).trim() !== 'None' ? String(u).trim() : '';
    const l = row[labelKey];
    const label =
      l != null && String(l).trim() !== '' && String(l).trim() !== 'None' ? String(l).trim() : null;
    return { text: String(v).trim(), unitSuffix, label };
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
function VariantPills({ summary }: { summary: string }) {
  const parts = summary.split(/;\s*/).filter(Boolean);
  return (
    <div className="sv-variant-pills">
      {parts.map((part) => (
        <span key={part} className="sv-variant-pill">{part}</span>
      ))}
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
  const [customHostSlug, setCustomHostSlug] = useState<string | null>(null);
  const [customHostResolved, setCustomHostResolved] = useState(!hostSlug);

  useEffect(() => {
    if (hostSlug) {
      setCustomHostSlug(null);
      setCustomHostResolved(true);
      return;
    }
    const host =
      typeof window !== 'undefined' ? window.location.hostname.trim().toLowerCase() : '';
    if (!host || isPlatformAppHostname(host)) {
      setCustomHostSlug(null);
      setCustomHostResolved(true);
      return;
    }
    let cancelled = false;
    setCustomHostResolved(false);
    getStoreSlugByCustomHostname(host).then((r) => {
      if (cancelled) return;
      setCustomHostSlug(r.success && r.slug ? r.slug : null);
      setCustomHostResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hostSlug]);

  const dedicatedHost = !!hostSlug || !!customHostSlug;
  const effectiveSlug = slug || hostSlug || customHostSlug || null;

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
  const [sellerFieldsDefinition, setSellerFieldsDefinition] = useState<any>(null);
  const [homepageLayout, setHomepageLayout] = useState<HomepageLayout | null>(null);
  const [homepageLoading, setHomepageLoading] = useState(false);

  // Fetch the seller's custom field names from Supabase
  useEffect(() => {
    if (!store?.sellerUserId) return;
    const supabase = getSupabaseClient();
    // Fetch fields definition in parallel with products
    supabase
      .from('fields_definition')
      .select('*')
      .eq('user_id', store.sellerUserId)
      .single()
      .then(({ data }) => {
        if (data) setSellerFieldsDefinition(data);
      });
  }, [store?.sellerUserId]);

  const [allProducts, setAllProducts] = useState<ProductWithCatalogueData[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cartLines, setCartLines] = useState<OrderCartLine[]>([]);
  const [draftVariantSelections, setDraftVariantSelections] = useState<Record<string, Record<string, string>>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsappCountry, setCustomerWhatsappCountry] = useState('+91');
  const [customerWhatsappNumber, setCustomerWhatsappNumber] = useState('');
  const [shipLine1, setShipLine1] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipPincode, setShipPincode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'prepaid' | 'cod'>('prepaid');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ trackingUrl: string | null } | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [variantErrorIds, setVariantErrorIds] = useState<Set<string>>(new Set());
  const [inventoryMap, setInventoryMap] = useState<InventoryAvailabilityMap | null>(null);
  const [resolvedInventoryId, setResolvedInventoryId] = useState<string | null>(null);
  const [sellerCheckoutFeatures, setSellerCheckoutFeatures] = useState<SellerCheckoutFeatures | null>(null);
  const pathFallbackSentRef = useRef(false);
  /** Latest slug for tab-visibility refetch (avoid stale closure). */
  const effectiveSlugRef = useRef(effectiveSlug);
  effectiveSlugRef.current = effectiveSlug;

  const catalogProductHandle = useMemo(
    () =>
      store?.websiteModeEnabled
        ? null
        : parseStorefrontProductHandle(location.pathname, dedicatedHost),
    [store?.websiteModeEnabled, location.pathname, dedicatedHost]
  );

  const openProductPage = useCallback(
    (product: ProductWithCatalogueData) => {
      const slugForPath = effectiveSlug || store?.storeSlug || '';
      if (!slugForPath) return;
      navigate(productPagePath(slugForPath, product, dedicatedHost));
    },
    [effectiveSlug, store?.storeSlug, dedicatedHost, navigate]
  );

  const closeProductPage = useCallback(() => {
    const slugForPath = effectiveSlug || store?.storeSlug || '';
    const base = slugForPath ? storeBasePath(slugForPath, dedicatedHost) : '/';
    navigate(base);
  }, [effectiveSlug, store?.storeSlug, dedicatedHost, navigate]);

  // Listen for store-updated custom events from Store.tsx toggle
  useEffect(() => {
    const handleStoreUpdated = (event: Event) => {
      console.log('STORE-UPDATED event received', event);
      if (event instanceof CustomEvent && effectiveSlugRef.current) {
        console.log('Custom event is valid, detail:', event.detail);
        console.log('Refetching store for slug:', effectiveSlugRef.current);
        getStoreBySlug(effectiveSlugRef.current).then((r) => {
          console.log('Store refetched - success:', r.success, 'homepageEnabled:', r.data?.homepageEnabled);
          if (r.success && r.data) {
            console.log('Updating store state');
            setStore(r.data);
            setStoreError(null);
          }
        });
      }
    };
    window.addEventListener('store-updated', handleStoreUpdated);
    return () => window.removeEventListener('store-updated', handleStoreUpdated);
  }, []);

  useEffect(() => {
    if (!customHostResolved) return;
    if (!effectiveSlug) { setStoreError('Store not found'); setStoreLoading(false); return; }
    setStoreLoading(true);
    getStoreBySlug(effectiveSlug).then((r) => { if (!r.success || !r.data) setStoreError(r.error || 'Store not found'); else setStore(r.data); setStoreLoading(false); });
  }, [effectiveSlug, customHostResolved]);

  /** If the SPA loads on a seller subdomain but the store cannot be loaded, send users to the path-based URL on the public app host (edge middleware handles the hard 403 case). */
  useEffect(() => {
    const fallbackSlug = hostSlug || customHostSlug;
    if (storeLoading || !storeError || !fallbackSlug || slug) return;
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
    window.location.replace(`${base}/store/${encodeURIComponent(fallbackSlug)}${window.location.search || ''}`);
  }, [storeLoading, storeError, hostSlug, customHostSlug, slug]);

  useEffect(() => {
    setLogoFailed(false);
  }, [store?.sellerLogoUrl]);

  useEffect(() => {
    if (!store?.sellerUserId) return;
    if (store.isLive === false || store.maintenanceMode === true) {
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
  }, [store?.sellerUserId, store?.isLive, store?.maintenanceMode, store?.catalogueId, store?.cataloguesDefinition]);

  // Safety check: custom website layout only applies when website mode is on.
  useEffect(() => {
    if (!store?.websiteModeEnabled && homepageLayout) {
      setHomepageLayout(null);
      setHomepageLoading(false);
    }
  }, [store?.websiteModeEnabled, homepageLayout]);

  // Load published homepage config only for custom website mode (WebsiteRuntime).
  useEffect(() => {
    if (!store?.websiteModeEnabled) {
      setHomepageLayout(null);
      setHomepageLoading(false);
      return;
    }

    if (!store?.id) return;

    setHomepageLoading(true);
    getPublishedHomepageConfig(store.id).then((config) => {
      const nextLayout = config?.publishedLayout || null;
      if (nextLayout) {
        setHomepageLayout(normalizeHomepageLayoutForWebsiteMode(nextLayout));
      } else {
        setHomepageLayout(null);
      }
      setHomepageLoading(false);
    }).catch(() => {
      setHomepageLayout(null);
      setHomepageLoading(false);
    });
  }, [store?.id, store?.websiteModeEnabled]);

  useEffect(() => {
    if (!store?.sellerUserId) {
      setSellerCheckoutFeatures(null);
      return;
    }
    let cancelled = false;
    void fetchSellerCheckoutFeatures(store.sellerUserId).then((features) => {
      if (!cancelled) setSellerCheckoutFeatures(features);
    });
    return () => {
      cancelled = true;
    };
  }, [store?.sellerUserId]);

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
        if (r.data.websiteModeEnabled && r.data.id) {
          void getPublishedHomepageConfig(r.data.id).then((config) => {
            const nextLayout = config?.publishedLayout || null;
            setHomepageLayout(nextLayout ? normalizeHomepageLayoutForWebsiteMode(nextLayout) : null);
          });
        } else {
          setHomepageLayout(null);
        }
        if (r.data.sellerUserId && r.data.isLive !== false) {
          setProductsLoading(true);

          // Re-fetch custom labels on tab visibility restoration
          const supabase = getSupabaseClient();
          supabase
            .from('fields_definition')
            .select('*')
            .eq('user_id', r.data.sellerUserId)
            .single()
            .then(({ data }) => {
              if (data) setSellerFieldsDefinition(data);
            });

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
  }, [store?.id]);

  const catalogues = useMemo(
    () => ensureCataloguesForStorefront(store?.cataloguesDefinition, store?.catalogueId),
    [store?.cataloguesDefinition, store?.catalogueId]
  );
  const behavior = useMemo(
    () => resolveStoreBehaviorSettings(store?.behaviorSettings),
    [store?.behaviorSettings]
  );
  const listingCatalogueId = useMemo(
    () =>
      store?.catalogueId
        ? resolveBehaviorCatalogueId(behavior.productsToShow, store.catalogueId, catalogues)
        : '',
    [behavior.productsToShow, store?.catalogueId, catalogues]
  );
  const storefrontGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${productsPerRowCount(behavior.productsPerRow)}, minmax(0, 1fr))`,
    }),
    [behavior.productsPerRow]
  );
  const storefrontImageAspectRatio = useMemo(
    () => productImageAspectRatio(behavior.productImageRatio),
    [behavior.productImageRatio]
  );
  const currencySymbol = useMemo(() => getSymbolForCurrencyCode(store?.sellerCurrencyCode || 'INR'), [store?.sellerCurrencyCode]);

  /** Same order as `public.products.position` (int8), even if RPC returns rows out of order. */
  const productsInTableOrder = useMemo(
    () => sortProductsBySupabaseRowOrder(allProducts),
    [allProducts]
  );

  /** Prefer cloud definition; if custom `cat…` id is missing there, infer `priceField` from `catalogueData[id]` on a real product row (matches Supabase JSON). */
  const catalogue = useMemo((): Catalogue | null => {
    const id = listingCatalogueId;
    if (!id) return null;
    const fromDef = catalogues.find((c) => c.id === id);
    if (fromDef) return fromDef;
    const sample = productsInTableOrder.find((p) => {
      const cd = p.catalogueData?.[id];
      return cd != null && typeof cd === 'object';
    });
    const raw = sample?.catalogueData?.[id] as Record<string, unknown> | undefined;
    return inferCatalogueStubFromRowData(id, raw);
  }, [catalogues, listingCatalogueId, productsInTableOrder]);

  const effectiveCatalogue = useMemo((): Catalogue | null => {
    if (!catalogue) return null;
    const inv = resolvedInventoryId?.trim() || catalogue.inventoryId?.trim();
    if (!inv || inv === catalogue.inventoryId) return catalogue;
    return { ...catalogue, inventoryId: inv };
  }, [catalogue, resolvedInventoryId]);

  const inventoryTracked = useMemo(
    () => isCatalogueInventoryTracked(effectiveCatalogue, inventoryMap, resolvedInventoryId),
    [effectiveCatalogue, inventoryMap, resolvedInventoryId]
  );

  const reloadStoreInventory = useCallback(() => {
    if (!store?.sellerUserId || !listingCatalogueId) return;
    void getStorefrontInventory(store.sellerUserId, listingCatalogueId).then((res) => {
      setInventoryMap(buildInventoryAvailabilityMap(res.data.lines));
      setResolvedInventoryId(res.data.inventoryId);
    });
  }, [store?.sellerUserId, listingCatalogueId]);

  useEffect(() => {
    reloadStoreInventory();
  }, [reloadStoreInventory]);

  const storeProducts = useMemo(() => {
    if (!listingCatalogueId) return [];

    const productInStockForStore = (p: ProductWithCatalogueData) => {
      const legacy = isProductInStockForCatalogue(p, listingCatalogueId, effectiveCatalogue);
      if (!inventoryTracked) {
        const groups = getProductVariantGroups(p);
        if (groups.length === 0) return legacy;
        return getAllVariantCombinations(groups).some((combo) =>
          getVariantLegacyInStock(p, listingCatalogueId, combo.id, legacy)
        );
      }
      const groups = getProductVariantGroups(p);
      if (groups.length === 0) {
        return isInStockWithInventory(effectiveCatalogue, inventoryMap, p.id, null, legacy, resolvedInventoryId);
      }
      return getAllVariantCombinations(groups).some((combo) =>
        isInStockWithInventory(
          effectiveCatalogue,
          inventoryMap,
          p.id,
          combo.id || null,
          getVariantLegacyInStock(p, listingCatalogueId, combo.id, legacy),
          resolvedInventoryId
        )
      );
    };

    const enabledProducts = productsInTableOrder.filter((p) =>
      isProductEnabledForCatalogue(p, listingCatalogueId)
    );

    const scoped = filterProductsByBehaviorScope(
      enabledProducts,
      behavior.productsToShow,
      listingCatalogueId
    );

    const enabledInStock = scoped.filter(productInStockForStore);

    let listed = enabledInStock;
    if (enabledInStock.length === 0) {
      if (enabledProducts.length === 0 && productsInTableOrder.length > 0) {
        listed = productsInTableOrder.filter(productInStockForStore);
      } else {
        listed = enabledInStock;
      }
    }

    return applyMaxProducts(
      sortStorefrontProducts(
        listed,
        behavior.defaultSorting,
        listingCatalogueId,
        effectiveCatalogue
      ),
      behavior.maxProducts
    );
  }, [
    listingCatalogueId,
    productsInTableOrder,
    effectiveCatalogue,
    inventoryMap,
    inventoryTracked,
    resolvedInventoryId,
    behavior.productsToShow,
    behavior.defaultSorting,
    behavior.maxProducts,
  ]);
  const availableCategories = useMemo(
    () => buildStorefrontCategoryFilterList(store?.productCategories, storeProducts),
    [store?.productCategories, storeProducts]
  );
  useEffect(() => {
    if (
      selectedCategory !== 'all' &&
      selectedCategory !== 'uncategorized' &&
      !availableCategories.includes(selectedCategory)
    ) {
      setSelectedCategory('all');
    }
  }, [availableCategories, selectedCategory]);
  const hasUncategorized = useMemo(() => storeProducts.some((p) => getCats(p).length === 0), [storeProducts]);
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return storeProducts.filter((p) => {
      const cats = getCats(p);
      return (!q || srchText(p).includes(q)) && (selectedCategory === 'all' || (selectedCategory === 'uncategorized' ? cats.length === 0 : cats.includes(selectedCategory)));
    });
  }, [searchQuery, selectedCategory, storeProducts]);

  const catalogActiveProduct = useMemo(
    () => (catalogProductHandle ? findProductByHandle(storeProducts, catalogProductHandle) : null),
    [catalogProductHandle, storeProducts]
  );

  const orderSummary = useMemo(() => {
    if (!listingCatalogueId) return { items: [] as any[], total: 0 };
    const items: any[] = []; let total = 0;
    activeCartLines(cartLines).forEach((line) => {
      const productId = line.productId;
      const quantity = line.quantity;
      const product = allProducts.find((p) => p.id === productId); if (!product) return;
      const selection = line.variantSelection;
      const catData = getCatalogueData(product, listingCatalogueId);
      const variantData =
        Object.keys(selection).length > 0
          ? getVariantCombinationData(product, selection, listingCatalogueId)
          : undefined;
      const { price: unitPrice, priceUnit } = getStorefrontPriceAndUnit(
        catData,
        catalogue,
        product,
        selection,
        quantity
      );
      const rules = getProductOrderQuantityRules(catData, variantData?.customFields);
      const quantityStep = rules.step;
      const rowTotal = unitPrice * quantity;
      const pr = product as Record<string, unknown>;
      const iv = pr.imageVersion ?? pr.image_version;
      const variantImageUrl = variantData?.image;
      const baseImageUrl = pickProductImageSrc(product);
      const groups = getProductVariantGroups(product);
      items.push({
        lineId: line.lineId,
        productId,
        name: product.name,
        quantity,
        unitPrice,
        rowTotal,
        priceUnit,
        quantityStep,
        imageUrl: variantImageUrl || baseImageUrl,
        imageVersion: typeof iv === 'number' && Number.isFinite(iv) ? iv : undefined,
        subtitle: product.subtitle,
        variantSelection: { ...selection },
        variantSummary: formatVariantSelectionSummary(groups, selection),
        variantCombinationId:
          groups.length > 0 && isVariantSelectionComplete(groups, selection)
            ? generateVariantCombinationId(selection)
            : undefined,
      });
      total += rowTotal;
    });
    return { items, total };
  }, [cartLines, listingCatalogueId, catalogue, allProducts]);

  const selectedProductCount = useMemo(() => totalCartLineCount(cartLines), [cartLines]);
  const minimumOrderValue = useMemo(() => {
    const n = store?.minimumOrderValue;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  }, [store?.minimumOrderValue]);
  const minimumOrderMet = orderSummary.total >= minimumOrderValue;
  const remainingToMinimum = Math.max(0, minimumOrderValue - orderSummary.total);

  /** Digits for wa.me — same bar as hero chip (any digits); wa.me prefers full country code. */
  const sellerWhatsappDigits = useMemo(() => {
    if (!store) return '';
    return resolveStoreWhatsapp(store);
  }, [store]);

  const changeQty = useCallback((productId: string, delta: number, _qstep?: number) => {
    const product =
      allProducts.find((p) => p.id === productId) ||
      storeProducts.find((p) => p.id === productId);
    if (!product) return;

    const draftSelection = draftVariantSelections[productId] ?? {};
    const groups = getProductVariantGroups(product);
    const isComplete = isVariantSelectionComplete(groups, draftSelection);

    if (groups.length > 0 && !isComplete) {
      setVariantErrorIds(new Set([productId]));
      setTimeout(() => setVariantErrorIds(new Set()), 600);
      openProductPage(product);
      return;
    }

    const catData = listingCatalogueId ? getCatalogueData(product, listingCatalogueId) : null;
    const variantData =
      Object.keys(draftSelection).length > 0
        ? getVariantCombinationData(product, draftSelection, listingCatalogueId)
        : undefined;
    const rules = getProductOrderQuantityRules(catData, variantData?.customFields);
    const current = getCartLineQty(cartLines, productId, draftSelection);
    let rounded = applyQuantityDelta(current, delta, rules.step, rules.moq);

    if (inventoryTracked && listingCatalogueId) {
      const variantId =
        groups.length > 0 && Object.keys(draftSelection).length > 0
          ? generateVariantCombinationId(draftSelection)
          : null;
      const available = getAvailableQty(
        effectiveCatalogue,
        inventoryMap,
        productId,
        variantId,
        resolvedInventoryId
      );
      if (available != null && rounded > available) {
        rounded = available;
      }
    }

    setCartLines((prev) => setCartLineQty(prev, productId, draftSelection, rounded));
  }, [
    allProducts,
    storeProducts,
    draftVariantSelections,
    cartLines,
    listingCatalogueId,
    inventoryTracked,
    openProductPage,
    effectiveCatalogue,
    inventoryMap,
    resolvedInventoryId,
  ]);

  const changeCartLineQty = (lineId: string, delta: number) => {
    const line = cartLines.find((l) => l.lineId === lineId);
    if (!line || !listingCatalogueId) return;
    const product = allProducts.find((p) => p.id === line.productId);
    if (!product) return;
    const selection = line.variantSelection;
    const groups = getProductVariantGroups(product);
    const catData = getCatalogueData(product, listingCatalogueId);
    const variantData =
      Object.keys(selection).length > 0
        ? getVariantCombinationData(product, selection, listingCatalogueId)
        : undefined;
    const rules = getProductOrderQuantityRules(catData, variantData?.customFields);
    let rounded = applyQuantityDelta(line.quantity, delta, rules.step, rules.moq);
    if (inventoryTracked) {
      const variantId =
        groups.length > 0 && Object.keys(selection).length > 0
          ? generateVariantCombinationId(selection)
          : null;
      const available = getAvailableQty(
        effectiveCatalogue,
        inventoryMap,
        line.productId,
        variantId,
        resolvedInventoryId
      );
      if (available != null && rounded > available) {
        rounded = available;
      }
    }
    setCartLines((prev) => setCartLineQtyById(prev, lineId, rounded));
  };

  const applyDraftVariantSelection = useCallback((productId: string, groupId: string, option: string) => {
    setDraftVariantSelections((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? {}), [groupId]: option },
    }));

    setCartLines((prev) => removeZeroQtyLinesForProduct(prev, productId));

    setVariantErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const loadDraftVariantIntoEditor = useCallback((productId: string, selection: Record<string, string>) => {
    setDraftVariantSelections((prev) => ({
      ...prev,
      [productId]: { ...selection },
    }));
    setCartLines((prev) => removeZeroQtyLinesForProduct(prev, productId));
  }, []);

  const websiteOrderBridge = useMemo<WebsiteOrderBridgeValue | null>(() => {
    if (!store?.websiteModeEnabled) return null;
    return {
      currencySymbol,
      catalogue,
      sellerFieldsDefinition,
      getProductQty: (productId: string) =>
        getCartLineQty(cartLines, productId, draftVariantSelections[productId] ?? {}),
      changeProductQty: (productId: string, delta: number, qstep: number) => changeQty(productId, delta, qstep),
      getVariantSelection: (productId: string) => draftVariantSelections[productId] ?? {},
      setVariantSelection: (productId: string, groupId: string, option: string) => {
        applyDraftVariantSelection(productId, groupId, option);
      },
      hasVariantError: (productId: string) => variantErrorIds.has(productId),
    };
  }, [
    store?.websiteModeEnabled,
    currencySymbol,
    catalogue,
    sellerFieldsDefinition,
    cartLines,
    draftVariantSelections,
    variantErrorIds,
    applyDraftVariantSelection,
    changeQty,
    allProducts,
    storeProducts,
  ]);

  const websiteCheckoutTheme = useMemo(
    () => buildWebsiteThemeVars(homepageLayout?.theme),
    [homepageLayout?.theme]
  );
  const websiteCheckoutVariant =
    homepageLayout?.websiteConfig?.templates?.product?.layoutVariant ?? 'minimal';
  const websiteCheckoutClass = store?.websiteModeEnabled
    ? `website-checkout wp-${websiteCheckoutVariant}`
    : '';

  const handleBack = useCallback(() => {
    if (catalogProductHandle) {
      closeProductPage();
      return;
    }
    if (step !== 'products') {
      setStep(step === 'review' ? 'customer' : 'products');
      return;
    }
    window.history.back();
  }, [catalogProductHandle, step, closeProductPage]);

  // Filter out 0-quantity items for final submission
  const reviewSummary = useMemo(() => {
    return {
      items: orderSummary.items.filter(item => item.quantity > 0),
      total: orderSummary.items
        .filter(item => item.quantity > 0)
        .reduce((sum, item) => sum + item.rowTotal, 0),
    };
  }, [orderSummary]);

  const checkoutSettings = useMemo(
    () =>
      sellerCheckoutFeatures?.checkoutSettings ??
      normalizeCheckoutSettings(store?.checkoutSettings),
    [sellerCheckoutFeatures, store?.checkoutSettings]
  );

  const showCodOption = useMemo(() => {
    if (checkoutSettings.enableCod) return true;
    return checkoutSettings.rules.some((r) => r.enabled && r.type === 'cod_charge');
  }, [checkoutSettings]);

  const integrationFlags = useMemo(
    () =>
      sellerCheckoutFeatures?.integrationFlags ??
      normalizeStoreIntegrationFlags(store?.integrationFlags),
    [sellerCheckoutFeatures, store?.integrationFlags]
  );
  const shiprocketActive = integrationFlags.shiprocket;
  const razorpayActive = integrationFlags.razorpay;
  const requiresShippingAddress = shiprocketActive;
  const customerDetailsComplete =
    Boolean(customerName.trim()) &&
    Boolean(customerWhatsappNumber.trim()) &&
    (!requiresShippingAddress ||
      (Boolean(shipLine1.trim()) &&
        Boolean(shipCity.trim()) &&
        Boolean(shipState.trim()) &&
        shipPincode.replace(/\D/g, '').length === 6)) &&
    (minimumOrderValue <= 0 || minimumOrderMet);
  const showPrepaidOption = razorpayActive;
  const showPaymentMethodChoice = showPrepaidOption && showCodOption;

  const effectivePaymentMethod = useMemo(() => {
    if (showPrepaidOption && showCodOption) return paymentMethod;
    if (showPrepaidOption) return 'prepaid' as const;
    if (showCodOption) return 'cod' as const;
    return 'prepaid' as const;
  }, [showPrepaidOption, showCodOption, paymentMethod]);

  useEffect(() => {
    if (showPrepaidOption && !showCodOption) setPaymentMethod('prepaid');
    if (!showPrepaidOption && showCodOption) setPaymentMethod('cod');
  }, [showPrepaidOption, showCodOption]);

  const checkoutTotals = useMemo(
    () =>
      computeCheckoutTotals(reviewSummary.total, checkoutSettings, {
        couponCode,
        paymentMethod: effectivePaymentMethod,
      }),
    [reviewSummary.total, checkoutSettings, couponCode, effectivePaymentMethod]
  );

  const hasCheckoutRules = checkoutSettings.rules.some((r) => r.enabled);

  const handlePlaceOrder = async () => {
    if (!listingCatalogueId) return;
    for (const item of reviewSummary.items) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) continue;
      const groups = getProductVariantGroups(product);
      if (
        groups.length > 0 &&
        !isVariantSelectionComplete(groups, item.variantSelection ?? {})
      ) {
        alert(`Please choose all variants for "${item.name}" before placing the order.`);
        if (store.websiteModeEnabled) {
          const slugForPath = effectiveSlug || store.storeSlug || '';
          navigate(productPagePath(slugForPath, product, dedicatedHost));
        } else {
          openProductPage(product);
          setStep('products');
        }
        return;
      }
    }
    if (inventoryTracked) {
      for (const item of reviewSummary.items) {
        const available = getAvailableQty(
          effectiveCatalogue,
          inventoryMap,
          item.productId,
          item.variantCombinationId ?? null,
          resolvedInventoryId
        );
        if (available != null && item.quantity > available) {
          alert(
            available === 0
              ? `"${item.name}" is out of stock. Remove it or choose another variant.`
              : `Only ${available} available for "${item.name}". Please adjust the quantity.`
          );
          const product = allProducts.find((p) => p.id === item.productId);
          if (product) {
            if (store.websiteModeEnabled) {
              const slugForPath = effectiveSlug || store.storeSlug || '';
              navigate(productPagePath(slugForPath, product, dedicatedHost));
            } else {
              openProductPage(product);
              setStep('products');
            }
          }
          return;
        }
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
        const catData = getCatalogueData(product, listingCatalogueId);
        const { price: unitPrice, priceUnit } = getStorefrontPriceAndUnit(
          catData,
          catalogue,
          product,
          item.variantSelection ?? {}
        );
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
          variantCombinationId: item.variantCombinationId || undefined,
        });
      });
      setSupabaseRlsUserId(store.sellerUserId);
      const fullWhatsappNumber = customerWhatsappNumber.trim() ? `${customerWhatsappCountry}${customerWhatsappNumber.trim()}` : undefined;
      const storeSlugForOrder = (effectiveSlug || store.storeSlug || '').trim().toLowerCase();
      const { data: createdOrder, error } = await createOrder(
        store.sellerUserId,
        '',
        customerName.trim(),
        orderItems,
        checkoutTotals.grandTotal,
        store.sellerCurrencyCode || 'INR',
        fullWhatsappNumber,
        'store',
        storeSlugForOrder || undefined,
        {
          paymentMethod: effectivePaymentMethod,
          checkoutAdjustments: checkoutTotals,
          shippingAddress:
            requiresShippingAddress &&
            shipLine1.trim() &&
            shipCity.trim() &&
            shipState.trim() &&
            shipPincode.trim()
              ? {
                  line1: shipLine1.trim(),
                  city: shipCity.trim(),
                  state: shipState.trim(),
                  pincode: shipPincode.replace(/\D/g, '').slice(0, 6),
                  country: 'India',
                }
              : undefined,
        }
      );
      if (error) {
        const msg = String((error as { message?: string })?.message ?? error ?? '');
        if (msg.includes('insufficient_stock')) {
          alert('Some items are no longer in stock. Please review your cart and try again.');
        } else {
          alert('Failed to place order. Please try again.');
        }
      } else {
        if (effectivePaymentMethod === 'prepaid' && razorpayActive && createdOrder?.id) {
          try {
            const session = await beginStoreRazorpayCheckout(createdOrder.id);
            await openStoreRazorpayCheckout(session, storeDisplayName);
          } catch (payErr) {
            const payMsg = payErr instanceof Error ? payErr.message : 'Payment could not be completed';
            alert(`Order placed but payment was not completed: ${payMsg}`);
          }
        }
        const trackingUrl = createdOrder?.tracking_token
          ? buildOrderTrackingUrl(createdOrder.tracking_token)
          : null;
        setStep('products');
        setCartLines([]);
        setDraftVariantSelections({});
        setCustomerName('');
        setCustomerWhatsappCountry('+91');
        setCustomerWhatsappNumber('');
        setShipLine1('');
        setShipCity('');
        setShipState('');
        setShipPincode('');
        setSearchQuery('');
        setSelectedCategory('all');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setOrderSuccess({ trackingUrl });
        reloadStoreInventory();
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
      if (
        requiresShippingAddress &&
        (!shipLine1.trim() || !shipCity.trim() || !shipState.trim() || shipPincode.replace(/\D/g, '').length !== 6)
      ) {
        alert('Please enter your full delivery address (street, city, state, and 6-digit pincode)');
        return;
      }
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
        <div className="sv"><div className={`sv-page${store?.websiteModeEnabled ? ' website-mode-full' : ''}`}>
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
              <div className="sv-error-icon">
                <IconAlertTriangle size={28} />
              </div>
              <div className="sv-error-title">Store unavailable</div>
              <div className="sv-error-desc">{storeError || 'This store could not be found.'}</div>
              <button className="sv-error-btn" onClick={() => navigate('/')}>Go home</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Seller maintenance break ── */
  if (store.maintenanceMode === true) {
    const maintName =
      store.sellerBusinessName?.trim() ||
      (store.storeSlug ? store.storeSlug.charAt(0).toUpperCase() + store.storeSlug.slice(1) : 'This store');
    return (
      <>
        <style>{CSS}</style>
        <div className="sv sv-fullscreen">
          <div className="sv-error-card">
            <div className="sv-error-stripe" style={{ background: 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
            <div className="sv-error-body">
              <div className="sv-offline-icon" aria-hidden>🔧</div>
              <div className="sv-offline-title">Under maintenance</div>
              <div className="sv-offline-desc">
                {maintName} is temporarily unavailable while we make improvements. Please check back soon.
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
        <div className={`sv-page${store?.websiteModeEnabled ? ' website-mode-full' : ''}`}>

          {store?.websiteModeEnabled && websiteOrderBridge ? (
            <WebsiteOrderBridgeProvider value={websiteOrderBridge}>
              <WebsiteRuntime
                slug={effectiveSlug || slug || ''}
                pathname={location.pathname}
                homepageLayout={homepageLayout}
                products={storeProducts}
                store={store}
                onSubdomain={dedicatedHost}
              />
            </WebsiteOrderBridgeProvider>
          ) : store?.websiteModeEnabled ? (
            <WebsiteRuntime
              slug={effectiveSlug || slug || ''}
              pathname={location.pathname}
              homepageLayout={homepageLayout}
              products={storeProducts}
              store={store}
              onSubdomain={dedicatedHost}
            />
          ) : (
            <>
          {catalogProductHandle ? (
            <div className="sv-catalog-product-page">
              <div className="sv-catalog-product-top">
                <button type="button" className="sv-catalog-product-back" onClick={closeProductPage} aria-label="Back to items">
                  ←
                </button>
                <div className="sv-catalog-product-top-meta">
                  <div className="sv-store-name">{storeDisplayName}</div>
                </div>
              </div>
              <div className="sv-catalog-product-content">
                {catalogActiveProduct && store ? (
                  <StoreProductOrderPanel
                    product={catalogActiveProduct}
                    store={store}
                    currencySymbol={currencySymbol}
                    catalogue={catalogue}
                    sellerFieldsDefinition={sellerFieldsDefinition}
                    quantity={getCartLineQty(
                      cartLines,
                      catalogActiveProduct.id,
                      draftVariantSelections[catalogActiveProduct.id] ?? {}
                    )}
                    variantSelection={draftVariantSelections[catalogActiveProduct.id] ?? {}}
                    variantError={variantErrorIds.has(catalogActiveProduct.id)}
                    onVariantSelect={(groupId, option) =>
                      applyDraftVariantSelection(catalogActiveProduct.id, groupId, option)
                    }
                    onQtyChange={(delta) => {
                      const catData = listingCatalogueId
                        ? getCatalogueData(catalogActiveProduct, listingCatalogueId)
                        : null;
                      const qstep = normalizeOrderQuantityStep(catData?.orderQuantityStep);
                      changeQty(catalogActiveProduct.id, delta, qstep);
                    }}
                    onDone={closeProductPage}
                    layout="page"
                    layoutVariant="minimal"
                    orderCtaLabel="Done"
                    ctaStyle="solid"
                    showQuantitySelector
                  />
                ) : (
                  <div className="sv-empty">
                    <strong>Product not found</strong>
                    <p>This item is not available on this store.</p>
                    <button type="button" className="sv-details-btn" onClick={closeProductPage}>
                      Back to all items
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
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

          {/* ══ PRODUCT LISTING (default orderform storefront) ══ */}
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
                <span className="sv-search-icon">
                  <IconSearch size={16} />
                </span>
                <input className="sv-search-input" type="text" placeholder="Search items…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && <button className="sv-search-clear" onClick={() => setSearchQuery('')}>×</button>}
              </div>
            )}
            {behavior.showCategories && availableCategories.length > 0 && (
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
          <div
            className={storefrontViewMode === 'list' ? 'of-items sv-of-items--store' : 'sv-grid'}
            style={storefrontViewMode === 'grid' ? storefrontGridStyle : undefined}
          >
            {productsLoading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
            {!productsLoading && storeProducts.length === 0 && (
              <div className="sv-empty"><div className="sv-empty-icon"><IconShoppingBag size={40} /></div><strong>No items yet</strong><p>Products will appear here once the seller adds them.</p></div>
            )}
            {!productsLoading && storeProducts.length > 0 && filteredProducts.length === 0 && (
              <div className="sv-empty"><div className="sv-empty-icon"><IconSearch size={40} /></div><strong>Nothing found</strong><p>Try a different search or category.</p></div>
            )}
            {!productsLoading && filteredProducts.map((product) => {
              const draftSelection = draftVariantSelections[product.id] ?? {};
              const variantGroups = getProductVariantGroups(product);
              const quantity = getCartLineQty(cartLines, product.id, draftSelection);
              const isSelected = productHasCartLines(cartLines, product.id);
              const catData = listingCatalogueId ? getCatalogueData(product, listingCatalogueId) : null;
              const variantData =
                Object.keys(draftSelection).length > 0
                  ? getVariantCombinationData(product, draftSelection, listingCatalogueId)
                  : undefined;
              const rules = getProductOrderQuantityRules(catData, variantData?.customFields);
              const { price, priceUnit, listPrice, showOffer, priceFrom } = getStorefrontPriceAndUnit(
                catData,
                catalogue,
                product,
                draftSelection,
                quantity
              );
              const qstep = rules.step;
              const minQty = rules.minQty;
              const slabLines = formatQuantitySlabTable(catData, currencySymbol, variantData ?? undefined);
              const imgUrl = displayStoreProductImage(product);
              const hasParsedPrice = Number.isFinite(price);
              const lineAmt = quantity > 0 && hasParsedPrice ? quantity * price : 0;
              const lineCalcDetail =
                hasParsedPrice && quantity > 0
                  ? formatStorefrontLineCalculationDetail(quantity, price, priceUnit, currencySymbol)
                  : null;
              const legacyInStock = isProductInStockForCatalogue(
                product,
                listingCatalogueId,
                effectiveCatalogue
              );

              if (storefrontViewMode === 'list') {
                return (
                  <div
                    key={product.id}
                    className={`of-item-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <div className="of-img-wrap" onClick={() => openProductPage(product)}>
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
                            {behavior.showPrice && Number.isFinite(price) ? (
                              <div className="of-price-tag">
                                {priceFrom ? 'From ' : ''}
                                {fmt(price, currencySymbol)}
                                {showOffer && listPrice != null && listPrice > 0 ? (
                                  <span className="sv-price-strike">{fmt(listPrice, currencySymbol)}</span>
                                ) : null}
                                {priceUnit ? ` ${priceUnit}` : ''}
                              </div>
                            ) : null}
                            {behavior.showAvailability && !legacyInStock ? (
                              <div className="of-step-hint of-step-hint--next-to-qty">Out of stock</div>
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
                            {minQty > 1 ? (
                              <div className="of-step-hint of-step-hint--next-to-qty">
                                <AlertIcon />
                                Min {minQty}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="of-view-btn"
                          onClick={() => openProductPage(product)}
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
                          {behavior.showPrice && hasParsedPrice ? (
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
                  <div className="sv-pcard-img-wrap" style={{ aspectRatio: storefrontImageAspectRatio }} onClick={() => openProductPage(product)}>
                    <StoreProductImageArea product={product} variant="card" />
                    {behavior.showAvailability && !legacyInStock ? (
                      <span className="sv-pcard-stock sv-pcard-stock--oos">Out of stock</span>
                    ) : null}
                    {isSelected && <div className="sv-pcard-sel"><IconCheck /></div>}
                  </div>
                  <div className="sv-pcard-body">
                    <div className="sv-pcard-name">{product.name}</div>
                    {product.subtitle && <div className="sv-pcard-sub">{product.subtitle}</div>}
                    {isSelected && Object.keys(draftSelection).length > 0 && (() => {
                      const summary = formatVariantSelectionSummary(variantGroups, draftSelection);
                      return summary && quantity > 0 ? <VariantPills summary={summary} /> : null;
                    })()}
                    {behavior.showPrice && Number.isFinite(price) && (
                      <div className="sv-pcard-price">
                        {priceFrom ? 'From ' : ''}
                        {fmt(price, currencySymbol)}
                        {showOffer && listPrice != null && listPrice > 0 ? (
                          <span className="sv-price-strike">{fmt(listPrice, currencySymbol)}</span>
                        ) : null}
                        {priceUnit && <span className="sv-pcard-price-unit">/{unitLabel(priceUnit)}</span>}
                      </div>
                    )}
                    {slabLines.length > 0 && (
                      <div className="sv-pcard-sub" style={{ fontSize: '10px', lineHeight: 1.4 }}>
                        {slabLines.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="sv-pcard-footer">
                    <div className="sv-pcard-actions">
                      <QtyControl
                        value={quantity}
                        step={qstep}
                        onChange={(d) => {
                          const hasVariants = variantGroups.length > 0;
                          const variantComplete = isVariantSelectionComplete(variantGroups, draftSelection);
                          if (hasVariants && !variantComplete) {
                            openProductPage(product);
                          } else {
                            changeQty(product.id, d, qstep);
                          }
                        }}
                        accent={isSelected}
                      />
                      <button type="button" className="sv-details-btn" onClick={() => openProductPage(product)}>Details</button>
                    </div>
                    {qstep > 1 && <PackHint step={qstep} />}
                    {rules.moq > 1 && <MoqHint minQty={minQty} />}
                  </div>
                  {isSelected && behavior.showPrice && (
                    <div className="sv-pcard-subtotal">
                      {calcDetail && <span className="sv-pcard-subtotal-calc">{calcDetail}</span>}
                      <span className="sv-pcard-subtotal-val">{fmt(price * quantity, currencySymbol)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}
            </>
          )}

          {!store?.websiteModeEnabled && hasFooterDetails && renderStoreFooter()}

          {/* ══ FLOATING CART BAR ══ */}
          {selectedProductCount > 0 && step === 'products' && (
            <div className={`sv-cart${websiteCheckoutClass ? ` ${websiteCheckoutClass}` : ''}`} style={websiteCheckoutClass ? websiteCheckoutTheme : undefined}>
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
          <div
            className={`sv-panel sv-checkout-panel${step === 'customer' ? ' sv-checkout-panel--details' : ''}${websiteCheckoutClass ? ` ${websiteCheckoutClass}` : ''}`}
            style={websiteCheckoutClass ? websiteCheckoutTheme : undefined}
          >
            <div className="sv-checkout-shell">
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
                    ? !customerDetailsComplete
                    : isSubmitting || (minimumOrderValue > 0 && !minimumOrderMet)
                }
              >
                {step === 'customer' ? 'Review →' : isSubmitting ? 'Placing…' : 'Confirm'}
              </button>
            </div>

            <div className="sv-checkout-steps">
              <StepBar current={step} />
            </div>

            {step === 'customer' && (
              <div className="sv-checkout-content">
                <div className="sv-checkout-grid sv-checkout-grid--details">
                  <div className="sv-checkout-column sv-checkout-column--main">
                    {(!customerName.trim() || !customerWhatsappNumber.trim()) && (
                      <div className="sv-checkout-alert">
                        Name and WhatsApp are required to continue.
                      </div>
                    )}
                    {requiresShippingAddress && (!shipLine1.trim() || !shipCity.trim() || !shipState.trim() || shipPincode.replace(/\D/g, '').length !== 6) && (
                      <div className="sv-checkout-alert">
                        Delivery address is required because shipping is enabled on this store.
                      </div>
                    )}
                    {minimumOrderValue > 0 && !minimumOrderMet && (
                      <div className="sv-checkout-alert">
                        Minimum order is {fmt(minimumOrderValue, currencySymbol)}. Add {fmt(remainingToMinimum, currencySymbol)} more to continue.
                      </div>
                    )}

                    <div className="sv-checkout-card">
                      <h2 className="sv-checkout-card-title">Contact details</h2>
                      <div className="sv-checkout-fields">
                        <div className="sv-field">
                          <label>Your name *</label>
                          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter your full name" autoFocus />
                        </div>
                        <div className="sv-field">
                          <label>WhatsApp number *</label>
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
                                aria-label="Country code"
                              />
                            </div>
                            <div className="sv-phone-group-number">
                              <input type="text" value={customerWhatsappNumber} onChange={(e) => setCustomerWhatsappNumber(e.target.value.replace(/\D/g, ''))} placeholder="98xxxxxxxx" inputMode="numeric" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {requiresShippingAddress ? (
                      <div className="sv-checkout-card">
                        <h2 className="sv-checkout-card-title">Delivery address</h2>
                        <div className="sv-checkout-fields">
                          <div className="sv-field">
                            <label>Street / building / area *</label>
                            <input
                              type="text"
                              value={shipLine1}
                              onChange={(e) => setShipLine1(e.target.value)}
                              placeholder="House no., street, area"
                            />
                          </div>
                          <div className="sv-field-row sv-field-row--3">
                            <div className="sv-field">
                              <label>City *</label>
                              <input type="text" value={shipCity} onChange={(e) => setShipCity(e.target.value)} placeholder="City" />
                            </div>
                            <div className="sv-field">
                              <label>State *</label>
                              <input type="text" value={shipState} onChange={(e) => setShipState(e.target.value)} placeholder="State" />
                            </div>
                            <div className="sv-field sv-field--pincode">
                              <label>Pincode *</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={shipPincode}
                                onChange={(e) => setShipPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6-digit"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <aside className="sv-checkout-column sv-checkout-column--aside">
                    {showPaymentMethodChoice ? (
                      <div className="sv-checkout-card">
                        <h2 className="sv-checkout-card-title">Payment method</h2>
                        <div className="sv-payment-options">
                          <button
                            type="button"
                            className={`sv-payment-opt${paymentMethod === 'prepaid' ? ' is-active' : ''}`}
                            onClick={() => setPaymentMethod('prepaid')}
                          >
                            Pay now / UPI
                          </button>
                          <button
                            type="button"
                            className={`sv-payment-opt${paymentMethod === 'cod' ? ' is-active' : ''}`}
                            onClick={() => setPaymentMethod('cod')}
                          >
                            Cash on delivery
                          </button>
                        </div>
                      </div>
                    ) : showPrepaidOption ? (
                      <div className="sv-checkout-card sv-checkout-card--compact">
                        <h2 className="sv-checkout-card-title">Payment</h2>
                        <p className="sv-checkout-card-note">
                          You will pay online securely via Razorpay after confirming the order.
                        </p>
                      </div>
                    ) : showCodOption ? (
                      <div className="sv-checkout-card sv-checkout-card--compact">
                        <h2 className="sv-checkout-card-title">Payment</h2>
                        <p className="sv-checkout-card-note">
                          Cash on delivery
                          {checkoutTotals.codTotal > 0
                            ? ` (includes ${fmt(checkoutTotals.codTotal, currencySymbol)} COD fee)`
                            : ''}
                        </p>
                      </div>
                    ) : null}

                    {checkoutSettings.allowCouponEntry && checkoutSettings.rules.some((r) => r.enabled && r.type.startsWith('coupon_')) ? (
                      <div className="sv-checkout-card sv-checkout-card--compact">
                        <h2 className="sv-checkout-card-title">Coupon code</h2>
                        <div className="sv-coupon-row">
                          <input
                            type="text"
                            className="sv-coupon-input"
                            placeholder="Enter code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          />
                        </div>
                        {couponCode.trim() && !checkoutTotals.appliedCouponCode ? (
                          <p className="sv-checkout-coupon-hint">Code not recognized or does not apply to this order.</p>
                        ) : null}
                      </div>
                    ) : null}

                    {orderSummary.items.length > 0 ? (
                      <div className="sv-checkout-card sv-checkout-card--summary">
                        <h2 className="sv-checkout-card-title">Your order</h2>
                        <div className="sv-review-list">
                          {orderSummary.items.map((item: any) => {
                            const catData = listingCatalogueId
                              ? getCatalogueData(allProducts.find((p) => p.id === item.productId), listingCatalogueId)
                              : null;
                            const qstep = catData ? normalizeOrderQuantityStep(catData.orderQuantityStep) : 1;
                            const cd = item.quantity > 0 ? fmtCalc(item.quantity, item.unitPrice, item.priceUnit, currencySymbol, item.quantityStep) : null;
                            return (
                              <div key={item.lineId} className={`sv-checkout-item-card${item.quantity === 0 ? ' is-muted' : ''}`}>
                                <div className="sv-checkout-item-row">
                                  <div className="sv-checkout-item-thumb">
                                    {(() => {
                                      const src = productImageDisplayUrl(item.imageUrl, item.imageVersion);
                                      return isDisplayableImageUrl(src)
                                        ? <img key={src} src={src} alt={item.name} />
                                        : <div className="sv-checkout-item-thumb-ph"><IconImg size={24} /></div>;
                                    })()}
                                  </div>
                                  <div className="sv-checkout-item-main">
                                    <div className="sv-checkout-item-text">
                                      <div className="sv-checkout-item-name">{item.name}</div>
                                      {item.subtitle ? <div className="sv-checkout-item-sub">{item.subtitle}</div> : null}
                                      {item.variantSummary ? <VariantPills summary={item.variantSummary} /> : null}
                                    </div>
                                    <QtyControl value={item.quantity} step={qstep} onChange={(delta) => changeCartLineQty(item.lineId, delta)} accent={item.quantity > 0} />
                                  </div>
                                </div>
                                {cd ? (
                                  <div className="sv-checkout-item-footer">
                                    <span>{cd}</span>
                                    <span className="sv-checkout-line-total">{fmt(item.rowTotal, currencySymbol)}</span>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <CheckoutBreakdown
                          totals={checkoutTotals}
                          currencySymbol={currencySymbol}
                          fmt={fmt}
                          showBreakdown={checkoutSettings.showBreakdown && hasCheckoutRules}
                        />
                      </div>
                    ) : null}
                  </aside>
                </div>
              </div>
            )}

            {step === 'customer' ? (
              <div className="sv-checkout-mobile-cta">
                <button
                  type="button"
                  className="sv-panel-cta"
                  onClick={handlePanelAction}
                  disabled={!customerDetailsComplete}
                >
                  Review →
                </button>
              </div>
            ) : null}

            {step === 'review' && (
              <div className="sv-checkout-content">
                <div className="sv-review-layout sv-checkout-grid sv-checkout-grid--review">
                  <section className="sv-checkout-section sv-checkout-section--main">
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
                              <div>
                                <div className="sv-rcard-name">{item.name}</div>
                                {item.subtitle && <div className="sv-rcard-sub">{item.subtitle}</div>}
                                {item.variantSummary && <VariantPills summary={item.variantSummary} />}
                              </div>
                              <div className="sv-rcard-bottom">
                                {cd && <span className="sv-rcard-calc">{cd}</span>}
                                <span className="sv-rcard-total">{fmt(item.rowTotal, currencySymbol)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="sv-review-customer" style={{ margin: '14px 0 0' }}>
                      <div className="sv-review-customer-label">Ordering as</div>
                      <div className="sv-review-customer-name">{customerName}</div>
                      {customerWhatsappNumber && (
                        <div className="sv-review-customer-phone">
                          {customerWhatsappCountry} {customerWhatsappNumber}
                        </div>
                      )}
                    </div>
                  </section>
                  <section className="sv-checkout-section sv-checkout-section--summary">
                    {showCodOption ? (
                      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--c-text2)' }}>
                        Payment: <strong>{paymentMethod === 'cod' ? 'Cash on delivery' : 'Pay now / UPI'}</strong>
                      </div>
                    ) : null}
                    <CheckoutBreakdown
                      totals={checkoutTotals}
                      currencySymbol={currencySymbol}
                      fmt={fmt}
                      showBreakdown={checkoutSettings.showBreakdown && hasCheckoutRules}
                    />
                    <button type="button" className="sv-edit-btn" style={{ marginTop: 12 }} onClick={() => setStep('customer')}>
                      Edit items
                    </button>
                  </section>
                </div>
              </div>
            )}
            {!store?.websiteModeEnabled && hasFooterDetails && renderStoreFooter()}
            </div>
          </div>
        )}

        {sellerWhatsappDigits && !catalogProductHandle && (step === 'products' || step === 'customer' || step === 'review') && (
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

      </div>

      <OrderPlacedSuccessModal
        isOpen={orderSuccess !== null}
        onClose={() => setOrderSuccess(null)}
        trackingUrl={orderSuccess?.trackingUrl ?? null}
        subtitle="Save this link to check status and edit your order anytime while it is pending. The seller will contact you soon."
      />
    </>
  );
}
