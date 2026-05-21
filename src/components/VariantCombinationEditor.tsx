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
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            Edit: {formatVariantSelectionSummary(variantConfig.groups, selectedCombination.selections)}
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 border-t pt-4">
          {/* Image */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Image (optional)</label>
            {editingData.image && (
              <div className="mb-2 relative w-full h-32 rounded border border-gray-200 overflow-hidden bg-gray-50">
                <img src={editingData.image} alt="Variant" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setEditingData({ ...editingData, image: undefined })}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold"
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
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-3 rounded text-sm font-medium transition-colors"
              >
                {uploadingImage ? "Uploading..." : "Upload Image"}
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Or paste URL:</label>
              <input
                type="text"
                value={editingData.image ?? ""}
                onChange={(e) => setEditingData({ ...editingData, image: e.target.value || undefined })}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Price (optional)</label>
            <input
              type="number"
              step="0.01"
              value={editingData.price ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setEditingData({ ...editingData, price: val ? parseFloat(val) : undefined });
              }}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">SKU (optional)</label>
            <input
              type="text"
              value={(editingData.customFields?.sku as string) ?? ""}
              onChange={(e) =>
                setEditingData({
                  ...editingData,
                  customFields: { ...editingData.customFields, sku: e.target.value || undefined },
                })
              }
              placeholder="ABC-123-S-RED"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Stock */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Stock (optional)</label>
            <input
              type="number"
              min="0"
              value={(editingData.customFields?.stock as number) ?? ""}
              onChange={(e) =>
                setEditingData({
                  ...editingData,
                  customFields: { ...editingData.customFields, stock: e.target.value ? parseInt(e.target.value) : undefined },
                })
              }
              placeholder="100"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Barcode */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Barcode (optional)</label>
            <input
              type="text"
              value={(editingData.customFields?.barcode as string) ?? ""}
              onChange={(e) =>
                setEditingData({
                  ...editingData,
                  customFields: { ...editingData.customFields, barcode: e.target.value || undefined },
                })
              }
              placeholder="5901234123457"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Weight (optional)</label>
            <input
              type="text"
              value={(editingData.customFields?.weight as string) ?? ""}
              onChange={(e) =>
                setEditingData({
                  ...editingData,
                  customFields: { ...editingData.customFields, weight: e.target.value || undefined },
                })
              }
              placeholder="500g"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={(editingData.customFields?.notes as string) ?? ""}
              onChange={(e) =>
                setEditingData({
                  ...editingData,
                  customFields: { ...editingData.customFields, notes: e.target.value || undefined },
                })
              }
              placeholder="Variant-specific instructions or details..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t pt-4">
          <button
            onClick={handleSaveData}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-3 rounded text-sm font-medium"
          >
            Cancel
          </button>
          {selectedExistingData && (
            <button
              onClick={handleDeleteData}
              className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-medium"
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
