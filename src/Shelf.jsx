import React, { useState, useEffect } from "react";
import { HIDDEN_MENU_UNLOCKED_EVENT } from "./utils/hiddenMenuFeatures";
import { useNavigate } from "react-router-dom";
import { MdOutlineHome } from "react-icons/md";
import ProductPreviewModal from "./ProductPreviewModal";
import SideDrawer from "./SideDrawer";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { deleteRenderedImageForProduct } from "./Save";
import { tryReadProductSourceAsDataUrl, deleteProductSourceImagesBestEffort } from "./utils/productSourceImage";
import { deleteAllDeletedProducts, deleteProductFromSupabase } from "./services/supabaseSync";
import { useSync } from "./context/SyncContext";
import { SyncBusyOverlay } from "./components/SyncBusyOverlay";

export default function Shelf({ deletedProducts, setDeletedProducts, setProducts, products, imageMap: globalImageMap, user }) {
  const { syncProductsToCloud, isStrictMode } = useSync();
  const [shelfPermanentDeleteBusy, setShelfPermanentDeleteBusy] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [imageMap, setImageMap] = useState({});
  const [showHiddenShelfActions, setShowHiddenShelfActions] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const onUnlocked = () => setShowHiddenShelfActions(true);
    window.addEventListener(HIDDEN_MENU_UNLOCKED_EVENT, onUnlocked);
    return () => window.removeEventListener(HIDDEN_MENU_UNLOCKED_EVENT, onUnlocked);
  }, []);

  // Load imageMap for deleted products
  useEffect(() => {
    const loadShelfImages = async () => {
      const map = {};
      for (const p of deletedProducts) {
        let resolved = await tryReadProductSourceAsDataUrl(p);
        if (!resolved) {
          resolved = (typeof p.image === "string" && p.image) || p.imageUrl || "";
        }
        map[p.id] = resolved;
      }
      setImageMap(map);
    };
    loadShelfImages();
  }, [deletedProducts]);

  const handleRestore = async (product) => {
    const freshProducts = [product, ...products];
    const freshDeleted = deletedProducts.filter((p) => p.id !== product.id);
    setProducts(freshProducts);
    setDeletedProducts(freshDeleted);

    if (isStrictMode() && user?.uid) {
      try {
        const cloudData = await syncProductsToCloud(freshProducts, freshDeleted, { onlyProductIds: [product.id] });
        setProducts(cloudData.products);
        setDeletedProducts(cloudData.deletedProducts);
        console.log(`✅ Product ${product.id} restored and synced to cloud`);
      } catch (err) {
        console.error(`❌ Error syncing restoration:`, err);
      }
    }
  };

  const confirmDelete = (id) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;

    const toDelete = deletedProducts.find(p => p.id === deleteTargetId);
    if (!toDelete) {
      setDeleteTargetId(null);
      setShowDeleteConfirm(false);
      return;
    }

    if (!user?.uid) {
      alert("Please login to permanently delete from cloud.");
      return;
    }

    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    setShelfPermanentDeleteBusy(true);

    try {
      // 1) Delete from Supabase + R2 FIRST
      const result = await deleteProductFromSupabase(user.uid, String(toDelete.id));
      if (!result.success) {
        console.error(`❌ Failed to delete from Supabase:`, result.error);
        alert(result.error || "Failed to delete from cloud. Please try again.");
        return;
      }
      console.log(`✅ Product ${toDelete.id} permanently deleted from Supabase`);

      // 2) After cloud success, remove from local state (no product-added event)
      setDeletedProducts((prev) => prev.filter((p) => p.id !== toDelete.id));

      // 3) Local file cleanup (best-effort)
      try {
        await deleteRenderedImageForProduct(toDelete.id);
        await deleteProductSourceImagesBestEffort(toDelete);
      } catch (err) {
        console.warn(`⚠️ Failed to clean up files for product ${toDelete.id}:`, err);
      }
    } finally {
      setShelfPermanentDeleteBusy(false);
    }
  };

  const handleDeleteAll = async () => {
    setShowDeleteAllConfirm(false);

    if (!user?.uid) {
      alert("Please login to permanently delete from cloud.");
      return;
    }

    const snapshot = [...deletedProducts];
    setShelfPermanentDeleteBusy(true);

    try {
      const result = await deleteAllDeletedProducts(user.uid);
      if (!result.success) {
        console.error('❌ Failed to delete shelf from Supabase:', result.error);
        alert(result.error || "Failed to delete shelf items from cloud. Please try again.");
        return;
      }

      console.log('✅ All shelf items permanently deleted from Supabase');
      setDeletedProducts([]);

      // Local file cleanup (best-effort)
      for (const product of snapshot) {
        try {
          await deleteRenderedImageForProduct(product.id);
          await deleteProductSourceImagesBestEffort(product);
        } catch (err) {
          console.warn(`⚠️ Failed to clean up files for product ${product.id}:`, err);
        }
      }
    } catch (err) {
      console.error('❌ Error deleting shelf:', err);
      alert("Failed to delete shelf items from cloud. Please try again.");
    } finally {
      setShelfPermanentDeleteBusy(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-b from-white to-gray-100 relative">
        {shelfPermanentDeleteBusy && (
          <SyncBusyOverlay
            title="Deleting…"
            subtitle="Removing from cloud and cleaning up files"
          />
        )}
        <div className="sticky top-0 h-[40px] bg-black z-50"></div>
        <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 min-h-14 flex items-center gap-3 px-4 relative">
        <button
          onClick={() => setMenuOpen(true)}
          className="relative w-8 h-8 shrink-0 flex items-center justify-center text-gray-700"
          aria-label="Menu"
          title="Menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold flex-1 text-center">Shelf</h1>
        {showHiddenShelfActions && deletedProducts.length > 0 && (
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="text-xs font-medium px-3 py-1 bg-red-500 text-white rounded hover:bg-red-700 transition"
            title="Delete all items permanently"
          >
            Delete All
          </button>
        )}
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-200 transition"
          title="Go to Home"
        >
          <MdOutlineHome size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24">
        {deletedProducts.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">Shelf is empty</div>
        ) : (
          <div className="space-y-3 mt-4">
            {deletedProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => setPreviewProduct(p)}
                className="flex justify-between items-center gap-3 border p-3 rounded bg-gray-100 cursor-pointer min-h-[60px]"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 shrink-0 rounded overflow-hidden border bg-white flex items-center justify-center">
                    {imageMap[p.id] ? (
                      <img
                        src={imageMap[p.id]}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement.innerHTML =
                            '<span class="text-[10px] text-gray-400 text-xs">No image</span>';
                        }}
                      />
                    ) : p.id in imageMap ? (
                      <span className="text-[10px] text-gray-400">No image</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Loading...</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 truncate">{p.field1 || p.color}</div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(p);
                    }}
                    className="text-xs font-medium px-3 py-1 bg-green-500 text-white rounded hover:bg-green-700"
                  >
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      Haptics.impact({ style: ImpactStyle.Medium });
                      confirmDelete(p.id);
                    }}
                    className="text-xs font-medium px-3 py-1 bg-red-500 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewProduct && (
          <ProductPreviewModal
            product={previewProduct}
            tab="shelf"
            filteredProducts={deletedProducts}
            onClose={() => setPreviewProduct(null)}
            onEdit={null}
            onToggleStock={null}
            onSwipeLeft={(next) => setPreviewProduct(next)}
            onSwipeRight={(prev) => setPreviewProduct(prev)}
            onShelf={() => {}}
          />
        )}
      </main>

      <SideDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        products={products}
        setProducts={setProducts}
        deletedProducts={deletedProducts}
        setDeletedProducts={setDeletedProducts}
        imageMap={globalImageMap}
        selected={[]}
        onShowTutorial={() => {
          navigate("/");
          setMenuOpen(false);
        }}
      />

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Delete this item permanently?
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              This action cannot be undone. The item will be permanently removed from your Catalogue.
            </p>
            <div className="flex justify-center gap-4">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                onClick={handleDelete}
              >
                Delete
              </button>
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-full hover:bg-gray-400 transition"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setShowDeleteAllConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Delete all items permanently?
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              This will permanently delete all {deletedProducts.length} item{deletedProducts.length !== 1 ? 's' : ''} in your Shelf.
            </p>
            <p className="text-sm text-gray-600 mb-5">
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                onClick={handleDeleteAll}
              >
                Delete All
              </button>
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-full hover:bg-gray-400 transition"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
