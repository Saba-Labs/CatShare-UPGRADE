import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdArrowBack, MdStar, MdOutlineHome } from "react-icons/md";
import { Capacitor } from "@capacitor/core";
import { BillingPlugin } from "capacitor-billing";
import { useSubscription } from "../context/SubscriptionContext";
import { getSupabaseAccessToken } from "../supabaseClient";
import { SUBSCRIPTION_SKUS, SUBSCRIPTION_BASE_PLAN_IDS, INAPP_SKUS } from "../config/subscriptionSkus";
import { getCurrentCurrencySymbol, onCurrencyChange } from "../utils/currencyUtils";
import {
  FREE_MAX_PRODUCTS,
  FREE_MAX_CATALOGUES,
  FREE_MAX_PDF_PER_DAY,
  FREE_MAX_SHARE_LINK_PER_DAY,
  FREE_WATERMARK_TEXT,
  TRIAL_DAYS_UI_FALLBACK,
} from "../config/freeTierLimits";
import SupportWhatsAppFab from "../components/SupportWhatsAppFab";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const ANDROID_PACKAGE_NAME = "com.catshare.official";

function formatTrialEndDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });
  } catch {
    return iso;
  }
}

function daysRemaining(iso) {
  try {
    const diff = new Date(iso) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

export default function ProInfo() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPro, isPaidPro, isTrialActive, trialEndsAt, trialDays, refresh } = useSubscription();

  // Get the referrer from query params
  const params = new URLSearchParams(location.search);
  const referrer = params.get('from') || 'settings'; // default to settings if not specified
  const trialDaysDisplay = trialDays ?? TRIAL_DAYS_UI_FALLBACK;
  const daysLeft = trialEndsAt ? daysRemaining(trialEndsAt) : null;
  const trialProgress = daysLeft != null && trialDaysDisplay ? ((trialDaysDisplay - daysLeft) / trialDaysDisplay) * 100 : 0;

  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState(null);
  const [billingFrequency, setBillingFrequency] = useState("monthly"); // "monthly", "yearly", "lifetime"
  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());
  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "compare"

  const isAndroid = Capacitor.getPlatform() === "android";

  // Listen for currency changes
  useEffect(() => {
    const unsubscribe = onCurrencyChange((currency, symbol) => {
      setCurrencySymbol(symbol);
    });
    return unsubscribe;
  }, []);

  // Load prices from Google Play
useEffect(() => {
  if (!isAndroid) return;
  (async () => {
    try {
      const next = {};

      // Subscriptions: monthly + yearly
      for (const sku of [SUBSCRIPTION_SKUS.monthly, SUBSCRIPTION_SKUS.yearly]) {
        try {
          const result = await BillingPlugin.querySkuDetails({
            product: sku,
            type: "SUBS",
            basePlanId: SUBSCRIPTION_BASE_PLAN_IDS[sku],
          });
          const parsed = Array.isArray(result) ? result[0] : result;
          next[sku] = parsed?.price || null;
        } catch (skuErr) {
          next[sku] = null;
        }
      }

      // Lifetime in-app
      try {
        const sku = INAPP_SKUS.lifetime;
        const result = await BillingPlugin.querySkuDetails({ product: sku, type: "inapp" });
          const parsed = Array.isArray(result) ? result[0] : result;
          next[sku] = parsed?.price || null;
      } catch (inappErr) {
        next[INAPP_SKUS.lifetime] = null;
      }

      setPrices(next);
    } catch (e) {
      setError("Could not load prices. Please try again.");
    }
  })();
}, [isAndroid]);

  async function verifyWithBackend(path, body) {
    if (!BACKEND_URL) throw new Error("Missing VITE_BACKEND_URL");
    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) throw new Error("Not logged in");
    const resp = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      throw new Error(json?.error || `Verification failed (${resp.status})`);
    }
    return resp.json().catch(() => ({}));
  }

  const handleBuySubscription = async (sku) => {
  setLoading(true);
  setError(null);
  try {
    const cleanSku = sku.split(":")[0]; // safety strip any accidental suffix
    const result = await BillingPlugin.launchBillingFlow({
      product: cleanSku,
      type: "SUBS",
      basePlanId: SUBSCRIPTION_BASE_PLAN_IDS[cleanSku],
    });

    let purchase;
    try {
      purchase = JSON.parse(result.value);
    } catch (parseErr) {
      throw new Error("Billing response parse failed");
    }

    const purchaseToken = purchase.purchaseToken;
    await BillingPlugin.sendAck({ purchaseToken });

    await verifyWithBackend("/iap/android/receipt", {
      packageName: ANDROID_PACKAGE_NAME,
      subscriptionId: cleanSku,
      purchaseToken,
    });

    await refresh();
  } catch (e) {
    setError(e?.message || "Purchase failed. Please try again.");
  } finally {
    setLoading(false);
  }
};

  const handleBuyLifetime = async () => {
  setLoading(true);
  setError(null);
  try {
    const sku = INAPP_SKUS.lifetime;
    const result = await BillingPlugin.launchBillingFlow({
      product: sku,
      type: "inapp",
    });

    let purchase;
    try {
      purchase = JSON.parse(result.value);
    } catch (parseErr) {
      throw new Error("Billing response parse failed");
    }

    const purchaseToken = purchase.purchaseToken;
    await BillingPlugin.sendAck({ purchaseToken });

    await verifyWithBackend("/iap/android/product", {
      packageName: ANDROID_PACKAGE_NAME,
      productId: sku,
      purchaseToken,
    });

    await refresh();
  } catch (e) {
    setError(e?.message || "Purchase failed. Please try again.");
  } finally {
    setLoading(false);
  }
};

  const handleRestore = async () => {
    setLoading(true);
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError("Restore failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const planLabel = isPaidPro ? "Pro" : isTrialActive ? "Pro Trial" : isPro ? "Pro" : "Free";
  const handleManageAccount = () => navigate(`/settings/pro/manage?from=${referrer}`);

  const freePlanLimits = {
    products: FREE_MAX_PRODUCTS,
    catalogues: FREE_MAX_CATALOGUES,
    pdfPerDay: FREE_MAX_PDF_PER_DAY,
    shareLinkPerDay: FREE_MAX_SHARE_LINK_PER_DAY,
  };

  const features = [
    {
      name: "Product Creation",
      free: `Up to ${freePlanLimits.products}`,
      pro: "Unlimited",
      locked: true,
    },
    {
      name: "Catalogue Creation",
      free: `Up to ${freePlanLimits.catalogues}`,
      pro: "Unlimited",
      locked: true,
    },
    {
      name: "Product Images",
      free: "Limited",
      pro: "Multiple Images",
      locked: true,
    },
    {
      name: "Slab Pricing",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Product Variants",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Watermark Settings",
      free: `"${FREE_WATERMARK_TEXT}" (fixed)`,
      pro: "Full control",
      locked: true,
    },
    {
      name: "Stock Control",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "PDF generation (per day)",
      free: `${freePlanLimits.pdfPerDay}`,
      pro: "Unlimited",
      locked: false,
    },
    {
      name: "Shareable order links (per day)",
      free: `${freePlanLimits.shareLinkPerDay}`,
      pro: "Unlimited",
      locked: false,
    },
    {
      name: "Bulk Editor",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Homepage Builder",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Custom Domain",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Payment Integration",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Shipping Integration",
      free: "-",
      pro: "Available",
      locked: true,
    },
    {
      name: "Glass Theme",
      free: "Locked",
      pro: "Available",
      locked: true,
    },
  ];

  return (
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-white via-gray-50 to-gray-100 relative">
      <SupportWhatsAppFab bottomOffsetPx={0} alignCenterWithHeightPx={0} />
      {/* Status bar placeholder */}
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      {/* Header */}
      <header className="sticky top-[40px] z-40 bg-white/70 backdrop-blur-md border-b border-gray-200/50 h-14 flex items-center gap-3 px-4 relative">
        <button
          onClick={() => navigate(referrer === 'account' ? '/account' : '/settings')}
          className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 hover:bg-gray-200 rounded-md transition"
          aria-label="Back"
        >
          <MdArrowBack size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1 text-center text-gray-800">Pricing Plans</h1>
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-200 transition"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 pb-24">
        <div className="space-y-8 max-w-6xl mx-auto">

        {/* CURRENT PLAN STATUS CARD - FROM CURRENT CODE */}
        <div style={{
          background: "white",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)",
          border: "1px solid #e5e7eb",
        }}>
          {/* Plan badge row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Current Plan</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 22, fontWeight: 800, color: isPro ? "#2563eb" : "#111827"
                }}>{planLabel}</span>
                {isPro && (
                  <span style={{
                    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                    color: "white", fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 999, letterSpacing: "0.05em"
                  }}>ACTIVE</span>
                )}
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8f9fb", borderRadius: 12 }}>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Status</span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: isPaidPro ? "#16a34a" : isTrialActive ? "#d97706" : isPro ? "#2563eb" : "#6b7280"
              }}>
                {isPaidPro ? "Subscribed" : isTrialActive ? "Trial Active" : isPro ? "Active" : "Free"}
              </span>
            </div>

            {/* Trial countdown */}
            {isTrialActive && trialEndsAt && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
                  <span style={{ fontSize: 13, color: "#92400e", fontWeight: 500 }}>Trial ends</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{formatTrialEndDate(trialEndsAt)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
                  <span style={{ fontSize: 13, color: "#92400e", fontWeight: 500 }}>Days remaining</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: daysLeft <= 3 ? "#dc2626" : "#92400e" }}>{daysLeft} days</span>
                </div>
                {/* Progress bar */}
                <div style={{ padding: "10px 14px", background: "#f8f9fb", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Trial progress</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{Math.round(trialProgress)}% used</span>
                  </div>
                  <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      width: `${trialProgress}%`,
                      background: trialProgress > 80 ? "linear-gradient(90deg,#f59e0b,#dc2626)" : "linear-gradient(90deg,#2563eb,#7c3aed)",
                      transition: "width 0.5s ease"
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                    {trialDaysDisplay}-day trial · Started {trialDaysDisplay - daysLeft} days ago
                  </p>
                </div>
              </>
            )}

            {/* What's included */}
            <div style={{ padding: "12px 14px", background: isPro ? "#eff6ff" : "#f8f9fb", borderRadius: 12, border: isPro ? "1px solid #bfdbfe" : "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: isPro ? "#1d4ed8" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                {isPro ? "Your benefits" : "Free plan includes"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {isPro ? (
                  ["Unlimited products & catalogues", "Glass Theme access", "Watermark control", "Unlimited PDF exports", "Unlimited order links", "Email support"].map(b => (
                    <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "#1e40af" }}>{b}</span>
                    </div>
                  ))
                ) : (
                  [`Up to ${FREE_MAX_PRODUCTS} products`, `Up to ${FREE_MAX_CATALOGUES} catalogues`, `${FREE_MAX_PDF_PER_DAY} PDF/day`, `${FREE_MAX_SHARE_LINK_PER_DAY} order link/day`].map(b => (
                    <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "#4b5563" }}>{b}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HERO SECTION - FROM OLD CODE */}
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
              Select the plan that fits your needs. Upgrade anytime to unlock unlimited features.
            </p>
            {isTrialActive && trialEndsAt && (
              <div className="inline-block mt-4 px-3 sm:px-4 py-2 sm:py-3 bg-amber-50 border border-amber-300 rounded-xl max-w-xl mx-auto text-left">
                <p className="text-xs sm:text-sm font-semibold text-amber-900">
                  {trialDaysDisplay}-day Pro trial — full access
                </p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Your trial includes every Pro feature. It ends on{" "}
                  <span className="font-semibold">{formatTrialEndDate(trialEndsAt)}</span>. Subscribe
                  anytime to keep Pro after your trial.
                </p>
              </div>
            )}
            {isPaidPro && (
              <div className="inline-block mt-4 px-3 sm:px-4 py-2 bg-green-100 border border-green-300 rounded-full">
                <p className="text-xs sm:text-sm font-semibold text-green-700">You are on Pro Plan</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-100 border border-red-300 rounded-lg mb-6">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* BILLING FREQUENCY SELECTOR — show until user has a paid subscription (trial users can still buy) — desktop only */}
          {!isPaidPro && isAndroid && (
            <div className="hidden md:flex gap-3 justify-center mb-8">
              <button
                onClick={() => setBillingFrequency("monthly")}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  billingFrequency === "monthly"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingFrequency("yearly")}
                className={`px-6 py-3 rounded-lg font-semibold transition relative ${
                  billingFrequency === "yearly"
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-300"
                }`}
              >
                Yearly
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          )}

          {/* PLAN CARDS SECTION */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* FREE PLAN CARD */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative h-full p-5 sm:p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col">
                {/* Badge */}
                {!isPro && (
                  <div className="absolute -top-3 left-4 px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                    Current Plan
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Free</h3>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{currencySymbol}0</span>
                  <span className="text-gray-600 ml-2 text-base sm:text-lg">Forever</span>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                  Perfect for getting started with CatShare's core features.
                </p>

                {/* Button */}
                {!isPro ? (
                  <button
                    disabled
                    className="w-full py-2 sm:py-3 px-4 bg-gray-200 text-gray-600 font-semibold text-sm sm:text-base rounded-lg mb-6 cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : isPaidPro ? (
                  <button
                    type="button"
                    onClick={handleManageAccount}
                    className="w-full py-2 sm:py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm sm:text-base rounded-lg mb-6 shadow-lg hover:shadow-xl transition"
                  >
                    Manage Account
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2 sm:py-3 px-4 bg-gray-100 text-gray-500 font-semibold text-sm sm:text-base rounded-lg mb-6 cursor-not-allowed"
                  >
                    Pro Trial Active
                  </button>
                )}

                {/* Features */}
                <div className="space-y-3 sm:space-y-4 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Included</p>
                  <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Up to {FREE_MAX_PRODUCTS} products</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Up to {FREE_MAX_CATALOGUES} catalogues</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Product Editing</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Bulk Editor</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Basic Themes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">{FREE_MAX_PDF_PER_DAY} PDF export per day</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">{FREE_MAX_SHARE_LINK_PER_DAY} shareable order link per day</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* PRO PLAN CARD */}
            <div className="relative group md:scale-105 md:origin-center">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative h-full p-5 sm:p-8 bg-white/80 backdrop-blur-xl border-2 border-transparent bg-gradient-to-br from-white to-gray-50/50 rounded-2xl shadow-2xl hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden">
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-transparent rounded-2xl pointer-events-none"></div>

                {/* Badge */}
                <div className="relative z-10 absolute -top-2 sm:-top-3 right-3 sm:right-4 px-2 sm:px-4 py-0.5 sm:py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full">
                  Most Popular
                </div>

                {/* Plan Name */}
                <h3 className="relative z-10 text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Pro
                </h3>

                {/* Price */}
                <div className="relative z-10 mb-6">
                  {!isPaidPro ? (
                    isAndroid ? (
                      billingFrequency === "monthly" && prices?.[SUBSCRIPTION_SKUS.monthly] ? (
                        <>
                          <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{prices[SUBSCRIPTION_SKUS.monthly]}</span>
                          <span className="text-gray-600 ml-2 text-sm sm:text-base">/month</span>
                        </>
                      ) : billingFrequency === "yearly" && prices?.[SUBSCRIPTION_SKUS.yearly] ? (
                        <>
                          <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{prices[SUBSCRIPTION_SKUS.yearly]}</span>
                          <span className="text-gray-600 ml-2 text-sm sm:text-base">/year</span>
                        </>
                      ) : (
                        <span className="text-base sm:text-lg font-semibold text-gray-500">Loading price...</span>
                      )
                    ) : (
                      <>
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{currencySymbol}9.99</span>
                        <span className="text-gray-600 ml-2 text-sm sm:text-base">/month</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Pro</span>
                      <span className="text-gray-600 ml-2 text-sm sm:text-base">Active</span>
                    </>
                  )}
                </div>

                {/* Description */}
                <p className="relative z-10 text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                  Unlock unlimited possibilities and professional features.
                </p>

                {/* BILLING FREQUENCY SELECTOR — Mobile only inside Pro card */}
                {!isPaidPro && isAndroid && (
                  <div className="md:hidden flex gap-2 mb-6">
                    <button
                      onClick={() => setBillingFrequency("monthly")}
                      className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-semibold transition text-xs sm:text-sm ${
                        billingFrequency === "monthly"
                          ? "bg-blue-600 text-white shadow-lg"
                          : "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingFrequency("yearly")}
                      className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-semibold transition text-xs sm:text-sm relative ${
                        billingFrequency === "yearly"
                          ? "bg-purple-600 text-white shadow-lg"
                          : "bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-300"
                      }`}
                    >
                      Yearly
                      {billingFrequency !== "yearly" && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                          -20%
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {/* Button */}
                {!isPaidPro ? (
                  isAndroid ? (
                    <button
                      onClick={() => {
                        if (billingFrequency === "monthly") {
                          handleBuySubscription(SUBSCRIPTION_SKUS.monthly);
                        } else if (billingFrequency === "yearly") {
                          handleBuySubscription(SUBSCRIPTION_SKUS.yearly);
                        }
                      }}
                      disabled={loading}
                      className="relative z-10 w-full py-2 sm:py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold text-sm sm:text-base rounded-lg transition mb-6 shadow-lg hover:shadow-xl"
                    >
                      {loading ? "Processing..." : `Upgrade Now${
                        billingFrequency === "monthly" && prices?.[SUBSCRIPTION_SKUS.monthly]
                          ? ` — ${prices[SUBSCRIPTION_SKUS.monthly]}`
                          : billingFrequency === "yearly" && prices?.[SUBSCRIPTION_SKUS.yearly]
                          ? ` — ${prices[SUBSCRIPTION_SKUS.yearly]}`
                          : ""
                      }`}
                    </button>
                  ) : (
                    <button
                      onClick={() => alert("Payments are only available on the Android app. Please open CatShare on your Android device to upgrade.")}
                      className="relative z-10 w-full py-2 sm:py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm sm:text-base rounded-lg transition mb-6 shadow-lg hover:shadow-xl"
                    >
                      Upgrade Now
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleManageAccount}
                    className="relative z-10 w-full py-2 sm:py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm sm:text-base rounded-lg transition mb-6 shadow-lg hover:shadow-xl"
                  >
                    Manage Account
                  </button>
                )}

                {/* Features */}
                <div className="relative z-10 space-y-3 sm:space-y-4 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Everything in Free, plus:</p>
                  <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Unlimited Products</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Unlimited Catalogues</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Advanced Bulk Editor</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Stock Control</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Watermark Control</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Multiple Product Images</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Slab Pricing</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Product Variants</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Homepage Builder</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Custom Domain</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Payment Integration</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Shipping Integration</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Share as Link</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Glass Theme Access</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Unlimited PDF exports & order links</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span className="text-gray-700">Email Support</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* FEATURE COMPARISON TABLE */}
          <div className="mt-12 mb-8">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 text-center">Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 sm:py-4 px-3 sm:px-6 font-bold text-xs sm:text-sm md:text-base text-gray-900">Feature</th>
                    <th className="text-center py-3 sm:py-4 px-3 sm:px-6 font-bold text-xs sm:text-sm md:text-base text-gray-700">Free</th>
                    <th className="text-center py-3 sm:py-4 px-3 sm:px-6 font-bold text-xs sm:text-sm md:text-base text-gray-700">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-gray-200 hover:bg-gray-50 transition ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="py-3 sm:py-4 px-3 sm:px-6 font-medium text-xs sm:text-sm text-gray-800">{feature.name}</td>
                      <td className="text-center py-4 px-6">
                        <span className="text-gray-700 text-sm">{feature.free}</span>
                      </td>
                      <td className="text-center py-4 px-6">
                        <span className="text-gray-700 text-sm">{feature.pro}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PURCHASE OPTIONS - Only show if not Pro */}
          {!isPro && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-8 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Choose Your Billing Plan</h3>
                <p className="text-gray-600">Select the subscription option that works best for you.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {/* Payment Options - Always Show (warning only on click for non-Android) */}
              <div className="space-y-4">
                {/* Monthly */}
                <button
                  onClick={() => {
                    if (!isAndroid) {
                      alert("Payments are only available on the Android app. Please open CatShare on your Android device to upgrade.");
                    } else {
                      handleBuySubscription(SUBSCRIPTION_SKUS.monthly);
                    }
                  }}
                  disabled={loading}
                  className="w-full p-4 border-2 border-blue-300 bg-white hover:bg-blue-50 rounded-xl transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">Monthly Plan</p>
                      <p className="text-sm text-gray-600">
                        {prices?.[SUBSCRIPTION_SKUS.monthly]
                          ? `${prices[SUBSCRIPTION_SKUS.monthly]} per month`
                          : "Cancel anytime"}
                      </p>
                    </div>
                    <div className="text-blue-600 font-bold text-lg">→</div>
                  </div>
                </button>

                {/* Yearly */}
                <button
                  onClick={() => {
                    if (!isAndroid) {
                      alert("Payments are only available on the Android app. Please open CatShare on your Android device to upgrade.");
                    } else {
                      handleBuySubscription(SUBSCRIPTION_SKUS.yearly);
                    }
                  }}
                  disabled={loading}
                  className="w-full p-4 border-2 border-purple-300 bg-white hover:bg-purple-50 rounded-xl transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">Yearly Plan</p>
                      <p className="text-sm text-gray-600">
                        {prices?.[SUBSCRIPTION_SKUS.yearly]
                          ? `${prices[SUBSCRIPTION_SKUS.yearly]} per year (Save 20%)`
                          : "Best value"}
                      </p>
                    </div>
                    <div className="text-purple-600 font-bold text-lg">→</div>
                  </div>
                </button>


                {/* Restore */}
                <button
                  onClick={() => {
                    if (!isAndroid) {
                      alert("Payments are only available on the Android app. Please open CatShare on your Android device to upgrade.");
                    } else {
                      handleRestore();
                    }
                  }}
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Restoring..." : "Restore Previous Purchases"}
                </button>
              </div>

              {!isAndroid && (
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mt-4">
                  <p className="text-sm text-blue-800 font-semibold">
                    You're viewing on desktop. Payment buttons will work on Android devices. Clicking will show a message on this device.
                  </p>
                </div>
              )}
            </div>
          )}
<div className="pt-4 border-t border-gray-200 flex gap-3">
    <button
      onClick={() => navigate(referrer === 'account' ? '/account' : '/settings')}
      className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
    >
      Back to {referrer === 'account' ? 'Account' : 'Settings'}
    </button>
  </div>
          

        </div>
      </main>
    </div>
  );
}
