import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdArrowBack, MdOutlineHome, MdStar, MdOpenInNew, MdRefresh, MdStorefront } from "react-icons/md";
import { Capacitor } from "@capacitor/core";
import { BillingPlugin } from "capacitor-billing";
import { useSubscription } from "../context/SubscriptionContext";
import { getSupabaseAccessToken } from "../supabaseClient";
import { SUBSCRIPTION_SKUS, SUBSCRIPTION_BASE_PLAN_IDS, INAPP_SKUS } from "../config/subscriptionSkus";
import {
  daysUntilDate,
  formatSubscriptionDate,
  formatSubscriptionDateTime,
  isLifetimeProduct,
  subscriptionAutoRenewLabel,
  subscriptionBillingCycle,
  subscriptionPeriodProgress,
  subscriptionPlanLabel,
  subscriptionPlatformLabel,
  subscriptionRenewalLabel,
  subscriptionStatusLabel,
  subscriptionSubscribedSinceLabel,
} from "../utils/subscriptionDisplay";
import SupportWhatsAppFab from "../components/SupportWhatsAppFab";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const ANDROID_PACKAGE_NAME = "com.catshare.official";

const cardStyle = {
  background: "white",
  borderRadius: 20,
  padding: "20px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)",
  border: "1px solid #e5e7eb",
};

const PRO_BENEFITS = [
  "Unlimited products & catalogues",
  "Glass Theme access",
  "Watermark control",
  "Unlimited PDF exports",
  "Unlimited order links",
  "Homepage Builder & custom domain",
];

export default function ProSubscriptionManage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const referrer = params.get("from") || "settings";

  const { isPaidPro, subscription, refresh, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const isAndroid = Capacitor.getPlatform() === "android";

  const subscriptionExpired =
    !!subscription && !isPaidPro && (subscription.status === "expired" || subscription.status === "canceled");
  const daysUntilRenewal = subscription?.expiresAt ? daysUntilDate(subscription.expiresAt) : null;
  const periodProgress = subscriptionPeriodProgress(subscription);
  const planName = subscription ? subscriptionPlanLabel(subscription.productId) : isPaidPro ? "Pro" : "—";
  const statusLabel = subscriptionStatusLabel(subscription, isPaidPro);
  const isLifetime = subscription ? isLifetimeProduct(subscription.productId) : false;

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

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
      const cleanSku = sku.split(":")[0];
      const result = await BillingPlugin.launchBillingFlow({
        product: cleanSku,
        type: "SUBS",
        basePlanId: SUBSCRIPTION_BASE_PLAN_IDS[cleanSku],
      });
      const purchase = JSON.parse(result.value);
      await BillingPlugin.sendAck({ purchaseToken: purchase.purchaseToken });
      await verifyWithBackend("/iap/android/receipt", {
        packageName: ANDROID_PACKAGE_NAME,
        subscriptionId: cleanSku,
        purchaseToken: purchase.purchaseToken,
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
      const purchase = JSON.parse(result.value);
      await BillingPlugin.sendAck({ purchaseToken: purchase.purchaseToken });
      await verifyWithBackend("/iap/android/product", {
        packageName: ANDROID_PACKAGE_NAME,
        productId: sku,
        purchaseToken: purchase.purchaseToken,
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
    setActionError(null);
    try {
      await refresh();
    } catch (e) {
      setError("Restore failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGooglePlay = async () => {
    setActionError(null);
    setLoading(true);
    try {
      const subscriptionsUrl = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`;
      if (isAndroid) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: subscriptionsUrl, toolbarColor: "#ffffff" });
        return;
      }
      const opened = window.open(subscriptionsUrl, "_blank", "noopener,noreferrer");
      if (!opened) throw new Error("Popup blocked");
    } catch (e) {
      setActionError(
        isAndroid
          ? "Could not open Google Play. Go to Play Store → Profile → Payments & subscriptions → Subscriptions → CatShare."
          : "Google Play subscriptions open on your Android device. On desktop, allow pop-ups or use the CatShare Android app."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResubscribe = () => {
    if (!isAndroid) {
      alert("Payments are only available on the Android app. Please open CatShare on your Android device to subscribe.");
      return;
    }
    if (subscription?.productId === INAPP_SKUS.lifetime) {
      handleBuyLifetime();
      return;
    }
    if (subscription?.productId === SUBSCRIPTION_SKUS.yearly) {
      handleBuySubscription(SUBSCRIPTION_SKUS.yearly);
      return;
    }
    handleBuySubscription(SUBSCRIPTION_SKUS.monthly);
  };

  const backToPro = () => navigate(`/settings/pro?from=${referrer}`);

  const statusColor = isPaidPro
    ? "#16a34a"
    : subscriptionExpired
      ? "#dc2626"
      : subscription
        ? "#d97706"
        : "#6b7280";

  return (
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-white via-gray-50 to-gray-100 relative">
      <SupportWhatsAppFab bottomOffsetPx={0} alignCenterWithHeightPx={0} />
      <div className="sticky top-0 h-[40px] bg-black z-50" />

      <header className="sticky top-[40px] z-40 bg-white/70 backdrop-blur-md border-b border-gray-200/50 h-14 flex items-center gap-3 px-4 relative">
        <button
          type="button"
          onClick={backToPro}
          className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 hover:bg-gray-200 rounded-md transition"
          aria-label="Back"
        >
          <MdArrowBack size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1 text-center text-gray-800">Manage subscription</h1>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-200 transition"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 pb-24">
        <div className="space-y-5 max-w-2xl mx-auto">

          {error ? (
            <div className="p-4 bg-red-100 border border-red-300 rounded-xl">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          ) : null}

          {/* Hero plan card */}
          <div
            style={{
              ...cardStyle,
              background: "linear-gradient(135deg, #ffffff 0%, #f8faff 50%, #f5f3ff 100%)",
              border: "1px solid #dbeafe",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: "linear-gradient(90deg, #2563eb, #7c3aed)",
              }}
            />

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  Your plan
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <MdStar size={28} style={{ color: "#2563eb" }} />
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#2563eb" }}>{planName}</span>
                  {isPaidPro && (
                    <span
                      style={{
                        background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                        color: "white",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 999,
                        letterSpacing: "0.05em",
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                  {subscriptionExpired && (
                    <span
                      style={{
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid #fecaca",
                      }}
                    >
                      EXPIRED
                    </span>
                  )}
                </div>
              </div>
            </div>

            {subLoading && !subscription ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                Loading subscription details…
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <InfoRow label="Status" value={statusLabel} valueColor={statusColor} />
                {subscription ? (
                  <>
                    <InfoRow label="Billing cycle" value={subscriptionBillingCycle(subscription.productId)} />
                    <InfoRow
                      label="Subscribed since"
                      value={subscriptionSubscribedSinceLabel(subscription)}
                      highlight
                    />
                    <InfoRow
                      label="Payment platform"
                      value={subscriptionPlatformLabel(subscription.platform)}
                    />
                    <InfoRow
                      label="Auto-renew"
                      value={subscriptionAutoRenewLabel(subscription.productId, isPaidPro)}
                    />
                    <InfoRow
                      label={isLifetime ? "Access" : isPaidPro ? "Next renewal" : "Valid until"}
                      value={
                        isLifetime
                          ? "Lifetime — no expiry"
                          : subscription.expiresAt
                            ? formatSubscriptionDate(subscription.expiresAt)
                            : "—"
                      }
                      highlight={isPaidPro && !isLifetime}
                      highlightTone={subscriptionExpired ? "danger" : isPaidPro ? "success" : "warning"}
                    />
                    {!isLifetime && subscription.expiresAt ? (
                      <InfoRow
                        label="Renewal summary"
                        value={subscriptionRenewalLabel(subscription, isPaidPro)}
                      />
                    ) : null}
                  </>
                ) : isPaidPro ? (
                  <InfoRow label="Details" value="Active Pro subscription" valueColor="#16a34a" />
                ) : (
                  <InfoRow label="Details" value="No subscription record found" />
                )}

                {isPaidPro && periodProgress && daysUntilRenewal != null && daysUntilRenewal > 0 ? (
                  <div style={{ padding: "12px 14px", background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 500 }}>Billing period</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: daysUntilRenewal <= 7 ? "#dc2626" : "#1d4ed8" }}>
                        {daysUntilRenewal} day{daysUntilRenewal === 1 ? "" : "s"} left
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#dbeafe", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 999,
                          width: `${periodProgress.percent}%`,
                          background:
                            daysUntilRenewal <= 7
                              ? "linear-gradient(90deg,#f59e0b,#dc2626)"
                              : "linear-gradient(90deg,#2563eb,#7c3aed)",
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 8 }}>
                      {Math.round(periodProgress.percent)}% of current{" "}
                      {subscription ? subscriptionBillingCycle(subscription.productId).toLowerCase() : "billing"} period used
                    </p>
                  </div>
                ) : null}

                {subscription?.updatedAt ? (
                  <InfoRow label="Last synced" value={formatSubscriptionDateTime(subscription.updatedAt)} muted />
                ) : null}
              </div>
            )}
          </div>

          {/* Benefits */}
          {isPaidPro ? (
            <div style={cardStyle}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#1d4ed8",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 12,
                }}
              >
                Your Pro benefits
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PRO_BENEFITS.map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#2563eb", fontWeight: 700, fontSize: 16 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#374151" }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div style={cardStyle}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 14,
              }}
            >
              Manage billing
            </p>

            {actionError ? (
              <div className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-900 leading-relaxed">{actionError}</p>
              </div>
            ) : null}

            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.55 }}>
              {isAndroid
                ? "Cancel, change payment method, or view invoices in Google Play. CatShare syncs your plan status after each purchase or restore."
                : "Billing is managed through Google Play on your Android device. Use the buttons below to restore or open Play Store subscriptions."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {subscriptionExpired ? (
                <ActionButton
                  variant="primary"
                  onClick={handleResubscribe}
                  disabled={loading}
                  icon={<MdStar size={18} />}
                >
                  {loading ? "Processing…" : "Resubscribe to Pro"}
                </ActionButton>
              ) : null}

              <ActionButton variant="secondary" onClick={handleRestore} disabled={loading} icon={<MdRefresh size={18} />}>
                {loading ? "Refreshing…" : "Restore purchases"}
              </ActionButton>

              <ActionButton
                variant="play"
                onClick={handleOpenGooglePlay}
                disabled={loading}
                icon={<MdStorefront size={18} />}
                trailing={<MdOpenInNew size={16} />}
              >
                {loading ? "Opening…" : "Manage on Google Play"}
              </ActionButton>
            </div>
          </div>

          <button
            type="button"
            onClick={backToPro}
            className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl transition shadow-sm"
          >
            ← Back to pricing plans
          </button>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value, valueColor, highlight = false, highlightTone = "success", muted = false }) {
  const toneStyles = {
    success: { bg: "#eff6ff", border: "#bfdbfe" },
    warning: { bg: "#fffbeb", border: "#fde68a" },
    danger: { bg: "#fef2f2", border: "#fecaca" },
  };
  const tone = highlight ? toneStyles[highlightTone] || toneStyles.success : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        background: tone ? tone.bg : muted ? "#fafafa" : "#f8f9fb",
        borderRadius: 12,
        border: tone ? `1px solid ${tone.border}` : "1px solid transparent",
      }}
    >
      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: valueColor || (muted ? "#6b7280" : "#111827"),
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, variant, icon, trailing }) {
  const styles = {
    primary:
      "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white shadow-md",
    secondary: "border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white",
    play: "border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 px-4 font-semibold text-sm rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 ${styles[variant]}`}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {trailing}
    </button>
  );
}
