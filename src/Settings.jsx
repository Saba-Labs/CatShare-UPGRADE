import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MdOutlineHome } from "react-icons/md";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { logThemeChanged } from "./config/analyticsEvents";
import { useSubscription } from "./context/SubscriptionContext";
import SideDrawer from "./SideDrawer";

export default function Settings({
  darkMode = false,
  setDarkMode = (value) => {},
  products = [],
  setProducts = (value) => {},
  deletedProducts = [],
  setDeletedProducts = (value) => {},
  isRendering = false,
  setIsRendering = (value) => {},
  renderProgress = 0,
  setRenderProgress = (value) => {},
  showTutorial = false,
  setShowTutorial = (value) => {},
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWatermark, setShowWatermark] = useState(() => {
    const stored = localStorage.getItem("showWatermark");
    return stored !== null ? JSON.parse(stored) : true; // Default: true (enabled for new users)
  });
  const [watermarkText, setWatermarkText] = useState(() => {
    const stored = localStorage.getItem("watermarkText");
    return stored || "Created using CatShare"; // Default text
  });
  const [localDarkMode, setLocalDarkMode] = useState(darkMode);

  const navigate = useNavigate();
  const { isPro, isPaidPro, isTrialActive, trialEndsAt } = useSubscription();

  // Update localDarkMode when darkMode prop changes
  useEffect(() => {
    setLocalDarkMode(darkMode);
  }, [darkMode]);

  // Handle dark mode toggle
  const handleDarkModeToggle = (value) => {
    setLocalDarkMode(value);
    setDarkMode(value);
    logThemeChanged(value ? "dark" : "light");
  };

  // Handle watermark toggle
  const handleWatermarkToggle = (value) => {
    setShowWatermark(value);
    localStorage.setItem("showWatermark", JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("watermarkChanged", { detail: { value } }));
  };

  // Handle render all images
  const handleRenderAllImages = () => {
    window.dispatchEvent(new CustomEvent("requestRenderAllPNGs"));
  };

  // Send notification helper
  const sendNotification = async (title, body) => {
    const isNative = Capacitor.getPlatform() !== "web";
    if (!isNative) {
      console.log("Notification (web):", title, body);
      return;
    }

    try {
      // Create channel
      await LocalNotifications.createChannel({
        id: 'default_channel',
        name: 'App Notifications',
        importance: 5,
        visibility: 1,
      });

      // Schedule notification
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000) + 1,
            title,
            body,
            channelId: 'default_channel',
          },
        ]
      });

      console.log("✅ Notification sent:", title);
    } catch (error) {
      console.error("❌ Notification failed:", error);
    }
  };

  // Clear localStorage cache
  const clearLocalStorageCache = () => {
    if (window.confirm("Clear cached rendered images from storage?\n\nThis will free up space but won't delete your products or settings.\n\nYou can always re-render images later.")) {
      try {
        let clearedCount = 0;
        const keysToDelete = [];

        // Find all rendered image cache keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('rendered::')) {
            keysToDelete.push(key);
          }
        }

        // Delete them
        keysToDelete.forEach(key => {
          localStorage.removeItem(key);
          clearedCount++;
        });

        const sizeFreed = (keysToDelete.length > 0 ? "multiple MB" : "no");
        alert(`✅ Cleared ${clearedCount} cached images!\n\nFreed up space: ${sizeFreed}`);
        console.log(`🗑️ Cleared ${clearedCount} cached rendered images from localStorage`);
      } catch (err) {
        alert(`❌ Error clearing cache: ${err.message}`);
        console.error("Error clearing cache:", err);
      }
    }
  };

  // Show notification only when rendering actually completes
  useEffect(() => {
    const handleRenderComplete = async () => {
      await sendNotification("Rendering Complete", "Your images have been processed and saved! 🎉");
    };

    window.addEventListener("renderComplete", handleRenderComplete);
    return () => {
      window.removeEventListener("renderComplete", handleRenderComplete);
    };
  }, []);

  return (
    <div className="w-full h-screen flex flex-col bg-white dark:bg-gray-950 relative">
      {/* Status bar placeholder */}
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      {/* Header */}
      <header className="sticky top-[40px] z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center gap-3 px-4 relative">
        <button
          onClick={() => setMenuOpen(true)}
          className="relative w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition"
          aria-label="Menu"
          title="Menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold flex-1 text-center truncate whitespace-nowrap dark:text-white">Settings</h1>
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          title="Go to Home"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <div className="w-full max-w-4xl mx-auto">
          {/* Settings List */}
          <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            {/* Dark Mode Setting */}
            <div
              onClick={() => navigate("/settings/appearance")}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Appearance</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose between dark and light mode</p>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDarkModeToggle(!localDarkMode);
                  }}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                    localDarkMode ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      localDarkMode ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-800"></div>

            {/* Themes Setting */}
            <div
              onClick={() => navigate("/settings/themes")}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer text-left"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Themes</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Choose product card layout and design</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-800"></div>

            {/* Watermark Setting */}
            <div
              onClick={() => navigate("/settings/watermark")}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer text-left"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Watermark</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Add custom text to your product images</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-800"></div>

            {/* Fields Setting */}
            <div
              onClick={() => navigate("/settings/fields")}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer text-left"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Product Fields</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Configure custom fields and units for your products</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-800"></div>

            {/* Currency Setting */}
            <div
              onClick={() => navigate("/settings/currency")}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer text-left"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Currency</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Set default currency for your products</p>
              </div>
            </div>
          </div>

          {/* Clear Cache Button */}
          <div className="mt-4">
            <button
              onClick={clearLocalStorageCache}
              className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base flex-shrink-0">🗑️</span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Clear Cache</h3>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Free up storage space by removing cached rendered images</p>
                </div>
              </div>
            </button>
          </div>

          {/* Pro Plan Card */}
          <div className="mt-4">
            <div
              onClick={() => navigate("/settings/pro?from=settings")}
              className="w-full bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition cursor-pointer text-left p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base flex-shrink-0">✨</span>
                    <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                      {isPaidPro ? "Pro Plan Active" : isTrialActive ? "On Free Trial" : "Free Plan"}
                    </h3>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    {isPaidPro
                      ? "You have access to all premium features"
                      : isTrialActive
                      ? `Trial expires ${new Date(trialEndsAt).toLocaleDateString()}`
                      : "Subscribe to unlock premium features"}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isPro
                      ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                  }`}>
                    {isPro ? "PRO" : "FREE"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>


      {/* Side Drawer */}
      {menuOpen && (
        <SideDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          products={products}
          imageMap={{}}
          setProducts={setProducts}
          setDeletedProducts={setDeletedProducts}
          selected={[]}
          onShowTutorial={() => setShowTutorial(true)}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          isRendering={isRendering}
          renderProgress={renderProgress}
          renderResult={null}
          setRenderResult={() => {}}
          handleRenderAllImages={handleRenderAllImages}
        />
      )}
    </div>
  );
}
