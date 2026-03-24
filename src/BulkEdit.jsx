import React, { useState, useEffect } from "react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { useToast } from "./context/ToastContext";
import { getCatalogueData, setCatalogueData, isProductEnabledForCatalogue, normalizeOrderQuantityStep } from "./config/catalogueProductUtils";
import { getAllCatalogues } from "./config/catalogueConfig";
import { getFieldConfig, getAllFields } from "./config/fieldConfig";
import { getPriceUnits } from "./utils/priceUnitsUtils";
import { logBulkEdit } from "./config/analyticsEvents";
import { saveProducts } from "./config/productUtils";

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
  }

  baseFields.push({ key: "stock", label: "Stock Update" });
  baseFields.push({ key: "orderQuantityStep", label: "Qty step" });
  return baseFields;
};

export default function BulkEdit({ products, allProducts, imageMap, setProducts, onClose, triggerRender, catalogueId: initialCatalogueId, priceField: initialPriceField, priceUnitField: initialPriceUnitField, stockField: initialStockField, setShowAddProductsModal }) {
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

  // Use initial values or selected values
  const catalogueId = selectedCatalogueId || initialCatalogueId;
  const priceField = selectedCatalogueConfig?.priceField || initialPriceField;
  const priceUnitField = selectedCatalogueConfig?.priceUnitField || initialPriceUnitField;
  const stockField = selectedCatalogueConfig?.stockField || initialStockField;

  // Reset filledFromMaster when catalogue changes
  useEffect(() => {
    // For new catalogues, all fields start unchecked (empty)
    // For existing catalogues, fields with data start unchecked (since data is already loaded)
    setFilledFromMaster({});
  }, [catalogueId]);

  const totalProducts = products.length;
  const estimatedSeconds = totalProducts * 2; // or whatever estimate you use
  const FIELD_OPTIONS = getFieldOptions(catalogueId, priceField, priceUnitField);

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
      badge: catData.badge || p.badge || "",
      category: p.category || [],
      // Store original badge for fallback
      masterBadge: p.badge || "",
      wholesaleStock:
        typeof p.wholesaleStock === "boolean"
          ? p.wholesaleStock ? "in" : "out"
          : p.wholesaleStock || "",
    };

    // Dynamically copy all fieldX data
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
      normalized[priceField] = catData[priceField] || "";
      normalized[priceUnitField] = catData[priceUnitField] || "/ piece";
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
    const cleanData = editedData.map((p) => {
  let copy = { ...p };
  // Preserve image field to maintain product-to-image associations

  // Convert stock fields from string → boolean
  if (typeof copy.wholesaleStock === "string") {
    copy.wholesaleStock = copy.wholesaleStock === "in";
  }

  // Handle catalogue-specific stock field
  if (stockField && stockField !== 'wholesaleStock' && stockField !== 'resellStock') {
    if (typeof copy[stockField] === "string") {
      copy[stockField] = copy[stockField] === "in";
    }
  }

  // Save catalogue-specific data
  const catUpdates = {
    badge: p.badge,
    [priceField]: priceField ? p[priceField] : undefined,
    [priceUnitField]: priceField ? p[priceUnitField] : undefined,
    [stockField]: stockField ? (typeof p[stockField] === "string" ? p[stockField] === "in" : p[stockField]) : undefined,
    orderQuantityStep: normalizeOrderQuantityStep(p.orderQuantityStep),
  };

  // Save all fieldX slots
  for (let i = 1; i <= 10; i++) {
    catUpdates[`field${i}`] = p[`field${i}`];
    catUpdates[`field${i}Unit`] = p[`field${i}Unit`];
  }

  copy = setCatalogueData(copy, catalogueId, catUpdates);

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

  // Catalogue selection step
  if (step === "catalogue") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-lg px-4"
      onClick={onClose}
      >
  <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-md"
  onClick={(e) => e.stopPropagation()}
  >
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-bold text-gray-800">Select Catalogue to Edit</h2>
      <button onClick={onClose} className="text-2xl text-gray-600 hover:text-red-500">×</button>
    </div>

    <div className="space-y-2 text-gray-700">
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
                  }

                  normalized.orderQuantityStep = normalizeOrderQuantityStep(catData.orderQuantityStep);

                  return normalized;
                });
                setEditedData(normalized);
              }

              setStep("select");
            }}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-500 transition"
          >
            <div className="font-medium text-gray-800">{cat.label}</div>
            <div className="text-xs text-gray-500 mt-1">{productsForCat.length} products</div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-lg">
          <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl">
            <div className="text-center text-gray-600">Loading...</div>
          </div>
        </div>
      );
    }

    // If data is loaded but no visible products
    if (initialCatalogueId && dataLoaded && products.length === 0 && allProducts.length > 0) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-lg px-4"
        onClick={onClose}
        >
          <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-center"
          onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <div className="inline-block p-3 bg-yellow-100 rounded-full mb-3">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No Products in This Catalogue</h2>
            <p className="text-sm text-gray-600 mb-4">
              No products are currently visible in this catalogue. Click below to add products from your master list.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (setShowAddProductsModal) setShowAddProductsModal(true);
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Products
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 text-sm rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-lg px-4"
      onClick={onClose}
      >
  <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-md"
  onClick={(e) => e.stopPropagation()}
  >
    <div className="flex justify-between items-center mb-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Select Fields to Edit</h2>
        {selectedCatalogueConfig && <p className="text-xs text-gray-500 mt-1">{selectedCatalogueConfig.label}</p>}
      </div>
      <button onClick={onClose} className="text-2xl text-gray-600 hover:text-red-500">×</button>
    </div>

    <div className="grid grid-cols-2 gap-3 text-gray-700">
      {FIELD_OPTIONS.map((opt) => (
        <label key={opt.key} className="flex items-center gap-3 cursor-pointer text-gray-800">
  <input
    type="checkbox"
    className="appearance-none w-5 h-5 border-2 border-gray-400 rounded-sm checked:bg-blue-600 checked:border-blue-600 transition duration-200"
    checked={selectedFields.includes(opt.key)}
    onChange={(e) => {
      setSelectedFields((prev) =>
        e.target.checked
          ? [...prev, opt.key]
          : prev.filter((k) => k !== opt.key)
      );
    }}
  />
  <span className="text-sm">{opt.label}</span>
</label>
      ))}
    </div>

    <div className="flex justify-between gap-3 mt-6">
      {!initialCatalogueId && (
        <button
          onClick={() => {
            setStep("catalogue");
            setSelectedFields([]);
          }}
          className="px-4 py-2 rounded-full text-sm font-medium bg-gray-300 text-gray-800 hover:bg-gray-400 transition shadow"
        >
          Back
        </button>
      )}
      <button
        onClick={() => setStep("edit")}
        className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition shadow ${
          selectedFields.length === 0
            ? "bg-blue-400 text-white cursor-not-allowed"
            : "bg-blue-700 text-white hover:bg-blue-800"
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
  console.log("imageMap", imageMap);
  return (
  <div className="fixed inset-0 bg-white z-50 flex flex-col">
    <div className="sticky top-0 h-[40px] bg-black z-50"></div>
    <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center justify-between gap-3 px-4 relative">
  <h1 className="text-lg sm:text-xl font-semibold text-gray-800 tracking-tight">
    🛠️ Bulk Editor
  </h1>
  <button
    onClick={() => setStep("select")}
    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition"
  >
    <span>✏️</span>
    <span>Edit Fields</span>
  </button>
</header>


    <div className="flex-1 overflow-auto px-4">
        <div className="grid grid-cols-[32px_64px_repeat(auto-fill,minmax(190px,1fr))] gap-2 font-semibold text-xs py-2 border-b">
          <div>#</div>
          <div>Image</div>
          {selectedFields.map((field) => {
            const fieldLabel = FIELD_OPTIONS.find((f) => f.key === field)?.label;
            const isFilledFromMaster = !!filledFromMaster[field];
            const hideFillBox = field === "name" || field === "subtitle" || field === "privateNotes";

            return (
              <div key={field} className="flex items-center gap-1">
                {!hideFillBox && (
                  <input
                    type="checkbox"
                    checked={isFilledFromMaster}
                    onChange={() => toggleFillFromMaster(field)}
                    title={isFilledFromMaster ? "Uncheck to clear all values" : "Check to fill from Master catalogue"}
                    className="appearance-none w-4 h-4 border border-gray-400 rounded checked:bg-green-600 checked:border-green-600 cursor-pointer"
                  />
                )}
                <span>{fieldLabel}</span>
              </div>
            );
          })}
        </div>

        {editedData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : editedData.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-[32px_64px_repeat(auto-fill,minmax(190px,1fr))] gap-2 items-center text-sm py-2 border-b"
          >
            <div>{index + 1}</div>
            <div className="w-14 h-14 flex items-center justify-center">
              {(imageMap[item.id] || item.imageUrl) ? (
  <img
    src={imageMap[item.id] || item.imageUrl}
    alt=""
    className="object-contain w-14 h-14 border rounded"
    onError={(e) => {
      e.currentTarget.style.display = "none";
      e.currentTarget.parentElement.innerHTML =
        '<div class="text-gray-400 text-xs">No Image</div>';
    }}
  />
) : (
  <div className="text-gray-400 text-xs">No Image</div>
)}


            </div>

            {selectedFields.includes("name") && (
              <input
                value={item.name ?? ""}
                onChange={(e) => handleFieldChange(item.id, "name", e.target.value)}
                className="border rounded px-2 py-1"
              />
            )}

            {selectedFields.includes("subtitle") && (
              <input
                value={item.subtitle ?? ""}
                onChange={(e) => handleFieldChange(item.id, "subtitle", e.target.value)}
                className="border rounded px-2 py-1"
              />
            )}

            {selectedFields.includes("privateNotes") && (
              <input
                value={item.privateNotes ?? ""}
                onChange={(e) => handleFieldChange(item.id, "privateNotes", e.target.value)}
                className="border rounded px-2 py-1"
                placeholder="Private Notes"
              />
            )}

            {/* Dynamic fields */}
            {getAllFields()
              .filter(f => f.enabled && f.key.startsWith('field'))
              .map(field => {
                if (!selectedFields.includes(field.key)) return null;
                return (
                  <div key={field.key} className="flex gap-2">
                    <input
                      value={item[field.key] ?? ""}
                      onChange={(e) => handleFieldChange(item.id, field.key, e.target.value)}
                      className="border rounded px-2 py-1 w-28"
                      placeholder={field.label}
                    />
                    {(field.unitsEnabled && field.unitOptions && field.unitOptions.length > 0) && (
                      <select
                        value={item[`${field.key}Unit`] ?? "None"}
                        onChange={(e) => handleFieldChange(item.id, `${field.key}Unit`, e.target.value)}
                        className="border rounded px-2 py-1 pr-8 w-16"
                      >
                        <option value="None">None</option>
                        {field.unitOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}

            {priceField && selectedFields.includes(priceField) && (
              <div className="flex gap-2">
                <input
                  value={item[priceField] ?? ""}
                  onChange={(e) => handleFieldChange(item.id, priceField, e.target.value)}
                  className="border rounded px-2 py-1 w-28"
                  placeholder="Price"
                />
                {(() => {
                  const config = getFieldConfig(priceField);
                  // Price fields should always have units enabled unless explicitly disabled
                  return (config ? config.unitsEnabled : true) && (
                    <select
                      value={item[priceUnitField] ?? getPriceUnits()[0]}
                      onChange={(e) => handleFieldChange(item.id, priceUnitField, e.target.value)}
                      className="border rounded px-2 py-1 pr-8 w-16"
                    >
                      {getPriceUnits().map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            )}

            {selectedFields.includes("wholesale") && (
              <div className="flex gap-2">
                <input
                  value={item.wholesale ?? ""}
                  onChange={(e) => handleFieldChange(item.id, "wholesale", e.target.value)}
                  className="border rounded px-2 py-1 w-28"
                />
                <select
                  value={item.wholesaleUnit ?? getPriceUnits()[0]}
                  onChange={(e) => handleFieldChange(item.id, "wholesaleUnit", e.target.value)}
                  className="border rounded px-2 py-1 pr-8 w-16"
                >
                  {getPriceUnits().map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedFields.includes("badge") && (
              <input
                value={item.badge ?? ""}
                onChange={(e) => handleFieldChange(item.id, "badge", e.target.value)}
                placeholder="Enter badge"
                className="border rounded px-2 py-1 w-full"
              />
            )}

            {selectedFields.includes("category") && (
  <div className="col-span-full">
    <div
      className="flex flex-wrap gap-2 overflow-hidden"
      style={{
        maxHeight: "4.5rem", // ~2 lines at 36px per line
        lineHeight: "1rem",  // tighter spacing
      }}
    >
      {categories.map((cat) => (
        <div
          key={cat}
          onClick={() => toggleCategory(item.id, cat)}
          className={`px-3 py-1 rounded-full text-xs cursor-pointer transition border ${
            Array.isArray(item.category) && item.category.includes(cat)
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-gray-100 text-gray-700 border-gray-300"
          }`}
        >
          {cat}
        </div>
      ))}
    </div>
  </div>
)}

{selectedFields.includes("stock") && (
  <div className="flex gap-2">
    <button
      onClick={() =>
        handleFieldChange(item.id, stockField, (item[stockField] ?? "") === "in" ? "out" : "in")
      }
      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
        (item[stockField] ?? "") === "in"
          ? "bg-green-600 text-white"
          : "bg-gray-300 text-gray-800"
      }`}
    >
      {stockField === 'wholesaleStock' ? 'WS' : stockField === 'resellStock' ? 'RS' : 'Stock'}: {(item[stockField] ?? "") === "in" ? "In" : "Out"}
    </button>
  </div>
)}

            {selectedFields.includes("orderQuantityStep") && (
              <input
                type="text"
                inputMode="numeric"
                value={String(item.orderQuantityStep ?? 1)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const n = parseInt(digits, 10);
                  const next =
                    !digits || !Number.isFinite(n) || n < 1 ? 1 : Math.min(n, 999999);
                  handleFieldChange(item.id, "orderQuantityStep", next);
                }}
                className="border rounded px-2 py-1 w-20"
                title="Minimum order quantity step (1 = any quantity)"
                aria-label="Qty step"
              />
            )}


          </div>
        ))}
      </div>

      <div className="shrink-0 bg-white border-t shadow-md flex justify-end gap-3 px-4 py-3 z-20">
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-300 text-sm rounded"
      >
        Cancel
      </button>
       <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded"
        >
          Save Changes
        </button>
      </div>
      {showRenderPopup && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-lg z-50 flex items-center justify-center px-4">
    <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-xs text-center">
      <h2 className="text-lg font-bold text-gray-800 mb-2">Render images?</h2>

      <p className="text-sm text-gray-600 mb-2">
        Your changes are saved. Would you like to render images now?
      </p>

      <p className="text-sm text-gray-600 mb-4">
        Estimated time: <span className="font-semibold">{estimatedSeconds}</span> sec for {totalProducts} products
      </p>

      <div className="flex justify-center gap-4 pb-[env(safe-area-inset-bottom)]">
        <button
          className="px-5 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition text-sm"
          onClick={() => {
            setShowRenderPopup(false);
            triggerRender?.();
            setTimeout(onClose, 100);
          }}
        >
          Continue
        </button>

        <button
          className="px-5 py-2 rounded-full bg-gray-300 text-gray-800 font-medium shadow hover:bg-gray-400 transition text-sm"
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
  <div className="fixed inset-0 bg-black/40 backdrop-blur-lg z-50 flex items-center justify-center px-4">
    <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-center">
      <h2 className="text-lg font-bold text-gray-800 mb-3">Fill from Master Catalogue?</h2>

      <p className="text-sm text-gray-600 mb-4">
        This will overwrite the current field value for <span className="font-semibold">all products</span> with the data from the master catalogue. Continue?
      </p>

      <div className="flex justify-center gap-3">
        <button
          className="px-5 py-2 rounded-full bg-gray-300 text-gray-800 font-medium shadow hover:bg-gray-400 transition text-sm"
          onClick={() => setConfirmDialog({ show: false, fieldKey: null })}
        >
          Cancel
        </button>

        <button
          className="px-5 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition text-sm"
          onClick={() => confirmFillFromMaster(confirmDialog.fieldKey)}
        >
          Yes, Fill
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
