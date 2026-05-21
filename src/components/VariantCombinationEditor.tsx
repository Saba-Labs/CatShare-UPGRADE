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

interface VariantCombinationEditorProps {
  variantConfig: ProductVariantsConfig;
  onChange: (updatedConfig: ProductVariantsConfig) => void;
  theme?: "classic" | "glass";
}

export default function VariantCombinationEditor({
  variantConfig,
  onChange,
  theme = "classic",
}: VariantCombinationEditorProps) {
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
    setSelectedCombinationId(null);
    setEditingData({});
  }, [selectedCombination, variantConfig, editingData, onChange]);

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
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const raw = stripDataUriPrefix(base64);
        const mimeType = file.type === "image/jpeg" || file.type === "image/jpg" ? "image/jpeg" : "image/png";
        const ext = mimeType === "image/jpeg" ? "jpg" : "png";
        const filename = `variant_${selectedCombinationId}_${Date.now()}.${ext}`;

        const result = await uploadImageToR2(raw, filename, "variant-images", mimeType as any);
        if (result.success && result.publicUrl) {
          setEditingData({ ...editingData, image: result.publicUrl });
        } else {
          alert(`Upload failed: ${result.error || "Unknown error"}`);
        }
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Image upload error:", err);
      alert("Failed to upload image");
      setUploadingImage(false);
    }
  }, [editingData, selectedCombinationId]);

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
              {editingData.image && (
                <div className="mb-2 relative w-full h-24 rounded border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={editingData.image} alt="Variant" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setEditingData({ ...editingData, image: undefined })}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-1.5 px-3 rounded text-xs font-medium transition-colors"
                >
                  {uploadingImage ? "Uploading..." : "Upload"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                />
              </div>
              <div className="mt-2">
                <input
                  type="text"
                  value={editingData.image ?? ""}
                  onChange={(e) => setEditingData({ ...editingData, image: e.target.value || undefined })}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800"
                />
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
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Offer */}
          <div className="flex gap-3 items-start">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 pt-2">
              Offer
            </label>
            <div className="relative flex-1 min-w-0">
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
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 placeholder:text-gray-400"
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
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800"
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
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        {combinations.length} combination{combinations.length !== 1 ? "s" : ""} found
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {combinations.map((combo) => {
          const hasData = existingData.some((c) => c.id === combo.id);
          const existing = existingData.find((c) => c.id === combo.id);

          return (
            <button
              key={combo.id}
              onClick={() => handleSelectCombination(combo.id)}
              className={`p-3 text-left rounded border-2 transition-colors ${
                hasData ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
              } hover:border-blue-400`}
            >
              <div className="font-medium text-sm">
                {formatVariantSelectionSummary(variantConfig.groups, combo.selections)}
              </div>
              {hasData && (
                <div className="text-xs text-green-700 mt-1">
                  {[
                    existing?.price !== undefined && `Price: $${existing.price}`,
                    existing?.image && "Image set",
                    existing?.customFields?.sku && `SKU: ${existing.customFields.sku}`,
                    existing?.customFields?.stock !== undefined && `Stock: ${existing.customFields.stock}`,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
