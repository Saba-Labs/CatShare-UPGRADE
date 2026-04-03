import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdStar, MdOutlineHome } from "react-icons/md";
import { Capacitor } from "@capacitor/core";
import { BillingPlugin } from "capacitor-billing";
import { useSubscription } from "../context/SubscriptionContext";
import { getSupabaseAccessToken } from "../supabaseClient";
import { SUBSCRIPTION_SKUS, INAPP_SKUS } from "../config/subscriptionSkus";
import {
  FREE_MAX_PRODUCTS,
  FREE_MAX_CATALOGUES,
  FREE_MAX_PDF_PER_DAY,
  FREE_MAX_SHARE_LINK_PER_DAY,
  FREE_WATERMARK_TEXT,
  TRIAL_DAYS_UI_FALLBACK,
} from "../config/freeTierLimits";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const ANDROID_PACKAGE_NAME = "com.catshare.official";

function formatTrialEndDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });
  } catch {
    return iso;
  }
}

export default function ProInfo() {
  const navigate = useNavigate();
  const { isPro, isPaidPro, isTrialActive, trialEndsAt, trialDays, refresh } = useSubscription();
  const trialDaysDisplay = trialDays ?? TRIAL_DAYS_UI_FALLBACK;
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState(null);
  const [billingFrequency, setBillingFrequency] = useState("monthly"); // "monthly", "yearly", "lifetime"

  const isAndroid = Capacitor.getPlatform() === "android";

  // Load prices from Google Play
useEffect(() => {
  if (!isAndroid) return;
  (async () => {
    try {
      const next = {};

      // Subscriptions: monthly + yearly
      for (const sku of [SUBSCRIPTION_SKUS.monthly, SUBSCRIPTION_SKUS.yearly]) {
        try {
          const result = await BillingPlugin.querySkuDetails({ product: sku, type: "SUBS" });
console.error("querySkuDetails [subs] raw", sku, JSON.stringify(result));

const parsed = Array.isArray(result) ? result[0] : result;
next[sku] = parsed?.price || null;

console.error("querySkuDetails [subs] price", sku, next[sku]);
        } catch (skuErr) {
          console.error("querySkuDetails failed for", sku, skuErr);
          next[sku] = null;
        }
      }

      // Lifetime in-app
      try {
        const sku = INAPP_SKUS.lifetime;
        const result = await BillingPlugin.querySkuDetails({ product: sku, type: "inapp" });
console.error("querySkuDetails [inapp] raw", sku, JSON.stringify(result));

const parsed = Array.isArray(result) ? result[0] : result;
next[sku] = parsed?.price || null;

console.error("querySkuDetails [inapp] price", sku, next[sku]);
      } catch (inappErr) {
        console.error("querySkuDetails failed for lifetime", inappErr);
        next[INAPP_SKUS.lifetime] = null;
      }

      setPrices(next);
    } catch (e) {
      console.error("Billing init error:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
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
    console.error("launchBillingFlow [subs] start", cleanSku);

    const result = await BillingPlugin.launchBillingFlow({
      product: cleanSku,
      type: "SUBS",
    });
    console.error("launchBillingFlow [subs] raw", cleanSku, result?.value);

    let purchase;
    try {
      purchase = JSON.parse(result.value);
    } catch (parseErr) {
      console.error("launchBillingFlow [subs] parse failed", cleanSku, result?.value, parseErr);
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
    console.error("Purchase failed [subs]", sku, e);
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
    console.error("launchBillingFlow [inapp] start", sku);

    const result = await BillingPlugin.launchBillingFlow({
      product: sku,
      type: "inapp",
    });
    console.error("launchBillingFlow [inapp] raw", sku, result?.value);

    let purchase;
    try {
      purchase = JSON.parse(result.value);
    } catch (parseErr) {
      console.error("launchBillingFlow [inapp] parse failed", sku, result?.value, parseErr);
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
    console.error("Purchase failed [inapp]", e);
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
      name: "Watermark Settings",
      free: `"${FREE_WATERMARK_TEXT}" (fixed)`,
      pro: "Full control",
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
      name: "Glass Theme",
      free: "Locked",
      pro: "Available",
      locked: true,
    },
  ];

  return (
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-white via-gray-50 to-gray-100 relative">
      {/* Status bar placeholder */}
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      {/* Header */}
      <header className="sticky top-[40px] z-40 bg-white/70 backdrop-blur-md border-b border-gray-200/50 h-14 flex items-center gap-3 px-4 relative">
        <button
          onClick={() => navigate("/settings")}
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

          {/* HERO SECTION */}
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Select the plan that fits your needs. Upgrade anytime to unlock unlimited features.
            </p>
            {isTrialActive && trialEndsAt && (
              <div className="inline-block mt-4 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl max-w-xl mx-auto text-left">
                <p className="text-sm font-semibold text-amber-900">
                  ✨ {trialDaysDisplay}-day Pro trial — full access
                </p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Your trial includes every Pro feature. It ends on{" "}
                  <span className="font-semibold">{formatTrialEndDate(trialEndsAt)}</span>. Subscribe
                  anytime to keep Pro after your trial.
                </p>
              </div>
            )}
            {isPaidPro && (
              <div className="inline-block mt-4 px-4 py-2 bg-green-100 border border-green-300 rounded-full">
                <p className="text-sm font-semibold text-green-700">✓ You are on Pro Plan</p>
              </div>
            )}
          </div>

          {/* BILLING FREQUENCY SELECTOR — show until user has a paid subscription (trial users can still buy) */}
          {!isPaidPro && isAndroid && (
            <div className="flex gap-3 justify-center mb-8">
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
              <div className="relative h-full p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col">
                {/* Badge */}
                {!isPro && (
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                    Current Plan
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600 ml-2 text-lg">Forever</span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Perfect for getting started with CatShare's core features.
                </p>

                {/* Button */}
                {!isPro ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-200 text-gray-600 font-semibold rounded-lg mb-6 cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full py-3 px-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition mb-6"
                  >
                    Manage Account
                  </button>
                )}

                {/* Features */}
                <div className="space-y-4 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Included</p>
                  <ul className="space-y-3 text-sm">
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

              <div className="relative h-full p-8 bg-white/80 backdrop-blur-xl border-2 border-transparent bg-gradient-to-br from-white to-gray-50/50 rounded-2xl shadow-2xl hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden">
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-transparent rounded-2xl pointer-events-none"></div>

                {/* Badge */}
                <div className="relative z-10 absolute -top-3 right-4 px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full">
                  Most Popular
                </div>

                {/* Plan Name */}
                <h3 className="relative z-10 text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Pro
                </h3>

                {/* Price */}
                <div className="relative z-10 mb-6">
                  {!isPaidPro ? (
                    isAndroid ? (
                      billingFrequency === "monthly" && prices?.[SUBSCRIPTION_SKUS.monthly] ? (
                        <>
                          <span className="text-4xl font-bold text-gray-900">{prices[SUBSCRIPTION_SKUS.monthly]}</span>
                          <span className="text-gray-600 ml-2">/month</span>
                        </>
                      ) : billingFrequency === "yearly" && prices?.[SUBSCRIPTION_SKUS.yearly] ? (
                        <>
                          <span className="text-4xl font-bold text-gray-900">{prices[SUBSCRIPTION_SKUS.yearly]}</span>
                          <span className="text-gray-600 ml-2">/year</span>
                        </>
                      ) : (
                        <span className="text-lg font-semibold text-gray-500">Loading price...</span>
                      )
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-gray-900">$9.99</span>
                        <span className="text-gray-600 ml-2">/month</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-gray-900">Pro</span>
                      <span className="text-gray-600 ml-2">Active</span>
                    </>
                  )}
                </div>

                {/* Description */}
                <p className="relative z-10 text-sm text-gray-600 mb-6 leading-relaxed">
                  Unlock unlimited possibilities and professional features.
                </p>

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
                      className="relative z-10 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold rounded-lg transition mb-6 shadow-lg hover:shadow-xl"
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
                      className="relative z-10 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition mb-6 shadow-lg hover:shadow-xl"
                    >
                      Upgrade Now
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => navigate("/settings")}
                    className="relative z-10 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg mb-6 shadow-lg hover:shadow-xl"
                  >
                    Manage Account
                  </button>
                )}

                {/* Features */}
                <div className="relative z-10 space-y-4 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Everything in Free, plus:</p>
                  <ul className="space-y-3 text-sm">
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
                      <span className="text-gray-700">Watermark Control</span>
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
                      <span className="text-gray-700">Unlimited PDF exports &amp; order links</span>
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
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-4 px-6 font-bold text-gray-900">Feature</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700">Free</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700">Pro</th>
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
                      <td className="py-4 px-6 font-medium text-gray-800">{feature.name}</td>
                      <td className="text-center py-4 px-6">
                        {feature.locked ? (
                          <span className="inline-flex items-center gap-2 text-orange-600 font-semibold text-sm">
                            <span className="text-lg">🔒</span>
                            <span className="text-xs">{feature.free}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-green-600 font-bold text-lg">✓</span>
                            <span className="text-gray-700 text-sm">{feature.free}</span>
                          </span>
                        )}
                      </td>
                      <td className="text-center py-4 px-6">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-blue-600 font-bold text-lg">✓</span>
                          <span className="text-gray-700 text-sm">{feature.pro}</span>
                        </span>
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
                    💡 You're viewing on desktop. Payment buttons will work on Android devices. Clicking will show a message on this device.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STATUS PANEL */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Account Status</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Current Plan</p>
                <p className={`text-2xl font-bold ${isPro ? "text-blue-600" : "text-gray-900"}`}>
                  {isPaidPro ? "Pro" : isTrialActive ? "Pro (trial)" : isPro ? "Pro" : "Free"}
                </p>
                {isTrialActive && trialEndsAt && (
                  <p className="text-xs text-gray-500">
                    Trial ends {formatTrialEndDate(trialEndsAt)} · {trialDaysDisplay} days from account creation
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isPro ? "bg-green-500" : "bg-gray-400"}`}></span>
                  <p className="text-gray-700">
                    {isPaidPro ? "Subscribed" : isTrialActive ? "Trial active" : isPro ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => navigate("/settings")}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
              >
                Back to Settings
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
