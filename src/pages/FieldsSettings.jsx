import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MdArrowBack, MdOutlineHome, MdSave, MdRefresh, MdDragIndicator, MdAdd, MdCheckCircle, MdInfoOutline, MdExpandMore, MdEdit, MdCheck, MdVisibility, MdVisibilityOff, MdToggleOn, MdToggleOff } from "react-icons/md";
import { FiTrash2, FiSettings, FiBriefcase, FiCheck } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  getFieldsDefinition,
  setFieldsDefinition,
  resetToDefaultFields,
  DEFAULT_FIELD_VISIBILITY,
} from "../config/fieldConfig";
import { getAllCatalogues } from "../config/catalogueConfig";
import { INDUSTRY_PRESETS } from "../config/industryPresets";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useCloudWriteGate } from "../hooks/useCloudWriteGate";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

function parseUnitOptionsString(unitsString) {
  return String(unitsString ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u !== "");
}

export default function FieldsSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { guardCloudWrite } = useCloudWriteGate();
  const [definition, setDefinition] = useState(null);
  const [savedDefinition, setSavedDefinition] = useState(null);
  const [activePriceFields, setActivePriceFields] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [editingLabelKey, setEditingLabelKey] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [priceUnits, setPriceUnits] = useState(() => {
    const stored = localStorage.getItem("priceFieldUnits");
    if (stored) {
      return JSON.parse(stored);
    }
    // Set default units
    const defaultUnits = ["/ piece", "/ dozen", "/ set", "/ kg"];
    localStorage.setItem("priceFieldUnits", JSON.stringify(defaultUnits));
    return defaultUnits;
  });
  const [editingPriceUnits, setEditingPriceUnits] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState("");
  const [editingUnitIndex, setEditingUnitIndex] = useState(null);
  const [editingUnitValue, setEditingUnitValue] = useState("");
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const scrollContainerRef = useRef(null);
  /** Raw unit-options text while typing (comma split only on blur — avoids stripping "," mid-edit). */
  const [unitsTextDraft, setUnitsTextDraft] = useState({});
  const unitsTextDraftRef = useRef({});
  const prevExpandedKeyRef = useRef(null);

  useEffect(() => {
    let def = getFieldsDefinition();

    // Cleanup: Remove old disabled fields beyond field10
    const customFields = def.fields.filter(f => f.key.startsWith('field'));
    const hasOldFields = customFields.some(f => parseInt(f.key.replace('field', '')) > 10 && !f.enabled);

    if (hasOldFields) {
      def = {
        ...def,
        fields: def.fields.filter(f => {
          if (f.key.startsWith('field') && parseInt(f.key.replace('field', '')) > 10 && !f.enabled) {
            return false;
          }
          return true;
        })
      };
      setFieldsDefinition(def);
    }

    setDefinition(def);
    setSavedDefinition(def);

    // Determine which price fields are actually in use by catalogues
    const catalogues = getAllCatalogues();
    const usedPriceFields = catalogues.map(c => c.priceField);
    setActivePriceFields(usedPriceFields);
  }, []);

  // Listen for backup restore events
  useEffect(() => {
    const handleBackupRestore = (event) => {
      const { newDefinition, template, isBackupRestore } = event.detail || {};

      if (isBackupRestore && newDefinition) {
        // Update local state with restored definition
        setDefinition(newDefinition);
        setSavedDefinition(newDefinition);

        // Switch to templates view to show the restored template
        setSearchParams({}, { replace: true });

        console.log(`✅ Auto-switched to restored template: ${template || 'Unknown'}`);
        showToast(`Template restored: ${template || 'Custom'}`, "success");
      }
    };

    window.addEventListener("fieldDefinitionsChanged", handleBackupRestore);
    return () => window.removeEventListener("fieldDefinitionsChanged", handleBackupRestore);
  }, [showToast]);

  // When switching expanded field, save unit-options draft for the previous field (same as blur)
  useEffect(() => {
    const prev = prevExpandedKeyRef.current;
    if (prev && prev !== expandedKey) {
      const raw = unitsTextDraftRef.current[prev];
      if (raw !== undefined) {
        const unitOptions = parseUnitOptionsString(raw);
        setDefinition((def) => {
          if (!def) return def;
          const newFields = def.fields.map((f) =>
            f.key === prev ? { ...f, unitOptions } : f
          );
          return { ...def, fields: newFields };
        });
        delete unitsTextDraftRef.current[prev];
        setUnitsTextDraft((u) => {
          const next = { ...u };
          delete next[prev];
          return next;
        });
      }
    }
    prevExpandedKeyRef.current = expandedKey;
  }, [expandedKey]);

  const onDragEnd = (result) => {
    if (!result.destination || !definition) return;

    const items = Array.from(definition.fields);

    // Filtered list based on active price fields
    const productFields = items.filter(f => f.key.startsWith('field'));
    const currentList = [...productFields];

    const sourceField = currentList[result.source.index];
    const destField = currentList[result.destination.index];

    const sourceIndex = items.findIndex(f => f.key === sourceField.key);
    const destIndex = items.findIndex(f => f.key === destField.key);

    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destIndex, 0, reorderedItem);

    setDefinition({ ...definition, fields: items });
  };

  const getUnitPlaceholder = (label) => {
    const labelLower = label?.toLowerCase() || '';

    // Fashion & Apparel examples
    if (labelLower.includes('size')) return "e.g. S, M, L, XL";
    if (labelLower.includes('fabric')) return "e.g. Cotton, Silk, Polyester";
    if (labelLower.includes('fit')) return "e.g. Slim, Regular, Loose";

    // Lifestyle & Personal Care examples
    if (labelLower.includes('volume') || labelLower.includes('weight')) return "e.g. ml, g, kg";
    if (labelLower.includes('skin') || labelLower.includes('hair')) return "e.g. Dry, Oily, Normal";

    // Home, Kitchen & Living examples
    if (labelLower.includes('material')) return "e.g. Steel, Plastic, Wood";
    if (labelLower.includes('dimension')) return "e.g. inches, cm, mm";
    if (labelLower.includes('capacity')) return "e.g. 500ml, 1L, 2L";

    // Electronics examples
    if (labelLower.includes('warranty')) return "e.g. months, years";
    if (labelLower.includes('connectivity')) return "e.g. WiFi, Bluetooth, USB";

    // Industrial examples
    if (labelLower.includes('specification')) return "e.g. High, Medium, Low";
    if (labelLower.includes('quality')) return "e.g. Premium, Standard, Economy";
    if (labelLower.includes('coating')) return "e.g. Powder, Galvanized, Painted";

    // Default
    return "e.g. option1, option2, option3";
  };

  const updateFieldUnits = (key, unitsString) => {
    const unitOptions = parseUnitOptionsString(unitsString);
    setDefinition((prev) => {
      if (!prev) return prev;
      const newFields = prev.fields.map((f) =>
        f.key === key ? { ...f, unitOptions } : f
      );
      return { ...prev, fields: newFields };
    });
  };

  /** Apply pending unit-option drafts into a definition object (used before save). */
  const mergeUnitDraftsIntoDefinition = (def) => {
    if (!def) return def;
    const keys = Object.keys(unitsTextDraftRef.current);
    if (keys.length === 0) return def;
    let fields = def.fields;
    for (const key of keys) {
      const raw = unitsTextDraftRef.current[key];
      const unitOptions = parseUnitOptionsString(raw);
      fields = fields.map((f) =>
        f.key === key ? { ...f, unitOptions } : f
      );
    }
    return { ...def, fields };
  };

  const handleSave = () => {
    // Show confirmation modal instead of saving immediately
    setShowSaveConfirmation(true);
  };

  const confirmSave = async () => {
    if (!guardCloudWrite()) {
      setShowSaveConfirmation(false);
      return;
    }
    if (definition) {
      const mergedDefinition = mergeUnitDraftsIntoDefinition(definition);
      setDefinition(mergedDefinition);
      setUnitsTextDraft({});
      unitsTextDraftRef.current = {};

      setFieldsDefinition(mergedDefinition);
      setSavedDefinition(mergedDefinition);
      window.dispatchEvent(new Event('storage'));
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}

      // Sync to Supabase in background
      if (user && user.uid) {
        try {
          const { syncFieldsDefinition } = await import('../services/supabaseSync');
          const syncResult = await syncFieldsDefinition(user.uid, mergedDefinition);
          if (syncResult.success) {
            console.log('✅ Fields definition synced to Supabase');
            const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
            if (strictOnline) {
              window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
            }
          } else {
            console.warn('⚠️ Failed to sync fields definition:', syncResult.error);
          }
        } catch (syncErr) {
          console.warn('⚠️ Background sync error:', syncErr.message);
        }
      }

      showToast("Field settings saved successfully", "success");
      setShowSaveConfirmation(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm("Reset all fields to default settings? This will overwrite your current configuration.")) {
      resetToDefaultFields();
      const resetDef = getFieldsDefinition();
      setDefinition(resetDef);
      setSavedDefinition(resetDef);
      window.dispatchEvent(new Event('storage'));
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {}
      showToast("Fields reset to defaults", "info");
    }
  };

  const updateFieldLabel = (key, label) => {
    if (!definition) return;
    const newFields = definition.fields.map(f =>
      f.key === key ? { ...f, label } : f
    );
    setDefinition({ ...definition, fields: newFields });
  };

  const toggleUnitsEnabled = async (key) => {
    if (!definition) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}

    const newFields = definition.fields.map(f =>
      f.key === key ? { ...f, unitsEnabled: !f.unitsEnabled } : f
    );
    setDefinition({ ...definition, fields: newFields });
  };

  const updateFieldSurfaceVisibility = async (key, surface) => {
    if (!definition) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}

    const newFields = definition.fields.map((f) => {
      if (f.key !== key) return f;
      const current = f.visibility || DEFAULT_FIELD_VISIBILITY;
      return {
        ...f,
        visibility: {
          ...DEFAULT_FIELD_VISIBILITY,
          ...current,
          [surface]: !(current?.[surface] ?? true),
        },
      };
    });
    setDefinition({ ...definition, fields: newFields });
  };

  // Price Units Management Functions
  const savePriceUnits = async () => {
    try {
      localStorage.setItem("priceFieldUnits", JSON.stringify(priceUnits));
      window.dispatchEvent(new CustomEvent("priceUnitsChanged", { detail: { units: priceUnits } }));
      await Haptics.impact({ style: ImpactStyle.Light });
      showToast("Price units updated successfully", "success");
      setEditingPriceUnits(false);
    } catch (e) {
      showToast("Failed to save price units", "error");
    }
  };

  const addPriceUnit = async () => {
    if (!newUnitInput.trim()) {
      showToast("Unit cannot be empty", "error");
      return;
    }

    // Normalize unit to include "/ " prefix
    let normalizedUnit = newUnitInput.trim();
    if (!normalizedUnit.startsWith("/ ")) {
      normalizedUnit = `/ ${normalizedUnit}`;
    }

    if (priceUnits.includes(normalizedUnit)) {
      showToast("This unit already exists", "error");
      return;
    }
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      setPriceUnits([...priceUnits, normalizedUnit]);
      setNewUnitInput("");
      showToast("Unit added", "success");
    } catch (e) {
      showToast("Failed to add unit", "error");
    }
  };

  const deletePriceUnit = async (index) => {
    if (priceUnits.length <= 1) {
      showToast("Must keep at least one unit", "error");
      return;
    }
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      setPriceUnits(priceUnits.filter((_, i) => i !== index));
      showToast("Unit removed", "success");
    } catch (e) {
      showToast("Failed to remove unit", "error");
    }
  };

  const startEditingUnit = (index) => {
    setEditingUnitIndex(index);
    setEditingUnitValue(priceUnits[index]);
  };

  const saveEditingUnit = async (index) => {
    if (!editingUnitValue.trim()) {
      showToast("Unit cannot be empty", "error");
      return;
    }

    // Normalize unit to include "/ " prefix
    let normalizedUnit = editingUnitValue.trim();
    if (!normalizedUnit.startsWith("/ ")) {
      normalizedUnit = `/ ${normalizedUnit}`;
    }

    if (priceUnits.some((unit, i) => unit === normalizedUnit && i !== index)) {
      showToast("This unit already exists", "error");
      return;
    }
    try {
      const updated = [...priceUnits];
      updated[index] = normalizedUnit;
      setPriceUnits(updated);
      setEditingUnitIndex(null);
      setEditingUnitValue("");
      await Haptics.impact({ style: ImpactStyle.Light });
      showToast("Unit updated", "success");
    } catch (e) {
      showToast("Failed to update unit", "error");
    }
  };

  const handleAddField = async () => {
    if (!definition) return;

    // First, try to find a disabled field from the pre-filled fields (1-10)
    const nextDisabledField = definition.fields.find(f => f.key.startsWith('field') && !f.enabled && parseInt(f.key.replace('field', '')) <= 10);

    if (nextDisabledField) {
      // Enable an existing disabled field
      const newFields = definition.fields.map(f =>
        f.key === nextDisabledField.key ? { ...f, enabled: true, label: "" } : f
      );
      setDefinition({ ...definition, fields: newFields });
      setExpandedKey(nextDisabledField.key);

      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}

      showToast(`Added new field`, "success");
    } else {
      // All 1-10 are enabled, so create a new field dynamically
      const customFields = definition.fields.filter(f => f.key.startsWith('field'));
      const maxFieldNum = customFields.length > 0
        ? Math.max(...customFields.map(f => parseInt(f.key.replace('field', ''))))
        : 0;
      const nextFieldNum = maxFieldNum + 1;

      const newField = {
        key: `field${nextFieldNum}`,
        label: "",
        type: 'text',
        enabled: true,
        unitsEnabled: false,
        unitOptions: [],
      };

      const newFields = [...definition.fields];
      newFields.splice(-1, 0, newField); // Insert before price1
      setDefinition({ ...definition, fields: newFields });
      setExpandedKey(newField.key);

      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}

      showToast(`Field ${nextFieldNum} added`, "success");
    }
  };

  const updateIndustry = async (industry) => {
    if (!definition) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}

    const preset = INDUSTRY_PRESETS.find(p => p.name === industry);
    let newFields = [...definition.fields];
    
    if (preset) {
      newFields = newFields.map(f => {
        if (f.key.startsWith('field')) {
          const index = parseInt(f.key.replace('field', '')) - 1;
          const presetField = preset.fields[index];
          if (presetField) {
            return {
              ...f,
              label: presetField.label,
              unitOptions: presetField.unitOptions || [],
              unitsEnabled: !!(presetField.unitOptions && presetField.unitOptions.length > 0),
              enabled: true
            };
          } else {
            return { ...f, enabled: false };
          }
        }
        return f;
      });
    } else {
      newFields = newFields.map(f => {
        if (f.key.startsWith('field')) {
          return { ...f, enabled: false, unitsEnabled: false, unitOptions: [] };
        }
        return f;
      });
    }

    setDefinition({ ...definition, industry, fields: newFields });
  };

  const toggleFieldEnabled = async (key) => {
    if (!definition) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}

    const newFields = definition.fields.map(f =>
      f.key === key ? { ...f, enabled: !f.enabled } : f
    );
    setDefinition({ ...definition, fields: newFields });
  };

  const removeField = async (key) => {
    if (!definition) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}

    // Actually delete the field from the array
    const newFields = definition.fields.filter(f => f.key !== key);
    setDefinition({ ...definition, fields: newFields });
    showToast("Field removed", "success");
  };

  const startEditingLabel = (e, field) => {
    e.stopPropagation();
    setEditingLabelKey(field.key);
    setEditingLabelValue(field.label || "");
  };

  const saveEditingLabel = (e, key) => {
    e.stopPropagation();
    updateFieldLabel(key, editingLabelValue);
    setEditingLabelKey(null);
    setEditingLabelValue("");
  };

  const openSavedActiveTemplate = () => {
    if (!savedDefinition) return;
    // Reset editor state to persisted data so "Active Template"
    // always opens the actual saved configuration.
    setDefinition(savedDefinition);
    setExpandedKey(null);
    setEditingLabelKey(null);
    setEditingLabelValue("");
    setUnitsTextDraft({});
    unitsTextDraftRef.current = {};
    prevExpandedKeyRef.current = null;
    setSearchParams(
      {
        industry: savedDefinition.industry || "General Products (Custom)",
        view: "configure",
      },
      { replace: true }
    );
  };

  if (!definition) return null;

  const productFields = definition.fields.filter(f => f.key.startsWith('field'));
  const allFields = [...productFields];
  const activeProductFieldsCount = productFields.filter(f => f.enabled).length;

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      {/* iOS-style Status Bar Area */}
      <div className="h-10 bg-black shrink-0"></div>

      {/* Modern Header */}
      <header className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (searchParams.get("view") === "configure") {
                setSearchParams({}, { replace: true });
              } else {
                navigate("/settings");
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <MdArrowBack size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Product Fields</h1>
            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-widest">Configuration</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            title="Go to Home"
          >
            <MdOutlineHome size={24} />
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <MdSave size={18} />
            Save
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4" ref={scrollContainerRef}>

        {/* Current Configuration Summary Card - Shows SAVED configuration */}
        {savedDefinition && searchParams.get("view") !== "configure" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <FiSettings className="text-blue-600" size={14} />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Current Configuration</h2>
            </div>
            <div className="bg-blue-600 dark:bg-blue-700 rounded-2xl border border-blue-500 dark:border-blue-800 shadow-lg shadow-blue-500/20 p-4">
              <button
                onClick={openSavedActiveTemplate}
                className="w-full flex items-center justify-between hover:opacity-90 transition-opacity cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm">
                    {savedDefinition.industry === "General Products (Custom)" || !savedDefinition.industry ? "📦" :
                     savedDefinition.industry.includes("Fashion") ? "👕" :
                     savedDefinition.industry.includes("Lifestyle") ? "🧴" :
                     savedDefinition.industry.includes("Home") ? "🏠" :
                     savedDefinition.industry.includes("Electronics") ? "🎧" : "🛠️"}
                  </div>
                  <div className="text-left flex-1">
                    <span className="text-[10px] font-bold text-blue-100/80 uppercase tracking-widest">Active Template</span>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">
                        {savedDefinition.industry || "General Products (Custom)"}
                      </h2>
                      <span className="inline-flex items-center justify-center bg-white text-blue-600 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
                        {savedDefinition.fields.filter(f => f.key.startsWith('field') && f.enabled).length}
                      </span>
                    </div>
                  </div>
                </div>
                <motion.div
                  className="text-white shrink-0"
                >
                  <MdArrowBack size={20} style={{ transform: 'rotate(180deg)' }} />
                </motion.div>
              </button>
            </div>
          </div>
        )}



        <AnimatePresence mode="wait">
          {searchParams.get("view") !== "configure" ? (
            <motion.div
              key="templates-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-8 space-y-4"
            >
              <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <FiBriefcase className="text-blue-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Available Templates</h2>
                </div>

                <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                  Choose a different template to quickly set up relevant fields. Selecting a template will overwrite your current configuration.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {INDUSTRY_PRESETS.filter(p => p.name !== (savedDefinition?.industry || "General Products (Custom)")).map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      updateIndustry(preset.name);
                      setSearchParams({ industry: preset.name, view: "configure" });
                    }}
                    className="p-4 rounded-2xl border-2 transition-all flex items-center justify-between group bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-200 dark:hover:border-blue-900"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl bg-gray-100 dark:bg-gray-800 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        {preset.name.includes("Fashion") ? "👕" :
                         preset.name.includes("Lifestyle") ? "🧴" :
                         preset.name.includes("Home") ? "🏠" :
                         preset.name.includes("Electronics") ? "🎧" : "🛠️"}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-sm block">{preset.name}</span>
                        <span className="text-[10px] opacity-70">{preset.fields.length} Recommended Fields</span>
                      </div>
                    </div>
                  </button>
                ))}

                {savedDefinition?.industry && savedDefinition.industry !== "General Products (Custom)" && (
                  <button
                    onClick={() => {
                      updateIndustry("General Products (Custom)");
                      setSearchParams({ industry: "General Products (Custom)", view: "configure" });
                    }}
                    className="p-4 rounded-2xl border-2 transition-all flex items-center justify-between group bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-200 dark:hover:border-blue-900"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl bg-gray-100 dark:bg-gray-800 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">📦</div>
                      <div className="text-left">
                        <span className="font-bold text-sm block">Custom / General</span>
                        <span className="text-[10px] opacity-70">Flexible fields for any business</span>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="fields-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="py-6 space-y-6"
            >
              <div className="space-y-3">
                {definition.industry && (
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {definition.industry.includes("Fashion") ? "👕" :
                       definition.industry.includes("Lifestyle") ? "🧴" :
                       definition.industry.includes("Home") ? "🏠" :
                       definition.industry.includes("Electronics") ? "🎧" : "🛠️"}
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{definition.industry}</h2>
                  </div>
                )}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-3 items-start">
                  <MdInfoOutline className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                  <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                    Configure field labels and units. Tap a field to expand and edit details. Use drag handles to reorder.
                  </p>
                </div>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="fields">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      <AnimatePresence mode="popLayout">
                        {(() => {
                          const isCustomTemplate = definition.industry === "General Products (Custom)" || !definition.industry;
                          // For custom templates, only show enabled fields. For presets, show all fields that match the preset
                          const visibleFields = isCustomTemplate
                            ? allFields.filter(f => f.enabled)
                            : allFields.filter(f => f.key.startsWith('field'));
                          return visibleFields.map((field, index) => (
                          <motion.div
                            key={field.key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                          >
                            <Draggable draggableId={field.key} index={index}>
                              {(provided, snapshot) => (
                                <motion.div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  layout={!snapshot.isDragging}
                                  className={`bg-white dark:bg-gray-900 rounded-2xl border transition-all ${
                                    snapshot.isDragging ? "shadow-2xl ring-2 ring-blue-500 z-50 scale-[1.02]" : ""
                                  } ${
                                    field.enabled
                                      ? "border-blue-200 dark:border-blue-900 shadow-sm"
                                      : "border-gray-200 dark:border-gray-800 opacity-60 grayscale-[0.5]"
                                  }`}
                                >
                                  <div
                                    className="p-4 cursor-pointer"
                                    onClick={() => setExpandedKey(expandedKey === field.key ? null : field.key)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div
                                          {...provided.dragHandleProps}
                                          onClick={(e) => e.stopPropagation()}
                                          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors ${
                                            field.enabled ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                          }`}
                                        >
                                          <MdDragIndicator size={20} />
                                        </div>
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                            {`Field ${field.key.replace('field', '')}`}
                                          </span>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <AnimatePresence mode="wait">
                                              {editingLabelKey === field.key ? (
                                                <motion.div
                                                  key="edit-mode"
                                                  className="flex items-center gap-1"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <div className="relative">
                                                    <input
                                                      autoFocus
                                                      type="text"
                                                      value={editingLabelValue}
                                                      onChange={(e) => setEditingLabelValue(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveEditingLabel(e, field.key);
                                                        if (e.key === 'Escape') setEditingLabelKey(null);
                                                      }}
                                                      className="bg-transparent border-0 border-b-2 border-transparent px-0 py-0.5 text-sm font-medium w-32 outline-none focus:ring-0 relative z-10"
                                                    />
                                                    <motion.div
                                                      initial={{ scaleX: 0, originX: 0 }}
                                                      animate={{ scaleX: 1, originX: 0 }}
                                                      exit={{ scaleX: 0, originX: 1 }}
                                                      transition={{ duration: 0.4, ease: "easeOut" }}
                                                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                                                    />
                                                  </div>
                                                  <motion.button
                                                    onClick={(e) => saveEditingLabel(e, field.key)}
                                                    initial={{ opacity: 0, rotate: -90 }}
                                                    animate={{ opacity: 1, rotate: 0 }}
                                                    exit={{ opacity: 0, rotate: 90 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                                    title="Save"
                                                  >
                                                    <MdCheck size={20} />
                                                  </motion.button>
                                                </motion.div>
                                              ) : (
                                                <motion.div
                                                  key="view-mode"
                                                  className="flex items-center gap-2"
                                                >
                                                  <h3 className="font-bold text-sm dark:text-white truncate max-w-[150px]">
                                                    {field.label || "Untitled Field"}
                                                  </h3>
                                                  <motion.button
                                                    onClick={(e) => startEditingLabel(e, field)}
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                                  >
                                                    <MdEdit size={14} />
                                                  </motion.button>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <motion.button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFieldEnabled(field.key);
                                          }}
                                          whileHover={{ scale: 1.15 }}
                                          whileTap={{ scale: 0.9 }}
                                          className={`cursor-pointer transition-colors ${
                                            field.enabled
                                              ? "text-blue-600"
                                              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                          }`}
                                          title={field.enabled ? "Hide field" : "Show field"}
                                        >
                                          <motion.div
                                            initial={false}
                                            animate={{ scale: field.enabled ? 1 : 0.8 }}
                                            transition={{ duration: 0.2 }}
                                          >
                                            {field.enabled ? (
                                              <MdVisibility size={20} />
                                            ) : (
                                              <MdVisibilityOff size={20} />
                                            )}
                                          </motion.div>
                                        </motion.button>
                                        <motion.div
                                          animate={{ rotate: expandedKey === field.key ? 180 : 0 }}
                                          className="text-gray-400"
                                        >
                                          <MdExpandMore size={20} />
                                        </motion.div>
                                      </div>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {expandedKey === field.key && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
                                      >
                                        <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 space-y-4">
                                          {field.enabled ? (
                                            <div className="space-y-4">
                                              {field.key.startsWith('field') && (
                                                (() => {
                                                  const fieldNum = parseInt(field.key.replace('field', ''));
                                                  const isCustomTemplate = definition.industry === "General Products (Custom)" || !definition.industry;
                                                  const isDynamicallyAdded = fieldNum > 10;
                                                  const canRemove = isCustomTemplate || isDynamicallyAdded;

                                                  return canRemove ? (
                                                    <div className="flex items-center justify-end">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          // For dynamically added fields in industry templates, delete the field
                                                          // For custom templates, just hide it
                                                          if (!isCustomTemplate && isDynamicallyAdded) {
                                                            removeField(field.key);
                                                          } else {
                                                            toggleFieldEnabled(field.key);
                                                          }
                                                        }}
                                                        className="flex items-center gap-1 text-red-500 hover:text-red-600 text-[10px] font-bold uppercase"
                                                      >
                                                        <FiTrash2 size={12} />
                                                        Remove Field
                                                      </button>
                                                    </div>
                                                  ) : null;
                                                })()
                                              )}

                                              {field.key.startsWith('field') && (
                                                <div className="space-y-2">
                                                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                    Show In
                                                  </label>
                                                  <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                      { key: 'shareImage', label: 'Share Image' },
                                                      { key: 'pdf', label: 'PDF' },
                                                      { key: 'orderLink', label: 'Order Link' },
                                                      { key: 'onlineStore', label: 'Online Store' },
                                                    ].map((surface) => {
                                                      const currentVisibility = field.visibility || DEFAULT_FIELD_VISIBILITY;
                                                      const enabled = (currentVisibility?.[surface.key] ?? true) === true;
                                                      return (
                                                        <motion.button
                                                          key={surface.key}
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateFieldSurfaceVisibility(field.key, surface.key);
                                                          }}
                                                          whileHover={{ scale: 1.02 }}
                                                          whileTap={{ scale: 0.98 }}
                                                          className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-between ${
                                                            enabled
                                                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                                              : "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                                          }`}
                                                        >
                                                          <span>{surface.label}</span>
                                                          {enabled ? <MdVisibility size={16} /> : <MdVisibilityOff size={16} />}
                                                        </motion.button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}

                                              {field.key.startsWith('field') && (
                                                <div className="space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                      Units
                                                    </label>
                                                    <motion.button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleUnitsEnabled(field.key);
                                                      }}
                                                      whileHover={{ scale: 1.2 }}
                                                      whileTap={{ scale: 0.95 }}
                                                      className="cursor-pointer transition-colors"
                                                      title={field.unitsEnabled ? "Disable units" : "Enable units"}
                                                    >
                                                      {field.unitsEnabled ? (
                                                        <MdToggleOn size={28} className="text-blue-600" />
                                                      ) : (
                                                        <MdToggleOff size={28} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-400" />
                                                      )}
                                                    </motion.button>
                                                  </div>

                                                  <AnimatePresence>
                                                    {field.unitsEnabled && (
                                                      <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="overflow-hidden"
                                                      >
                                                        <div className="relative pt-2">
                                                          <input
                                                            type="text"
                                                            value={
                                                              unitsTextDraft[field.key] !== undefined
                                                                ? unitsTextDraft[field.key]
                                                                : field.unitOptions?.join(", ") || ""
                                                            }
                                                            onChange={(e) => {
                                                              const v = e.target.value;
                                                              unitsTextDraftRef.current = {
                                                                ...unitsTextDraftRef.current,
                                                                [field.key]: v,
                                                              };
                                                              setUnitsTextDraft((prev) => ({
                                                                ...prev,
                                                                [field.key]: v,
                                                              }));
                                                            }}
                                                            onBlur={(e) => {
                                                              updateFieldUnits(field.key, e.target.value);
                                                              delete unitsTextDraftRef.current[field.key];
                                                              setUnitsTextDraft((prev) => {
                                                                const next = { ...prev };
                                                                delete next[field.key];
                                                                return next;
                                                              });
                                                            }}
                                                            placeholder={getUnitPlaceholder(field.label)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm outline-none transition-all dark:text-white"
                                                          />
                                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                                                            Separate options with commas. Saved when you leave this field.
                                                          </p>
                                                        </div>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="py-2 flex items-center gap-2 text-gray-400 italic text-xs justify-center">
                                              <span>Field is disabled. Enable to edit labels.</span>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              )}
                            </Draggable>
                            {/* Add New Field button after field 10 for industry templates */}
                            {!isCustomTemplate && field.key === "field10" && (
                              <motion.div
                                key="add-field-button"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                              >
                                <button
                                  onClick={handleAddField}
                                  className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-blue-500 hover:border-blue-200 dark:hover:border-blue-900 transition-all active:scale-[0.98] mt-3"
                                >
                                  <MdAdd size={24} />
                                  <span className="font-bold text-sm">Add New Field</span>
                                </button>
                              </motion.div>
                            )}
                          </motion.div>
                        ));
                        })()}
                        {/* Add New Field button for custom templates - always visible */}
                        {(() => {
                          const isCustomTemplate = definition.industry === "General Products (Custom)" || !definition.industry;
                          return isCustomTemplate ? (
                            <motion.div
                              key="add-field-button-custom"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                            >
                              <button
                                onClick={handleAddField}
                                className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-blue-500 hover:border-blue-200 dark:hover:border-blue-900 transition-all active:scale-[0.98]"
                              >
                                <MdAdd size={24} />
                                <span className="font-bold text-sm">Add New Field</span>
                              </button>
                            </motion.div>
                          ) : null;
                        })()}
                      </AnimatePresence>

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Price Field Units - Below Field Configuration */}
              <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Price Units</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default units for pricing</p>
                  </div>
                  <motion.button
                    onClick={() => setEditingPriceUnits(!editingPriceUnits)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      editingPriceUnits
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50"
                    }`}
                  >
                    {editingPriceUnits ? "Cancel" : "Edit"}
                  </motion.button>
                </div>

                <div className="p-4 space-y-3">
                  {!editingPriceUnits ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {priceUnits.map((unit, idx) => (
                          <span key={idx} className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg text-xs font-semibold">
                            ✓ {unit}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">These units are applied to all pricing fields</p>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {priceUnits.map((unit, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center gap-2"
                          >
                            {editingUnitIndex === idx ? (
                              <>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingUnitValue}
                                  onChange={(e) => setEditingUnitValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditingUnit(idx);
                                    if (e.key === 'Escape') setEditingUnitIndex(null);
                                  }}
                                  className="flex-1 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-xs bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <motion.button
                                  onClick={() => saveEditingUnit(idx)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                                  title="Save"
                                >
                                  <MdCheck size={16} />
                                </motion.button>
                                <motion.button
                                  onClick={() => setEditingUnitIndex(null)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </motion.button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {unit}
                                </span>
                                <motion.button
                                  onClick={() => startEditingUnit(idx)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                  title="Edit"
                                >
                                  <MdEdit size={16} />
                                </motion.button>
                                <motion.button
                                  onClick={() => deletePriceUnit(idx)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Delete"
                                >
                                  <FiTrash2 size={16} />
                                </motion.button>
                              </>
                            )}
                          </motion.div>
                        ))}
                      </div>

                      {/* Add New Unit Input */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Add New Unit</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newUnitInput}
                            onChange={(e) => setNewUnitInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addPriceUnit();
                            }}
                            placeholder="e.g. box, pallet (/ will be added automatically)"
                            className="flex-1 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded text-xs bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <motion.button
                            onClick={addPriceUnit}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-xs flex items-center gap-1 transition-colors"
                          >
                            <MdAdd size={16} />
                            Add
                          </motion.button>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="mt-4 flex gap-2">
                        <motion.button
                          onClick={savePriceUnits}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                        >
                          <MdSave size={16} />
                          Save Changes
                        </motion.button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Save Confirmation Modal */}
      {showSaveConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-sm w-full p-7 border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon */}
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <MdInfoOutline className="text-amber-600 dark:text-amber-400" size={28} />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-3">
              Confirm Field Changes
            </h2>

            {/* Warning Message */}
            <p className="text-gray-700 dark:text-gray-300 text-center text-sm mb-5 leading-relaxed">
              These changes will affect the current product fields across all your catalogues.
            </p>

            {/* Render Notice Box */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⚠️</span>
                <div>
                  <p className="text-amber-900 dark:text-amber-100 text-sm font-bold mb-1">
                    Render is Mandatory
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 text-xs leading-relaxed">
                    You must render images again to see the changes reflected in your shareable products.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={confirmSave}
                className="w-full px-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <MdCheck size={20} />
                Confirm & Save
              </button>
              <button
                onClick={() => setShowSaveConfirmation(false)}
                className="w-full px-4 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
