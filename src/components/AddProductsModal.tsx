import React, { useState, useEffect } from "react";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import { isProductEnabledForCatalogue, setProductEnabledForCatalogue } from "../config/catalogueProductUtils";
import { saveProducts } from "../config/productUtils";

interface AddProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogueId: string;
  catalogueLabel: string;
  allProducts: any[];
  imageMap: Record<string, string>;
  onProductsUpdate: (products: any[]) => void;
}

export default function AddProductsModal({
  isOpen,
  onClose,
  catalogueId,
  catalogueLabel,
  allProducts,
  imageMap,
  onProductsUpdate,
}: AddProductsModalProps) {
  const [products, setProducts] = useState(allProducts);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // When modal opens, refresh from the latest parent data
    // This ensures we have fresh product states
    if (isOpen) {
      setProducts(allProducts);
      setSearch(""); // Reset search when modal opens
    }
  }, [isOpen, allProducts]);

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.subtitle?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleProduct = (productId: string) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        const isEnabled = isProductEnabledForCatalogue(p, catalogueId);
        return setProductEnabledForCatalogue(p, catalogueId, !isEnabled);
      }
      return p;
    });

    setProducts(updated);

    // Save to localStorage and sync to Supabase
    saveProducts(updated);

    // Notify parent component (this will trigger re-render with updated products)
    onProductsUpdate(updated);
  };

  const handleToggleAllProducts = () => {
    // Check if all filtered products are enabled
    const allEnabled = filteredProducts.every((p) =>
      isProductEnabledForCatalogue(p, catalogueId)
    );

    // Toggle all filtered products to opposite state
    const updated = products.map((p) => {
      // Only toggle products that match current search
      if (filteredProducts.some((fp) => fp.id === p.id)) {
        return setProductEnabledForCatalogue(p, catalogueId, allEnabled ? false : true);
      }
      return p;
    });

    setProducts(updated);

    // Save to localStorage and sync to Supabase
    saveProducts(updated);

    // Notify parent component (this will trigger re-render with updated products)
    onProductsUpdate(updated);
  };

  const allFilteredEnabled = filteredProducts.length > 0 && filteredProducts.every((p) =>
    isProductEnabledForCatalogue(p, catalogueId)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Add Products to {catalogueLabel}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light"
            >
              ×
            </button>
          </div>

          {/* Search Input and Toggle All Button */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {filteredProducts.length > 0 && (
              <button
                onClick={handleToggleAllProducts}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 whitespace-nowrap bg-gray-200 hover:bg-gray-300 ${
                  allFilteredEnabled
                    ? "text-rose-700"
                    : "text-emerald-700"
                }`}
              >
                {allFilteredEnabled ? "Hide All" : "Show All"}
              </button>
            )}
          </div>
        </div>

        {/* Products List */}
        <div className="overflow-y-auto flex-1">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              No products found
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredProducts.map((product) => {
                const isEnabled = isProductEnabledForCatalogue(product, catalogueId);
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {/* Product Image */}
                    <div className="w-12 h-12 rounded border border-gray-300 bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {imageMap[product.id] ? (
                        <img
                          src={imageMap[product.id]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[9px] text-gray-400">No img</span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{product.name}</div>
                      {product.subtitle && (
                        <div className="text-xs text-gray-500 truncate">{product.subtitle}</div>
                      )}
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleProduct(product.id)}
                      className={`p-2 rounded-lg transition-colors flex-shrink-0 flex items-center justify-center ${
                        isEnabled
                          ? "bg-blue-100 hover:bg-blue-200 text-blue-600"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-500"
                      }`}
                      title={isEnabled ? "Hide product" : "Show product"}
                    >
                      {isEnabled ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
