import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdWarning, MdOutlineHome } from "react-icons/md";
import { MdCircle } from "react-icons/md";

import { safeGetFromStorage, safeSetInStorage } from "../utils/safeStorage";
import { logWatermarkApplied } from "../config/analyticsEvents";

export default function WatermarkSettings() {
  const navigate = useNavigate();
  const [showWatermark, setShowWatermark] = useState(() => {
    return safeGetFromStorage("showWatermark", true);
  });
  const [watermarkText, setWatermarkText] = useState(() => {
    return safeGetFromStorage("watermarkText", "Created using CatShare");
  });
  const [editingWatermarkText, setEditingWatermarkText] = useState(watermarkText);
  const [watermarkPosition, setWatermarkPosition] = useState(() => {
    return safeGetFromStorage("watermarkPosition", "bottom-left");
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [initialShowWatermark] = useState(() => {
    return safeGetFromStorage("showWatermark", true);
  });
  const [initialWatermarkText] = useState(() => {
    return safeGetFromStorage("watermarkText", "Created using CatShare");
  });
  const [initialWatermarkPosition] = useState(() => {
    return safeGetFromStorage("watermarkPosition", "bottom-left");
  });
  const [renderBoxVisible, setRenderBoxVisible] = useState(false);
  const renderBoxRef = useRef(null);
  const [showRenderConfirm, setShowRenderConfirm] = useState(false);

  // Migration logic handled here to ensure it moves to bottom-left if it was bottom-center
  useEffect(() => {
    // Update watermark position from bottom-center to bottom-left
    const positionValue = localStorage.getItem("watermarkPosition");
    if (positionValue === '"bottom-center"' || positionValue === 'bottom-center') {
      safeSetInStorage("watermarkPosition", "bottom-left");
      setWatermarkPosition("bottom-left");
    }
  }, []);

  useEffect(() => {
    setEditingWatermarkText(watermarkText);
  }, [watermarkText]);

  // Track changes to watermark settings
  useEffect(() => {
    const toggleChanged = showWatermark !== initialShowWatermark;
    const textChanged = watermarkText !== initialWatermarkText;
    const positionChanged = watermarkPosition !== initialWatermarkPosition;
    setHasChanges(toggleChanged || textChanged || positionChanged);
  }, [showWatermark, watermarkText, watermarkPosition, initialShowWatermark, initialWatermarkText, initialWatermarkPosition]);

  // Listen for render completion to reset changes
  useEffect(() => {
    const handleRenderComplete = () => {
      setHasChanges(false);
      setRenderBoxVisible(false);
    };
    window.addEventListener("renderComplete", handleRenderComplete);
    return () => window.removeEventListener("renderComplete", handleRenderComplete);
  }, []);

  // Reset renderBoxVisible when render box is not shown
  useEffect(() => {
    if (!hasChanges) {
      setRenderBoxVisible(false);
    }
  }, [hasChanges]);

  // Track if Render All Images box is visible in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setRenderBoxVisible(entry.isIntersecting);
      },
      { threshold: 0.01 }
    );

    if (renderBoxRef.current) {
      observer.observe(renderBoxRef.current);
    }

    return () => {
      if (renderBoxRef.current) {
        observer.unobserve(renderBoxRef.current);
      } else {
        observer.disconnect();
      }
    };
  }, [renderBoxRef]);

  const handleWatermarkToggle = (value) => {
    setShowWatermark(value);
    safeSetInStorage("showWatermark", value);
    logWatermarkApplied(value ? "enabled" : "disabled");
    window.dispatchEvent(new CustomEvent("watermarkChanged", { detail: { value } }));
  };

  const handleSaveWatermarkText = () => {
    const trimmedText = editingWatermarkText.trim();
    if (trimmedText.length === 0) {
      setEditingWatermarkText(watermarkText);
      return;
    }
    setWatermarkText(trimmedText);
    safeSetInStorage("watermarkText", trimmedText);
    logWatermarkApplied("text_changed", { textLength: trimmedText.length });
    window.dispatchEvent(new CustomEvent("watermarkTextChanged", { detail: { text: trimmedText } }));
  };

  const handleResetWatermarkText = () => {
    const defaultText = "Created using CatShare";
    setWatermarkText(defaultText);
    setEditingWatermarkText(defaultText);
    safeSetInStorage("watermarkText", defaultText);
    logWatermarkApplied("text_reset");
    window.dispatchEvent(new CustomEvent("watermarkTextChanged", { detail: { text: defaultText } }));
  };

  const handlePositionChange = (position) => {
    setWatermarkPosition(position);
    safeSetInStorage("watermarkPosition", position);
    logWatermarkApplied("position_changed", { position });
    window.dispatchEvent(new CustomEvent("watermarkPositionChanged", { detail: { position } }));
  };

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
          title="Back to Settings"
        >
          <MdArrowBack size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1 text-center">Watermark</h1>
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-200 transition"
          title="Go to Home"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="space-y-4 w-full max-w-4xl mx-auto">
          <p className="text-gray-600 text-sm">
            Display custom text on all product images and previews
          </p>

          {/* Toggle */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <MdCircle size={12} className={showWatermark ? "text-green-500" : "text-red-500"} />
                {showWatermark ? "Enabled" : "Disabled"}
              </span>
              <button
                onClick={() => handleWatermarkToggle(!showWatermark)}
                className={`relative inline-flex h-10 w-16 items-center rounded-full transition-colors ${
                  showWatermark ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform ${
                    showWatermark ? "translate-x-8" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-900">
              <span className="font-semibold">Status:</span>{" "}
              <span className={`${showWatermark ? "text-green-600 font-medium" : "text-red-600 font-medium"} flex items-center gap-1.5 inline-flex`}>
                <MdCircle size={10} className={showWatermark ? "text-green-500" : "text-red-500"} />
                {showWatermark ? "Enabled" : "Disabled"}
              </span>
            </p>
            <p className="text-xs text-blue-800 mt-2">
              {showWatermark
                ? "Watermark will appear on all exported images and in previews"
                : "Watermark is hidden on all content"}
            </p>
          </div>

          {/* Warning about export images */}
          {/* Watermark Text Editor - Only visible when enabled */}
          {showWatermark && (
            <>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                <label className="block text-sm font-medium text-gray-800 mb-2">Watermark Text</label>
                <input
                  type="text"
                  value={editingWatermarkText}
                  onChange={(e) => setEditingWatermarkText(e.target.value)}
                  placeholder="Enter watermark text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm mb-2"
                />
                <p className="text-xs text-gray-500 mb-3">
                  Current: <span className="font-mono">{watermarkText}</span>
                </p>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveWatermarkText}
                    disabled={editingWatermarkText.trim() === ""}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleResetWatermarkText}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 text-sm rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>

              {/* Watermark Position Selector */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                <label className="block text-sm font-medium text-gray-800 mb-3">Position</label>
                <p className="text-xs text-gray-600 mb-3">Click on the position buttons on the image preview</p>

                {/* Position Preview Image with Buttons */}
                <div className="relative mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden border-2 border-gray-300 mb-3" style={{ aspectRatio: "1/1", maxWidth: "280px", width: "100%" }}>
                  {/* Sample product image preview */}
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2F9de8f88039f043c2bb2e12760a839fad%2F7f2e888f655c4a6d8e8d286a6b93b85a?format=webp&width=800&height=1200"
                    alt="Sample product"
                    className="w-full h-full object-cover"
                    style={{ transform: "scale(1.05)" }}
                  />

                  {/* Watermark Text Preview at Selected Position */}
                  <div
                    style={{
                      position: "absolute",
                      fontSize: "10px",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: 500,
                      letterSpacing: "0.5px",
                      color: "rgba(128, 128, 128, 0.85)",
                      textShadow: "none",
                      pointerEvents: "none",
                      zIndex: 3,
                      ...(watermarkPosition === "top-left" && { top: 10, left: 10, transform: "none" }),
                      ...(watermarkPosition === "top-center" && { top: 10, left: "50%", transform: "translateX(-50%)" }),
                      ...(watermarkPosition === "top-right" && { top: 10, right: 10, left: "auto", transform: "none" }),
                      ...(watermarkPosition === "middle-left" && { top: "50%", left: 10, transform: "translateY(-50%)" }),
                      ...(watermarkPosition === "middle-center" && { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
                      ...(watermarkPosition === "middle-right" && { top: "50%", right: 10, left: "auto", transform: "translateY(-50%)" }),
                      ...(watermarkPosition === "bottom-left" && { bottom: 10, left: 10, transform: "none" }),
                      ...(watermarkPosition === "bottom-center" && { bottom: 10, left: "50%", transform: "translateX(-50%)" }),
                      ...(watermarkPosition === "bottom-right" && { bottom: 10, right: 10, left: "auto", transform: "none" }),
                    }}
                  >
                    {watermarkText}
                  </div>

                  {/* Top Left Position Button */}
                  <button
                    onClick={() => handlePositionChange("top-left")}
                    className={`absolute top-1 left-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "top-left"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Top Left"
                  >
                    ↖
                  </button>

                  {/* Top Center Position Button */}
                  <button
                    onClick={() => handlePositionChange("top-center")}
                    className={`absolute top-1 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "top-center"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Top Center"
                  >
                    ⬆
                  </button>

                  {/* Top Right Position Button */}
                  <button
                    onClick={() => handlePositionChange("top-right")}
                    className={`absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "top-right"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Top Right"
                  >
                    ↗
                  </button>

                  {/* Middle Left Position Button */}
                  <button
                    onClick={() => handlePositionChange("middle-left")}
                    className={`absolute top-1/2 -translate-y-1/2 left-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "middle-left"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Middle Left"
                  >
                    ⬅
                  </button>

                  {/* Middle Center Position Button */}
                  <button
                    onClick={() => handlePositionChange("middle-center")}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "middle-center"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Middle Center"
                  >
                    ●
                  </button>

                  {/* Middle Right Position Button */}
                  <button
                    onClick={() => handlePositionChange("middle-right")}
                    className={`absolute top-1/2 -translate-y-1/2 right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "middle-right"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Middle Right"
                  >
                    ➡
                  </button>

                  {/* Bottom Left Position Button */}
                  <button
                    onClick={() => handlePositionChange("bottom-left")}
                    className={`absolute bottom-1 left-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "bottom-left"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Bottom Left"
                  >
                    ↙
                  </button>

                  {/* Bottom Center Position Button */}
                  <button
                    onClick={() => handlePositionChange("bottom-center")}
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "bottom-center"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Bottom Center"
                  >
                    ⬇
                  </button>

                  {/* Bottom Right Position Button */}
                  <button
                    onClick={() => handlePositionChange("bottom-right")}
                    className={`absolute bottom-1 right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      watermarkPosition === "bottom-right"
                        ? "hidden"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title="Bottom Right"
                  >
                    ↘
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Current: <span className="font-medium capitalize">{watermarkPosition.replace("-", " ")}</span>
                </p>
              </div>
            </>
          )}

          {/* Render Images Box - Only visible when changes are made */}
          {hasChanges && (
            <div ref={renderBoxRef} className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-900 mb-3">
                <span className="font-semibold">✓ Changes Detected</span>
              </p>
              <p className="text-xs text-red-800 mb-3">
                You've made changes to your watermark settings. Click below to render all images and apply these changes to your shared images.
              </p>
              <button
                onClick={() => {
                  setShowRenderConfirm(true);
                }}
                className="w-full px-4 py-2 bg-red-900 text-white text-sm rounded-lg hover:bg-red-950 transition font-medium"
              >
                Render All Images
              </button>
            </div>
          )}

          {showWatermark && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-900">
                <span className="font-semibold">⚠️ Note about Shared Images:</span>
              </p>
              <p className="text-xs text-amber-800 mt-2">
                Other previews will show watermark changes immediately. However, to see watermark changes in your shared images, you need to <span className="font-semibold">render all images</span> again. Shared images will only update after rendering.
              </p>
            </div>
          )}

        </div>
      </main>

      {/* Floating Render Button - Visible only when changes are detected and render box is not visible */}
      {hasChanges && !renderBoxVisible && (
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            onClick={() => {
              setShowRenderConfirm(true);
            }}
            title="Watermark changes won't appear on shared images until rendered"
            className="px-4 py-3 bg-red-900 text-white text-sm rounded-lg hover:bg-red-950 transition font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <MdWarning size={18} />
            <span>Render</span>
          </button>
          <div className="absolute bottom-full right-0 mb-2 bg-gray-800 text-white text-xs rounded-lg p-3 max-w-xs hidden group-hover:block pointer-events-none whitespace-normal">
            <p className="font-semibold mb-1">Why render now?</p>
            <p>Watermark changes only appear on shared images after rendering. Previews update immediately, but shared content needs to be rendered.</p>
          </div>
        </div>
      )}

      {/* Render Confirmation Modal */}
      {showRenderConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-lg px-4">
          <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-center">
            <p className="text-lg font-medium text-gray-800 mb-4">Render all product images?</p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-red-900 mb-2">Why render now?</p>
              <ul className="text-xs text-red-800 space-y-1">
                <li>• Your watermark changes won't appear on shared images until rendered</li>
                <li>• Previews update immediately, but shared images need rendering</li>
                <li>• This ensures customers see your updated watermark</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              This will apply all watermark changes to your shared images.
            </p>

            <div className="flex justify-center gap-4">
              <button
                className="px-5 py-2 rounded-full bg-red-900 text-white font-medium shadow hover:bg-red-950 transition"
                onClick={() => {
                  setShowRenderConfirm(false);
                  window.dispatchEvent(new CustomEvent("requestRenderAllPNGs"));
                }}
              >
                Yes, Render
              </button>
              <button
                className="px-5 py-2 rounded-full bg-gray-300 text-gray-800 font-medium shadow hover:bg-gray-400 transition"
                onClick={() => setShowRenderConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
