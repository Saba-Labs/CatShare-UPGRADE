import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdOutlineHome, MdWarning, MdLock } from "react-icons/md";
import { FiEdit3, FiPackage, FiArchive, FiCheckCircle, FiX } from "react-icons/fi";
import { useTheme } from "../context/ThemeContext";
import { useSubscription } from "../context/SubscriptionContext";
import { getAllThemes } from "../config/themeConfig";

export default function ThemesSettings() {
  const navigate = useNavigate();
  const { isPro } = useSubscription();
  const { selectedThemeId, setTheme } = useTheme();
  const [expandedThemeId, setExpandedThemeId] = useState(null);
  const [initialThemeId] = useState(selectedThemeId);
  const [hasChanges, setHasChanges] = useState(false);
  const [renderBoxVisible, setRenderBoxVisible] = useState(false);
  const [showRenderConfirm, setShowRenderConfirm] = useState(false);
  const renderBoxRef = useRef(null);

  // Get all available themes from theme config
  const themes = getAllThemes();

  // Track changes to theme
  useEffect(() => {
    setHasChanges(selectedThemeId !== initialThemeId);
  }, [selectedThemeId, initialThemeId]);

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

  const handleThemeSelect = (themeId) => {
    if (themeId === "glass" && !isPro) {
      navigate("/settings/pro");
      return;
    }
    setTheme(themeId);
    console.log(`🎨 Theme selected: ${themeId}`);
  };

  // Sample products for different themes
  const classicProduct = {
    id: "sample-classic",
    name: "Frock",
    subtitle: "Fancy wear",
    color: "Red",
    package: "5 pcs / set",
    ageGroup: "5 years",
    price: "₹200",
    priceUnit: "/ piece",
    inStock: true,
    badge: "PREMIUM",
    imageBgColor: "white",
    bgColor: "#dc2626", // Dark red background
    lightBgColor: "#fca5a5", // Light red for classic
    fontColor: "white",
    cropAspectRatio: 1,
  };

  const glassProduct = {
    id: "sample-glass",
    name: "Frock",
    subtitle: "Fancy wear",
    color: "Red",
    package: "5 pcs / set",
    ageGroup: "5 years",
    price: "₹200",
    priceUnit: "/ piece",
    inStock: true,
    badge: "PREMIUM",
    imageBgColor: "white",
    bgColor: "#0f8577", // Teal/turquoise dark
    lightBgColor: "#7fdcc7", // Teal light for gradient
    fontColor: "white",
    cropAspectRatio: 1,
  };

  // Helper function to get lighter color for details section
  const getLighterColor = (color, theme) => {
    if (theme === "glass") {
      return "rgba(252, 165, 165, 0.8)";
    }
    return "#fca5a5";
  };

  // Sample product image
  const sampleProductImage =
    "https://cdn.builder.io/api/v1/image/assets%2F9de8f88039f043c2bb2e12760a839fad%2F7f2e888f655c4a6d8e8d286a6b93b85a?format=webp&width=800&height=1200";

  return (
    <div className="w-full h-screen flex flex-col bg-slate-50 dark:bg-slate-950 relative selection:bg-red-100 dark:selection:bg-red-900/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/40 dark:bg-blue-900/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-red-100/30 dark:bg-red-900/10 blur-[80px] rounded-full"></div>
      </div>

      <div className="sticky top-0 h-[40px] bg-black z-50"></div>

      <header className="sticky top-[40px] z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 h-16 flex items-center gap-4 px-5 relative">
        <button
          onClick={() => navigate("/settings")}
          className="w-10 h-10 shrink-0 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
        >
          <MdArrowBack size={22} />
        </button>
        <div className="flex flex-col flex-1 items-center">
          <h1 className="text-base sm:text-lg font-semibold sm:font-bold text-slate-900 dark:text-white leading-tight tracking-tight">Themes</h1>
          <span className="text-[8px] sm:text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-[0.2em] ml-1">Appearance</span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
          title="Go to Home"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-3 sm:px-5 py-6 sm:py-8 pb-32 z-10">
        <div className="max-w-xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xl sm:text-3xl font-bold sm:font-black text-slate-900 dark:text-white tracking-tighter">Choose Style</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-xs mx-auto font-medium">
              Pick the perfect aesthetic to showcase your unique product catalog
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {themes.map((theme) => {
              const sampleProduct = theme.id === "classic" ? classicProduct : glassProduct;
              const isGlassTheme = theme.id === "glass";
              const glassLocked = isGlassTheme && !isPro;
              const isExpanded = expandedThemeId === theme.id;

              return (
                <div
                  key={theme.id}
                  className={`group flex flex-col transition-all duration-500 rounded-[2.5rem] overflow-hidden border-2 ${
                    isExpanded
                      ? "bg-white dark:bg-slate-900 border-red-500/20 shadow-2xl shadow-red-500/10 ring-1 ring-red-500/5 p-4 sm:p-6"
                      : "bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm p-3 sm:p-4"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className="flex items-center gap-2 sm:gap-4 cursor-pointer flex-1"
                      onClick={() => setExpandedThemeId(isExpanded ? null : theme.id)}
                    >
                      <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                        selectedThemeId === theme.id
                          ? "bg-red-600 text-white scale-110"
                          : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                      }`}>
                        <span className="text-[10px] sm:text-sm font-bold sm:font-black uppercase tracking-tighter">
                          {theme.id === "classic" ? "CL" : "GL"}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-lg font-semibold sm:font-bold text-slate-900 dark:text-white tracking-tight">
                            {theme.name} Edition
                          </h3>
                          {glassLocked && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700/60">
                              <MdLock size={10} aria-hidden />
                              Pro
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isGlassTheme ? "bg-blue-400" : "bg-emerald-400"}`}></span>
                          <p className="text-[8px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                            {isGlassTheme ? "Ultra Modern" : "Universal Clean"}
                          </p>
                        </div>
                        {isGlassTheme && (
                          <div className="flex items-center gap-1 mt-1 text-amber-600 dark:text-amber-400 animate-pulse">
                            <MdWarning size={10} />
                            <p className="text-[7px] sm:text-[9px] font-medium leading-tight">
                              Modern look, requires more render time
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (glassLocked) {
                            navigate("/settings/pro");
                            return;
                          }
                          handleThemeSelect(theme.id);
                        }}
                        className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold sm:font-black text-[9px] sm:text-[11px] transition-all duration-300 active:scale-95 flex items-center gap-2 shadow-lg ${
                          glassLocked
                            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            : selectedThemeId === theme.id
                              ? "bg-red-600 text-white shadow-red-500/30"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
                        }`}
                      >
                        {glassLocked ? (
                          <>
                            <MdLock size={14} className="shrink-0" aria-hidden />
                            Upgrade
                          </>
                        ) : (
                          <>
                            {selectedThemeId === theme.id ? "Selected" : "Select"}
                            {selectedThemeId === theme.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="relative">
                        {selectedThemeId === theme.id && (
                          <div className="absolute -top-4 -right-4 w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-slate-50 dark:border-slate-950 z-30 transform rotate-12">
                            <span className="text-lg font-bold">✓</span>
                          </div>
                        )}

                        <div className="flex justify-center mb-10 transform transition-transform duration-500 group-hover:scale-[1.02]">
                          {isGlassTheme ? (
                            <div
                              style={{
                                background: "white",
                                padding: 0,
                                display: "flex",
                                flexDirection: "column",
                                height: "auto",
                                width: "100%",
                                maxWidth: "340px",
                                borderRadius: "16px",
                                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  backgroundColor: sampleProduct.imageBgColor || "white",
                                  textAlign: "center",
                                  padding: 0,
                                  position: "relative",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  aspectRatio: sampleProduct.cropAspectRatio || 1,
                                  width: "100%",
                                }}
                              >
                                <img
                                  src={sampleProductImage}
                                  alt={sampleProduct.name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    margin: "0 auto",
                                    padding: "16px",
                                  }}
                                />
                                {sampleProduct.badge && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: 12,
                                      right: 12,
                                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                                      backdropFilter: "blur(20px) saturate(180%)",
                                      WebkitBackdropFilter: "blur(20px) saturate(180%)",
                                      color: "rgba(255, 255, 255, 0.95)",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      padding: "8px 14px",
                                      borderRadius: "999px",
                                      boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.3)",
                                      border: "1.5px solid rgba(255, 255, 255, 0.4)",
                                      letterSpacing: "0.5px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {sampleProduct.badge.toUpperCase()}
                                  </div>
                                )}
                              </div>

                              <div
                                style={{
                                  background: "linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #dc2626 100%)",
                                  backgroundSize: "400% 400%",
                                  width: "100%",
                                  padding: "8px",
                                  paddingTop: "0",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  position: "relative",
                                  overflow: "visible",
                                }}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: "radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 0, 0, 0.1) 0%, transparent 50%)",
                                    pointerEvents: "none",
                                    zIndex: 0,
                                  }}
                                ></div>
                                <div
                                  style={{
                                    backgroundColor: "rgba(255, 255, 255, 0.28)",
                                    backdropFilter: "blur(25px) saturate(180%)",
                                    WebkitBackdropFilter: "blur(25px) saturate(180%)",
                                    padding: "12px 12px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    border: "2px solid rgba(255, 255, 255, 0.8)",
                                    borderRadius: "14px",
                                    width: "calc(100% - 16px)",
                                    marginTop: "-30px",
                                    marginLeft: "16px",
                                    marginRight: "16px",
                                    marginBottom: "16px",
                                    boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.1)",
                                    position: "relative",
                                    zIndex: 2,
                                  }}
                                >
                                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                                    <p style={{ fontWeight: "600", fontSize: 18, margin: "0 0 4px 0", color: "white" }}>
                                      {sampleProduct.name}
                                    </p>
                                    {sampleProduct.subtitle && (
                                      <p style={{ fontStyle: "italic", fontSize: 13, margin: 0, color: "white" }}>
                                        ({sampleProduct.subtitle})
                                      </p>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, marginBottom: 8, color: "white", fontSize: 13, width: "100%", paddingLeft: 20, paddingRight: 20 }}>
                                    <div style={{ marginBottom: 4, display: "flex", alignItems: "flex-start" }}>
                                      <span style={{ fontWeight: "500", width: "90px", flexShrink: 0 }}>Colour</span>
                                      <span style={{ fontWeight: "500" }}>:</span>
                                      <span style={{ textAlign: "left", marginLeft: "8px", flex: 1 }}>{sampleProduct.color}</span>
                                    </div>
                                    <div style={{ marginBottom: 4, display: "flex", alignItems: "flex-start" }}>
                                      <span style={{ fontWeight: "500", width: "90px", flexShrink: 0 }}>Package</span>
                                      <span style={{ fontWeight: "500" }}>:</span>
                                      <span style={{ textAlign: "left", marginLeft: "8px", flex: 1 }}>{sampleProduct.package}</span>
                                    </div>
                                    <div style={{ marginBottom: 4, display: "flex", alignItems: "flex-start" }}>
                                      <span style={{ fontWeight: "500", width: "90px", flexShrink: 0 }}>Age Group</span>
                                      <span style={{ fontWeight: "500" }}>:</span>
                                      <span style={{ textAlign: "left", marginLeft: "8px", flex: 1 }}>{sampleProduct.ageGroup}</span>
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      backgroundColor: "#dc2626",
                                      color: "white",
                                      padding: "6px 16px",
                                      textAlign: "center",
                                      fontWeight: "600",
                                      fontSize: 16,
                                      borderRadius: "10px",
                                      marginTop: 8,
                                      width: "calc(100% - 32px)",
                                      whiteSpace: "nowrap",
                                      border: "1px solid rgba(0, 0, 0, 0.1)",
                                    }}
                                  >
                                    {sampleProduct.price} {sampleProduct.priceUnit}
                                  </div>
                                </div>
                              </div>

                            </div>
                          ) : (
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "330px",
                            backgroundColor: "white",
                            borderRadius: "8px",
                            overflow: "hidden",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            border: "1px solid rgb(229, 231, 235)",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          {/* ... card content ... */}
                          <div
                            style={{
                              backgroundColor: sampleProduct.imageBgColor || "white",
                              textAlign: "center",
                              padding: 0,
                              position: "relative",
                              boxShadow: "0 12px 15px -6px rgba(0, 0, 0, 0.4)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              aspectRatio: sampleProduct.cropAspectRatio || 1,
                              width: "100%",
                            }}
                          >
                            <img
                              src={sampleProductImage}
                              alt={sampleProduct.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                margin: "0 auto",
                              }}
                            />
                            {sampleProduct.badge && (
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 10,
                                  right: 10,
                                  backgroundColor: "#666666",
                                  color: "white",
                                  fontSize: 12,
                                  fontWeight: 400,
                                  padding: "5px 10px",
                                  borderRadius: "999px",
                                  opacity: 0.95,
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                  border: "1px solid rgba(0,0,0,0.2)",
                                  letterSpacing: "0.4px",
                                  pointerEvents: "none",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {sampleProduct.badge.toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              backgroundColor: getLighterColor(sampleProduct.bgColor, theme.id),
                              color: sampleProduct.fontColor || "white",
                              padding: "12px 12px",
                              fontSize: 17,
                              flex: 1,
                            }}
                          >
                            <div style={{ textAlign: "center", marginBottom: 6 }}>
                              <p style={{ fontWeight: "normal", textShadow: "3px 3px 5px rgba(0,0,0,0.2)", fontSize: 28, margin: "0 0 3px 0" }}>
                                {sampleProduct.name}
                              </p>
                              {sampleProduct.subtitle && (
                                <p style={{ fontStyle: "italic", fontSize: 18, margin: "0 0 0 0" }}>
                                  ({sampleProduct.subtitle})
                                </p>
                              )}
                            </div>
                            <div style={{ textAlign: "left", lineHeight: 1.3, paddingLeft: 12, paddingRight: 8 }}>
                              <p style={{ margin: "2px 0", display: "flex" }}>
                                <span style={{ width: "90px" }}>Colour</span>
                                <span>:</span>
                                <span style={{ marginLeft: "8px" }}>{sampleProduct.color}</span>
                              </p>
                              <p style={{ margin: "2px 0", display: "flex" }}>
                                <span style={{ width: "90px" }}>Package</span>
                                <span>:</span>
                                <span style={{ marginLeft: "8px" }}>{sampleProduct.package}</span>
                              </p>
                              <p style={{ margin: "2px 0", display: "flex" }}>
                                <span style={{ width: "90px" }}>Age Group</span>
                                <span>:</span>
                                <span style={{ marginLeft: "8px" }}>{sampleProduct.ageGroup}</span>
                              </p>
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: sampleProduct.bgColor || "#add8e6",
                              color: sampleProduct.fontColor || "white",
                              padding: "6px 8px",
                              textAlign: "center",
                              fontWeight: "normal",
                              fontSize: 19,
                              flexShrink: 0,
                            }}
                          >
                            Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;{sampleProduct.price} {sampleProduct.priceUnit}
                          </div>

                        </div>
                      )}
                        </div>

                        <div className="p-4 sm:p-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm space-y-4">
                          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            {theme.description}
                          </p>
                          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                            <h4 className="text-[8px] sm:text-[10px] font-bold sm:font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-4">Key Features</h4>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {isGlassTheme ? (
                                <>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>Frosted Glass</span>
                                  </li>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>3D Depth Effect</span>
                                  </li>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>Vibrant Gradients</span>
                                  </li>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>Premium Polish</span>
                                  </li>
                                </>
                              ) : (
                                <>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>Minimalist Grid</span>
                                  </li>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>High Readability</span>
                                  </li>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>Fast Rendering</span>
                                  </li>
                                  <li className="flex items-center gap-2 text-[9px] sm:text-[11px] font-semibold sm:font-bold text-slate-700 dark:text-slate-300">
                                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[6px] sm:text-[8px]">✓</span>
                                    <span>Custom Colors</span>
                                  </li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Render Images Box - Moved here from above the grid */}
          {hasChanges && (
            <div ref={renderBoxRef} className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-900 mb-3">
                <span className="font-semibold">✓ Changes Detected</span>
              </p>
              <p className="text-xs text-red-800 mb-3">
                You've changed your theme. Click below to render all images and apply this new theme to your shared images.
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

          <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 shadow-2xl">
            <div className="bg-white dark:bg-slate-900 rounded-[2.4rem] p-8 space-y-5 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full"></div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-3xl mb-2 text-3xl shadow-inner border border-amber-200/50">✨</div>
              <div className="space-y-2">
                <h3 className="text-base sm:text-xl font-bold sm:font-black text-slate-900 dark:text-white tracking-tight">More Themes Coming</h3>
                <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed px-2 sm:px-4">We're crafting new breathtaking layouts to give your products the spotlight they deserve.</p>
              </div>
              <div className="pt-2">
                <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[8px] sm:text-[10px] font-bold sm:font-black uppercase tracking-[0.2em]">Stay Tuned</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Render Button - Visible only when changes are detected and render box is not visible */}
      {hasChanges && !renderBoxVisible && (
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            onClick={() => {
              setShowRenderConfirm(true);
            }}
            title="Theme changes won't appear on shared images until rendered"
            className="px-4 py-3 bg-red-900 text-white text-sm rounded-lg hover:bg-red-950 transition font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <MdWarning size={18} />
            <span>Render</span>
          </button>
          <div className="absolute bottom-full right-0 mb-2 bg-gray-800 text-white text-xs rounded-lg p-3 max-w-xs hidden group-hover:block pointer-events-none whitespace-normal">
            <p className="font-semibold mb-1">Why render now?</p>
            <p>Theme changes only appear on shared images after rendering. Previews update immediately, but shared content needs to be rendered.</p>
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
                <li>• Your theme changes won't appear on shared images until rendered</li>
                <li>• Previews update immediately, but shared images need rendering</li>
                <li>• This ensures customers see your updated theme</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              This will apply your new theme to all your shared images.
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
