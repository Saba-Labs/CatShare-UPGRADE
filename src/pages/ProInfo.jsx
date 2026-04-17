import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdArrowBack, MdOutlineHome } from "react-icons/md";
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

  const params = new URLSearchParams(location.search);
  const referrer = params.get("from") || "settings";
  const trialDaysDisplay = trialDays ?? TRIAL_DAYS_UI_FALLBACK;
  const daysLeft = trialEndsAt ? daysRemaining(trialEndsAt) : null;
  const trialProgress = daysLeft != null && trialDaysDisplay ? ((trialDaysDisplay - daysLeft) / trialDaysDisplay) * 100 : 0;

  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState(null);
  const [billingFrequency, setBillingFrequency] = useState("monthly");
  const [currencySymbol, setCurrencySymbol] = useState(() => getCurrentCurrencySymbol());
  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "compare"

  const isAndroid = Capacitor.getPlatform() === "android";

  useEffect(() => {
    const unsubscribe = onCurrencyChange((currency, symbol) => setCurrencySymbol(symbol));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAndroid) return;
    (async () => {
      try {
        const next = {};
        for (const sku of [SUBSCRIPTION_SKUS.monthly, SUBSCRIPTION_SKUS.yearly]) {
          try {
            const result = await BillingPlugin.querySkuDetails({
              product: sku,
              type: "SUBS",
              basePlanId: SUBSCRIPTION_BASE_PLAN_IDS[sku],
            });
            const parsed = Array.isArray(result) ? result[0] : result;
            next[sku] = parsed?.price || null;
          } catch {
            next[sku] = null;
          }
        }
        try {
          const sku = INAPP_SKUS.lifetime;
          const result = await BillingPlugin.querySkuDetails({ product: sku, type: "inapp" });
          const parsed = Array.isArray(result) ? result[0] : result;
          next[sku] = parsed?.price || null;
        } catch {
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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
      const cleanSku = sku.split(":")[0];
      const result = await BillingPlugin.launchBillingFlow({
        product: cleanSku,
        type: "SUBS",
        basePlanId: SUBSCRIPTION_BASE_PLAN_IDS[cleanSku],
      });
      let purchase;
      try { purchase = JSON.parse(result.value); } catch { throw new Error("Billing response parse failed"); }
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
      const result = await BillingPlugin.launchBillingFlow({ product: sku, type: "inapp" });
      let purchase;
      try { purchase = JSON.parse(result.value); } catch { throw new Error("Billing response parse failed"); }
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
    try { await refresh(); } catch { setError("Restore failed. Please try again."); } finally { setLoading(false); }
  };

  const planLabel = isPaidPro ? "Pro" : isTrialActive ? "Pro Trial" : isPro ? "Pro" : "Free";
  const planColor = isPro ? "#2563eb" : "#6b7280";

  const features = [
    { name: "Products", free: `Up to ${FREE_MAX_PRODUCTS}`, pro: "Unlimited", locked: true },
    { name: "Catalogues", free: `Up to ${FREE_MAX_CATALOGUES}`, pro: "Unlimited", locked: true },
    { name: "Watermark", free: `Fixed text`, pro: "Full control", locked: true },
    { name: "PDF exports / day", free: `${FREE_MAX_PDF_PER_DAY}`, pro: "Unlimited", locked: false },
    { name: "Order links / day", free: `${FREE_MAX_SHARE_LINK_PER_DAY}`, pro: "Unlimited", locked: false },
    { name: "Glass Theme", free: "Locked", pro: "Included", locked: true },
    { name: "Bulk Editor", free: "Basic", pro: "Advanced", locked: false },
    { name: "Email Support", free: "—", pro: "Included", locked: false },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f8f9fb", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Status bar */}
      <div style={{ height: 40, background: "#0f0f14", flexShrink: 0 }} />

      {/* Header */}
      <div style={{
        position: "sticky", top: 40, zIndex: 40,
        background: "rgba(248,249,251,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e5e7eb",
        display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 52,
      }}>
        <button
          onClick={() => navigate(referrer === "account" ? "/account" : "/settings")}
          style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "#f1f3f5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <MdArrowBack size={20} color="#374151" />
        </button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 17, color: "#111827", textAlign: "center" }}>Pricing Plans</span>
        <button
          onClick={() => navigate("/")}
          style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "#f1f3f5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <MdOutlineHome size={20} color="#374151" />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>

        {/* ── ACCOUNT STATUS CARD ── */}
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
            {/* Status dot */}
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: isPro ? "linear-gradient(135deg,#dbeafe,#ede9fe)" : "#f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {isPaidPro ? "💎" : isTrialActive ? "⏳" : isPro ? "✨" : "🆓"}
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
                {isPaidPro ? "✓ Subscribed" : isTrialActive ? "Trial Active" : isPro ? "Active" : "Free"}
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
                      <span style={{ color: "#2563eb", fontWeight: 700, fontSize: 13 }}>✓</span>
                      <span style={{ fontSize: 13, color: "#1e40af" }}>{b}</span>
                    </div>
                  ))
                ) : (
                  [`Up to ${FREE_MAX_PRODUCTS} products`, `Up to ${FREE_MAX_CATALOGUES} catalogues`, `${FREE_MAX_PDF_PER_DAY} PDF/day`, `${FREE_MAX_SHARE_LINK_PER_DAY} order link/day`].map(b => (
                    <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>·</span>
                      <span style={{ fontSize: 13, color: "#4b5563" }}>{b}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", background: "#f1f3f5", borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {["plans", "compare"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 13, transition: "all 0.2s",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#111827" : "#6b7280",
                boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab === "plans" ? "Plans" : "Compare"}
            </button>
          ))}
        </div>

        {/* ── PLANS TAB ── */}
        {activeTab === "plans" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Free card */}
            <div style={{
              background: "white", borderRadius: 20, padding: 20,
              border: !isPro ? "2px solid #d1d5db" : "1px solid #e5e7eb",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  {!isPro && <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 999, display: "inline-block", marginBottom: 6 }}>CURRENT PLAN</span>}
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Free</h3>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "4px 0 0" }}>{currencySymbol}0 <span style={{ fontSize: 14, fontWeight: 500, color: "#9ca3af" }}>forever</span></p>
                </div>
                <div style={{ fontSize: 32 }}>🆓</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {[`${FREE_MAX_PRODUCTS} products`, `${FREE_MAX_CATALOGUES} catalogues`, `${FREE_MAX_PDF_PER_DAY} PDF/day`, "Basic themes"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                    <span style={{ fontSize: 13, color: "#4b5563" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                disabled
                style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: "#f3f4f6", color: "#9ca3af", fontWeight: 700, fontSize: 14, cursor: "not-allowed" }}
              >
                {!isPro ? "Current Plan" : "Downgrade"}
              </button>
            </div>

            {/* Pro card */}
            <div style={{
              borderRadius: 20, padding: 2,
              background: "linear-gradient(135deg,#2563eb,#7c3aed)",
              boxShadow: "0 8px 32px rgba(37,99,235,0.25)",
            }}>
              <div style={{ background: "white", borderRadius: 18, padding: 20 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                      background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white",
                      padding: "2px 10px", borderRadius: 999, display: "inline-block", marginBottom: 6
                    }}>MOST POPULAR</span>
                    <h3 style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg,#2563eb,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>Pro</h3>

                    {/* Price display */}
                    {!isPaidPro ? (
                      isAndroid ? (
                        <p style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "4px 0 0" }}>
                          {billingFrequency === "monthly" && prices?.[SUBSCRIPTION_SKUS.monthly]
                            ? prices[SUBSCRIPTION_SKUS.monthly]
                            : billingFrequency === "yearly" && prices?.[SUBSCRIPTION_SKUS.yearly]
                            ? prices[SUBSCRIPTION_SKUS.yearly]
                            : "—"}
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af", marginLeft: 4 }}>
                            /{billingFrequency === "yearly" ? "yr" : "mo"}
                          </span>
                        </p>
                      ) : (
                        <p style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "4px 0 0" }}>
                          {currencySymbol}9.99 <span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>/mo</span>
                        </p>
                      )
                    ) : (
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", margin: "4px 0 0" }}>✓ Active Subscription</p>
                    )}
                  </div>
                  <div style={{ fontSize: 32 }}>💎</div>
                </div>

                {/* Billing toggle */}
                {!isPaidPro && isAndroid && (
                  <div style={{ display: "flex", background: "#f1f3f5", borderRadius: 10, padding: 3, marginBottom: 14, gap: 3 }}>
                    {["monthly", "yearly"].map(freq => (
                      <button
                        key={freq}
                        onClick={() => setBillingFrequency(freq)}
                        style={{
                          flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
                          fontWeight: 600, fontSize: 12, transition: "all 0.2s",
                          background: billingFrequency === freq ? "white" : "transparent",
                          color: billingFrequency === freq ? "#111827" : "#6b7280",
                          boxShadow: billingFrequency === freq ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                          position: "relative",
                        }}
                      >
                        {freq === "yearly" ? "Yearly" : "Monthly"}
                        {freq === "yearly" && (
                          <span style={{
                            position: "absolute", top: -6, right: 4,
                            background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800,
                            padding: "1px 5px", borderRadius: 999
                          }}>-20%</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {["Unlimited products & catalogues", "Glass Theme access", "Watermark control", "Unlimited PDF exports", "Unlimited order links", "Email support"].map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#2563eb", fontWeight: 700 }}>✓</span>
                      <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                {!isPaidPro ? (
                  <button
                    onClick={() => {
                      if (!isAndroid) {
                        alert("Payments are only available on the Android app.");
                        return;
                      }
                      if (billingFrequency === "monthly") handleBuySubscription(SUBSCRIPTION_SKUS.monthly);
                      else handleBuySubscription(SUBSCRIPTION_SKUS.yearly);
                    }}
                    disabled={loading}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                      background: loading ? "#9ca3af" : "linear-gradient(135deg,#2563eb,#7c3aed)",
                      color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 16px rgba(37,99,235,0.3)", transition: "all 0.2s",
                    }}
                  >
                    {loading ? "Processing…" : isTrialActive ? "Subscribe Now" : "Upgrade to Pro"}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(referrer === "account" ? "/account" : "/settings")}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                      background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                      color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer",
                    }}
                  >
                    Manage Subscription
                  </button>
                )}

                {isTrialActive && !isPaidPro && (
                  <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                    Subscribe before {formatTrialEndDate(trialEndsAt)} to keep Pro access
                  </p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px" }}>
                <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 500, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Restore */}
            {!isPaidPro && (
              <button
                onClick={() => {
                  if (!isAndroid) { alert("Available on Android app only."); return; }
                  handleRestore();
                }}
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 12, border: "1.5px solid #d1d5db",
                  background: "white", color: "#6b7280", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >
                {loading ? "Restoring…" : "Restore Previous Purchases"}
              </button>
            )}

            {!isAndroid && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 500, margin: 0 }}>
                  💡 Payments are available on the Android app. Tap buttons here to see a reminder.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── COMPARE TAB ── */}
        {activeTab === "compare" && (
          <div style={{ background: "white", borderRadius: 20, overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", background: "#f8f9fb", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>Free</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pro</span>
            </div>
            {features.map((feature, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 80px",
                  padding: "13px 16px", alignItems: "center",
                  borderBottom: idx < features.length - 1 ? "1px solid #f3f4f6" : "none",
                  background: idx % 2 === 0 ? "white" : "#fafafa",
                }}
              >
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{feature.name}</span>
                <div style={{ textAlign: "center" }}>
                  {feature.locked ? (
                    <span style={{ fontSize: 12, color: "#f59e0b" }}>🔒 {feature.free}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{feature.free}</span>
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>✓ {feature.pro}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom back button */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(248,249,251,0.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid #e5e7eb", padding: "12px 16px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
      }}>
        <button
          onClick={() => navigate(referrer === "account" ? "/account" : "/settings")}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid #d1d5db",
            background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}
        >
          ← Back to {referrer === "account" ? "Account" : "Settings"}
        </button>
      </div>
    </div>
  );
}