import React, { useState, useEffect } from "react";
import { type Catalogue } from "./config/catalogueConfig";
import {
  addCatalogue,
  updateCatalogue,
  deleteCatalogue,
  getAllCatalogues,
} from "./config/catalogueConfig";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { deleteRenderedImagesFromFolder, renameRenderedImagesForCatalogue } from "./Save";
import { FiX, FiPlus, FiEdit2, FiTrash2, FiImage, FiCheck, FiLoader } from "react-icons/fi";
import { logCatalogueCreated, logCatalogueDeleted } from "./config/analyticsEvents";
import { useAuth } from "./context/AuthContext";
import { useCloudWriteGate } from "./hooks/useCloudWriteGate";
import { useSubscription } from "./context/SubscriptionContext";
import { FREE_MAX_CATALOGUES } from "./config/freeTierLimits";
import { syncCataloguesDefinition } from "./services/supabaseSync";
import { getStorageKey, safeSetInStorage } from "./utils/safeStorage";
import { uploadImageToR2, stripDataUriPrefix, deleteImageFromR2 } from "./services/cloudflareService";

function isR2Url(value: string | undefined): boolean {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://');
}

function isBase64(value: string | undefined): boolean {
  if (!value) return false;
  return value.startsWith('data:');
}

async function uploadHeroImageToR2(base64: string, catalogueId: string): Promise<string> {
  const raw = stripDataUriPrefix(base64);
  const mimeType = base64.includes('image/jpeg') || base64.includes('image/jpg') ? 'image/jpeg' : 'image/png';
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filename = `catalogue_hero_${catalogueId}.${ext}`;
  const result = await uploadImageToR2(raw, filename, 'catalogue-heroes', mimeType as any);
  if (!result.success || !result.publicUrl) {
    throw new Error(result.error || 'Failed to upload catalogue image to R2');
  }
  return result.publicUrl;
}

interface ManageCataloguesProps {
  onClose: () => void;
  onCataloguesChanged: (catalogues: Catalogue[]) => void;
  products: any[];
  setProducts: (products: any[]) => void;
  renamingCatalogueIds?: Set<string>;
}

export default React.memo(function ManageCatalogues({
  onClose,
  onCataloguesChanged,
  products,
  setProducts,
  renamingCatalogueIds = new Set(),
}: ManageCataloguesProps) {
  const { user } = useAuth();
  const { guardCloudWrite } = useCloudWriteGate();
  const { isPro } = useSubscription();
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<Catalogue | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Catalogue | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formLabel, setFormLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHeroImage, setFormHeroImage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const cats = getAllCatalogues();
    setCatalogues(cats);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Catalogue cover image must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setFormHeroImage(base64String);
      setFormError("");
    };
    reader.readAsDataURL(file);
  };

  const resetFormFields = () => {
    setFormLabel("");
    setFormDescription("");
    setFormHeroImage("");
    setFormError("");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formLabel.trim()) {
      setFormError("Catalogue name is required");
      return;
    }

    if (catalogues.some((c) => c.label.toLowerCase() === formLabel.toLowerCase())) {
      setFormError("A catalogue with this name already exists");
      return;
    }

    if (!isPro && catalogues.length >= FREE_MAX_CATALOGUES) {
      setFormError(
        `Free plan allows up to ${FREE_MAX_CATALOGUES} catalogues. Upgrade to Pro for unlimited.`
      );
      return;
    }

    if (!guardCloudWrite()) return;

    setIsSaving(true);
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });

      let heroImageValue = formHeroImage;
      const tempId = `new_${Date.now()}`;
      if (isBase64(heroImageValue) && user?.uid) {
        heroImageValue = await uploadHeroImageToR2(heroImageValue, tempId);
      }

      const newCatalogue = addCatalogue(formLabel.trim(), {
        folder: formLabel.trim(),
        heroImage: heroImageValue,
        description: formDescription.trim(),
      });

      if (newCatalogue) {
        const updatedProducts = products.map((p) => ({
          ...p,
          [newCatalogue.stockField]: true,
          [newCatalogue.priceField]: "",
          [newCatalogue.priceUnitField]: "/ piece",
        }));

        try {
          const productsKey = user?.uid
            ? getStorageKey("products", user.uid)
            : "products";
          const ok = safeSetInStorage(productsKey, updatedProducts);
          if (!ok) {
            throw new Error("Storage quota exceeded while updating products for new catalogue");
          }

          setProducts(updatedProducts);
          window.dispatchEvent(new CustomEvent("product-added"));

          const updated = getAllCatalogues();
          setCatalogues(updated);
          onCataloguesChanged(updated);

          if (user?.uid) {
            const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
            if (strictOnline) {
              const syncRes = await syncCataloguesDefinition(user.uid, updated);
              if (!syncRes.success) {
                throw new Error(syncRes.error || 'Failed to sync catalogues to Supabase');
              }
              window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
            } else {
              syncCataloguesDefinition(user.uid, updated).catch(err => {
                console.warn('⚠️ Failed to sync catalogues to Supabase:', err);
              });
            }
          }

          logCatalogueCreated(newCatalogue.label);

          setShowAddForm(false);
          resetFormFields();
        } catch (storageErr) {
          if ((storageErr as Error).name === 'QuotaExceededError' || (storageErr as Error).message.includes('quota')) {
            setFormError("Storage full! Cannot add more catalogues. Please clear app cache or delete some products/images first.");
          } else {
            setFormError("Failed to save products: " + (storageErr as Error).message);
          }
          deleteCatalogue(newCatalogue.id, user?.uid);
        }
      }
    } catch (err) {
      setFormError("Failed to add catalogue: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formLabel.trim()) {
      setFormError("Catalogue name is required");
      return;
    }

    if (!showEditForm) return;

    if (
      catalogues.some(
        (c) =>
          c.id !== showEditForm.id &&
          c.label.toLowerCase() === formLabel.toLowerCase()
      )
    ) {
      setFormError("A catalogue with this name already exists");
      return;
    }

    if (!guardCloudWrite()) return;

    setIsSaving(true);
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });

      const newLabel = formLabel.trim();
      const oldFolder = showEditForm.folder;
      const oldLabel = showEditForm.label;
      const newFolder = newLabel;

      if (oldFolder !== newFolder || oldLabel !== newLabel) {
        console.log(`📁 Catalogue changed from "${oldLabel}" to "${newLabel}" - starting background rename`);
        window.dispatchEvent(new CustomEvent("catalogue-rename-start", { detail: { id: showEditForm.id } }));
        renameRenderedImagesForCatalogue(oldFolder, newFolder, oldLabel, newLabel)
          .then(() => {
            console.log(`✅ Background rename complete for: ${newLabel}`);
            window.dispatchEvent(new CustomEvent("catalogue-rename-end", { detail: { id: showEditForm.id } }));
          })
          .catch((err) => {
            console.error(`❌ Background rename failed for: ${newLabel}`, err);
            window.dispatchEvent(new CustomEvent("catalogue-rename-end", { detail: { id: showEditForm.id } }));
          });
      }

      let heroImageValue = formHeroImage;
      const oldHeroImage = showEditForm.heroImage || "";

      if (isBase64(heroImageValue) && user?.uid) {
        heroImageValue = await uploadHeroImageToR2(heroImageValue, showEditForm.id);
        if (isR2Url(oldHeroImage)) {
          deleteImageFromR2(oldHeroImage).catch(err => {
            console.warn('⚠️ Failed to delete old catalogue hero image from R2:', err);
          });
        }
      } else if (!heroImageValue && isR2Url(oldHeroImage)) {
        deleteImageFromR2(oldHeroImage).catch(err => {
          console.warn('⚠️ Failed to delete removed catalogue hero image from R2:', err);
        });
      }

      const updates = {
        label: newLabel,
        folder: newFolder,
        heroImage: heroImageValue,
        description: formDescription.trim(),
      };
      updateCatalogue(showEditForm.id, updates);

      const updated = getAllCatalogues();
      setCatalogues(updated);
      onCataloguesChanged(updated);

      if (user?.uid) {
        const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
        if (strictOnline) {
          const syncRes = await syncCataloguesDefinition(user.uid, updated);
          if (!syncRes.success) {
            throw new Error(syncRes.error || 'Failed to sync catalogues to Supabase');
          }
          window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
        } else {
          syncCataloguesDefinition(user.uid, updated).catch(err => {
            console.warn('⚠️ Failed to sync catalogues to Supabase:', err);
          });
        }
      }

      logCatalogueCreated(newLabel);

      setShowEditForm(null);
      resetFormFields();
    } catch (err) {
      setFormError("Failed to update catalogue: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async (catalogue: Catalogue) => {
    if (!catalogue) return;
    if (!guardCloudWrite()) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });

      try {
        await deleteRenderedImagesFromFolder(catalogue.folder || catalogue.label);
      } catch (err) {
        console.warn(`⚠️ Failed to clean up folder for catalogue ${catalogue.label}:`, err);
      }

      if (isR2Url(catalogue.heroImage)) {
        deleteImageFromR2(catalogue.heroImage!).catch(err => {
          console.warn('⚠️ Failed to delete catalogue hero image from R2:', err);
        });
      }

      const success = deleteCatalogue(catalogue.id);
      if (success) {
        const updated = getAllCatalogues();
        setCatalogues(updated);
        onCataloguesChanged(updated);

        if (user?.uid) {
          const strictOnline = localStorage.getItem('strictOnlineMode::device') === 'true';
          if (strictOnline) {
            const syncRes = await syncCataloguesDefinition(user.uid, updated);
            if (!syncRes.success) {
              throw new Error(syncRes.error || 'Failed to sync catalogues to Supabase');
            }
            window.dispatchEvent(new CustomEvent('strict-refresh-from-cloud'));
          } else {
            syncCataloguesDefinition(user.uid, updated).catch(err => {
              console.warn('⚠️ Failed to sync catalogues to Supabase:', err);
            });
          }
        }

        logCatalogueDeleted(catalogue.label);
        setShowDeleteConfirm(null);
      } else {
        setFormError("Cannot delete default catalogues");
      }
    } catch (err) {
      setFormError("Failed to delete catalogue: " + (err as Error).message);
    }
  };

  const openEditForm = (catalogue: Catalogue) => {
    setFormLabel(catalogue.label);
    setFormDescription(catalogue.description || "");
    setFormHeroImage(catalogue.heroImage || "");
    setShowEditForm(catalogue);
    setFormError("");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[90vh] rounded-lg shadow-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Manage Catalogues</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition text-white"
            title="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Add New Catalogue Button */}
            {!showAddForm && !showEditForm && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setFormError("");
                }}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
              >
                <FiPlus size={18} />
                Add New Catalogue
              </button>
            )}

            {/* Add Form */}
            {showAddForm && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <h3 className="text-base font-semibold text-gray-800">Create New Catalogue</h3>

                <form onSubmit={handleAddSubmit} className="space-y-3">
                  {/* Catalogue Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Catalogue Name *
                    </label>
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="e.g., Distributor, B2B, Retail"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>

                  {/* Hero Image */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Hero Image
                    </label>
                    {formHeroImage ? (
                      <div className="relative rounded-lg overflow-hidden mb-2">
                        <img src={formHeroImage} alt="Preview" className="w-full h-32 object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormHeroImage("")}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50 cursor-pointer hover:bg-blue-100 transition">
                        <FiImage size={20} className="text-blue-500 mb-1.5" />
                        <span className="text-xs font-medium text-gray-700">Click to upload image</span>
                        <span className="text-xs text-gray-500 mt-0.5">Max 2MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Add a description for this catalogue..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Error Message */}
                  {formError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-3">
                      <span className="text-red-600 text-xs">{formError}</span>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 active:scale-95"
                    >
                      <FiCheck size={16} />
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        resetFormFields();
                      }}
                      className="flex-1 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300 transition active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Form */}
            {showEditForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Edit Catalogue</h3>
                  {showEditForm.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      Default
                    </span>
                  )}
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  {/* Catalogue Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Catalogue Name *
                    </label>
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>

                  {/* Hero Image */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Hero Image
                    </label>
                    {formHeroImage ? (
                      <div className="relative rounded-lg overflow-hidden mb-2">
                        <img src={formHeroImage} alt="Preview" className="w-full h-32 object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormHeroImage("")}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-100 cursor-pointer hover:bg-slate-200 transition">
                        <FiImage size={20} className="text-slate-500 mb-1.5" />
                        <span className="text-xs font-medium text-gray-700">Click to upload image</span>
                        <span className="text-xs text-gray-500 mt-0.5">Max 2MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Add a description for this catalogue..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Error Message */}
                  {formError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-3">
                      <span className="text-red-600 text-xs">{formError}</span>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 active:scale-95"
                    >
                      <FiCheck size={16} />
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditForm(null);
                        resetFormFields();
                      }}
                      className="flex-1 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300 transition active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Catalogues List */}
            {!showAddForm && !showEditForm && (
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                  Your Catalogues ({catalogues.length})
                </h3>

                {catalogues.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">No catalogues yet. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {catalogues.map((catalogue) => (
                      <div
                        key={catalogue.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow bg-white flex items-center gap-3 p-3 group"
                      >
                        {/* Image - Left side */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-md bg-gray-200 overflow-hidden">
                          {catalogue.heroImage ? (
                            <img
                              src={catalogue.heroImage}
                              alt={catalogue.label}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <FiImage size={20} className="text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Content - Middle */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-gray-900 truncate text-sm">
                              {catalogue.label}
                            </h4>
                            {renamingCatalogueIds.has(catalogue.id) && (
                              <FiLoader className="animate-spin text-blue-500" size={12} />
                            )}
                            {catalogue.isDefault && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                Default
                              </span>
                            )}
                          </div>
                          {catalogue.description && (
                            <p className="text-xs text-gray-600 line-clamp-1">
                              {catalogue.description}
                            </p>
                          )}
                        </div>

                        {/* Action Icons - Right side */}
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => openEditForm(catalogue)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(catalogue)}
                            disabled={catalogue.isDefault}
                            className={`p-1.5 rounded-lg transition ${
                              catalogue.isDefault
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                            title={catalogue.isDefault ? "Cannot delete default catalogue" : "Delete"}
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-sm w-11/12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 px-4 py-3 border-b border-red-200">
              <h3 className="text-base font-semibold text-red-700">Delete Catalogue?</h3>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-gray-700 text-sm">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">"{showDeleteConfirm.label}"</span>?
              </p>

              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">⚠️ Note:</span> Product data will not be deleted, but this
                  catalogue will no longer be accessible.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2 bg-gray-100 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-200 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <FiTrash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
