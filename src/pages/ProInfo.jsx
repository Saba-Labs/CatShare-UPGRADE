import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdStar, MdOutlineHome } from "react-icons/md";
import { Capacitor } from "@capacitor/core";
import { BillingPlugin } from "capacitor-billing";
import { useSubscription } from "../context/SubscriptionContext";
import { auth } from "../config/firebaseConfig";

const PRODUCT_ID = "catshare_pro_monthly";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function ProInfo() {
  const navigate = useNavigate();
  const { isPro, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [error, setError] = useState(null);

  const isAndroid = Capacitor.getPlatform() === "android";

  // Load product price from Google Play
  useEffect(() => {
    if (!isAndroid) return;
    (async () => {
      try {
        const result = await BillingPlugin.querySkuDetails({
          product: PRODUCT_ID,
          type: "subs",
        });
        const parsed = JSON.parse(result.value);
        setProductInfo(parsed);
      } catch (e) {
        console.error("querySkuDetails failed", e);
      }
    })();
  }, []);

  const handleBuy = async () => {
    setLoading(true);
    setError(null);
    try {
      // Launch Google Play billing sheet
      const result = await BillingPlugin.launchBillingFlow({
        product: PRODUCT_ID,
        type: "subs",
      });
      const purchase = JSON.parse(result.value);
      const purchaseToken = purchase.purchaseToken;

      // Acknowledge the purchase
      await BillingPlugin.sendAck({ purchaseToken });

      // Send to backend to store in Supabase
      const user = auth.currentUser;
      const resp = await fetch(`${BACKEND_URL}/api/verify-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseToken,
          productId: PRODUCT_ID,
          userId: user.uid,
        }),
      });

      if (!resp.ok) throw new Error("Verification failed");

      await refresh();
    } catch (e) {
      console.error("Purchase failed", e);
      setError("Purchase failed. Please try again.");
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
                    onClick={handleBuy}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition font-medium"
                  >
                    {loading
                      ? "Processing..."
                      : productInfo?.price
                      ? `Subscribe for ${productInfo.price}/month`
                      : "Subscribe to Pro"}
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
