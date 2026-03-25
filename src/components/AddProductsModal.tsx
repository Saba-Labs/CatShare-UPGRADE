import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  startTransition,
} from "react";
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

type ProductRowProps = {
  product: any;
  catalogueId: string;
  imageSrc?: string;
  onToggle: (id: string) => void;
};

const CatalogueProductToggleRow = memo(function CatalogueProductToggleRow({
  product,
  catalogueId,
  imageSrc,
  onToggle,
}: ProductRowProps) {
  const isEnabled = isProductEnabledForCatalogue(product, catalogueId);
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150">
      <div className="w-12 h-12 rounded border border-gray-300 bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {imageSrc ? (
          <img src={imageSrc} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[9px] text-gray-400">No img</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{product.name}</div>
        {product.subtitle && (
          <div className="text-xs text-gray-500 truncate">{product.subtitle}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onToggle(product.id)}
        className={`p-2 rounded-lg flex-shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] transition-all duration-200 ease-out active:scale-95 ${
          isEnabled
            ? "bg-blue-100 hover:bg-blue-200 text-blue-600 shadow-sm"
            : "bg-gray-200 hover:bg-gray-300 text-gray-500"
        }`}
        title={isEnabled ? "Hide product" : "Show product"}
        aria-pressed={isEnabled}
      >
        {isEnabled ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
      </button>
    </div>
  );
});

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
  const wasOpenRef = useRef(false);

  // Only hydrate from parent when the modal opens — not on every parent re-render (avoids jank / search reset).
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setProducts(allProducts);
      setSearch("");
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, allProducts]);

  const persistAndNotifyParent = useCallback((updated: any[]) => {
    requestAnimationFrame(() => {
      saveProducts(updated);
      startTransition(() => {
        onProductsUpdate(updated);
      });
    });
  }, [onProductsUpdate]);

  const handleToggleProduct = useCallback(
    (productId: string) => {
      let updated: any[] | undefined;
      setProducts((prev) => {
        updated = prev.map((p) => {
          if (p.id === productId) {
            const enabled = isProductEnabledForCatalogue(p, catalogueId);
            return setProductEnabledForCatalogue(p, catalogueId, !enabled);
          }
          return p;
        });
        return updated;
      });
      if (updated) persistAndNotifyParent(updated);
    },
    [catalogueId, persistAndNotifyParent]
  );

  const handleToggleAllProducts = useCallback(() => {
    let updated: any[] | undefined;
    setProducts((prev) => {
      const filtered = prev.filter(
        (p) =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.subtitle?.toLowerCase().includes(search.toLowerCase())
      );
      const allEnabled =
        filtered.length > 0 && filtered.every((p) => isProductEnabledForCatalogue(p, catalogueId));
      updated = prev.map((p) => {
        if (filtered.some((fp) => fp.id === p.id)) {
          return setProductEnabledForCatalogue(p, catalogueId, allEnabled ? false : true);
        }
        return p;
      });
      return updated;
    });
    if (updated) persistAndNotifyParent(updated);
  }, [catalogueId, search, persistAndNotifyParent]);

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.subtitle?.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredEnabled =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => isProductEnabledForCatalogue(p, catalogueId));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Add Products to {catalogueLabel}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light transition-colors duration-150"
            >
              ×
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-shadow duration-150"
            />
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAllProducts}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 ease-out flex-shrink-0 whitespace-nowrap active:scale-[0.98] bg-gray-200 hover:bg-gray-300 ${
                  allFilteredEnabled ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {allFilteredEnabled ? "Hide All" : "Show All"}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 overscroll-contain">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">No products found</div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredProducts.map((product) => (
                <CatalogueProductToggleRow
                  key={product.id}
                  product={product}
                  catalogueId={catalogueId}
                  imageSrc={imageMap[product.id]}
                  onToggle={handleToggleProduct}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
