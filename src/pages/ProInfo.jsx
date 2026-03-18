import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdStar, MdOutlineHome } from "react-icons/md";
import { Capacitor } from "@capacitor/core";
import { BillingPlugin } from "capacitor-billing";
import { useSubscription } from "../context/SubscriptionContext";
import { auth } from "../config/firebaseConfig";
import { SUBSCRIPTION_SKUS, INAPP_SKUS } from "../config/subscriptionSkus";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const ANDROID_PACKAGE_NAME = "com.catshare.official";

export default function ProInfo() {
  const navigate = useNavigate();
  const { isPro, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState(null);

  const isAndroid = Capacitor.getPlatform() === "android";

  // Load prices from Google Play
  useEffect(() => {
    if (!isAndroid) return;
    (async () => {
      try {
        const next = {};

        // subs: monthly + yearly
        for (const sku of [SUBSCRIPTION_SKUS.monthly, SUBSCRIPTION_SKUS.yearly]) {
          const result = await BillingPlugin.querySkuDetails({ product: sku, type: "subs" });
          // Use console.error so it shows up in release Logcat (chromium)
          console.error("querySkuDetails subs raw result", sku, result);
          let parsed = {};
          try {
            parsed = JSON.parse(result.value);
          } catch (parseErr) {
            console.error("querySkuDetails subs JSON.parse failed", sku, result?.value, parseErr);
          }
          // plugin returns different shapes across versions; try a few common fields
          next[sku] =
            parsed?.price ||
            parsed?.subscriptionOfferDetails?.[0]?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice ||
            parsed?.oneTimePurchaseOfferDetails?.formattedPrice ||
            null;
        }

        // inapp: lifetime
        {
          const sku = INAPP_SKUS.lifetime;
          const result = await BillingPlugin.querySkuDetails({ product: sku, type: "inapp" });
          console.error("querySkuDetails inapp raw result", sku, result);
          let parsed = {};
          try {
            parsed = JSON.parse(result.value);
          } catch (parseErr) {
            console.error("querySkuDetails inapp JSON.parse failed", sku, result?.value, parseErr);
          }
          next[sku] =
            parsed?.price ||
            parsed?.oneTimePurchaseOfferDetails?.formattedPrice ||
            parsed?.subscriptionOfferDetails?.[0]?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice ||
            null;
        }

        setPrices(next);
      } catch (e) {
        console.error("querySkuDetails failed", e);
      }
    })();
  }, []);

  async function verifyWithBackend(path, body) {
    if (!BACKEND_URL) throw new Error("Missing VITE_BACKEND_URL");
    const user = auth.currentUser;
    if (!user) throw new Error("Not logged in");
    const idToken = await user.getIdToken();
    const resp = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
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
      console.error("launchBillingFlow subs start", sku);
      // Launch Google Play billing sheet
      const result = await BillingPlugin.launchBillingFlow({
        product: sku,
        type: "subs",
      });
      console.error("launchBillingFlow subs raw result", sku, result);
      let purchase;
      try {
        purchase = JSON.parse(result.value);
      } catch (parseErr) {
        console.error("launchBillingFlow subs JSON.parse failed", sku, result?.value, parseErr);
        throw new Error("Billing response parse failed");
      }
      const purchaseToken = purchase.purchaseToken;

      // Acknowledge the purchase
      await BillingPlugin.sendAck({ purchaseToken });

      // Verify with backend + store in Supabase
      await verifyWithBackend("/iap/android/receipt", {
        packageName: ANDROID_PACKAGE_NAME,
        subscriptionId: sku,
        purchaseToken,
      });

      await refresh();
    } catch (e) {
      console.error("Purchase failed (subs)", sku, e);
      const msg =
        e?.message ||
        (typeof e === "string" ? e : "") ||
        "Purchase failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyLifetime = async () => {
    setLoading(true);
    setError(null);
    try {
      const sku = INAPP_SKUS.lifetime;
      console.error("launchBillingFlow inapp start", sku);
      const result = await BillingPlugin.launchBillingFlow({
        product: sku,
        type: "inapp",
      });
      console.error("launchBillingFlow inapp raw result", sku, result);
      let purchase;
      try {
        purchase = JSON.parse(result.value);
      } catch (parseErr) {
        console.error("launchBillingFlow inapp JSON.parse failed", sku, result?.value, parseErr);
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
      console.error("Purchase failed (inapp)", e);
      const msg =
        e?.message ||
        (typeof e === "string" ? e : "") ||
        "Purchase failed. Please try again.";
      setError(msg);
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

  const proFeatures = [
    { name: "Bulk Editor", description: "Edit multiple products at once with batch operations" },
    { name: "Watermark Customization", description: "Change watermark text and customize it for your brand" },
    { name: "Manage Categories", description: "Create, edit, and organize unlimited product categories" },
    { name: "Stock Control", description: "Toggle wholesale and resell stock IN/OUT status" },
  ];

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-b from-white to-gray-100 relative">
      {/* Status bar placeholder */}
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      {/* Header */}
      <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center gap-3 px-4 relative">
        <button
          onClick={() => navigate("/settings")}
          className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 hover:bg-gray-200 rounded-md transition"
          aria-label="Back"
        >
          <MdArrowBack size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1 text-center">CatShare Pro</h1>
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-200 transition"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="space-y-6 max-w-2xl">

          {/* Title */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <MdStar className="text-yellow-500 text-2xl" />
            <h2 className="text-2xl font-bold text-gray-800">CatShare Pro</h2>
          </div>

          {/* Status */}
          <div className={`p-4 rounded-lg border shadow-sm ${isPro ? "bg-green-50 border-green-300" : "bg-yellow-50 border-yellow-300"}`}>
            <p className={`text-sm mb-2 ${isPro ? "text-green-900" : "text-yellow-900"}`}>
              <span className="font-semibold">Status:</span> {isPro ? "Pro active ✓" : "Free plan"}
            </p>
            <p className={`text-xs leading-relaxed ${isPro ? "text-green-800" : "text-yellow-800"}`}>
              {isPro ? "Thanks for supporting CatShare!" : "Upgrade to unlock Pro features like PDF and Link sharing."}
            </p>
          </div>

          {/* Upgrade Section — only show if not Pro */}
          {!isPro && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <p className="text-sm font-semibold text-blue-900">Upgrade to Pro</p>

              {error && <p className="text-xs text-red-600">{error}</p>}

              {isAndroid ? (
                <>
                  <button
                    onClick={() => handleBuySubscription(SUBSCRIPTION_SKUS.monthly)}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition font-medium"
                  >
                    {loading
                      ? "Processing..."
                      : prices?.[SUBSCRIPTION_SKUS.monthly]
                      ? `Monthly ${prices[SUBSCRIPTION_SKUS.monthly]}`
                      : "Monthly subscription"}
                  </button>

                  <button
                    onClick={() => handleBuySubscription(SUBSCRIPTION_SKUS.yearly)}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition font-medium"
                  >
                    {loading
                      ? "Processing..."
                      : prices?.[SUBSCRIPTION_SKUS.yearly]
                      ? `Yearly ${prices[SUBSCRIPTION_SKUS.yearly]}`
                      : "Yearly subscription"}
                  </button>

                  <button
                    onClick={handleBuyLifetime}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 text-sm rounded-lg transition font-medium"
                  >
                    {loading
                      ? "Processing..."
                      : prices?.[INAPP_SKUS.lifetime]
                      ? `Lifetime ${prices[INAPP_SKUS.lifetime]}`
                      : "Lifetime (one-time)"}
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 text-sm rounded-lg transition font-medium"
                  >
                    Restore purchases
                  </button>
                </>
              ) : (
                <p className="text-xs text-blue-800">
                  In-app purchases available on Android only. Pro features are free during beta!
                </p>
              )}
            </div>
          )}

          {/* Pro Features */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MdStar className="text-yellow-500" />
              Pro Features {!isPro && "(Available Now - Free!)"}
            </h3>
            <div className="space-y-3">
              {proFeatures.map((feature, idx) => (
                <div key={idx} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition">
                  <p className="text-sm font-medium text-gray-800">{feature.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Why Upgrade to Pro?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span><span>Edit bulk products at once to save time</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span><span>Full control over watermark and branding</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span><span>Unlimited categories for organizing products</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">✓</span><span>Advanced inventory management with stock control</span></li>
            </ul>
          </div>

          {/* CTA */}
          <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white">
            <p className="text-sm font-semibold mb-2">🚀 Make the Most of It</p>
            <p className="text-xs mb-4 opacity-90">
              {isPro ? "You have full Pro access. Enjoy all features!" : "Pro features are free during beta — enjoy full access now!"}
            </p>
            <button
              onClick={() => navigate("/settings")}
              className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition font-medium"
            >
              Back to Settings
            </button>
          </div>

          {/* Footer */}
          <p className="text-xs text-center">
            <span className="text-green-600 font-semibold block">✓ Free access to Pro features during beta</span>
            <span className="text-gray.500 block mt-1">Pricing model coming soon</span>
          </p>

        </div>
      </main>
    </div>
  );
}
