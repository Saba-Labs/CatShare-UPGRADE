import React, { useState, useEffect } from "react";
import { FiSettings, FiLoader, FiPlus } from "react-icons/fi";
import { type Catalogue } from "./config/catalogueConfig";
import { isProductEnabledForCatalogue } from "./config/catalogueProductUtils";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface CataloguesListProps {
  catalogues: Catalogue[];
  onSelectCatalogue: (catalogueId: string) => void;
  imageMap: Record<string, string>;
  products: any[];
  onManageCatalogues: () => void;
  renamingCatalogueIds?: Set<string>;
}

function seededHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickStableRandomItems<T>(items: T[], count: number, seedKey: string): T[] {
  if (items.length <= count) return items;
  const arr = [...items];
  let seed = seededHash(seedKey) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, count);
}

export default React.memo(function CataloguesList({
  catalogues,
  onSelectCatalogue,
  imageMap,
  products,
  onManageCatalogues,
  renamingCatalogueIds = new Set(),
}: CataloguesListProps) {
  const [catalogueStats, setCatalogueStats] = useState<
    Record<string, { total: number; inStock: number }>
  >({});

  useEffect(() => {
    // Calculate stats for each catalogue
    const stats: Record<string, { total: number; inStock: number }> = {};

    for (const cat of catalogues) {
      // Only count products that are enabled for this specific catalogue
      const enabledProducts = products.filter((p) =>
        isProductEnabledForCatalogue(p, cat.id)
      );
      const total = enabledProducts.length;
      const inStock = enabledProducts.filter((p) => (p as any)[cat.stockField]).length;
      stats[cat.id] = { total, inStock };
    }

    setCatalogueStats(stats);
  }, [catalogues, products]);

  const handleCatalogueClick = async (catalogueId: string) => {
    await Haptics.impact({ style: ImpactStyle.Light });
    onSelectCatalogue(catalogueId);
  };

  return (
    <>
      <div className="sticky top-0 h-[40px] bg-black z-50"></div>
      <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center gap-3 px-4 relative">
        {/* Menu Button */}
        <button
          onClick={() => window.dispatchEvent(new Event("toggle-menu"))}
          className="relative w-8 h-8 shrink-0 flex items-center justify-center text-gray-700 transition-opacity duration-200"
          aria-label="Menu"
          title="Menu"
        >
          <span className="absolute w-6 h-0.5 bg-gray-700" style={{ top: '50%', transform: 'translateY(-8px)' }} />
          <span className="absolute w-6 h-0.5 bg-gray-700" style={{ top: '50%', transform: 'translateY(0px)' }} />
          <span className="absolute w-6 h-0.5 bg-gray-700" style={{ top: '50%', transform: 'translateY(8px)' }} />
        </button>

        {/* Title */}
        <h1 className="text-lg font-semibold text-gray-800">
          All Catalogues
        </h1>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Manage Button */}
        <button
          onClick={async () => {
            await Haptics.impact({ style: ImpactStyle.Light });
            onManageCatalogues();
          }}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition shrink-0"
          title="Add, edit, or delete catalogues"
        >
          <FiSettings size={20} />
        </button>
      </header>

      {catalogues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No catalogues available</p>
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-4">
          {catalogues.map((catalogue) => {
            const stats = catalogueStats[catalogue.id] || {
              total: 0,
              inStock: 0,
            };
            // Pick a stable random set of product images for this catalogue
            const enabledProducts = products.filter((p) =>
              isProductEnabledForCatalogue(p, catalogue.id)
            );
            const catalogueProducts = pickStableRandomItems(
              enabledProducts,
              3,
              `${catalogue.id}:${enabledProducts.map((p) => p.id).join(",")}`
            );

            return (
              <button
                key={catalogue.id}
                onClick={() => handleCatalogueClick(catalogue.id)}
                className="w-full group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-200 hover:border-blue-300"
              >
                {/* Background gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative p-4 flex items-center gap-4">
                  {/* Image preview - Hero image front with product images layered behind */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    {/* Product images layered behind (fan effect) */}
                    {catalogueProducts.length > 0 &&
                      catalogueProducts.map((product, idx) => {
                        // Calculate rotation and offset for card fan effect (behind hero)
                        const totalCards = catalogueProducts.length;
                        const centerIdx = Math.floor(totalCards / 2);
                        const offset = idx - centerIdx;
                        const rotation = offset * 12; // 12 degrees per card
                        const translateX = offset * 4; // 4px offset horizontally
                        const translateY = Math.abs(offset) * 2; // Slight vertical spread

                        return (
                          <div
                            key={`product-${idx}`}
                            className="absolute w-16 h-16 rounded border border-gray-300 bg-gray-100 flex items-center justify-center overflow-hidden"
                            style={{
                              transform: `rotate(${rotation}deg) translateX(${translateX}px) translateY(${translateY}px)`,
                              zIndex: Math.max(0, totalCards - Math.abs(offset) - 1), // Keep behind hero image
                              transformOrigin: 'center',
                              left: '2px',
                              top: '2px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                          >
                            {imageMap[product.id] ? (
                              <img
                                src={imageMap[product.id]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-[10px] text-gray-400">
                                No image
                              </span>
                            )}
                          </div>
                        );
                      })}

                    {/* Hero image as front card (highest z-index within card) */}
                    {catalogue.heroImage ? (
                      <div
                        className="absolute w-16 h-16 rounded border border-gray-300 bg-gray-100 flex items-center justify-center overflow-hidden"
                        style={{
                          zIndex: 10, // Front layer within card only
                          left: '2px',
                          top: '2px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        <img
                          src={catalogue.heroImage}
                          alt={catalogue.label}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    ) : catalogueProducts.length === 0 ? (
                      /* No hero image and no products */
                      <div className="absolute w-16 h-16 rounded border border-gray-300 bg-gray-100 flex items-center justify-center">
                        <span className="text-[10px] text-gray-400">
                          No products
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Catalogue info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                        {catalogue.label}
                      </h3>
                      {renamingCatalogueIds.has(catalogue.id) && (
                        <FiLoader className="animate-spin text-blue-500 shrink-0" size={14} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.total} products · {stats.inStock} in stock
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add Catalogue Button - Fixed in bottom right */}
      <button
        onClick={async () => {
          await Haptics.impact({ style: ImpactStyle.Light });
          onManageCatalogues();
        }}
        className="fixed right-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 active:scale-95 z-20"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
        title="Add new catalogue"
      >
        <FiPlus size={20} />
        <span className="text-sm font-semibold hidden sm:inline">Add Catalogue</span>
      </button>
    </>
  );
});
