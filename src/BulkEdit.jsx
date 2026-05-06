import React, { useState, useEffect, useRef, useMemo } from "react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { useToast } from "./context/ToastContext";
import { useCloudWriteGate } from "./hooks/useCloudWriteGate";
import { getCatalogueData, setCatalogueData, isProductEnabledForCatalogue, normalizeOrderQuantityStep } from "./config/catalogueProductUtils";
import { offerPriceFieldFor } from "./utils/offerPriceUtils";
import { getAllCatalogues } from "./config/catalogueConfig";
import { getFieldConfig, getAllFields } from "./config/fieldConfig";
import { getPriceUnits } from "./utils/priceUnitsUtils";
import { logBulkEdit } from "./config/analyticsEvents";
import { saveProducts } from "./config/productUtils";
import OrderQuantityStepInput from "./components/OrderQuantityStepInput";
import { FiEdit2, FiGrid, FiX } from "react-icons/fi";

const getFieldOptions = (catalogueId, priceField, priceUnitField) => {
  const baseFields = [
    { key: "name", label: "Name" },
    { key: "subtitle", label: "Subtitle" },
    { key: "privateNotes", label: "Private Notes" },
  ];

  // Add all enabled product fields
  getAllFields()
    .filter(f => f.enabled && f.key.startsWith('field'))
    .forEach(field => {
      baseFields.push({ key: field.key, label: field.label });
    });

  baseFields.push({ key: "badge", label: "Badge" });
  baseFields.push({ key: "category", label: "Category" });

  // Add price field based on catalogue
  if (priceField) {
    baseFields.push({ key: priceField, label: 'Price' });
    baseFields.push({ key: offerPriceFieldFor(priceField), label: 'Offer' });
  }

  baseFields.push({ key: "stock", label: "Stock Update" });
  baseFields.push({ key: "orderQuantityStep", label: "Qty step" });
  return baseFields;
};

export default function BulkEdit({
  products,
  allProducts,
  imageMap,
  setProducts,
  onClose,
  triggerRender,
  catalogueId: initialCatalogueId,
  priceField: initialPriceField,
  priceUnitField: initialPriceUnitField,
  stockField: initialStockField,
  setShowAddProductsModal,
  autoSelectAllFields = false,
  autoStartEdit = false,
  scrollToProductIds = [],
  showOnlyProductIds = false,
}) {
  const [editedData, setEditedData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [step, setStep] = useState(initialCatalogueId ? "select" : "catalogue");
  const [showRenderPopup, setShowRenderPopup] = useState(false);
  const [selectedCatalogueId, setSelectedCatalogueId] = useState(initialCatalogueId || null);
  const [selectedCatalogueConfig, setSelectedCatalogueConfig] = useState(null);
  const [catalogues, setCatalogues] = useState([]);
  const [filledFromMaster, setFilledFromMaster] = useState({}); // Track which fields are filled from master
  const [confirmDialog, setConfirmDialog] = useState({ show: false, fieldKey: null }); // Confirmation dialog
  const [hasConfirmedFill, setHasConfirmedFill] = useState(false); // Track if user confirmed fill dialog once
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data has been loaded
  const { showToast } = useToast();
  const { guardCloudWrite } = useCloudWriteGate();

  // Use initial values or selected values
  const catalogueId = selectedCatalogueId || initialCatalogueId;
  const priceField = selectedCatalogueConfig?.priceField || initialPriceField;
  const priceUnitField = selectedCatalogueConfig?.priceUnitField || initialPriceUnitField;
  const stockField = selectedCatalogueConfig?.stockField || initialStockField;
  const offerField = priceField ? offerPriceFieldFor(priceField) : null;

  // Reset filledFromMaster when catalogue changes
  useEffect(() => {
    // For new catalogues, all fields start unchecked (empty)
    // For existing catalogues, fields with data start unchecked (since data is already loaded)
    setFilledFromMaster({});
  }, [catalogueId]);

  const totalProducts = products.length;
  const estimatedSeconds = totalProducts * 2; // or whatever estimate you use
  const FIELD_OPTIONS = getFieldOptions(catalogueId, priceField, priceUnitField);
  /** Edit grid columns follow getFieldOptions order, not checkbox selection order. */
  const selectedFieldsInDefaultOrder = useMemo(() => {
    const selected = new Set(selectedFields);
    return getFieldOptions(catalogueId, priceField, priceUnitField)
      .map((f) => f.key)
      .filter((key) => selected.has(key));
  }, [selectedFields, catalogueId, priceField, priceUnitField]);
  const tableScrollRef = useRef(null);
  const scrollToSet = useMemo(
    () => new Set((scrollToProductIds || []).map((id) => String(id))),
    [scrollToProductIds]
  );
  const visibleEditedData = useMemo(() => {
    if (!showOnlyProductIds || scrollToSet.size === 0) return editedData;
    return editedData.filter((item) => scrollToSet.has(String(item.id)));
  }, [editedData, showOnlyProductIds, scrollToSet]);

  useEffect(() => {
    if (!autoSelectAllFields || step !== "select" || FIELD_OPTIONS.length === 0) return;
    setSelectedFields((prev) => {
      const all = FIELD_OPTIONS.map((f) => f.key);
      if (all.length === prev.length && all.every((k) => prev.includes(k))) return prev;
      return all;
    });
  }, [autoSelectAllFields, step, FIELD_OPTIONS]);

  useEffect(() => {
    if (!autoStartEdit || step !== "select" || !dataLoaded || FIELD_OPTIONS.length === 0) return;
    if (!FIELD_OPTIONS.every((f) => selectedFields.includes(f.key))) return;
    setStep("edit");
  }, [autoStartEdit, step, dataLoaded, FIELD_OPTIONS, selectedFields]);

  useEffect(() => {
    if (step !== "edit" || scrollToSet.size === 0 || !tableScrollRef.current) return;
    const target = tableScrollRef.current.querySelector("[data-bulk-scroll-target='true']");
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [step, editedData, scrollToSet]);

  // Load catalogues on mount
  useEffect(() => {
    const cats = getAllCatalogues();
    setCatalogues(cats);
    // If initialCatalogueId is provided, set the config immediately
    if (initialCatalogueId) {
      const config = cats.find(c => c.id === initialCatalogueId);
      if (config) {
        setSelectedCatalogueConfig(config);
      }
    }
  }, [initialCatalogueId]);


useEffect(() => {
  if (dataLoaded) return;
  const storedCategories = JSON.parse(localStorage.getItem("categories") || "[]");
  setCategories(storedCategories);

  const normalized = products.map((p) => {
    // Get catalogue-specific data
    const catData = catalogueId ? getCatalogueData(p, catalogueId) : {};

    // Show field if it has data, otherwise leave empty
    const normalized = {
      ...p,
      // Keep product identity
      name: p.name || "",
      subtitle: p.subtitle || "",
      privateNotes: p.privateNotes || "",
      badge: catData.badge ?? (p.badge ?? ""),
      category: p.category || [],
      // Store original badge for fallback
      masterBadge: p.badge || "",
      wholesaleStock:
        typeof p.wholesaleStock === "boolean"
          ? p.wholesaleStock ? "in" : "out"
          : p.wholesaleStock || "",
    };

    // Dynamically copy all fieldX data from catalogue data
    for (let i = 1; i <= 10; i++) {
      const fieldKey = `field${i}`;
      const unitKey = `field${i}Unit`;
      normalized[fieldKey] = catData[fieldKey] || p[fieldKey] || "";
      normalized[unitKey] = catData[unitKey] || p[unitKey] || "None";
    }

    // Handle catalogue-specific stock field
    if (stockField && stockField !== 'wholesaleStock' && stockField !== 'resellStock') {
      normalized[stockField] = typeof p[stockField] === "boolean"
        ? p[stockField] ? "in" : "out"
        : (p[stockField] || "");
    }

    // Add price field for the current catalogue
    if (priceField) {
      normalized[priceField] = catData[priceField] || p[priceField] || p.price1 || p.wholesale || "";
      normalized[priceUnitField] = catData[priceUnitField] || p[priceUnitField] || p.price1Unit || p.wholesaleUnit || "/ piece";
      const of = offerPriceFieldFor(priceField);
      normalized[of] = catData[of] !== undefined && catData[of] !== null ? String(catData[of]) : "";
    }

    // Initialize other price fields - show if they exist
    normalized.wholesale = p.wholesale || "";
    normalized.wholesaleUnit = p.wholesaleUnit || "/ piece";
    normalized.stock = p.stock || "";
    normalized.orderQuantityStep = normalizeOrderQuantityStep(catData.orderQuantityStep);

    // Store master values for fallback/fill from master
    normalized.masterName = p.name || "";
    normalized.masterSubtitle = p.subtitle || "";
    normalized.masterPrivateNotes = p.privateNotes || "";
    normalized.masterCategory = p.category || [];
    normalized.masterWholesale = p.wholesale || "";
    normalized.masterWholesaleUnit = p.wholesaleUnit || "/ piece";

    return normalized;
  });

  setEditedData(normalized.map(item => ensureFieldDefaults(item)));
  console.log("loaded field1 for first product:", normalized[0]?.field1, normalized[0]?.field2);
  setDataLoaded(true);
}, [products, stockField, catalogueId, priceField, priceUnitField, initialCatalogueId]);





  // Ensure all fields have proper defaults
  const ensureFieldDefaults = (item) => {
    const defaults = {
      id: item.id,
      name: item.name ?? "",
      subtitle: item.subtitle ?? "",
      privateNotes: item.privateNotes ?? "",
      badge: item.badge ?? "",
      category: item.category ?? [],
      wholesale: item.wholesale ?? "",
      wholesaleUnit: item.wholesaleUnit ?? "/ piece",
      // Initialize all possible price fields to avoid undefined
      price: item.price ?? "",
      priceUnit: item.priceUnit ?? "/ piece",
      price1: item.price1 ?? "",
      price1Unit: item.price1Unit ?? "/ piece",
      wholesaleStock: item.wholesaleStock ?? "",
      stock: item.stock ?? "",
      image: item.image ?? "",
      imagePath: item.imagePath ?? "",
    };

    // Add all fieldX slots to defaults
    for (let i = 1; i <= 10; i++) {
      defaults[`field${i}`] = item[`field${i}`] ?? "";
      defaults[`field${i}Unit`] = item[`field${i}Unit`] ?? "None";
    }

    // Also ensure dynamic price field is initialized
    if (priceField && !(priceField in defaults)) {
      defaults[priceField] = item[priceField] ?? "";
    }
    if (priceUnitField && !(priceUnitField in defaults)) {
      defaults[priceUnitField] = item[priceUnitField] ?? "/ piece";
    }
    if (priceField) {
      const of = offerPriceFieldFor(priceField);
      if (!(of in defaults)) {
        defaults[of] = item[of] ?? "";
      }
    }
    if (stockField && !(stockField in defaults)) {
      defaults[stockField] = item[stockField] ?? "";
    }
    defaults.orderQuantityStep = normalizeOrderQuantityStep(item.orderQuantityStep);

    // Merge with item, ensuring all values are defined
    const result = { ...defaults };
    Object.entries(item).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    });

    return result;
  };

  const handleFieldChange = (id, field, value) => {
    setEditedData((prev) =>
      prev.map((item) => (item.id === id ? ensureFieldDefaults({ ...item, [field]: value }) : item))
    );
  };

  const toggleFillFromMaster = (fieldKey) => {
    const newState = !filledFromMaster[fieldKey];

    if (newState) {
      // Show confirmation before filling from master, but only once per session
      if (hasConfirmedFill) {
        confirmFillFromMaster(fieldKey);
      } else {
        setConfirmDialog({ show: true, fieldKey });
      }
    } else {
      // Directly empty the field without confirmation
      setFilledFromMaster((prev) => ({ ...prev, [fieldKey]: false }));

      setEditedData((prev) =>
        prev.map((item) => {
          const updates = {};

          if (fieldKey.startsWith('field')) {
            updates[fieldKey] = "";
            updates[`${fieldKey}Unit`] = "None";
          } else if (fieldKey === "badge") {
            updates.badge = "";
          } else if (fieldKey === priceField) {
            updates[priceField] = "";
            updates[priceUnitField] = "/ piece";
          } else if (offerField && fieldKey === offerField) {
            updates[offerField] = "";
          } else if (fieldKey === "wholesale") {
            updates.wholesale = "";
            updates.wholesaleUnit = "/ piece";
          } else if (fieldKey === "name") {
            updates.name = "";
          } else if (fieldKey === "subtitle") {
            updates.subtitle = "";
          } else if (fieldKey === "privateNotes") {
            updates.privateNotes = "";
          } else if (fieldKey === "category") {
            updates.category = [];
          } else if (fieldKey === "stock") {
            updates[stockField] = "out";
          } else if (fieldKey === "orderQuantityStep") {
            updates.orderQuantityStep = 1;
          }

          return ensureFieldDefaults({ ...item, ...updates });
        })
      );
    }
  };

  const confirmFillFromMaster = (fieldKey) => {
    const masterCatalogue = catalogues[0];
    if (!masterCatalogue) return;
    const masterCatalogueId = masterCatalogue.id;

    setFilledFromMaster((prev) => ({ ...prev, [fieldKey]: true }));

    setEditedData((prev) =>
      prev.map((item) => {
        const masterData = getCatalogueData(item, masterCatalogueId);
        const updates = {};

        if (fieldKey.startsWith('field')) {
          updates[fieldKey] = masterData[fieldKey] || "";
          updates[`${fieldKey}Unit`] = masterData[`${fieldKey}Unit`] || "None";
        } else if (fieldKey === "badge") {
          updates.badge = masterData.badge || item.masterBadge || "";
        } else if (fieldKey === priceField) {
          // Fill current catalogue's price field with master catalogue's price field data
          updates[priceField] = masterData[masterCatalogue.priceField] || "";
          updates[priceUnitField] = masterData[masterCatalogue.priceUnitField] || "/ piece";
        } else if (offerField && fieldKey === offerField) {
          const masterOfferKey = offerPriceFieldFor(masterCatalogue.priceField);
          const raw = masterData[masterOfferKey];
          updates[offerField] =
            raw !== undefined && raw !== null ? String(raw) : "";
        } else if (fieldKey === "wholesale") {
          updates.wholesale = item.masterWholesale || "";
          updates.wholesaleUnit = item.masterWholesaleUnit || "/ piece";
        } else if (fieldKey === "name") {
          updates.name = item.masterName || "";
        } else if (fieldKey === "subtitle") {
          updates.subtitle = item.masterSubtitle || "";
        } else if (fieldKey === "privateNotes") {
          updates.privateNotes = item.masterPrivateNotes || "";
        } else if (fieldKey === "category") {
          updates.category = item.masterCategory || [];
        } else if (fieldKey === "stock") {
          const masterStockVal = masterData[masterCatalogue.stockField];
          updates[stockField] = typeof masterStockVal === "boolean"
            ? (masterStockVal ? "in" : "out")
            : (masterStockVal || "in");
        } else if (fieldKey === "orderQuantityStep") {
          updates.orderQuantityStep = normalizeOrderQuantityStep(masterData.orderQuantityStep);
        }

        return ensureFieldDefaults({ ...item, ...updates });
      })
    );

    setHasConfirmedFill(true);
    setConfirmDialog({ show: false, fieldKey: null });
  };

  const toggleCategory = (id, cat) => {
    setEditedData((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current = Array.isArray(item.category) ? item.category : [];
        return ensureFieldDefaults({
          ...item,
          category: current.includes(cat)
            ? current.filter((c) => c !== cat)
            : [...current, cat],
        });
      })
    );
  };

   const handleSave = () => {
  try {
    if (!guardCloudWrite()) return;
    const cleanData = editedData.map((p) => {
  let copy = { ...p };

  if (typeof copy.wholesaleStock === "string") {
    copy.wholesaleStock = copy.wholesaleStock === "in";
  }

  if (stockField && stockField !== 'wholesaleStock' && stockField !== 'resellStock') {
    if (typeof copy[stockField] === "string") {
      copy[stockField] = copy[stockField] === "in";
    }
  }

  const catUpdates = {
    badge: p.badge ?? "",
    [priceField]: priceField ? (p[priceField] ?? "") : undefined,
    [priceUnitField]: priceField ? (p[priceUnitField] ?? "/ piece") : undefined,
    ...(priceField
      ? { [offerPriceFieldFor(priceField)]: p[offerPriceFieldFor(priceField)] ?? "" }
      : {}),
    [stockField]: stockField ? (typeof p[stockField] === "string" ? p[stockField] === "in" : p[stockField]) : undefined,
    orderQuantityStep: normalizeOrderQuantityStep(p.orderQuantityStep),
  };

  for (let i = 1; i <= 10; i++) {
    catUpdates[`field${i}`] = p[`field${i}`] ?? "";
    catUpdates[`field${i}Unit`] = p[`field${i}Unit`] ?? "None";
  }

      copy = setCatalogueData(copy, catalogueId, catUpdates);
  console.log("after save field1:", copy.field1, "cat1 field1:", copy.catalogueData?.cat1?.field1);
  

  for (let i = 1; i <= 10; i++) {
    copy[`field${i}`] = p[`field${i}`] ?? "";
    copy[`field${i}Unit`] = p[`field${i}Unit`] ?? "None";
  }

  copy.price1 = p[priceField] ?? p.price1 ?? "";
  copy.price1Unit = p[priceUnitField] ?? p.price1Unit ?? "/ piece";
  copy.wholesale = p[priceField] ?? p.wholesale ?? "";
  copy.wholesaleUnit = p[priceUnitField] ?? p.wholesaleUnit ?? "/ piece";
  copy.badge = p.badge ?? "";

  return copy;
});

    // Merge edited products back into allProducts to preserve products not in this catalogue
    const editedIds = new Set(cleanData.map(p => p.id));
    const mergedData = allProducts ? allProducts.map(p =>
      editedIds.has(p.id) ? cleanData.find(edited => edited.id === p.id) : p
    ) : cleanData;

    // Validate data before saving
    try {
      JSON.stringify(mergedData);
    } catch (jsonErr) {
      throw new Error(`Data validation failed: ${jsonErr.message}`);
    }
const productToCheck = mergedData.find(p => p.field1);
  console.log("mergedData field1:", productToCheck?.field1, "cat1:", productToCheck?.catalogueData?.cat1?.field1);
  saveProducts(mergedData);
    // Save products (this will sync to Supabase and localStorage)
    saveProducts(mergedData);
    setProducts(mergedData);
    window.dispatchEvent(new CustomEvent("product-added"));
    logBulkEdit(cleanData.length, selectedFields.length);
    setShowRenderPopup(true);
  } catch (err) {
    console.error("Save failed:", err);

    // Provide specific error messages
    let errorMessage = "Something went wrong during save.";

    if (err.name === "QuotaExceededError") {
      errorMessage = "Storage quota exceeded. Try deleting some products or clearing old backups.";
    } else if (err.message?.includes("Data validation failed")) {
      errorMessage = "Data format error. Try refreshing and making smaller changes.";
    } else if (err.message?.includes("setCatalogueData")) {
      errorMessage = "Failed to process catalogue data. Please check the form values.";
    }

    showToast(errorMessage, "error");
  }
};

  /** Fixed width per field column; horizontal scroll on narrow screens */
  const bulkFieldCol =
    "min-w-[190px] max-w-[240px] w-[190px] shrink-0";

  /** Shared field control look — visual only */
  const cellInput =
    "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-shadow";
  const cellInputFlex =
    "min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-shadow";
  const unitSelect =
    "rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-6 shrink-0 w-16 text-xs leading-5 text-slate-700 shadow-sm overflow-hidden text-ellipsis whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";

  const renderBulkFieldHeader = (field) => {
    const fieldLabel = FIELD_OPTIONS.find((f) => f.key === field)?.label;
    const isFilledFromMaster = !!filledFromMaster[field];
    const hideFillBox = field === "name" || field === "subtitle" || field === "privateNotes";

    return (
      <div className={`flex items-center gap-1.5 ${bulkFieldCol}`}>
        {!hideFillBox && (
          <input
            type="checkbox"
            checked={isFilledFromMaster}
            onChange={() => toggleFillFromMaster(field)}
            title={isFilledFromMaster ? "Uncheck to clear all values" : "Check to fill from Master catalogue"}
            className="h-4 w-4 shrink-0 rounded border border-slate-300 text-emerald-600 focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
          />
        )}
        <span className="truncate font-medium text-slate-700">{fieldLabel}</span>
      </div>
    );
  };

  const renderBulkFieldCell = (item, field) => {
    if (field === "name") {
      return (
        <input
          value={item.name ?? ""}
          onChange={(e) => handleFieldChange(item.id, "name", e.target.value)}
          className={cellInput}
        />
      );
    }
    if (field === "subtitle") {
      return (
        <input
          value={item.subtitle ?? ""}
          onChange={(e) => handleFieldChange(item.id, "subtitle", e.target.value)}
          className={cellInput}
        />
      );
    }
    if (field === "privateNotes") {
      return (
        <input
          value={item.privateNotes ?? ""}
          onChange={(e) => handleFieldChange(item.id, "privateNotes", e.target.value)}
          className={cellInput}
          placeholder="Private Notes"
        />
      );
    }

    if (field.startsWith("field")) {
      const fieldDef = getAllFields().find((f) => f.enabled && f.key === field);
      if (!fieldDef) return null;
      return (
        <div className="flex gap-2 w-full min-w-0">
          <input
            value={item[field] ?? ""}
            onChange={(e) => handleFieldChange(item.id, field, e.target.value)}
            className={cellInputFlex}
            placeholder={fieldDef.label}
          />
          {fieldDef.unitsEnabled && fieldDef.unitOptions && fieldDef.unitOptions.length > 0 && (
            <select
              value={item[`${field}Unit`] ?? "None"}
              onChange={(e) => handleFieldChange(item.id, `${field}Unit`, e.target.value)}
              className={unitSelect}
            >
              <option value="None">None</option>
              {fieldDef.unitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }

    if (priceField && field === priceField) {
      return (
        <div className="flex gap-2 w-full min-w-0">
          <input
            value={item[priceField] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                handleFieldChange(item.id, priceField, val);
              }
            }}
            className={cellInputFlex}
            placeholder="Price"
            inputMode="decimal"
          />
          {(() => {
            const config = getFieldConfig(priceField);
            return (config ? config.unitsEnabled : true) && (
              <select
                value={item[priceUnitField] ?? getPriceUnits()[0]}
                onChange={(e) => handleFieldChange(item.id, priceUnitField, e.target.value)}
                className={unitSelect}
              >
                {getPriceUnits().map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            );
          })()}
        </div>
      );
    }

    if (offerField && field === offerField) {
      return (
        <input
          value={item[offerField] ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*\.?\d*$/.test(val)) {
              handleFieldChange(item.id, offerField, val);
            }
          }}
          className={cellInput}
          placeholder="Offer"
          inputMode="decimal"
        />
      );
    }

    if (field === "wholesale") {
      return (
        <div className="flex gap-2 w-full min-w-0">
          <input
            value={item.wholesale ?? ""}
            onChange={(e) => handleFieldChange(item.id, "wholesale", e.target.value)}
            className={cellInputFlex}
          />
          <select
            value={item.wholesaleUnit ?? getPriceUnits()[0]}
            onChange={(e) => handleFieldChange(item.id, "wholesaleUnit", e.target.value)}
            className={unitSelect}
          >
            {getPriceUnits().map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field === "badge") {
      return (
        <input
          value={item.badge ?? ""}
          onChange={(e) => handleFieldChange(item.id, "badge", e.target.value)}
          placeholder="Enter badge"
          className={cellInput}
        />
      );
    }

    if (field === "category") {
      return (
        <div className="max-h-[5rem] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200/80 bg-slate-50/50 p-1.5">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <div
                key={cat}
                onClick={() => toggleCategory(item.id, cat)}
                className={`px-2 py-0.5 rounded-full text-[11px] cursor-pointer transition border shadow-sm ${
                  Array.isArray(item.category) && item.category.includes(cat)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {cat}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (field === "stock") {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              handleFieldChange(item.id, stockField, (item[stockField] ?? "") === "in" ? "out" : "in")
            }
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shadow-sm transition ${
              (item[stockField] ?? "") === "in"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-slate-200 text-slate-800 hover:bg-slate-300"
            }`}
          >
            {(item[stockField] ?? "") === "in" ? "In" : "Out"}
          </button>
        </div>
      );
    }

    if (field === "orderQuantityStep") {
      return (
        <OrderQuantityStepInput
          value={item.orderQuantityStep ?? 1}
          onCommit={(next) => handleFieldChange(item.id, "orderQuantityStep", next)}
          className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          title="Minimum order quantity step (1 = any quantity)"
          aria-label="Qty step"
        />
      );
    }

    return null;
  };

  // Catalogue selection step
  if (step === "catalogue") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm px-4"
      onClick={onClose}
      >
  <div className="bg-white border border-slate-200/90 p-6 sm:p-7 rounded-2xl shadow-2xl w-full max-w-md"
  onClick={(e) => e.stopPropagation()}
  >
    <div className="flex justify-between items-start gap-3 mb-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Select catalogue</h2>
        <p className="text-xs text-slate-500 mt-1">Choose which catalogue to edit in bulk</p>
      </div>
      <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition" aria-label="Close">
        <FiX size={20} />
      </button>
    </div>

    <div className="space-y-2.5 text-slate-700 max-h-[min(60vh,28rem)] overflow-y-auto pr-0.5">
      {catalogues.map((cat) => {
        // Filter products for this catalogue
        const productsForCat = allProducts ? allProducts.filter(p => isProductEnabledForCatalogue(p, cat.id)) : [];

        return (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatalogueId(cat.id);
              setSelectedCatalogueConfig(cat);

              // Filter products to show only those enabled for this catalogue
              if (allProducts) {
                const filtered = allProducts.filter(p => isProductEnabledForCatalogue(p, cat.id));
                // Update editedData with filtered products
                const normalized = filtered.map((p) => {
                  const catData = getCatalogueData(p, cat.id);
                  const normalized = {
                    ...p,
                    badge: catData.badge || p.badge || "",
                    masterBadge: p.badge || "",
                    wholesaleStock: typeof p.wholesaleStock === "boolean" ? p.wholesaleStock ? "in" : "out" : p.wholesaleStock,
                    resellStock: typeof p.resellStock === "boolean" ? p.resellStock ? "in" : "out" : p.resellStock,
                    masterName: p.name || "",
                    masterSubtitle: p.subtitle || "",
                    masterCategory: p.category || [],
                    masterWholesale: p.wholesale || "",
                    masterWholesaleUnit: p.wholesaleUnit || "/ piece",
                  };

                  // Copy all fieldX slots
                  for (let i = 1; i <= 10; i++) {
                    const fieldKey = `field${i}`;
                    const unitKey = `field${i}Unit`;
                    normalized[fieldKey] = catData[fieldKey] || p[fieldKey] || "";
                    normalized[unitKey] = catData[unitKey] || p[unitKey] || "None";
                  }

                  if (cat.stockField && cat.stockField !== 'wholesaleStock' && cat.stockField !== 'resellStock') {
                    normalized[cat.stockField] = typeof p[cat.stockField] === "boolean" ? p[cat.stockField] ? "in" : "out" : p[cat.stockField];
                  }

                  if (cat.priceField) {
                    normalized[cat.priceField] = catData[cat.priceField] || p[cat.priceField] || "";
                    normalized[cat.priceUnitField] = catData[cat.priceUnitField] || p[cat.priceUnitField] || "/ piece";
                    const of = offerPriceFieldFor(cat.priceField);
                    const raw = catData[of];
                    normalized[of] =
                      raw !== undefined && raw !== null ? String(raw) : (p[of] ?? "");
                  }

                  normalized.orderQuantityStep = normalizeOrderQuantityStep(catData.orderQuantityStep);

                  return normalized;
                });
                setEditedData(normalized);
              }

              setStep("select");
            }}
            className="w-full text-left px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-blue-400 hover:shadow-md transition text-left"
          >
            <div className="font-semibold text-slate-900">{cat.label}</div>
            <div className="text-xs text-slate-500 mt-1">{productsForCat.length} products</div>
          </button>
        );
      })}
    </div>
  </div>
</div>

    );
  }

  if (step === "select") {
    // If we have initialCatalogueId but data not loaded yet, show loading
    if (initialCatalogueId && !dataLoaded) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 px-8 py-6 rounded-2xl shadow-xl">
            <div className="text-center text-sm font-medium text-slate-600">Loading…</div>
          </div>
        </div>
      );
    }

    // If data is loaded but no visible products
    if (initialCatalogueId && dataLoaded && products.length === 0 && allProducts.length > 0) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm px-4"
        onClick={onClose}
        >
          <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-2xl w-full max-w-sm text-center"
          onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <div className="inline-block p-3 bg-yellow-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">No products in this catalogue</h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              No products are currently visible in this catalogue. Click below to add products from your master list.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => {
                  if (setShowAddProductsModal) setShowAddProductsModal(true);
                  onClose();
                }}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Products
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-800 text-sm rounded-xl hover:bg-slate-200 transition font-semibold border border-slate-200/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm px-3 sm:px-4 py-6"
      onClick={onClose}
      >
  <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-2xl w-full max-w-xl"
  onClick={(e) => e.stopPropagation()}
  >
    <div className="flex justify-between items-start gap-3 mb-3 sm:mb-4">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Fields to edit</h2>
        {selectedCatalogueConfig && (
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-0.5">{selectedCatalogueConfig.label}</p>
        )}
      </div>
      <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition shrink-0" aria-label="Close">
        <FiX size={18} />
      </button>
    </div>

    {/* Two columns for readable labels on narrow screens; no inner scroll */}
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-slate-800">
      {FIELD_OPTIONS.map((opt) => (
        <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200/90 bg-slate-50/80 px-2 py-1.5 sm:px-2.5 sm:py-2 hover:bg-white hover:border-slate-300 transition min-w-0">
  <input
    type="checkbox"
    className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40"
    checked={selectedFields.includes(opt.key)}
    onChange={(e) => {
      setSelectedFields((prev) =>
        e.target.checked
          ? [...prev, opt.key]
          : prev.filter((k) => k !== opt.key)
      );
    }}
  />
  <span className="text-[11px] sm:text-xs font-medium text-slate-800 leading-tight truncate">{opt.label}</span>
</label>
      ))}
    </div>

    <div className="flex justify-between gap-3 mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100">
      {!initialCatalogueId && (
        <button
          type="button"
          onClick={() => {
            setStep("catalogue");
            setSelectedFields([]);
          }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition border border-slate-200/80"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={() => setStep("edit")}
        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
          selectedFields.length === 0
            ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/25"
        }`}
        disabled={selectedFields.length === 0}
      >
        Continue
      </button>
    </div>
  </div>
</div>

    );
  }
  return (
  <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
    <div className="sticky top-0 h-[40px] bg-black z-50"></div>
    <header className="sticky top-[40px] z-40 bg-white border-b border-slate-200/90 shadow-sm min-h-[3.5rem] flex items-center justify-between gap-3 px-4 py-2.5 relative">
  <div className="flex items-center gap-2.5 min-w-0">
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
      <FiGrid size={18} strokeWidth={2.25} aria-hidden />
    </span>
    <div className="min-w-0">
      <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
        Bulk Editor
      </h1>
      {selectedCatalogueConfig?.label && (
        <p className="text-[11px] font-medium text-slate-500 truncate">{selectedCatalogueConfig.label}</p>
      )}
    </div>
  </div>
  <button
    type="button"
    onClick={() => setStep("select")}
    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-indigo-700 bg-gradient-to-br from-indigo-50 via-white to-indigo-100 border border-indigo-200 rounded-xl shadow-sm hover:from-indigo-100 hover:to-indigo-200 hover:shadow transition-all shrink-0"
  >
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white border border-indigo-200 text-indigo-600">
      <FiEdit2 size={14} strokeWidth={2.25} aria-hidden />
    </span>
    <span>Edit Fields</span>
  </button>
</header>


    {/* No horizontal padding-left here — padding caused a gap where scrolled cells painted beside the sticky # column */}
    <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pr-2 sm:pr-4">
      <div className="min-w-max pb-3 pt-2">
        <div className="sticky top-0 z-[35] flex border-b border-slate-200 bg-slate-100 font-semibold text-[11px] uppercase tracking-wide text-slate-600 shadow-sm">
          <div className="sticky left-0 z-[50] flex w-[96px] shrink-0 items-stretch border-r border-slate-200 bg-slate-100 px-1 py-2.5 shadow-[6px_0_12px_-8px_rgba(0,0,0,0.12)]">
            <div className="flex w-8 shrink-0 items-center justify-center text-center">#</div>
            <div className="flex w-16 shrink-0 items-center justify-center text-center normal-case tracking-normal font-semibold">Image</div>
          </div>
          <div className="flex gap-2 py-2.5 pr-1 pl-2">
            {selectedFieldsInDefaultOrder.map((field) => (
              <React.Fragment key={field}>{renderBulkFieldHeader(field)}</React.Fragment>
            ))}
          </div>
        </div>

        {visibleEditedData.length === 0 ? (
          <div className="text-center py-12 text-sm font-medium text-slate-500">Loading…</div>
        ) : (
          visibleEditedData.map((item, index) => {
            const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50/80";
            return (
            <div
              key={item.id}
              data-bulk-scroll-target={scrollToSet.has(String(item.id)) ? "true" : undefined}
              className={`flex border-b border-slate-100 text-sm ${rowBg}`}
            >
              <div className={`sticky left-0 z-[30] flex w-[96px] shrink-0 items-center border-r border-slate-200 px-1 py-2 shadow-[6px_0_12px_-8px_rgba(0,0,0,0.08)] ${rowBg}`}>
                <div className="flex w-8 shrink-0 items-center justify-center text-xs font-semibold text-slate-500 tabular-nums">
                  {index + 1}
                </div>
                <div className="flex w-16 shrink-0 items-center justify-center pr-4">
                  {imageMap[item.id] || item.imageUrl ? (
                    <img
                      src={imageMap[item.id] || item.imageUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg border border-slate-200 object-contain bg-white shadow-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const el = e.currentTarget.parentElement;
                        if (el)
                          el.innerHTML =
                            '<div class="text-gray-400 text-[10px] text-center leading-tight">No img</div>';
                      }}
                    />
                  ) : (
                    <div className="text-center text-[10px] leading-tight text-slate-400">No img</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 py-2 pl-2 pr-1 items-center">
                {selectedFieldsInDefaultOrder.map((field) => (
                  <div key={`${item.id}-${field}`} className={bulkFieldCol}>
                    {renderBulkFieldCell(item, field)}
                  </div>
                ))}
              </div>
            </div>
          );
          })
        )}
      </div>
    </div>

      <div className="shrink-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 flex justify-end gap-2.5 px-4 py-3.5 z-20 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] pb-[max(0.875rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
      >
        Cancel
      </button>
       <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-600/20"
        >
          Save changes
        </button>
      </div>
      {showRenderPopup && (
  <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center px-4">
    <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-2xl w-full max-w-sm text-center">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Render images?</h2>

      <p className="text-sm text-slate-600 mb-2 leading-relaxed">
        Your changes are saved. Render catalogue images now?
      </p>

      <p className="text-sm text-slate-500 mb-5">
        Est. <span className="font-semibold text-slate-700">{estimatedSeconds}</span>s · {totalProducts} products
      </p>

      <div className="flex flex-col sm:flex-row justify-center gap-2.5 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition text-sm"
          onClick={() => {
            setShowRenderPopup(false);
            triggerRender?.();
            setTimeout(onClose, 100);
          }}
        >
          Render now
        </button>

        <button
          type="button"
          className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200 hover:bg-slate-200 transition text-sm"
          onClick={() => {
    setShowRenderPopup(false);
    onClose(); // ✅ Close the Bulk Editor
  }}
        >
          Maybe later
        </button>
      </div>
    </div>
  </div>
)}

{confirmDialog.show && (
  <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center px-4">
    <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-2xl w-full max-w-sm text-center">
      <h2 className="text-lg font-bold text-slate-900 mb-3">Fill from Master catalogue?</h2>

      <p className="text-sm text-slate-600 mb-5 leading-relaxed">
        This will overwrite the current field for <span className="font-semibold text-slate-800">all products</span> with data from the master catalogue.
      </p>

      <div className="flex flex-col-reverse sm:flex-row justify-center gap-2.5">
        <button
          type="button"
          className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200 hover:bg-slate-200 transition text-sm"
          onClick={() => setConfirmDialog({ show: false, fieldKey: null })}
        >
          Cancel
        </button>

        <button
          type="button"
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition text-sm"
          onClick={() => confirmFillFromMaster(confirmDialog.fieldKey)}
        >
          Yes, fill
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
