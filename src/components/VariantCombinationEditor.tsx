import React, { useState, useCallback } from "react";
import {
  getAllVariantCombinations,
  formatVariantSelectionSummary,
  upsertVariantCombination,
  type ProductVariantGroup,
  type ProductVariantsConfig,
  type VariantCombination,
} from "../utils/productVariants";

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
            <label className="block text-xs font-medium text-gray-700 mb-1">Image URL (optional)</label>
            <input
              type="text"
              value={editingData.image ?? ""}
              onChange={(e) => setEditingData({ ...editingData, image: e.target.value || undefined })}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
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

          {/* Custom Fields */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Custom Fields (JSON)</label>
            <textarea
              value={JSON.stringify(editingData.customFields ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || "{}");
                  setEditingData({ ...editingData, customFields: parsed });
                } catch {
                  // ignore parse errors while typing
                }
              }}
              placeholder='{"sku": "ABC-123", "stock": 10}'
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono text-xs"
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
                    existing?.customFields && Object.keys(existing.customFields).length > 0
                      ? `Fields: ${Object.keys(existing.customFields).length}`
                      : null,
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
