import React, { useState, useEffect, useRef } from "react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileSharer } from "@byteowls/capacitor-filesharer";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import MediaLibrary from "./MediaLibrary";
import BulkEdit from "./BulkEdit";
import { App } from "@capacitor/app";
import JSZip from "jszip";
import { saveRenderedImage } from "./Save";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { MdInventory2, MdBackup, MdCategory, MdBook, MdImage, MdSettings, MdPublic } from "react-icons/md";
import { RiEdit2Line } from "react-icons/ri";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { APP_VERSION } from "./config/version";
import { useToast } from "./context/ToastContext";
import { useTheme } from "./context/ThemeContext";
import { useAuth } from "./context/AuthContext";
import { useSubscription } from "./context/SubscriptionContext";
import { getCataloguesDefinition, setCataloguesDefinition, DEFAULT_CATALOGUES, getAllCatalogues, createLegacyResellCatalogueIfNeeded } from "./config/catalogueConfig";
import { ensureProductsHaveStockFields } from "./utils/dataMigration";
import { migrateProductToNewFormat } from "./config/fieldMigration";
import { applyBackupFieldAnalysis } from "./config/fieldConfig";
import { Capacitor } from "@capacitor/core";
import { getPersistedAuthUserId } from "./utils/authUserId";
import { safeGetFromStorage, safeSetInStorage, getStorageKey } from "./utils/safeStorage";
import { getCurrentCurrency } from "./utils/currencyUtils";
import { getPriceUnits } from "./utils/priceUnitsUtils";
import { logBackupCreated, logBackupRestored, logBackupSharedFileSharer, logBackupDownloaded, logCsvExported, logFileSharerError, logCategoryManaged } from "./config/analyticsEvents";
import { syncCategories } from "./services/supabaseSync";
import { notifyHiddenMenuUnlocked } from "./utils/hiddenMenuFeatures";
import {
  snapshotSupabaseAuthFromLocalStorage,
  restoreSupabaseAuthToLocalStorage,
  refreshSupabaseSessionFromStorage,
} from "./supabaseClient";
import { readProductSourceBase64ForCloudUpload } from "./utils/productSourceImage";
import { assertProductsHaveCloudImageUrlForSync } from "./utils/syncImageValidation";

/**
 * After backup restore, ensure every product with a local imagePath gets an HTTPS imageUrl (R2)
 * before Supabase sync — same path resolution as main sync (Data + External + legacy).
 */
async function uploadMissingProductImagesToR2ForRestore(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const { uploadProductImageToR2 } = await import("./services/r2Upload");

  if (!Capacitor.isNativePlatform()) {
    assertProductsHaveCloudImageUrlForSync(items, "Backup restore");
    return items;
  }

  const merged = await Promise.all(
    items.map(async (p) => {
      const hasHttps =
        typeof p.imageUrl === "string" && /^https?:\/\//i.test(p.imageUrl.trim());
      if (hasHttps || !p.imagePath) return p;

      let base64 = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        base64 = await readProductSourceBase64ForCloudUpload(p);
        if (base64) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 180));
      }
      if (!base64) {
        throw new Error(
          `Cannot read image file for product "${p.name || p.id}" (${p.id}). ` +
            `The file may be missing or still writing — try restore again.`
        );
      }
      const pathHint =
        typeof p.imagePath === "string" && p.imagePath.trim() ? p.imagePath.trim() : "";
      const filename = (pathHint.split("/").pop() || "product.png").toLowerCase();
      const dataUrlPrefix =
        filename.endsWith(".jpg") || filename.endsWith(".jpeg")
          ? "data:image/jpeg;base64,"
          : "data:image/png;base64,";
      const uploaded = await uploadProductImageToR2({
        productId: String(p.id),
        dataUrl: `${dataUrlPrefix}${base64}`,
      });
      if (!uploaded?.url) {
        throw new Error(`Cloud upload returned no URL for product ${p.id}`);
      }
      return { ...p, imageUrl: uploaded.url };
    })
  );

  assertProductsHaveCloudImageUrlForSync(merged, "Backup restore");
  return merged;
}

export default function SideDrawer({
  open,
  onClose,
  products,
  imageMap,
  setProducts,
  setDeletedProducts,
  selected,
  onShowTutorial,
  darkMode,
  setDarkMode,
  isRendering,
  renderProgress,
  renderResult,
  setRenderResult,
  handleRenderAllImages,
}) {
  const [showCategories, setShowCategories] = useState(false);
   const [showMediaLibrary, setShowMediaLibrary] = useState(false);
   const [showBulkEdit, setShowBulkEdit] = useState(false);
const [showRenderConfirm, setShowRenderConfirm] = useState(false);
const [clickCountN, setClickCountN] = useState(0);
const [showHiddenFeatures, setShowHiddenFeatures] = useState(false);
const [allProductsCached, setAllProductsCached] = useState([]);
const [showBackupPopup, setShowBackupPopup] = useState(false);
const [showRenderAfterRestore, setShowRenderAfterRestore] = useState(false);
const [backupResult, setBackupResult] = useState(null); // { status: 'success'|'error', message: string }
const [showShareErrorDialog, setShowShareErrorDialog] = useState(false);
const [shareErrorMessage, setShareErrorMessage] = useState("");
const [shareErrorBlob, setShareErrorBlob] = useState(null);
const [shareErrorFilename, setShareErrorFilename] = useState("");
const [shareErrorBase64, setShareErrorBase64] = useState(null);
const [detectedBackups, setDetectedBackups] = useState([]);
const [showBrowseForBackup, setShowBrowseForBackup] = useState(false);
const [isLoadingBackups, setIsLoadingBackups] = useState(false);
const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { isPro, isPaidPro, isTrialActive, trialEndsAt, loading: subscriptionLoading } =
    useSubscription();
  const isGlassTheme = currentTheme?.styles?.layout === "glass";

  const accountPlanLine = (() => {
    if (subscriptionLoading) {
      return { text: "Checking plan…", className: "text-xs text-gray-500 mt-1" };
    }
    if (isPaidPro) {
      return { text: "Pro", className: "text-xs font-semibold text-emerald-700 mt-1" };
    }
    if (isTrialActive && trialEndsAt) {
      const end = new Date(trialEndsAt).getTime();
      const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
      const dayWord = daysLeft === 1 ? "day" : "days";
      return {
        text: `Trial · ${daysLeft} ${dayWord} left`,
        className: "text-xs font-medium text-amber-800 mt-1",
      };
    }
    if (isPro) {
      return { text: "Pro", className: "text-xs font-semibold text-emerald-700 mt-1" };
    }
    return { text: "Free", className: "text-xs text-gray-600 mt-1" };
  })();

  const totalProducts = products.length;
  // Estimated rendering time: ~2s for standard, ~4s for glass theme per product
  const estimatedSeconds = Math.ceil(totalProducts * (isGlassTheme ? 4 : 2));

  // Load all products asynchronously (avoid blocking render)
  useEffect(() => {
    setAllProductsCached(products || []);
  }, [products]);

  // Load detected backups when backup popup is opened
  useEffect(() => {
    if (showBackupPopup) {
      setIsLoadingBackups(true);
      listCatShareBackups().then(backups => {
        setDetectedBackups(backups);
        setIsLoadingBackups(false);
      }).catch(err => {
        console.error("Error loading backups:", err);
        setDetectedBackups([]);
        setIsLoadingBackups(false);
      });
    }
  }, [showBackupPopup]);

  // Expose all modal states globally for back button handlers
  useEffect(() => {
    window.__sideDrawerState = {
      showBackupPopup,
      showRenderAfterRestore,
      showCategories,
      showBulkEdit,
      showMediaLibrary,
      setShowBackupPopup,
      setShowRenderAfterRestore,
      setShowCategories,
      setShowBulkEdit,
      setShowMediaLibrary,
    };
  }, [showBackupPopup, showRenderAfterRestore, showCategories, showBulkEdit, showMediaLibrary]);

  if (!open) return null;

  const handleNClick = () => {
    const newCount = clickCountN + 1;
    setClickCountN(newCount);
    if (newCount === 7) {
      setShowHiddenFeatures(true);
      notifyHiddenMenuUnlocked();
      setClickCountN(0); // Reset counter
    }
  };

  const handleDownloadRenderedImages = async () => {
  try {
    const zip = new JSZip();
    let hasImages = false;
    let totalSize = 0;

    // Get all catalogues dynamically
    const catalogues = getAllCatalogues();

    // Also check for legacy folders for backward compatibility
    const foldersToCheck = [
      ...catalogues.map(cat => cat.folder || cat.label), // Use folder name (which is now set to catalogue name)
      "Wholesale", // Legacy support
      "Resell"     // Legacy support
    ];

    const authUserId = getPersistedAuthUserId();
    const userFolder = authUserId ? `user-${authUserId}` : null;

    // Try to read each catalogue folder
    for (const folderName of foldersToCheck) {
      try {
        const files = await Filesystem.readdir({
          path: folderName,
          directory: Directory.External,
        });

        for (const file of files.files) {
          if (file.name.endsWith(".png")) {
            try {
              const fileData = await Filesystem.readFile({
                path: `${folderName}/${file.name}`,
                directory: Directory.External,
              });
              zip.file(`${folderName}/${file.name}`, fileData.data, { base64: true });
              totalSize += fileData.data.length;
              hasImages = true;
            } catch (readErr) {
              console.warn(`Could not read file ${folderName}/${file.name}:`, readErr.message);
              // Skip individual files that fail to read
            }
          }
        }
      } catch (err) {
        console.warn(`Could not read ${folderName} folder:`, err.message);
        // Continue to next folder if this one doesn't exist
      }

      // New user-scoped location:
      // user-<uid>/<catalogue-folder>/products/*.png
      if (userFolder) {
        try {
          const productsDir = `${userFolder}/${folderName}`;
          let files2;
          try {
            files2 = await Filesystem.readdir({
              path: productsDir,
              directory: Directory.External,
            });
          } catch {
            // Fallback to old layout: user/<uid>/<folderName>/products/
            const oldProductsDir = `${userFolder}/${folderName}/products`;
            files2 = await Filesystem.readdir({
              path: oldProductsDir,
              directory: Directory.External,
            });
            files2.__baseDir = oldProductsDir;
          }
          const baseDir = files2.__baseDir || productsDir;

          for (const file of files2.files) {
            if (file.name.endsWith(".png")) {
              try {
                const fileData = await Filesystem.readFile({
                  path: `${baseDir}/${file.name}`,
                  directory: Directory.External,
                });
                // Keep zip structure readable: user/<catalogue>/...
                zip.file(`${userFolder}/${folderName}/${file.name}`, fileData.data, { base64: true });
                totalSize += fileData.data.length;
                hasImages = true;
              } catch (readErr) {
                console.warn(`Could not read ${baseDir}/${file.name}:`, readErr.message);
              }
            }
          }
        } catch (err2) {
          // It's fine if the user hasn't rendered anything yet
        }
      }
    }

    if (!hasImages) {
      showToast("No rendered images found. Please render images first.", "info");
      return;
    }

    console.log(`📦 Creating ZIP with ${totalSize} bytes of image data...`);

    try {
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      console.log(`✅ ZIP created successfully. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      const now = new Date();
      const timestamp = now.toISOString().replace(/[-T:.]/g, "").slice(0, 12);
      const filename = `catshare-rendered-images-${timestamp}.zip`;

      try {
        // For large files, skip FileSharer and use browser download directly
        // FileSharer has issues with files larger than ~10MB base64 (~7.5MB binary)
        const MAX_FILESHARER_SIZE = 10 * 1024 * 1024; // 10MB base64

        if (blob.size > 5 * 1024 * 1024) {
          // File is large (>5MB), use browser download directly
          console.log(`📦 File is large (${(blob.size / 1024 / 1024).toFixed(2)}MB), using browser download...`);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Keep URL object alive briefly, then revoke
          setTimeout(() => URL.revokeObjectURL(url), 100);
          showToast("ZIP file downloaded to your device!", "success");
        } else {
          // File is smaller, try FileSharer for better mobile experience
          console.log(`📝 Writing file: ${filename}`);

          // Convert blob to base64 more safely for smaller chunks
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          // Convert to base64 in chunks to avoid "Invalid array length" error
          let binary = '';
          const chunkSize = 8192; // Process in 8KB chunks
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64Data = btoa(binary);

          // Safety check: if base64 is too large, fall back to direct download
          if (base64Data.length > MAX_FILESHARER_SIZE) {
            console.warn(`⚠️ Base64 data too large for FileSharer (${(base64Data.length / 1024 / 1024).toFixed(2)}MB), using browser download...`);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
            showToast("ZIP file downloaded to your device!", "success");
            return;
          }

          console.log(`📤 Sharing file via FileSharer...`);
          try {
            await FileSharer.share({
              filename,
              base64Data,
              contentType: "application/zip",
            });
            showToast("Rendered images downloaded successfully!", "success");
          } catch (fileSharerErr) {
            console.warn(`⚠️ FileSharer failed, falling back to browser download:`, fileSharerErr.message);

            // FileSharer failed, use browser download as fallback
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
            showToast("ZIP file downloaded to your device!", "success");
          }
        }
      } catch (shareErr) {
        console.error("Share/Write error:", shareErr);

        // Final fallback: Try direct download without anything else
        try {
          console.log(`📥 Using final fallback: direct blob download...`);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 100);
          showToast("ZIP file downloaded to your device!", "success");
        } catch (fallbackErr) {
          console.error("All download methods failed:", fallbackErr);
          showToast("Failed to download images: " + (fallbackErr.message || shareErr.message), "error");
        }
      }
    } catch (genErr) {
      console.error("ZIP generation failed:", genErr);
      showToast("Failed to create ZIP: " + genErr.message, "error");
    }
  } catch (err) {
    console.error("Download rendered images failed:", err);
    showToast("Failed to download rendered images: " + err.message, "error");
  }
};

// Helper function to list backup files from Documents/CatShare folder
const listCatShareBackups = async () => {
  try {
    const files = await Filesystem.readdir({
      path: "CatShare",
      directory: Directory.Documents,
    });

    // Filter only ZIP files
    const backupFiles = files.files
      .filter(file => file.name.endsWith('.zip') && file.name.startsWith('catalogue-backup-'))
      .sort((a, b) => {
        // Sort by modification time (newest first)
        const timeA = parseInt(a.name.match(/\d{12}/)?.[0] || 0);
        const timeB = parseInt(b.name.match(/\d{12}/)?.[0] || 0);
        return timeB - timeA;
      });

    return backupFiles;
  } catch (err) {
    console.log("ℹ️ CatShare folder not found or empty:", err.message);
    return [];
  }
};

const handleBackup = async () => {
  const deleted = JSON.parse(localStorage.getItem("deletedProducts") || "[]");
  const cataloguesDefinition = getCataloguesDefinition();
  const fieldsDefinition = safeGetFromStorage('fieldsDefinition', null);
  const categories = JSON.parse(localStorage.getItem("categories") || "[]");
  const zip = new JSZip();

  const dataForJson = [];
  const deletedForJson = [];

  // Helper function to backup a product with its image
  const backupProductWithImage = async (p) => {
    const product = { ...p };
    delete product.imageBase64;
    delete product.image; // Remove any base64 image data

    // ✅ PRESERVE imageUrl (cloud image URL from R2) for cloud sync on restore
    // This is critical for cross-device access and cloud syncing
    // imageUrl is NOT removed - it's essential for restoring cloud images

    // IMPORTANT: Ensure root-level badge is synced from catalogueData
    // This fixes old products that might only have badge in catalogueData
    if (!product.badge && product.catalogueData) {
      for (const catId in product.catalogueData) {
        if (product.catalogueData[catId]?.badge) {
          product.badge = product.catalogueData[catId].badge;
          break;
        }
      }
    }

    // Try to back up the image
    if (p.imagePath) {
      try {
        const res = await Filesystem.readFile({
          path: p.imagePath,
          directory: Directory.Data,
        });

        const imageFilename = p.imagePath.split("/").pop();
        zip.file(`images/${imageFilename}`, res.data, { base64: true });
        product.imageFilename = imageFilename;
        console.log(`✅ Backed up image for "${p.name}": ${imageFilename}`);
      } catch (err) {
        console.warn(`⚠️ Image file not found for "${p.name}": ${p.imagePath}`);
        // Image reference exists but file doesn't - this is a data inconsistency
      }
    } else if (p.image && typeof p.image === 'string' && p.image.startsWith('data:')) {
      // Product has base64 image but no imagePath - include it directly in the backup
      console.log(`📝 Including base64 image for "${p.name}" in backup`);
      product.image = p.image; // Keep base64 for this product
    } else if (p.image) {
      // Product has some image data - keep it
      console.log(`📝 Including image data for "${p.name}" in backup`);
      product.image = p.image;
    }

    // ✅ Log if imageUrl is being backed up
    if (p.imageUrl) {
      console.log(`☁️ Cloud image URL preserved for "${p.name}": ${p.imageUrl}`);
    }

    return product;
  };

  // Back up all products
  for (const p of products) {
    const backupProduct = await backupProductWithImage(p);
    dataForJson.push(backupProduct);
  }

  // Also process deleted products' images
  for (const p of deleted) {
    const backupProduct = await backupProductWithImage(p);
    deletedForJson.push(backupProduct);
  }

  // Include catalogues definition and all settings in backup
  // Ensure fieldsDefinition includes the template name
  const backupFieldsDefinition = fieldsDefinition || {
    version: 1,
    fields: [],
    industry: 'General Products (Custom)',
    lastUpdated: Date.now(),
  };

  // Get additional metadata for comprehensive backup
  const enabledFields = backupFieldsDefinition.fields?.filter(f => f.enabled) || [];
  const customFieldLabels = enabledFields.filter(f => {
    // Check if label is custom (not the default)
    const defaultLabel = `Field ${f.key.replace('field', '')}`;
    return f.label !== defaultLabel && f.label !== f.key;
  });

  // Fetch currency and custom currencies
  const defaultCurrency = getCurrentCurrency();
  const customCurrencies = safeGetFromStorage('customCurrencies', {});

  // Fetch price units
  const priceUnits = getPriceUnits();

  const privateNotesCount = products.filter(p => p.privateNotes).length;

  const backupMetadata = {
    template: backupFieldsDefinition.industry || 'General Products (Custom)',
    fieldNames: backupFieldsDefinition.fields?.map(f => ({
      key: f.key,
      label: f.label,
      enabled: f.enabled,
      type: f.type,
      unitsEnabled: f.unitsEnabled || false,
      unitOptions: f.unitOptions || [],
    })) || [],
    privateNotesCount,
    customFieldLabelsCount: customFieldLabels.length,
    enabledFieldsCount: enabledFields.length,
    watermarkSettings: {
      showWatermark: safeGetFromStorage('showWatermark', false),
      watermarkText: safeGetFromStorage('watermarkText', 'Created using CatShare'),
      watermarkPosition: safeGetFromStorage('watermarkPosition', 'bottom-center'),
    },
    currencySettings: {
      defaultCurrency,
      customCurrencies,
    },
    priceUnits,
  };

  // Log what's being backed up
  console.log(`\n📋 BACKING UP FIELD CONFIGURATION:`);
  console.log(`   Template: ${backupMetadata.template}`);
  console.log(`   Enabled Fields: ${backupMetadata.enabledFieldsCount}`);
  if (backupMetadata.customFieldLabelsCount > 0) {
    console.log(`   Custom Field Labels: ${backupMetadata.customFieldLabelsCount}`);
    customFieldLabels.forEach(f => console.log(`      • ${f.key}: "${f.label}"`));
  }
  if (privateNotesCount > 0) {
    console.log(`   Private Notes: Found in ${privateNotesCount} products`);
  }
  if (enabledFields.some(f => f.unitsEnabled)) {
    console.log(`   Fields with Units:`);
    enabledFields.filter(f => f.unitsEnabled).forEach(f => {
      console.log(`      • ${f.label}: ${f.unitOptions?.join(', ') || 'default units'}`);
    });
  }

  console.log(`\n💱 BACKING UP CURRENCY & PRICE SETTINGS:`);
  console.log(`   Default Currency: ${backupMetadata.currencySettings.defaultCurrency}`);
  if (Object.keys(backupMetadata.currencySettings.customCurrencies).length > 0) {
    console.log(`   Custom Currencies: ${Object.keys(backupMetadata.currencySettings.customCurrencies).length}`);
    Object.entries(backupMetadata.currencySettings.customCurrencies).forEach(([code, symbol]) => {
      console.log(`      • ${code}: ${symbol}`);
    });
  }
  console.log(`   Price Units: ${backupMetadata.priceUnits.join(', ')}`);

  zip.file("catalogue-data.json", JSON.stringify({
    version: 3, // New version with comprehensive metadata
    products: dataForJson,
    deleted: deletedForJson,
    cataloguesDefinition,
    fieldsDefinition: backupFieldsDefinition, // Include field definitions with template name to preserve custom field labels
    categories,
    metadata: backupMetadata, // NEW: Comprehensive metadata for complete restoration
    backupDate: new Date().toISOString(),
    appVersion: APP_VERSION
  }, null, 2));

  try {
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    console.log(`✅ Backup ZIP created successfully. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

    // Track backup creation
    logBackupCreated(blob.size);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-T:.]/g, "").slice(0, 12);
    const filename = `catalogue-backup-${timestamp}.zip`;

    // MAX size for FileSharer base64 (around 10MB binary = ~13.3MB base64)
    const MAX_FILESHARER_SIZE = 13 * 1024 * 1024;

    try {
      // Convert to base64 safely in chunks
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Data = btoa(binary);

      // Check if base64 would exceed FileSharer limits
      if (base64Data.length > MAX_FILESHARER_SIZE) {
        console.log(`⚠️ Backup base64 too large (${(base64Data.length / 1024 / 1024).toFixed(2)}MB base64), showing error dialog...`);
        setShareErrorMessage(`Backup file is too large (${(blob.size / 1024 / 1024).toFixed(2)}MB). The maximum FileSharer limit is around 10MB. Would you like to download it instead?`);
        setShareErrorBlob(blob);
        setShareErrorFilename(filename);
        setShareErrorBase64(null);
        setShowShareErrorDialog(true);
        return;
      }

      // Try to save to filesystem first (for mobile persistence)
      try {
        // Create CatShare folder in Documents if it doesn't exist
        try {
          await Filesystem.mkdir({
            path: "CatShare",
            directory: Directory.Documents,
            recursive: true,
          });
          console.log(`✅ CatShare folder ensured in Documents`);
        } catch (mkdirErr) {
          // Folder might already exist, which is fine
          if (!mkdirErr.message?.includes("Directory already exists")) {
            console.warn("⚠️ Failed to create CatShare folder:", mkdirErr.message);
          }
        }

        // Write backup to CatShare folder
        await Filesystem.writeFile({
          path: `CatShare/${filename}`,
          data: base64Data,
          directory: Directory.Documents,
        });
        console.log(`✅ Backup file written to Documents > CatShare: ${filename}`);
      } catch (writeErr) {
        console.warn("⚠️ Could not write to filesystem, will still try to share:", writeErr.message);
      }

      // Try to share the file via FileSharer
      try {
        await FileSharer.share({
          filename,
          base64Data,
          contentType: "application/zip",
        });

        // Track successful FileSharer share
        logBackupSharedFileSharer(blob.size);

        setBackupResult({
          status: "success",
          message: "Backup ZIP created and shared",
        });
      } catch (fileShareErr) {
        console.error("FileSharer failed:", fileShareErr.message);
        logFileSharerError(fileShareErr.message);
        // Show dialog with retry/download options instead of silent fallback
        setShareErrorMessage(`Sharing via FileSharer failed. Would you like to download instead?`);
        setShareErrorBlob(blob);
        setShareErrorFilename(filename);
        setShareErrorBase64(base64Data);
        setShowShareErrorDialog(true);
      }
    } catch (err) {
      // Handle other errors (base64 conversion, filesystem write, etc.)
      console.error("Backup process error:", err.message);
      setBackupResult({
        status: "error",
        message: "Backup failed: " + err.message,
      });
    }
  } catch (genErr) {
    console.error("Backup generation failed:", genErr);
    setBackupResult({
      status: "error",
      message: "Backup failed: " + genErr.message,
    });
  }
};

 


const exportProductsToCSV = (products) => {
  if (!products || products.length === 0) {
    showToast("No products to export!", "warning");
    return;
  }

  // Convert objects to CSV format
  const headers = Object.keys(products[0]); // Use object keys as headers
  const csvRows = [
    headers.join(","), // header row
    ...products.map((product) =>
      headers
        .map((header) => {
          let val = product[header] ?? "";
          // Escape quotes and commas
          if (typeof val === "string") {
            val = val.replace(/"/g, '""');
            if (val.includes(",") || val.includes("\n")) {
              val = `"${val}"`;
            }
          }
          return val;
        })
        .join(",")
    ),
  ];

  const csvData = csvRows.join("\n");

  // Create a download link
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "products.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  logCsvExported(products.length);
};




  const handleRestore = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const zip = await JSZip.loadAsync(event.target.result);

      // Try to find catalogue-data.json at root first
      let jsonFile = zip.file("catalogue-data.json");

      // If not found at root, search for it in any subfolder (handles zipped folders)
      if (!jsonFile) {
        console.log("🔍 catalogue-data.json not found at root, searching subfolders...");
        const allFiles = Object.keys(zip.files);
        const match = allFiles.find(name => name.endsWith("catalogue-data.json"));
        if (match) {
          console.log(`✅ Found catalogue-data.json at: ${match}`);
          jsonFile = zip.file(match);
        }
      }

      if (!jsonFile) {
        console.error("❌ ZIP contents:", Object.keys(zip.files));
        throw new Error("Missing catalogue-data.json in backup");
      }

      const jsonText = await jsonFile.async("text");
      const parsed = JSON.parse(jsonText);

      // Check if this is a v3 backup with comprehensive metadata
      const isV3Backup = parsed.version === 3 && parsed.metadata;

      // Validate backup format
      if (!parsed.products || !Array.isArray(parsed.products)) {
        throw new Error("Invalid backup format: missing products array");
      }

      // CRITICAL: Determine which field definition to use
      // Priority: 1) Backup's own fieldsDefinition (preserves original labels)
      //          2) Auto-analyzed from product data (fallback for old backups)
      let backupFieldDef = null;

      if (parsed.fieldsDefinition) {
        // Backup has its own field definition - use it to preserve original field labels
        console.log("✅ Found fieldsDefinition in backup - using original field labels and configuration");

        // Ensure price fields retain their unit configuration from defaults if not in backup
        const defaultDef = getCataloguesDefinition ? safeGetFromStorage('fieldsDefinition', null) : null;
        if (parsed.fieldsDefinition.fields && !parsed.fieldsDefinition.fields.some(f => f.key === 'price1' && f.unitOptions?.length > 0)) {
          // Price fields might not have unit options in old backups, merge with defaults
          parsed.fieldsDefinition.fields = parsed.fieldsDefinition.fields.map(f => {
            if (f.key === 'price1' && (!f.unitOptions || f.unitOptions.length === 0)) {
              // Add default unit options for price1
              return {
                ...f,
                unitsEnabled: true,
                unitOptions: ['/ piece', '/ dozen', '/ set'],
                defaultUnit: '/ piece'
              };
            }
            return f;
          });
        }
        backupFieldDef = parsed.fieldsDefinition;

        // For v3 backups, also log the field names being restored
        if (isV3Backup && parsed.metadata?.fieldNames) {
          const enabledFields = parsed.metadata.fieldNames.filter(f => f.enabled);
          console.log(`\n📋 RESTORING FIELD CONFIGURATION FROM BACKUP:`);
          console.log(`   Template: ${parsed.metadata.template}`);
          console.log(`   Total Fields in Backup: ${parsed.metadata.fieldNames.length}`);
          console.log(`   Enabled Fields: ${enabledFields.length}`);

          // Log ALL enabled fields including price fields
          enabledFields.forEach(f => {
            const unitInfo = f.unitsEnabled ? `✅ Units: ${f.unitOptions?.join(', ') || 'default units'}` : 'No units';
            console.log(`      • ${f.key} (${f.label}) - ${unitInfo}`);
          });

          if (parsed.metadata.customFieldLabelsCount > 0) {
            console.log(`   Custom Field Labels: ${parsed.metadata.customFieldLabelsCount}`);
            enabledFields.forEach(f => {
              const defaultLabel = `Field ${f.key.replace('field', '')}`;
              if (f.label !== defaultLabel && f.label !== f.key) {
                console.log(`      ✅ ${f.key}: "${f.label}"`);
              }
            });
          }

          const fieldsWithUnits = enabledFields.filter(f => f.unitsEnabled);
          if (fieldsWithUnits.length > 0) {
            console.log(`   Fields with Units:`);
            fieldsWithUnits.forEach(f => {
              console.log(`      ✅ ${f.label}: ${f.unitOptions?.join(', ') || 'default units'}`);
            });
          }
        }
      } else {
        // Old backup without fieldsDefinition - analyze the product data to detect fields
        console.log("🔎 Analyzing original backup fields BEFORE migration (old backup format - v1)...");
        applyBackupFieldAnalysis(parsed.products, true); // Pass true to indicate this is an old backup
        backupFieldDef = safeGetFromStorage('fieldsDefinition', null);
        console.log("✅ Original backup fields analyzed and auto-detected");
        console.log("📋 Setting template to 'Custom Fields (from Backup)' to indicate old backup");
      }

      const rebuilt = await Promise.all(
        parsed.products.map(async (p) => {
          let imageRestored = false;

          // Try to restore image from ZIP file first (preferred method)
          if (p.imageFilename && p.imagePath) {
            const imgFile = zip.file(`images/${p.imageFilename}`);
            if (imgFile) {
              const base64 = await imgFile.async("base64");

              try {
                await Filesystem.writeFile({
                  path: p.imagePath,
                  data: base64,
                  directory: Directory.Data,
                  recursive: true,
                });
                imageRestored = true;
                console.log(`📸 Image restored from file for "${p.name}": ${p.imagePath}`);
              } catch (err) {
                console.warn(`❌ Image write failed for "${p.name}":`, p.imagePath, err);
              }

              // ✅ ADD THIS BLOCK HERE
              if (!p.imageUrl && imageRestored && false) {
                try {
                  const { uploadImageToR2 } = await import('./services/cloudflareService');
                  const folder = p.imagePath.split("/")[0];
                  const filename = p.imageFilename;
                  const mimeType = filename.endsWith(".jpg") ? "image/jpeg" : "image/png";

                  const result = await uploadImageToR2(base64, filename, folder, mimeType);
                  if (result.success) {
                    p.imageUrl = result.publicUrl;
                    console.log(`☁️ Uploaded to R2 for "${p.name}": ${result.publicUrl}`);
                  } else {
                    console.warn(`⚠️ R2 upload failed for "${p.name}":`, result.error);
                  }
                } catch (err) {
                  console.warn(`⚠️ R2 upload error for "${p.name}":`, err.message);
                }
              }

            } else {
              console.warn(`⚠️ Image file not found in ZIP for "${p.name}": images/${p.imageFilename}`);
            }
          }

          // Fallback: Keep base64 image if no file-based image was restored
          if (!imageRestored && p.image && typeof p.image === 'string') {
            console.log(`📸 Keeping base64 image for "${p.name}" (${(p.image.length / 1024).toFixed(1)} KB)`);
          }

          const clean = { ...p };
          delete clean.imageBase64;
          delete clean.imageFilename;
          // KEEP p.image if it exists (base64 fallback)

          // Migrate old field names to new field names (Colour -> field1, Package -> field2, etc.)
          const migrated = migrateProductToNewFormat(clean);

          // IMPORTANT: Sync badge from catalogueData to root level for consistency
          // This ensures old backups with badge only in catalogueData get the root-level field
          if (!migrated.badge && migrated.catalogueData) {
            // Find the first catalogue with a badge and sync it to root level
            for (const catId in migrated.catalogueData) {
              if (migrated.catalogueData[catId]?.badge) {
                migrated.badge = migrated.catalogueData[catId].badge;
                break;
              }
            }
          }

          return migrated;
        })
      );

      // CRITICAL: Clear everything first to maximize space for new data
      // BUT preserve critical settings that shouldn't be lost during restore
      console.log("🗑️ Clearing old data to free up maximum space...");

      console.log(`📦 Backup format: v${parsed.version}${isV3Backup ? ' (comprehensive)' : ''}`);

      // Preserve critical settings before clearing
      const preservedSettings = {
        hasCompletedOnboarding: safeGetFromStorage('hasCompletedOnboarding', false),
        darkMode: safeGetFromStorage('darkMode', false),
        showWatermark: isV3Backup && parsed.metadata?.watermarkSettings
          ? parsed.metadata.watermarkSettings.showWatermark
          : safeGetFromStorage('showWatermark', true),
        watermarkText: isV3Backup && parsed.metadata?.watermarkSettings
          ? parsed.metadata.watermarkSettings.watermarkText
          : safeGetFromStorage('watermarkText', 'Created using CatShare'),
        watermarkPosition: isV3Backup && parsed.metadata?.watermarkSettings
          ? parsed.metadata.watermarkSettings.watermarkPosition
          : safeGetFromStorage('watermarkPosition', 'bottom-left'),
        fieldsDefinition: backupFieldDef,
        userId: localStorage.getItem('userId'),
        supabase_user_id: localStorage.getItem('supabase_user_id'), // ✅ ADD THIS LINE
      };

      // Restore currency and price units from backup if available
      if (isV3Backup && parsed.metadata?.currencySettings) {
        if (parsed.metadata.currencySettings.defaultCurrency) {
          preservedSettings.defaultCurrency = parsed.metadata.currencySettings.defaultCurrency;
        }
        if (parsed.metadata.currencySettings.customCurrencies && Object.keys(parsed.metadata.currencySettings.customCurrencies).length > 0) {
          preservedSettings.customCurrencies = parsed.metadata.currencySettings.customCurrencies;
        }
      }

      if (isV3Backup && parsed.metadata?.priceUnits && Array.isArray(parsed.metadata.priceUnits) && parsed.metadata.priceUnits.length > 0) {
        preservedSettings.priceFieldUnits = parsed.metadata.priceUnits;
      }

      console.log("💾 Preserved critical settings:", Object.keys(preservedSettings));
      if (isV3Backup && parsed.metadata?.watermarkSettings) {
        console.log("📝 Restoring watermark settings from backup metadata");
      }
      if (isV3Backup && parsed.metadata?.currencySettings) {
        console.log("💱 Restoring currency and custom currencies from backup metadata");
      }
      if (isV3Backup && parsed.metadata?.priceUnits) {
        console.log("💵 Restoring price units from backup metadata");
      }

      // Validate that fieldsDefinition includes units configuration
      if (backupFieldDef?.fields) {
        const fieldsWithUnits = backupFieldDef.fields.filter(f => f.enabled && f.unitsEnabled);
        const priceFields = backupFieldDef.fields.filter(f => f.key.startsWith('price'));

        console.log(`\n🔍 FIELD RESTORATION VALIDATION:`);
        console.log(`   Total fields in definition: ${backupFieldDef.fields.length}`);
        console.log(`   Enabled fields: ${backupFieldDef.fields.filter(f => f.enabled).length}`);
        console.log(`   Price fields found: ${priceFields.length}`);

        priceFields.forEach(f => {
          console.log(`   → ${f.key} (${f.label}): enabled=${f.enabled}, unitsEnabled=${f.unitsEnabled}, units=${f.unitOptions?.join(', ') || 'none'}`);
        });

        if (fieldsWithUnits.length > 0) {
          console.log(`✅ UNITS ENABLED - Fields with units in restored definition:`);
          fieldsWithUnits.forEach(f => {
            console.log(`   • ${f.label}: ${f.unitOptions?.join(', ') || 'default units'}`);
          });
        }
      }

      const supabaseAuthSnapshotBrowse = snapshotSupabaseAuthFromLocalStorage();
      setDeletedProducts([]);
      localStorage.clear(); // Nuclear option - clear EVERYTHING

      // Restore preserved settings
      console.log("♻️ Restoring preserved settings...");
      Object.entries(preservedSettings).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (key === 'userId' || key === 'supabase_user_id') {
            localStorage.setItem(key, value); // ✅ plain string, no JSON
          } else {
            safeSetInStorage(key, value);
          }
        }
      });
      restoreSupabaseAuthToLocalStorage(supabaseAuthSnapshotBrowse);
      void refreshSupabaseSessionFromStorage();
      console.log("✅ Preserved settings restored with auto-detected fields");

      // Log currency and price units restoration
      if (isV3Backup && parsed.metadata?.currencySettings) {
        console.log(`\n💱 CURRENCY RESTORATION SUMMARY:`);
        console.log(`   Default Currency: ${preservedSettings.defaultCurrency || 'Not restored'}`);
        if (preservedSettings.customCurrencies && Object.keys(preservedSettings.customCurrencies).length > 0) {
          console.log(`   Custom Currencies: ${Object.keys(preservedSettings.customCurrencies).length}`);
          Object.entries(preservedSettings.customCurrencies).forEach(([code, symbol]) => {
            console.log(`      • ${code}: ${symbol}`);
          });
        }
      }

      if (isV3Backup && parsed.metadata?.priceUnits) {
        console.log(`\n💵 PRICE UNITS RESTORATION SUMMARY:`);
        console.log(`   Price Units: ${preservedSettings.priceFieldUnits?.join(', ') || 'Not restored'}`);
      }

      // Aggressively clean products - remove ALL image data except imagePath and imageUrl
      const cleanedProducts = rebuilt.map(p => {
        const clean = { ...p };
        // Remove ALL image-related fields EXCEPT imagePath and imageUrl
        delete clean.image; // base64 image
        delete clean.imageBase64;
        delete clean.imageData;
        delete clean.imageFilename;
        delete clean.renderedImages;
        // ✅ KEEP imagePath - reference to where the image file is stored on the filesystem
        // ✅ KEEP imageUrl - cloud image URL from R2 (critical for cross-device sync)
        if (p.imageUrl) {
          console.log(`☁️ Preserved cloud image URL for "${p.name}": ${p.imageUrl}`);
        }
        return clean;
      });

      console.log(`📦 Products to save: ${cleanedProducts.length}`);
      console.log(`📊 Data size: ${JSON.stringify(cleanedProducts).length / 1024}KB`);

      let productsToUse = cleanedProducts;

      try {
        localStorage.setItem(
          user?.uid ? getStorageKey("products", user.uid) : "products",
          JSON.stringify(cleanedProducts)
        );
        console.log("✅ Products saved successfully");
      } catch (err) {
        console.error("❌ Failed to save products:", err.message);
        // If still too large, limit to first 50 products
        if (err.name === "QuotaExceededError") {
          console.warn("⚠️ Data still too large, limiting to 50 products...");
          productsToUse = cleanedProducts.slice(0, 50);
          localStorage.setItem(
            user?.uid ? getStorageKey("products", user.uid) : "products",
            JSON.stringify(productsToUse)
          );
          alert("⚠️ Restore limited to first 50 products due to storage quota. You can restore more products later by importing additional backups.");
        } else {
          throw err;
        }
      }

      setProducts(productsToUse);
      window.dispatchEvent(new CustomEvent("product-added"));

      // Restore categories from backup if available, otherwise extract from products
      try {
        if (parsed.categories && Array.isArray(parsed.categories)) {
          localStorage.setItem("categories", JSON.stringify(parsed.categories));
        } else {
          const categories = Array.from(
            new Set(
              rebuilt.flatMap((p) =>
                Array.isArray(p.category) ? p.category : [p.category]
              )
            )
          ).filter(Boolean);
          localStorage.setItem("categories", JSON.stringify(categories));
        }
      } catch (catErr) {
        console.warn("⚠️ Could not save categories:", catErr.message);
      }

      // Restore deleted products (shelf items) from backup
      let restoredDeletedShelf = [];
      if (Array.isArray(parsed.deleted) && parsed.deleted.length > 0) {
        console.log(`📂 Restoring ${parsed.deleted.length} deleted products (shelf items)...`);

        restoredDeletedShelf = await Promise.all(
          parsed.deleted.map(async (p) => {
            // Restore image from ZIP
            if (p.imageFilename && p.imagePath) {
              const imgFile = zip.file(`images/${p.imageFilename}`);
              if (imgFile) {
                try {
                  const base64 = await imgFile.async("base64");
                  await Filesystem.writeFile({
                    path: p.imagePath,
                    data: base64,
                    directory: Directory.Data,
                    recursive: true,
                  });
                  console.log(`✅ Image restored for deleted product "${p.name}"`);
                } catch (err) {
                  console.warn("Image write failed for deleted product:", p.imagePath);
                }
              }
            }

            // Clean up the product object
            const clean = { ...p };
            delete clean.imageBase64;
            delete clean.imageFilename;
            // ✅ KEEP imageUrl for cloud sync (same as active products)
            const migrated = migrateProductToNewFormat(clean);
            return migrated;
          })
        );

        // Save deleted products to localStorage
        try {
          localStorage.setItem(
            user?.uid ? getStorageKey("deletedProducts", user.uid) : "deletedProducts",
            JSON.stringify(restoredDeletedShelf)
          );
          setDeletedProducts(restoredDeletedShelf);
          console.log(`✅ Restored ${restoredDeletedShelf.length} shelf items successfully`);
        } catch (err) {
          console.warn("⚠️ Could not save deleted products (shelf items):", err.message);
        }
      }

      // Restore catalogues definition from backup
      // If the backup doesn't have cataloguesDefinition (old backups v1), use defaults
      if (parsed.cataloguesDefinition) {
        setCataloguesDefinition(parsed.cataloguesDefinition);
        console.log("✅ Restored catalogues definition from backup");
      } else {
        // Backward compatibility: old backups don't have cataloguesDefinition
        // Use the current one if it exists, otherwise use defaults
        const currentCatalogues = getCataloguesDefinition();
        if (!currentCatalogues || currentCatalogues.catalogues.length === 0) {
          // If no catalogues exist, restore defaults
          setCataloguesDefinition({
            version: 1,
            catalogues: DEFAULT_CATALOGUES,
            lastUpdated: Date.now(),
          });
          console.log("⚠️ Old backup detected - using default catalogues");
        } else {
          console.log("ℹ️ Using existing catalogue configuration");
        }
      }

      // Auto-create legacy Resell catalogue if the backup has resell data (backward compatibility)
      // This ensures old data from the 2-catalogue system is accessible in the new single-catalogue system
      createLegacyResellCatalogueIfNeeded(rebuilt);

      // Re-run migrations after catalogues definition has been restored
      // This ensures all products have the proper field structure for the restored catalogues
      ensureProductsHaveStockFields();

      console.log(`✅ Backup restored successfully - ${rebuilt.length} products restored`);

      // Track backup restoration
      logBackupRestored(file.size);

      showToast(`Catalogue restored successfully (${rebuilt.length} products).`, "success");

      // 🔄 Dispatch event to notify all components that field definitions have changed
      // This forces ProductPreviewModal and other components to reload field definitions
      const templateName = backupFieldDef?.industry || 'General Products (Custom)';
      window.dispatchEvent(new CustomEvent("fieldDefinitionsChanged", {
        detail: {
          newDefinition: backupFieldDef,
          template: templateName,
          isBackupRestore: true
        }
      }));
      console.log(`🔄 Dispatched fieldDefinitionsChanged event - Template: ${templateName}`);
      console.log(`📋 Field definitions restored with template: ${templateName}`);

      // Log restoration summary for v3 backups
      if (isV3Backup && parsed.metadata) {
        const enabledFields = parsed.metadata.fieldNames?.filter(f => f.enabled) || [];
        console.log(`\n📊 COMPREHENSIVE BACKUP RESTORATION SUMMARY:`);
        console.log(`   ✅ Template: ${parsed.metadata.template}`);
        console.log(`   ✅ Enabled Fields: ${enabledFields.length} (of ${parsed.metadata.fieldNames?.length || 0} total)`);
        if (parsed.metadata.customFieldLabelsCount > 0) {
          console.log(`   ✅ Custom Field Names: ${parsed.metadata.customFieldLabelsCount}`);
        }
        if (parsed.metadata.privateNotesCount > 0) {
          console.log(`   ✅ Private Notes: ${parsed.metadata.privateNotesCount} product(s)`);
        }
        if (enabledFields.some(f => f.unitsEnabled)) {
          console.log(`   ✅ Fields with Units: ${enabledFields.filter(f => f.unitsEnabled).length}`);
        }
        console.log(`   ✅ Products: ${rebuilt.length} product(s)`);
        console.log(`   ✅ Deleted Items: ${Array.isArray(parsed.deleted) ? parsed.deleted.length : 0}`);
        console.log(`   ✅ Categories: ${Array.isArray(parsed.categories) ? parsed.categories.length : 0}`);
        console.log(`   ✅ Catalogues: ${getCataloguesDefinition()?.catalogues?.length || 0}`);
        console.log(`   ✅ Watermark Settings: Restored`);
        console.log(`   ✅ Backup Date: ${parsed.backupDate}`);
        console.log(`   ✅ App Version: ${parsed.appVersion}`);
      } else {
        console.log(`\n📊 BACKUP RESTORATION SUMMARY:`);
        console.log(`   ✅ Products: ${rebuilt.length} product(s)`);
        console.log(`   ✅ Template: ${templateName}`);
        console.log(`   ⚠️ Backup Version: v${parsed.version} (legacy format - no custom field names preserved)`);
      }

      setShowRenderAfterRestore(true);

      // ✅ Sync restored products to Supabase in background for cloud persistence
      // This ensures imageUrl fields are synced to cloud and available on other devices
      if (user && user.uid) {
  (async () => {
    try {
      // ✅ Upload missing images to R2 (Data + External + legacy paths, with retries)
      const updatedProducts = await uploadMissingProductImagesToR2ForRestore(productsToUse);

      // Save updated products with new imageUrls to localStorage
      localStorage.setItem(
        user?.uid ? getStorageKey("products", user.uid) : "products",
        JSON.stringify(updatedProducts)
      );
      setProducts(updatedProducts);
      window.dispatchEvent(new CustomEvent("product-added"));
      console.log('✅ Products updated with R2 image URLs');
            const { syncProducts, syncDeletedProducts, syncFieldsDefinition } = await import('./services/supabaseSync');

            // Sync active products
            const productsSyncResult = await syncProducts(user.uid, updatedProducts);
            if (productsSyncResult.success) {
              console.log(`✅ Restored ${productsToUse.length} products synced to Supabase successfully`);
            } else {
              console.warn('⚠️ Products sync warning:', productsSyncResult.error);
            }

            // Shelf items: same R2 path resolution as active products, then sync
            if (restoredDeletedShelf.length > 0) {
              const updatedDeletedShelf = await uploadMissingProductImagesToR2ForRestore(
                restoredDeletedShelf
              );
              localStorage.setItem(
                user?.uid ? getStorageKey("deletedProducts", user.uid) : "deletedProducts",
                JSON.stringify(updatedDeletedShelf)
              );
              setDeletedProducts(updatedDeletedShelf);
              const deletedSyncResult = await syncDeletedProducts(user.uid, updatedDeletedShelf);
              if (deletedSyncResult.success) {
                console.log(
                  `✅ Restored ${updatedDeletedShelf.length} deleted products synced to Supabase successfully`
                );
              } else {
                console.warn('⚠️ Deleted products sync warning:', deletedSyncResult.error);
              }
            }

            // Sync fieldsDefinition to Supabase if it was restored
            if (backupFieldDef) {
              const fieldsSyncResult = await syncFieldsDefinition(user.uid, backupFieldDef);
              if (fieldsSyncResult.success) {
                console.log(`✅ Fields definition synced to Supabase: ${backupFieldDef.industry || 'Custom'}`);
              } else {
                console.warn('⚠️ Fields definition sync warning:', fieldsSyncResult.error);
              }
            }
          } catch (syncErr) {
            console.warn('⚠️ Background sync of restored products failed:', syncErr.message);
            // Don't show error to user - restore was successful, just sync failed
          }
        })();
      }
    } catch (err) {
      console.error("❌ Restore failed:", err);
      showToast("Restore failed: " + err.message, "error");
    }
  };

  reader.readAsArrayBuffer(file);
};

// Function to restore from a detected backup file in CatShare folder
const restoreFromDetectedBackup = async (backupFile) => {
  try {
    const fileData = await Filesystem.readFile({
      path: `CatShare/${backupFile.name}`,
      directory: Directory.Documents,
    });

    // Convert base64 string to Blob
    const binaryString = atob(fileData.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create a File object from the bytes
    const file = new File([bytes], backupFile.name, { type: "application/zip" });

    // Create a FileReader and trigger the restore logic
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const zip = await JSZip.loadAsync(event.target.result);

        // Try to find catalogue-data.json at root first
        let jsonFile = zip.file("catalogue-data.json");

        // If not found at root, search for it in any subfolder
        if (!jsonFile) {
          console.log("🔍 catalogue-data.json not found at root, searching subfolders...");
          const allFiles = Object.keys(zip.files);
          const match = allFiles.find(name => name.endsWith("catalogue-data.json"));
          if (match) {
            console.log(`✅ Found catalogue-data.json at: ${match}`);
            jsonFile = zip.file(match);
          }
        }

        if (!jsonFile) {
          console.error("❌ ZIP contents:", Object.keys(zip.files));
          throw new Error("Missing catalogue-data.json in backup");
        }

        const jsonText = await jsonFile.async("text");
        const parsed = JSON.parse(jsonText);

        // Check if this is a v3 backup
        const isV3Backup = parsed.version === 3 && parsed.metadata;

        // Validate backup format
        if (!parsed.products || !Array.isArray(parsed.products)) {
          throw new Error("Invalid backup format: missing products array");
        }

        // Determine field definition to use
        let backupFieldDef = null;

        if (parsed.fieldsDefinition) {
          console.log("✅ Found fieldsDefinition in backup - using original field labels and configuration");

          const defaultDef = getCataloguesDefinition ? safeGetFromStorage('fieldsDefinition', null) : null;
          if (parsed.fieldsDefinition.fields && !parsed.fieldsDefinition.fields.some(f => f.key === 'price1' && f.unitOptions?.length > 0)) {
            parsed.fieldsDefinition.fields = parsed.fieldsDefinition.fields.map(f => {
              if (f.key === 'price1' && (!f.unitOptions || f.unitOptions.length === 0)) {
                return {
                  ...f,
                  unitsEnabled: true,
                  unitOptions: ['/ piece', '/ dozen', '/ set'],
                  defaultUnit: '/ piece'
                };
              }
              return f;
            });
          }
          backupFieldDef = parsed.fieldsDefinition;
        } else {
          console.log("🔎 Analyzing original backup fields BEFORE migration (old backup format - v1)...");
          applyBackupFieldAnalysis(parsed.products, true);
          backupFieldDef = safeGetFromStorage('fieldsDefinition', null);
          console.log("✅ Original backup fields analyzed and auto-detected");
        }

        const rebuilt = await Promise.all(
          parsed.products.map(async (p) => {
            let imageRestored = false;

            if (p.imageFilename && p.imagePath) {
              const imgFile = zip.file(`images/${p.imageFilename}`);
              if (imgFile) {
                const base64 = await imgFile.async("base64");

                try {
                  await Filesystem.writeFile({
                    path: p.imagePath,
                    data: base64,
                    directory: Directory.Data,
                    recursive: true,
                  });
                  imageRestored = true;
                  console.log(`📸 Image restored from file for "${p.name}": ${p.imagePath}`);
                } catch (err) {
                  console.warn(`❌ Image write failed for "${p.name}":`, p.imagePath, err);
                }

                // ✅ ADD THIS BLOCK HERE
                if (!p.imageUrl && imageRestored && false) {
                  try {
                    const { uploadImageToR2 } = await import('./services/cloudflareService');
                    const folder = p.imagePath.split("/")[0];
                    const filename = p.imageFilename;
                    const mimeType = filename.endsWith(".jpg") ? "image/jpeg" : "image/png";

                    const result = await uploadImageToR2(base64, filename, folder, mimeType);
                    if (result.success) {
                      p.imageUrl = result.publicUrl;
                      console.log(`☁️ Uploaded to R2 for "${p.name}": ${result.publicUrl}`);
                    } else {
                      console.warn(`⚠️ R2 upload failed for "${p.name}":`, result.error);
                    }
                  } catch (err) {
                    console.warn(`⚠️ R2 upload error for "${p.name}":`, err.message);
                  }
                }

              } else {
                console.warn(`⚠️ Image file not found in ZIP for "${p.name}": images/${p.imageFilename}`);
              }
            }

            if (!imageRestored && p.image && typeof p.image === 'string') {
              console.log(`📸 Keeping base64 image for "${p.name}" (${(p.image.length / 1024).toFixed(1)} KB)`);
            }

            const clean = { ...p };
            delete clean.imageBase64;
            delete clean.imageFilename;

            const migrated = migrateProductToNewFormat(clean);

            if (!migrated.badge && migrated.catalogueData) {
              for (const catId in migrated.catalogueData) {
                if (migrated.catalogueData[catId]?.badge) {
                  migrated.badge = migrated.catalogueData[catId].badge;
                  break;
                }
              }
            }

            return migrated;
          })
        );

        console.log("🗑️ Clearing old data to free up maximum space...");
        console.log(`📦 Backup format: v${parsed.version}${isV3Backup ? ' (comprehensive)' : ''}`);

        const preservedSettings = {
          hasCompletedOnboarding: safeGetFromStorage('hasCompletedOnboarding', false),
          darkMode: safeGetFromStorage('darkMode', false),
          showWatermark: isV3Backup && parsed.metadata?.watermarkSettings
            ? parsed.metadata.watermarkSettings.showWatermark
            : safeGetFromStorage('showWatermark', true),
          watermarkText: isV3Backup && parsed.metadata?.watermarkSettings
            ? parsed.metadata.watermarkSettings.watermarkText
            : safeGetFromStorage('watermarkText', 'Created using CatShare'),
          watermarkPosition: isV3Backup && parsed.metadata?.watermarkSettings
            ? parsed.metadata.watermarkSettings.watermarkPosition
            : safeGetFromStorage('watermarkPosition', 'bottom-left'),
          fieldsDefinition: backupFieldDef,
          userId: localStorage.getItem('userId'),
          supabase_user_id: localStorage.getItem('supabase_user_id'), // ✅ ADD THIS LINE
        };

        if (isV3Backup && parsed.metadata?.currencySettings) {
          if (parsed.metadata.currencySettings.defaultCurrency) {
            preservedSettings.defaultCurrency = parsed.metadata.currencySettings.defaultCurrency;
          }
          if (parsed.metadata.currencySettings.customCurrencies && Object.keys(parsed.metadata.currencySettings.customCurrencies).length > 0) {
            preservedSettings.customCurrencies = parsed.metadata.currencySettings.customCurrencies;
          }
        }

        if (isV3Backup && parsed.metadata?.priceUnits && Array.isArray(parsed.metadata.priceUnits) && parsed.metadata.priceUnits.length > 0) {
          preservedSettings.priceFieldUnits = parsed.metadata.priceUnits;
        }

        const supabaseAuthSnapshotZip = snapshotSupabaseAuthFromLocalStorage();
        localStorage.clear();
Object.entries(preservedSettings).forEach(([key, value]) => {
  if (value !== undefined && value !== null) {
    if (key === 'userId' || key === 'supabase_user_id') {
      localStorage.setItem(key, value); // ✅ plain string, no JSON
    } else {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
});
        restoreSupabaseAuthToLocalStorage(supabaseAuthSnapshotZip);
        void refreshSupabaseSessionFromStorage();

        const cleanedProducts = rebuilt.map(p => {
          const clean = { ...p };
          delete clean.image;
          delete clean.imageBase64;
          delete clean.imageData;
          delete clean.imageFilename;
          delete clean.renderedImages;
          return clean;
        });

        console.log(`📦 Products to save: ${cleanedProducts.length}`);
        console.log(`📊 Data size: ${JSON.stringify(cleanedProducts).length / 1024}KB`);

        let productsToUse = cleanedProducts;

        try {
          localStorage.setItem(
            user?.uid ? getStorageKey("products", user.uid) : "products",
            JSON.stringify(cleanedProducts)
          );
          console.log("✅ Products saved successfully");
        } catch (err) {
          console.error("❌ Failed to save products:", err.message);
          if (err.name === "QuotaExceededError") {
            console.warn("⚠️ Data still too large, limiting to 50 products...");
            productsToUse = cleanedProducts.slice(0, 50);
            localStorage.setItem(
              user?.uid ? getStorageKey("products", user.uid) : "products",
              JSON.stringify(productsToUse)
            );
            alert("⚠️ Restore limited to first 50 products due to storage quota. You can restore more products later by importing additional backups.");
          } else {
            throw err;
          }
        }

        setProducts(productsToUse);
        window.dispatchEvent(new CustomEvent("product-added"));

        try {
          if (parsed.categories && Array.isArray(parsed.categories)) {
            localStorage.setItem("categories", JSON.stringify(parsed.categories));
          } else {
            const categories = Array.from(
              new Set(
                rebuilt.flatMap((p) =>
                  Array.isArray(p.category) ? p.category : [p.category]
                )
              )
            ).filter(Boolean);
            localStorage.setItem("categories", JSON.stringify(categories));
          }
        } catch (catErr) {
          console.warn("⚠️ Could not save categories:", catErr.message);
        }

        let restoredDeletedShelfZip = [];
        if (Array.isArray(parsed.deleted) && parsed.deleted.length > 0) {
          console.log(`📂 Restoring ${parsed.deleted.length} deleted products (shelf items)...`);

          restoredDeletedShelfZip = await Promise.all(
            parsed.deleted.map(async (p) => {
              if (p.imageFilename && p.imagePath) {
                const imgFile = zip.file(`images/${p.imageFilename}`);
                if (imgFile) {
                  try {
                    const base64 = await imgFile.async("base64");
                    await Filesystem.writeFile({
                      path: p.imagePath,
                      data: base64,
                      directory: Directory.Data,
                      recursive: true,
                    });
                    console.log(`✅ Image restored for deleted product "${p.name}"`);
                  } catch (err) {
                    console.warn("Image write failed for deleted product:", p.imagePath);
                  }
                }
              }

              const clean = { ...p };
              delete clean.imageBase64;
              delete clean.imageFilename;
              const migrated = migrateProductToNewFormat(clean);
              return migrated;
            })
          );

          try {
            localStorage.setItem(
              user?.uid ? getStorageKey("deletedProducts", user.uid) : "deletedProducts",
              JSON.stringify(restoredDeletedShelfZip)
            );
            setDeletedProducts(restoredDeletedShelfZip);
            console.log(`✅ Restored ${restoredDeletedShelfZip.length} shelf items successfully`);
          } catch (err) {
            console.warn("⚠️ Could not save deleted products (shelf items):", err.message);
          }
        }

        if (parsed.cataloguesDefinition) {
          setCataloguesDefinition(parsed.cataloguesDefinition);
          console.log("✅ Restored catalogues definition from backup");
        } else {
          const currentCatalogues = getCataloguesDefinition();
          if (!currentCatalogues || currentCatalogues.catalogues.length === 0) {
            setCataloguesDefinition({
              version: 1,
              catalogues: DEFAULT_CATALOGUES,
              lastUpdated: Date.now(),
            });
            console.log("⚠️ Old backup detected - using default catalogues");
          } else {
            console.log("ℹ️ Using existing catalogue configuration");
          }
        }

        createLegacyResellCatalogueIfNeeded(rebuilt);
        ensureProductsHaveStockFields();

        console.log(`✅ Backup restored successfully - ${rebuilt.length} products restored`);
        logBackupRestored(file.size);

        showToast(`Catalogue restored successfully (${rebuilt.length} products).`, "success");

        const templateName = backupFieldDef?.industry || 'General Products (Custom)';
        window.dispatchEvent(new CustomEvent("fieldDefinitionsChanged", {
          detail: {
            newDefinition: backupFieldDef,
            template: templateName,
            isBackupRestore: true
          }
        }));
        console.log(`🔄 Dispatched fieldDefinitionsChanged event - Template: ${templateName}`);

       // ✅ Upload missing images to R2 and sync to Supabase
if (user && user.uid) {
  (async () => {
    try {
      const hasSession = await refreshSupabaseSessionFromStorage();
      if (!hasSession) {
        console.warn('⚠️ No Supabase session after restore; skipping cloud sync. Try signing in again.');
        return;
      }
      const updatedProducts = await uploadMissingProductImagesToR2ForRestore(productsToUse);

      localStorage.setItem(
        user?.uid ? getStorageKey("products", user.uid) : "products",
        JSON.stringify(updatedProducts)
      );
      setProducts(updatedProducts);
      window.dispatchEvent(new CustomEvent("product-added"));
      console.log('✅ Products updated with R2 image URLs');

      const { syncProducts, syncDeletedProducts, syncFieldsDefinition } = await import('./services/supabaseSync');
      await syncProducts(user.uid, updatedProducts);
      if (restoredDeletedShelfZip.length > 0) {
        const updatedDeletedShelf = await uploadMissingProductImagesToR2ForRestore(
          restoredDeletedShelfZip
        );
        localStorage.setItem(
          user?.uid ? getStorageKey("deletedProducts", user.uid) : "deletedProducts",
          JSON.stringify(updatedDeletedShelf)
        );
        setDeletedProducts(updatedDeletedShelf);
        await syncDeletedProducts(user.uid, updatedDeletedShelf);
      }
    } catch (err) {
      console.warn('⚠️ Background sync failed:', err.message);
    }
  })();
}

setShowRenderAfterRestore(true);
setShowBackupPopup(false);
setShowBrowseForBackup(false);
      } catch (err) {
        console.error("❌ Restore failed:", err);
        showToast("Restore failed: " + err.message, "error");
      }
    };

    reader.onerror = (err) => {
      console.error("Error reading file:", err);
      showToast("Failed to read backup file", "error");
    };

    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error("Error restoring from detected backup:", err);
    showToast("Failed to restore backup: " + err.message, "error");
  }
};

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="absolute left-0 w-64 bg-white shadow-lg flex flex-col overflow-hidden"
          style={{
            top: 0,
            height: "100%",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-[40px] bg-black flex-shrink-0"></div>
          <div className="overflow-y-auto flex-1 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              Me<span
                onClick={handleNClick}
                className="cursor-pointer"
                title={showHiddenFeatures ? "Features unlocked! 🎉" : ""}
              >n</span>u
            </h2>
          </div>

          {user ? (
            <div className="mb-4 p-3 bg-gray-100 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "User")}`}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user.displayName || user.email}
                  </p>
                  <p className="text-xs text-gray-600 truncate">{user.email}</p>
                  <p className={accountPlanLine.className}>{accountPlanLine.text}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  navigate("/account");
                  onClose();
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-1"
              >
                Account Settings
              </button>
            </div>
          ) : (
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => {
                  navigate("/login");
                  onClose();
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  navigate("/register");
                  onClose();
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300 transition"
              >
                Create Account
              </button>
            </div>
          )}

          {showHiddenFeatures && (
            <button
              onClick={() => {
                navigate("/welcome");
                onClose();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 mb-2 rounded-lg bg-gradient-to-r from-blue-400 to-blue-500 text-white hover:from-blue-500 hover:to-blue-600 transition shadow-md font-medium"
              title="Reset onboarding setup"
            >
              <span className="text-white text-[18px]">🎯</span>
              <span className="text-sm font-medium">Welcome Setup</span>
            </button>
          )}

          <button
  onClick={() => setShowBackupPopup(true)}
  className="w-full flex items-center gap-3 px-5 py-3 mb-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
>
  <MdBackup className="text-gray-500 text-[18px]" />
  <span className="text-sm font-medium">Backup & Restore</span>
</button>



<button
  onClick={() => {
    navigate("/shelf");
    onClose();
  }}
  className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
>
  <span className="text-gray-500 text-[18px]"><MdInventory2 /></span>
  <span className="text-sm font-medium">Shelf</span>
</button>

<button
  onClick={() => setShowCategories(true)}
  className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
>
  <MdCategory className="text-gray-500 text-[18px]" />
  <span className="text-sm font-medium">Manage Categories</span>
</button>

{showHiddenFeatures && (
  <>
    <button
      onClick={() => {
        navigate('/retail');
        onClose();
      }}
      className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
    >
      <span className="text-gray-500">🛍️</span>
      <span className="text-sm font-medium">Retail</span>
    </button>

    <button
      onClick={() => setShowMediaLibrary(true)}
      className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
    >
      <span className="text-gray-500">🖼️</span>
      <span className="text-sm font-medium">Media Library</span>
    </button>

    <button
      onClick={() => {
        navigate("/website");
        onClose();
      }}
      className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition shadow-md"
    >
      <MdPublic className="text-white text-[18px]" />
      <span className="text-sm font-medium">Website</span>
    </button>
  </>
)}

<button
  onClick={() => setShowBulkEdit(true)}
  className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
>
  <RiEdit2Line className="text-gray-500 text-[18px]" />
  <span className="text-sm font-medium">Bulk Editor</span>
</button>

<button
  onClick={() => {
    navigate("/settings");
    onClose();
  }}
  className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
>
  <MdSettings className="text-gray-500 text-[18px]" />
  <span className="text-sm font-medium">Settings</span>
</button>

<button
  onClick={() => {
    onShowTutorial();
  }}
  className="w-full flex items-center gap-3 px-5 py-3 mb-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition shadow-sm"
>
  <MdBook className="text-gray-500 text-[18px]" />
  <span className="text-sm font-medium">Tutorial</span>
</button>

<div>
<button
  onClick={() => setShowRenderConfirm(true)}
  disabled={isRendering}
  className={`w-full flex items-center gap-3 px-5 py-3 mb-1 rounded-lg text-sm font-medium transition shadow-sm ${
    isRendering
      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
      : "bg-gray-800 text-white hover:bg-gray-700"
  }`}
>
  <MdImage className={`text-[18px] ${isRendering ? "text-gray-400" : "text-white"}`} />
  <span>{isRendering ? "Rendering images..." : "Render images"}</span>
</button>

{showHiddenFeatures && (
  <button
    onClick={() => handleDownloadRenderedImages()}
    className="w-full flex items-center gap-3 px-5 py-3 rounded-lg text-sm font-medium transition shadow-sm bg-blue-600 text-white hover:bg-blue-700 mb-2"
    title="Download all rendered product images"
  >
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    <span>Download PNGs</span>
  </button>
)}

{showBackupPopup && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    onClick={() => setShowBackupPopup(false)}
    data-backup-popup="true"
  >
    <div
      className="bg-white/80 border border-white/50 backdrop-blur-xl shadow-2xl rounded-2xl p-6 w-full max-w-xs text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Backup & Restore</h2>

      <div className="flex justify-center items-center gap-8 mb-4">
        {/* Backup */}
        <button
          onClick={() => {
            setShowBackupPopup(false);
            handleBackup();
          }}
          className="flex flex-col items-center justify-center hover:text-gray-700 transition"
        >
          <div className="w-12 h-12 bg-gray-800 text-white rounded-full flex items-center justify-center text-2xl shadow-md">
            📦
          </div>
          <span className="text-xs font-medium text-gray-700 mt-2">Backup & Share</span>
        </button>

        {/* Restore */}
        <button
          onClick={() => {
            const input = document.getElementById("catshare-backup-file-input");
            if (input) {
              input.click();
            }
          }}
          className="flex flex-col items-center justify-center hover:text-gray-700 transition"
        >
          <div className="w-12 h-12 bg-gray-200 text-gray-800 rounded-full flex items-center justify-center text-2xl shadow-md">
            📂
          </div>
          <span className="text-xs font-medium text-gray-700 mt-2">Restore</span>
        </button>
      </div>

      {/* Hidden file input that opens the system file manager.
          On Android this will typically default to Documents > CatShare
          because that's where backups are written. */}
      <input
        id="catshare-backup-file-input"
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          setShowBackupPopup(false);
          handleRestore(e);
        }}
      />

      <button
        onClick={() => setShowBackupPopup(false)}
        className="mt-1 text-sm text-gray-500 hover:text-red-500 transition"
      >
        Cancel
      </button>
    </div>
  </div>
)}

{showRenderAfterRestore && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-lg z-50 flex items-center justify-center px-4">
    <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-xs">
      <h2 className="text-lg font-bold text-gray-800 mb-3 text-center">Render images?</h2>

      <div className="space-y-3 mb-4">
        <p className="text-sm text-gray-600">
          Your catalogue has been restored. Would you like to render images now?
        </p>

        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
          <p className="text-xs text-red-800">
            <span className="font-semibold">⚠️ Important:</span> Rendering images is <span className="font-semibold">must to share</span> the images. Without rendering, you cannot share product images with customers.
          </p>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          Estimated time: <span className="font-semibold">{estimatedSeconds}</span> sec for {totalProducts} products
        </p>

        {isGlassTheme && (
          <div className="mt-3 p-3 bg-amber-50/70 border-l-4 border-amber-500 rounded-lg text-left backdrop-blur-md">
            <p className="text-[11px] text-amber-900 leading-relaxed">
              <span className="font-bold flex items-center gap-1 mb-0.5">
                <FiAlertCircle size={12} className="text-amber-600" />
                Glass Theme Notice
              </span>
              Rendering with transparency effects takes slightly more time but produces premium quality images.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4 pb-[env(safe-area-inset-bottom)]">
        <button
          className="px-5 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition text-sm"
          onClick={() => {
            setShowRenderAfterRestore(false);
            handleRenderAllImages(true);
          }}
        >
          Continue
        </button>

        <button
          className="px-5 py-2 rounded-full bg-gray-300 text-gray-800 font-medium shadow hover:bg-gray-400 transition text-sm"
          onClick={() => {
            setShowRenderAfterRestore(false);
            onClose();
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  </div>
)}

{showRenderConfirm && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-lg px-4">
    <div className="backdrop-blur-xl bg-white/70 border border-white/40 p-6 rounded-2xl shadow-2xl w-full max-w-xs text-center">
      <p className="text-lg font-medium text-gray-800 mb-2">Render all product images?</p>
<p className="text-sm text-gray-600 mb-4">
  Estimated time: <span className="font-semibold">{estimatedSeconds}</span> sec for {totalProducts} products
</p>

      {isGlassTheme && (
        <div className="mb-4 p-3 bg-amber-50/70 border-l-4 border-amber-500 rounded-lg text-left backdrop-blur-md">
          <p className="text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold flex items-center gap-1 mb-0.5">
              <FiAlertCircle size={12} className="text-amber-600" />
              Glass Theme Notice
            </span>
            Rendering with transparency effects takes slightly more time but produces premium quality images.
          </p>
        </div>
      )}

      <div className="flex justify-center gap-4">
        <button
          className="px-5 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-900 transition"
          onClick={() => {
            setShowRenderConfirm(false);
            onClose();
            setTimeout(() => handleRenderAllImages(true), 50);
          }}
        >
          Yes
        </button>
        <button
          className="px-5 py-2 rounded-full bg-gray-300 text-gray-800 font-medium shadow hover:bg-gray-400 transition"
          onClick={() => setShowRenderConfirm(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{backupResult && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full text-center">
      <div className="flex justify-center mb-4">
        {backupResult.status === "success" ? (
          <FiCheckCircle className="w-12 h-12 text-green-500" />
        ) : (
          <FiAlertCircle className="w-12 h-12 text-red-500" />
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        {backupResult.status === "success" ? "Success!" : "Failed"}
      </h2>

      <p className="text-sm text-gray-600 mb-5">
        {backupResult.message}
      </p>

      <button
        onClick={() => {
          setBackupResult(null);
          onClose();
        }}
        className="px-6 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
      >
        OK
      </button>
    </div>
  </div>
)}

{showShareErrorDialog && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full text-center">
      <div className="flex justify-center mb-4">
        <FiAlertCircle className="w-12 h-12 text-amber-500" />
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Sharing Failed
      </h2>

      <p className="text-sm text-gray-600 mb-6">
        {shareErrorMessage}
      </p>

      <div className="flex flex-col gap-3">
        {shareErrorBase64 ? (
          <>
            <button
              onClick={async () => {
                // Retry FileSharer
                try {
                  await FileSharer.share({
                    filename: shareErrorFilename,
                    base64Data: shareErrorBase64,
                    contentType: "application/zip",
                  });

                  setBackupResult({
                    status: "success",
                    message: "Backup ZIP created and shared",
                  });
                  setShowShareErrorDialog(false);
                } catch (retryErr) {
                  console.error("Retry failed:", retryErr.message);
                  // Update message to show retry failed
                  setShareErrorMessage("FileSharer still unavailable. Would you like to download instead?");
                  setShareErrorBase64(null); // Disable retry button for future attempts
                }
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium text-sm"
            >
              Retry
            </button>
            <button
              onClick={() => {
                // Download as fallback
                if (shareErrorBlob) {
                  const url = URL.createObjectURL(shareErrorBlob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = shareErrorFilename;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setTimeout(() => URL.revokeObjectURL(url), 100);

                  // Track backup download
                  logBackupDownloaded(shareErrorBlob.size);

                  setBackupResult({
                    status: "success",
                    message: "Backup ZIP created and downloaded",
                  });
                  setShowShareErrorDialog(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition font-medium text-sm"
            >
              Download Instead
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              // Download as fallback
              if (shareErrorBlob) {
                const url = URL.createObjectURL(shareErrorBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = shareErrorFilename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 100);

                // Track backup download
                logBackupDownloaded(shareErrorBlob.size);

                setBackupResult({
                  status: "success",
                  message: "Backup ZIP created and downloaded",
                });
                setShowShareErrorDialog(false);
              }
            }}
            className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition font-medium text-sm"
          >
            Download Instead
          </button>
        )}

        <button
          onClick={() => {
            setShowShareErrorDialog(false);
            setBackupResult(null);
          }}
          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition font-medium text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

  {isRendering && (
    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-600 transition-all duration-300"
        style={{ width: `${renderProgress}%` }}
      />
    </div>
  )}

<div className="pt-4 mt-5 border-t">
    <div className="text-center text-xs text-gray-400 mb-3">
      Created by <span className="font-semibold text-gray-600">BazelWings</span>
    </div>
  </div>
          </div>
</div>
        </div>

        {/* Legal Links - Fixed at Bottom */}
        <div className="absolute left-0 w-64 bottom-0 bg-white pt-3 pb-4">
          <div className="flex flex-col items-center gap-2 mb-3 px-4">
            <span className="text-xs text-gray-500">CatShare v{APP_VERSION}</span>
          </div>
          <div className="flex justify-center items-center gap-3 text-xs px-4">
            <button
              onClick={() => {
                navigate("/privacy");
                onClose();
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Privacy Policy
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={() => {
                navigate("/terms");
                onClose();
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>

      {showMediaLibrary && (
        <MediaLibrary
          onClose={() => setShowMediaLibrary(false)}
          onSelect={() => setShowMediaLibrary(false)}
        />
      )}

      {showBulkEdit && (
        <BulkEdit
          products={products}
          allProducts={allProductsCached}
          imageMap={imageMap}
          setProducts={setProducts}
          onClose={() => setShowBulkEdit(false)}
          triggerRender={handleRenderAllImages}
        />
      )}

      {showCategories && (
        <CategoryModal onClose={() => setShowCategories(false)} />
      )}

    </>
  );
}

function DragWrapper({ children, provided }) {
  const style = {
    ...provided.draggableProps.style,
    zIndex: 9999,
    position: "fixed",
    pointerEvents: "none",
    width: provided.draggableProps.style?.width || "300px", // lock width
    left: provided.draggableProps.style?.left,
    top: provided.draggableProps.style?.top,
  };

  return ReactDOM.createPortal(
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}


// 🔁 Updated Category Modal with drag & drop
function CategoryModal({ onClose }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editText, setEditText] = useState("");


  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("categories") || "[]");
    setCategories(stored);
  }, []);


  const save = (list) => {
    setCategories(list);
    localStorage.setItem("categories", JSON.stringify(list));

    // Sync categories to Supabase
    if (user?.uid) {
      // Convert simple category strings to objects with id and name for Supabase sync
      const categoriesForSync = list.map((cat, index) => ({
        id: cat, // Use the category name as the ID
        name: cat,
      }));

      syncCategories(user.uid, categoriesForSync).catch(err => {
        console.warn('⚠️ Failed to sync categories to Supabase:', err);
      });
    }
  };

  const add = () => {
    const c = newCat.trim();
    if (c && !categories.includes(c)) {
      save([...categories, c]);
      logCategoryManaged("added", c);
      setNewCat("");
    }
  };

  const update = () => {
    const list = [...categories];
    const oldName = categories[editIndex];
    list[editIndex] = editText.trim();
    save(list);
    logCategoryManaged("edited", { oldName, newName: editText.trim() });
    setEditIndex(null);
    setEditText("");
  };

  const remove = (i) => {
    const removedCat = categories[i];
    const list = categories.filter((_, idx) => idx !== i);
    save(list);
    logCategoryManaged("deleted", removedCat);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    save(reordered);
    logCategoryManaged("reordered", { count: reordered.length });
  };

  return (
    <div
  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
  onClick={onClose} // close when clicking outside
>
  <div
    className="bg-white w-full max-w-md p-5 rounded-xl shadow-lg relative animate-fadeIn"
    onClick={(e) => e.stopPropagation()} // prevent close when clicking inside
  >

        <h3 className="text-xl font-bold mb-4 text-center">Manage Categories</h3>

        <button
          onClick={onClose}
          className="absolute top-2 right-4 text-2xl text-gray-500 hover:text-red-500"
        >
          &times;
        </button>

        {/* Add new category */}
        <div className="flex gap-2 mb-4">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category"
            className="flex-1 border px-3 py-2 rounded text-sm"
          />
          <button
            onClick={add}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-red-600"
          >
            Add
          </button>
        </div>

        {/* Category list with drag-and-drop */}
        {categories.length === 0 ? (
          <p className="text-center text-gray-400 italic">No categories yet</p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="category-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2 max-h-[420px] overflow-y-auto pr-1"
                >
                  {categories.map((cat, i) => (
                    <Draggable key={cat} draggableId={cat} index={i}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center justify-between bg-gray-100 p-2 rounded text-sm shadow"
                        >
                          <div className="flex items-center gap-2 flex-grow">
                            <span
                              {...provided.dragHandleProps}
                              className="cursor-move text-gray-500"
                              title="Drag"
                            >
                              ☰
                            </span>
                            {editIndex === i ? (
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="flex-1 border px-2 py-1 rounded"
                              />
                            ) : (
                              <span className="flex-1">{cat}</span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {editIndex === i ? (
                              <>
                                <button
                                  onClick={update}
                                  className="text-blue-600 hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditIndex(null)}
                                  className="text-gray-500 hover:underline"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditIndex(i);
                                    setEditText(cat);
                                  }}
                                  className="text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => remove(i)}
                                  className="text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
