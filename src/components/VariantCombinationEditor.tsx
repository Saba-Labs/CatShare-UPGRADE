import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllVariantCombinations,
  formatVariantSelectionSummary,
  upsertVariantCombination,
  deleteVariantCombinationCatalogueDetails,
  extractVariantCombinationDetails,
  hasVariantCombinationDetailsForCatalogue,
  countConfiguredCombinationsForCatalogue,
  getVariantSpecificImages,
  getVariantBaseImageIndices,
  getVariantGalleryUrls,
  normalizeVariantImageFields,
  MAX_VARIANT_GALLERY_IMAGES,
  type ProductVariantGroup,
  type ProductVariantsConfig,
  type VariantCombination,
  type VariantCombinationDetails,
} from "../utils/productVariants";
import type { Catalogue } from "../config/catalogueConfig";
import { getAllFields } from "../config/fieldConfig";
import { getCurrentCurrencySymbol } from "../utils/currencyUtils";
import { useToast } from "../context/ToastContext";
import { deleteImageFromR2 } from "../services/cloudflareService";
import { uploadProductImageToR2 } from "../services/r2Upload";
import QuantitySlabEditor from "./QuantitySlabEditor";
import { InfoTooltip } from "./InfoTooltip";
import VariantCombinationStockField from "./VariantCombinationStockField";
import {
  normalizeQuantitySlabs,
  type QuantityPriceSlab,
} from "../utils/quantityPricingUtils";

interface VariantCombinationEditorProps {
  variantConfig: ProductVariantsConfig;
  onChange: (updatedConfig: ProductVariantsConfig) => void;
  theme?: "classic" | "glass";
  onSave?: (updatedConfig: ProductVariantsConfig) => void;
  onBackClick?: () => void;
  catalogues: Catalogue[];
  selectedCatalogue: string;
  onCatalogueChange?: (catalogueId: string) => void;
  productId: string;
  /** Base product gallery slots (same order as product imageUrls / editor slots). */
  baseProductImages?: string[];
}

export default function VariantCombinationEditor({
  variantConfig,
  onChange,
  theme = "classic",
  onSave,
  onBackClick,
  catalogues,
  selectedCatalogue,
  onCatalogueChange,
  productId,
  baseProductImages = [],
}: VariantCombinationEditorProps) {
  const { showToast } = useToast();
  const [selectedCombinationId, setSelectedCombinationId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<VariantCombinationDetails>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const combinations = getAllVariantCombinations(variantConfig.groups);
  const existingData = variantConfig.combinations ?? [];

  const selectedCombination = combinations.find((c) => c.id === selectedCombinationId);
  const selectedExistingData = selectedCombination
    ? existingData.find((c) => c.id === selectedCombination.id)
    : null;

  const selectedCatalogueConfig = catalogues.find((c) => c.id === selectedCatalogue);

  const handleSelectCombination = useCallback((combinationId: string) => {
    setSelectedCombinationId(combinationId);
    const existing = existingData.find((c) => c.id === combinationId);
    const details = existing
      ? extractVariantCombinationDetails(existing, selectedCatalogue)
      : undefined;
    setEditingData(details ? { ...details, inStock: details.inStock !== false } : { inStock: true });
  }, [existingData, selectedCatalogue]);

  const variantImages = getVariantSpecificImages(editingData as VariantCombinationDetails);
  const selectedBaseIndices = getVariantBaseImageIndices(editingData as VariantCombinationDetails);
  const baseImageSlots = baseProductImages
    .map((src, index) => ({ src: String(src ?? "").trim(), index }))
    .filter((slot) => slot.src.length > 0);
  const galleryPreviewCount =
    (getVariantGalleryUrls({ imageUrls: baseProductImages }, editingData as VariantCombinationDetails)?.length ??
      0);

  const toggleBaseImageIndex = useCallback((index: number) => {
    setEditingData((prev) => {
      const current = getVariantBaseImageIndices(prev as VariantCombinationDetails);
      const next = current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index].sort((a, b) => a - b);
      const normalized = normalizeVariantImageFields({
        ...(prev as VariantCombinationDetails),
        baseImageIndices: next,
      });
      return { ...prev, ...normalized };
    });
  }, []);

  const handleSaveData = useCallback(() => {
    if (!selectedCombination) return;
    const slabs = normalizeQuantitySlabs(editingData.customFields?.quantitySlabs);
    const imageFields = normalizeVariantImageFields(editingData);
    const payload: Partial<VariantCombinationDetails> = {
      ...editingData,
      ...imageFields,
      inStock: editingData.inStock !== false,
      customFields: {
        ...editingData.customFields,
        quantitySlabs: slabs.length > 0 ? slabs : undefined,
      },
    };
    const updated = upsertVariantCombination(
      variantConfig,
      selectedCombination.id,
      selectedCatalogue,
      payload,
      selectedCombination.selections
    );
    onChange(updated);
    showToast("Variant details saved and syncing to cloud...", "success");
    onSave?.(updated);
    setSelectedCombinationId(null);
    setEditingData({});
  }, [selectedCombination, variantConfig, editingData, onChange, onSave, showToast, selectedCatalogue]);

  const handleCancel = useCallback(() => {
    setSelectedCombinationId(null);
    setEditingData({});
  }, []);

  const handleDeleteData = useCallback(() => {
    if (!selectedCombination) return;
    const updated = deleteVariantCombinationCatalogueDetails(
      variantConfig,
      selectedCombination.id,
      selectedCatalogue
    );
    onChange(updated);
    setSelectedCombinationId(null);
    setEditingData({});
  }, [selectedCombination, variantConfig, onChange, selectedCatalogue]);

  const handleRemoveVariantImage = useCallback(async (url: string) => {
    const isBaseProductUrl = baseImageSlots.some((slot) => slot.src === url);
    if (!isBaseProductUrl && url.startsWith("https://")) {
      try {
        await deleteImageFromR2(url);
      } catch (err) {
        console.error("Failed to delete variant image from R2:", err);
      }
    }
    setEditingData((prev) => {
      const current = getVariantSpecificImages(prev as VariantCombinationDetails);
      const nextImages = current.filter((u) => u !== url);
      const normalized = normalizeVariantImageFields({
        ...(prev as VariantCombinationDetails),
        images: nextImages,
        image: nextImages[0],
      });
      return { ...prev, ...normalized };
    });
    setShowImageMenu(null);
  }, [baseImageSlots]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }

    const currentCount = getVariantSpecificImages(editingData as VariantCombinationDetails).length;
    if (currentCount >= MAX_VARIANT_GALLERY_IMAGES) {
      showToast(`You can add up to ${MAX_VARIANT_GALLERY_IMAGES} variant images`, "error");
      return;
    }

    setUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      
      const cleanComboId = String(selectedCombinationId ?? "combo")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_");
      
      const result = await uploadProductImageToR2({
        productId: `variant_${cleanComboId}_${Date.now()}`,
        dataUrl: base64,
      });
      if (result?.url) {
        setEditingData((prev) => {
          const current = getVariantSpecificImages(prev as VariantCombinationDetails);
          const nextImages = [...current, result.url].slice(0, MAX_VARIANT_GALLERY_IMAGES);
          const normalized = normalizeVariantImageFields({
            ...(prev as VariantCombinationDetails),
            images: nextImages,
            image: nextImages[0],
          });
          return { ...prev, ...normalized };
        });
        showToast("Image uploaded successfully", "success");
      } else {
        showToast("Upload failed: could not get image URL", "error");
      }
    } catch (err) {
      console.error("Image upload error:", err);
      showToast("Failed to upload image", "error");
    } finally {
      setUploadingImage(false);
    }
  }, [editingData, selectedCombinationId, showToast]);

  const selectedCatalogueLabel =
    catalogues.find((c) => c.id === selectedCatalogue)?.label ?? selectedCatalogue;
  const configuredCount = countConfiguredCombinationsForCatalogue(
    existingData,
    selectedCatalogue
  );

  const cataloguePicker = (
    <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-800">
      <label className="block text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
        Catalogue
      </label>
      <div className="flex gap-2 flex-wrap items-center">
        {catalogues.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              onCatalogueChange?.(cat.id);
              setSelectedCombinationId(null);
              setEditingData({});
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              selectedCatalogue === cat.id
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/30"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
        Variant groups are shared; details below apply to <span className="font-semibold">{selectedCatalogueLabel}</span> only.
      </p>
    </div>
  );

  if (combinations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-gray-800/50">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          No Variant Combinations Yet
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs mb-4">
          Create variant groups first to generate combinations. Each group creates new variants that can be individually configured with images, prices, and details.
        </p>
        {onBackClick && (
          <button
            onClick={onBackClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Create Variant Groups
          </button>
        )}
      </div>
    );
  }

  if (selectedCombination) {
    return (
      <div className="space-y-4">
        {cataloguePicker}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">
            {formatVariantSelectionSummary(variantConfig.groups, selectedCombination.selections)}
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {/* Images */}
          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
              Images
            </label>
            <div className="flex-1 space-y-3">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Upload variant photos first. Toggle base product images below to include shared shots
                like safety labels or instructions.
                {galleryPreviewCount > 0 ? (
                  <span className="block mt-1 font-medium text-gray-600 dark:text-gray-300">
                    {galleryPreviewCount} image{galleryPreviewCount !== 1 ? "s" : ""} will show for this variant.
                  </span>
                ) : null}
              </p>

              <div className="flex flex-wrap gap-3">
                {variantImages.map((url) => (
                  <div key={url} className="relative">
                    <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                      <img src={url} alt="Variant" className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowImageMenu(showImageMenu === url ? null : url)}
                      className="absolute -top-2 -right-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                      title="More actions"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.5 1.5H9.5V.5h1v1zm0 5H9.5v-1h1v1zm0 5H9.5v-1h1v1zm0 5H9.5v-1h1v1z" />
                      </svg>
                    </button>
                    <AnimatePresence>
                      {showImageMenu === url && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-10 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                          style={{ minWidth: "140px" }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click();
                              setShowImageMenu(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Add another
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveVariantImage(url)}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                {variantImages.length < MAX_VARIANT_GALLERY_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
                    title="Upload variant image"
                  >
                    {uploadingImage ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Uploading...</span>
                      </div>
                    ) : (
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {baseImageSlots.length > 0 ? (
                <div className="pt-1">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    From base product
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {baseImageSlots.map(({ src, index }) => {
                      const included = selectedBaseIndices.includes(index);
                      return (
                        <button
                          key={`${index}-${src}`}
                          type="button"
                          onClick={() => toggleBaseImageIndex(index)}
                          className={`relative h-20 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                            included
                              ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                              : "border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100"
                          }`}
                          title={included ? "Shown on this variant — click to hide" : "Hidden — click to show on this variant"}
                        >
                          <img src={src} alt={`Base product image ${index + 1}`} className="w-full h-full object-cover" />
                          <span
                            className={`absolute bottom-1 right-1 rounded px-1 py-0.5 text-[10px] font-bold ${
                              included
                                ? "bg-blue-600 text-white"
                                : "bg-gray-900/70 text-white"
                            }`}
                          >
                            {included ? "On" : "Off"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Custom Fields */}
          {getAllFields()
            .filter(f => f.enabled && f.key.startsWith('field'))
            .map(field => {
              const catData = editingData.customFields ?? {};
              return (
                <div key={field.key} className="flex gap-3 items-center">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
                    {field.label}
                  </label>
                  <div className="relative flex-1">
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={(catData[field.key] as string | number | undefined) ?? ""}
                      onChange={(e) =>
                        setEditingData({
                          ...editingData,
                          customFields: { ...editingData.customFields, [field.key]: e.target.value || undefined },
                        })
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800"
                    />
                  </div>
                  {(field.unitsEnabled && field.unitOptions && field.unitOptions.length > 0) && (
                    <div className="relative flex-shrink-0">
                      <select
                        value={(catData[`${field.key}Unit`] as string | undefined) ?? "None"}
                        onChange={(e) =>
                          setEditingData({
                            ...editingData,
                            customFields: { ...editingData.customFields, [`${field.key}Unit`]: e.target.value || undefined },
                          })
                        }
                        className="border border-gray-300 dark:border-gray-700 p-1.5 rounded min-w-[100px] text-xs appearance-none bg-white dark:bg-gray-800"
                      >
                        <option>None</option>
                        {field.unitOptions.map(opt => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}

          {/* Price */}
          <div className="flex gap-3 items-center">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 flex items-center gap-1">
              Price
              <InfoTooltip content={
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Selling price for this variant:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    <li>Cost to buyer</li>
                    <li>Applicable discount shows as Offer</li>
                  </ul>
                </div>
              } />
            </label>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600 dark:text-gray-400 pointer-events-none">
                {getCurrentCurrencySymbol()}
              </span>
              <input
                type="number"
                step="0.01"
                value={editingData.price ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingData({ ...editingData, price: val ? parseFloat(val) : undefined });
                }}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                className="w-full pl-6 pr-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&[type=number]]:appearance-none"
              />
            </div>
          </div>

          {/* Offer */}
          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
              Offer
            </label>
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600 dark:text-gray-400 pointer-events-none">
                {getCurrentCurrencySymbol()}
              </span>
              <input
                type="number"
                step="0.01"
                value={(editingData.customFields?.offer as number) ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingData({
                    ...editingData,
                    customFields: { ...editingData.customFields, offer: val ? parseFloat(val) : undefined },
                  });
                }}
                placeholder="Optional — lower than Price"
                inputMode="decimal"
                autoComplete="off"
                className="w-full pl-6 pr-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 placeholder:text-gray-400 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&[type=number]]:appearance-none"
              />
            </div>
          </div>

          {selectedCatalogueConfig && selectedCombination ? (
            <VariantCombinationStockField
              catalogue={selectedCatalogueConfig}
              productId={productId}
              variantCombinationId={selectedCombination.id}
              inStock={editingData.inStock !== false}
              onInStockChange={(next) =>
                setEditingData((prev) => ({ ...prev, inStock: next }))
              }
            />
          ) : null}

          {/* Qty Step */}
          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2 flex items-center gap-1">
              Qty step
              <InfoTooltip content={
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Order quantity increments:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    <li><span className="font-semibold text-gray-700 dark:text-gray-200">1</span> = any quantity allowed</li>
                    <li><span className="font-semibold text-gray-700 dark:text-gray-200">12</span> = only multiples (12, 24, 36, etc.)</li>
                    <li><span className="text-[11px] italic text-gray-500 dark:text-gray-500">Example: qty step 6 → buyer can order 6, 12, 18, 24…</span></li>
                  </ul>
                </div>
              } />
            </label>
            <div className="flex-1 min-w-0">
              <input
                type="number"
                min="1"
                value={(editingData.customFields?.orderQuantityStep as number) ?? 1}
                onChange={(e) =>
                  setEditingData({
                    ...editingData,
                    customFields: { ...editingData.customFields, orderQuantityStep: e.target.value ? parseInt(e.target.value) : undefined },
                  })
                }
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&[type=number]]:appearance-none"
              />
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2 flex items-center gap-1">
              MOQ
              <InfoTooltip content={
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Minimum order quantity for this variant:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    <li><span className="font-semibold text-gray-700 dark:text-gray-200">1</span> = no extra minimum</li>
                    <li><span className="font-semibold text-gray-700 dark:text-gray-200">Variant-level</span> override (not global)</li>
                    <li><span className="text-[11px] italic text-gray-500 dark:text-gray-500">Example: MOQ 50 → minimum order is 50 units</span></li>
                  </ul>
                </div>
              } />
            </label>
            <div className="flex-1 min-w-0">
              <input
                type="number"
                min="1"
                value={(editingData.customFields?.minimumOrderQuantity as number) ?? 1}
                onChange={(e) =>
                  setEditingData({
                    ...editingData,
                    customFields: {
                      ...editingData.customFields,
                      minimumOrderQuantity: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })
                }
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&[type=number]]:appearance-none"
              />
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2 flex items-center gap-1">
              Slab pricing
              <InfoTooltip content={
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Volume pricing tiers for bulk orders:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                    <li><span className="font-semibold text-gray-700 dark:text-gray-200">No slabs</span> = fixed price</li>
                    <li><span className="font-semibold text-gray-700 dark:text-gray-200">With slabs</span> = cheaper per unit at higher quantities</li>
                    <li><span className="text-[11px] italic text-gray-500 dark:text-gray-500">Example: 1–99 @ ₹100, 100+ @ ₹90</span></li>
                  </ul>
                </div>
              } />
            </label>
            <div className="flex-1 min-w-0">
              <QuantitySlabEditor
                key={selectedCombinationId ?? "variant-slab"}
                theme={theme}
                value={(editingData.customFields?.quantitySlabs as QuantityPriceSlab[] | undefined) ?? undefined}
                onChange={(slabs) =>
                  setEditingData({
                    ...editingData,
                    customFields: { ...editingData.customFields, quantitySlabs: slabs },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
          {selectedExistingData &&
            hasVariantCombinationDetailsForCatalogue(selectedExistingData, selectedCatalogue) && (
            <button
              onClick={handleDeleteData}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
          <div className="flex-1 flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveData}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cataloguePicker}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {combinations.length} variant{combinations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
            {configuredCount} configured for {selectedCatalogueLabel}
          </p>
        </div>
        <div className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {combinations.length > 0
            ? Math.round((configuredCount / combinations.length) * 100)
            : 0}%
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
        {combinations.map((combo) => {
          const existing = existingData.find((c) => c.id === combo.id);
          const hasData = existing
            ? hasVariantCombinationDetailsForCatalogue(existing, selectedCatalogue)
            : false;
          const details = existing
            ? extractVariantCombinationDetails(existing, selectedCatalogue)
            : undefined;

          return (
            <button
              key={combo.id}
              onClick={() => handleSelectCombination(combo.id)}
              className={`w-full text-left rounded-lg border transition-all duration-200 p-3 ${
                hasData
                  ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="space-y-2">
                {/* Variant Tags */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {variantConfig.groups.map((group) => {
                      const chosen = combo.selections[group.id];
                      if (!chosen) return null;
                      return (
                        <span
                          key={group.id}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
                        >
                          <span className="text-gray-500 dark:text-gray-400 mr-1">{group.name}:</span>
                          <span className="font-semibold">{chosen}</span>
                        </span>
                      );
                    })}
                  </div>
                  {hasData && (
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Details Grid */}
                {hasData && details && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-green-200 dark:border-green-800">
                    {details.image || (details.images && details.images.length > 0) || (details.baseImageIndices && details.baseImageIndices.length > 0) ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-green-700 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">
                          {getVariantGalleryUrls({ imageUrls: baseProductImages }, details)?.length ?? (details.image ? 1 : 0)} image(s)
                        </span>
                      </div>
                    ) : null}
                    {details.inStock === false && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-700 dark:text-red-400 font-semibold">Out of stock</span>
                      </div>
                    )}
                    {details.price !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-green-700 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.5 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM9 10a2 2 0 100-4 2 2 0 000 4zm0 6a4 4 0 100-8 4 4 0 000 8zm7-6a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300 font-semibold">{getCurrentCurrencySymbol()}{String(details.price)}</span>
                      </div>
                    )}
                    {details.customFields?.offer !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-green-700 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm0 6a2 2 0 00-2 2v4a2 2 0 002 2h10a2 2 0 002-2v-4a2 2 0 00-2-2H4z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300 font-semibold">{getCurrentCurrencySymbol()}{String(details.customFields.offer)}</span>
                      </div>
                    )}
                    {details.customFields?.orderQuantityStep !== undefined && details.customFields.orderQuantityStep !== 1 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-green-700 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948-.684l1.498-4.493a1 1 0 011.502-.684l1.498 4.493a1 1 0 00.948.684H17a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm5 9a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">Qty Step: <span className="font-semibold">{String(details.customFields.orderQuantityStep)}</span></span>
                      </div>
                    )}
                    {details.customFields?.minimumOrderQuantity !== undefined && details.customFields.minimumOrderQuantity !== 1 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-green-700 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.3A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">MOQ: <span className="font-semibold">{String(details.customFields.minimumOrderQuantity)}</span></span>
                      </div>
                    )}
                    {normalizeQuantitySlabs(details.customFields?.quantitySlabs).length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-4 h-4 text-green-700 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300"><span className="font-semibold">{normalizeQuantitySlabs(details.customFields?.quantitySlabs).length}</span> slab tier(s)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
