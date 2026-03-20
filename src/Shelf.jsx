import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdOutlineHome } from "react-icons/md";
import ProductPreviewModal from "./ProductPreviewModal";
import SideDrawer from "./SideDrawer";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { deleteRenderedImageForProduct } from "./Save";
import { deleteAllDeletedProducts, deleteProductFromSupabase, removeProductFromDeletedProducts } from "./services/supabaseSync";

export default function Shelf({ deletedProducts, setDeletedProducts, setProducts, products, imageMap: globalImageMap, user }) {
  const [previewProduct, setPreviewProduct] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [imageMap, setImageMap] = useState({});

  const navigate = useNavigate();

  // Load imageMap for deleted products
  useEffect(() => {
    const loadShelfImages = async () => {
      const map = {};
      for (const p of deletedProducts) {
        if (p.imagePath) {
          try {
            try {
              const result = await Filesystem.readFile({
                path: p.imagePath,
                directory: Directory.Data,
              });
              map[p.id] = `data:image/png;base64,${result.data}`;
            } catch {
              const result = await Filesystem.readFile({
                path: p.imagePath,
                directory: Directory.External,
              });
              map[p.id] = `data:image/png;base64,${result.data}`;
            }
          } catch {
            map[p.id] = p.image || "";
          }
        } else {
          map[p.id] = p.image || "";
        }
      }
      setImageMap(map);
    };
    loadShelfImages();
  }, [deletedProducts]);

  const handleRestore = async (product) => {
    setProducts((prev) => [product, ...prev]);
    setDeletedProducts((prev) => prev.filter((p) => p.id !== product.id));
    window.dispatchEvent(new CustomEvent("sync-to-supabase"));

    // Sync restoration to Supabase by removing from deleted_products
    if (user?.uid) {
      try {
          const result = await removeProductFromDeletedProducts(user.uid, String(product.id));
        if (result.success) {
          console.log(`✅ Product ${product.id} restored and removed from shelf in Supabase`);
        } else {
          console.error(`❌ Failed to sync restoration to Supabase:`, result.error);
        }
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
    if (deleteTargetId) {
      const toDelete = deletedProducts.find(p => p.id === deleteTargetId);
      if (!toDelete) {
        setDeleteTargetId(null);
        setShowDeleteConfirm(false);
        return;
      }

      // 🧹 Final cleanup: delete source image and rendered images
      try {
        // 1) Delete from Supabase + R2 FIRST (do not remove locally until success)
        if (user?.uid) {
          const result = await deleteProductFromSupabase(user.uid, String(toDelete.id));
          if (!result.success) {
            console.error(`❌ Failed to sync deletion to Supabase:`, result.error);
            alert(result.error || "Failed to delete from cloud. Please try again.");
            return;
          }
          console.log(`✅ Product ${toDelete.id} permanently deleted from Supabase`);
        } else {
          alert("Please login to permanently delete from cloud.");
          return;
        }

        // 2) After cloud success, remove from local state/UI
        setDeletedProducts((prev) => prev.filter((p) => p.id !== deleteTargetId));
        setDeleteTargetId(null);
        setShowDeleteConfirm(false);

        // 3) Local cleanup (best-effort)
        try {
          await deleteRenderedImageForProduct(toDelete.id);
          if (toDelete.imagePath) {
            try {
              await Filesystem.deleteFile({
                path: toDelete.imagePath,
                directory: Directory.Data,
              });
            } catch {
              await Filesystem.deleteFile({
                path: toDelete.imagePath,
                directory: Directory.External,
              });
            }
            console.log(`🗑️ Deleted source image: ${toDelete.imagePath}`);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fully clean up files for product ${toDelete.id}:`, err);
        }
      } finally {
        // Ensure dialog closes if the item was removed; otherwise keep it open for retry
      }
    }
  };

  const handleDeleteAll = async () => {
    setShowDeleteAllConfirm(false);

    // Sync to Supabase to remove all shelf items
    if (user?.uid) {
      try {
        const result = await deleteAllDeletedProducts(user.uid);
        if (result.success) {
          console.log('✅ All shelf items permanently deleted from Supabase');
          // Only clear locally after cloud success
          const snapshot = [...deletedProducts];
          setDeletedProducts([]);

          // Local cleanup (best-effort)
          for (const product of snapshot) {
            try {
              await deleteRenderedImageForProduct(product.id);
              if (product.imagePath) {
                try {
                  await Filesystem.deleteFile({
                    path: product.imagePath,
                    directory: Directory.Data,
                  });
                } catch {
                  await Filesystem.deleteFile({
                    path: product.imagePath,
                    directory: Directory.External,
                  });
                }
                console.log(`🗑️ Deleted source image: ${product.imagePath}`);
              }
            } catch (err) {
              console.warn(`⚠️ Failed to fully clean up files for product ${product.id}:`, err);
            }
          }
        } else {
          console.error('❌ Failed to sync deletion to Supabase:', result.error);
          alert(result.error || "Failed to delete shelf items from cloud. Please try again.");
        }
      } catch (err) {
        console.error('❌ Error syncing shelf deletion:', err);
        alert("Failed to delete shelf items from cloud. Please try again.");
      }
    } else {
      alert("Please login to permanently delete from cloud.");
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-b from-white to-gray-100 relative">
        <div className="sticky top-0 h-[40px] bg-black z-50"></div>
        <header className="sticky top-[40px] z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 h-14 flex items-center gap-3 px-4 relative">
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
        <h1 className="text-xl font-bold flex-1 text-center truncate whitespace-nowrap">Shelf</h1>
        {deletedProducts.length > 0 && (
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
                className="flex justify-between items-center border p-3 rounded bg-gray-100 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded overflow-hidden border bg-white flex items-center justify-center">
                    {imageMap[p.id] ? (
                      <img
                        src={imageMap[p.id]}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement.innerHTML =
                            '<span class="text-[10px] text-gray-400 text-xs">Image broken</span>';
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-gray-400">Loading...</span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.field1 || p.color}</div>
                  </div>
                </div>
                <div className="flex gap-2">
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
