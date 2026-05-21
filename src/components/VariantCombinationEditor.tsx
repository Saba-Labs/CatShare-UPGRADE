import React, { useState, useCallback, useRef } from "react";
import {
  getAllVariantCombinations,
  formatVariantSelectionSummary,
  upsertVariantCombination,
  type ProductVariantGroup,
  type ProductVariantsConfig,
  type VariantCombination,
} from "../utils/productVariants";
import { uploadImageToR2, stripDataUriPrefix } from "../services/cloudflareService";
import { getAllFields } from "../config/fieldConfig";
import { getCurrentCurrencySymbol } from "../utils/currencyUtils";
import { useToast } from "../context/ToastContext";

interface VariantCombinationEditorProps {
  variantConfig: ProductVariantsConfig;
  onChange: (updatedConfig: ProductVariantsConfig) => void;
  theme?: "classic" | "glass";
  onSave?: (updatedConfig: ProductVariantsConfig) => void;
}

export default function VariantCombinationEditor({
  variantConfig,
  onChange,
  theme = "classic",
  onSave,
}: VariantCombinationEditorProps) {
  const { showToast } = useToast();
  const [selectedCombinationId, setSelectedCombinationId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<VariantCombination>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const combinations = getAllVariantCombinations(variantConfig.groups);
  const existingData = variantConfig.combinations ?? [];

  const selectedCombination = combinations.find((c) => c.id === selectedCombinationId);
  const selectedExistingData = selectedCombination
    ? existingData.find((c) => c.id === selectedCombination.id)
    : null;

  const handleSelectCombination = useCallback((combinationId: string) => {
    setSelectedCombinationId(combinationId);
    const existing = existingData.find((c) => c.id === combinationId);
    setEditingData(existing ? { ...existing } : {});
  }, [existingData]);

  const handleSaveData = useCallback(() => {
    if (!selectedCombination) return;
    const updated = upsertVariantCombination(variantConfig, selectedCombination.id, editingData);
    onChange(updated);
    showToast("Variant details saved and syncing to cloud...", "success");
    onSave?.(updated);
    setSelectedCombinationId(null);
    setEditingData({});
  }, [selectedCombination, variantConfig, editingData, onChange, onSave, showToast, theme]);

  const handleCancel = useCallback(() => {
    setSelectedCombinationId(null);
    setEditingData({});
  }, []);

  const handleDeleteData = useCallback(() => {
    if (!selectedCombination) return;
    const updated = { ...variantConfig };
    updated.combinations = (updated.combinations ?? []).filter((c) => c.id !== selectedCombination.id);
    onChange(updated);
    setSelectedCombinationId(null);
    setEditingData({});
  }, [selectedCombination, variantConfig, onChange]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
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

      const raw = stripDataUriPrefix(base64);
      const mimeType = file.type === "image/jpeg" || file.type === "image/jpg" ? "image/jpeg" : "image/png";
      const ext = mimeType === "image/jpeg" ? "jpg" : "png";
      const filename = `variant_${selectedCombinationId}_${Date.now()}.${ext}`;

      const result = await uploadImageToR2(raw, filename, "variants", mimeType);
      if (result.success && result.publicUrl) {
        setEditingData((prev) => ({ ...prev, image: result.publicUrl }));
      } else {
        alert(`Upload failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Image upload error:", err);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }, [selectedCombinationId]);

  if (combinations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No variant combinations. Create variant groups first.</p>
      </div>
    );
  }

  if (selectedCombination) {
    return (
      <div className="space-y-4">
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
          {/* Image */}
          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
              Image
            </label>
            <div className="flex-1">
              <div className="flex flex-wrap gap-3">
                {editingData.image && (
                  <div className="relative h-24 w-24 rounded-xl overflow-hidden border-2 border-gray-200">
                    <img src={editingData.image} alt="Variant" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditingData({ ...editingData, image: undefined })}
                      className="absolute -top-2 -right-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-all hover:scale-110"
                      title="Remove image"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                      </svg>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    className="hidden"
                  />
                </button>
              </div>
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
                      value={(catData[field.key] as string | number) ?? ""}
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
                        value={(catData[`${field.key}Unit`] as string) ?? "None"}
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
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">
              Price
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

          {/* Qty Step */}
          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
              Qty step
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
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                1 = any quantity. E.g. 12 → only 12, 24, 36…
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleSaveData}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-xs font-medium flex-1"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-3 rounded text-xs font-medium flex-1"
          >
            Cancel
          </button>
          {selectedExistingData && (
            <button
              onClick={handleDeleteData}
              className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {combinations.length} combination{combinations.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {existingData.length} with details set
          </p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-hide">
        {combinations.map((combo) => {
          const hasData = existingData.some((c) => c.id === combo.id);
          const existing = existingData.find((c) => c.id === combo.id);

          return (
            <button
              key={combo.id}
              onClick={() => handleSelectCombination(combo.id)}
              className={`p-3 text-left rounded-lg border transition-all duration-200 group ${
                hasData
                  ? "border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:border-green-400 dark:hover:border-green-600 shadow-sm hover:shadow-md"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {formatVariantSelectionSummary(variantConfig.groups, combo.selections)}
                </div>
                {hasData && (
                  <div className="flex-shrink-0 ml-2">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              {hasData && (
                <div className="text-xs text-green-700 dark:text-green-300 mt-2 pt-2 border-t border-green-200 dark:border-green-800/50">
                  <div className="space-y-1">
                    {existing?.image && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4.5-4.5 3 3 4-4 2.5 2.5V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10z" />
                        </svg>
                        <span>Image</span>
                      </div>
                    )}
                    {existing?.price !== undefined && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.16 5a.5.5 0 00-.496.545l.84 4.49H4.5a.5.5 0 00-.492.41l-.8 4A.5.5 0 004 15h3.256l.933 4.967a.5.5 0 00.492.533h.138a.5.5 0 00.494-.426l.926-4.974h3.268l.933 4.973a.5.5 0 00.494.427h.138a.5.5 0 00.492-.534l-.8-4.267a.5.5 0 00-.492-.41H12.04l.84-4.49a.5.5 0 00-.496-.545h-4.22zm.324 1h3.872l-.84 4.49H7.484l.84-4.49z" />
                        </svg>
                        <span>${existing.price}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
