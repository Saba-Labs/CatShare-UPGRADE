import { Filesystem, Directory } from "@capacitor/filesystem";
import { getCatalogueData } from "./config/catalogueProductUtils";
import { safeGetFromStorage } from "./utils/safeStorage";
import { renderProductToCanvas, canvasToBase64 } from "./utils/canvasRenderer";
import { renderProductToCanvasGlass } from "./utils/canvasRenderer-glass";
import { getAllCatalogues } from "./config/catalogueConfig";
import { getAllFields, isFieldVisibleOnSurface } from "./config/fieldConfig";
import { getCurrentCurrencySymbol } from "./utils/currencyUtils";
import { getThemeById } from "./config/themeConfig";
import { uploadImageToR2, stripDataUriPrefix } from "./services/cloudflareService";
import { uploadProductImageToR2 } from "./services/r2Upload";
import { fetchUrlAsDataUrl } from "./utils/fetchImageCrossPlatform";
import {
  hydrateProductSourceForRender,
  pickRenderableImageForCanvas,
} from "./utils/productSourceImage";
import { getPersistedAuthUserId } from "./utils/authUserId";
import {
  getEffectiveWatermarkText,
  getEffectiveWatermarkPosition,
} from "./utils/freeTierWatermark";

function getUserFolderForRenderedImages(product) {
  // Always use the currently logged-in Supabase user to avoid cross-user mixing.
  try {
    const authUserId = getPersistedAuthUserId() || "anonymous";
    return `user-${authUserId}`;
  } catch {
    return "user-anonymous";
  }
}

/**
 * Delete all rendered images for a specific product
 * across all catalogues
 */
export async function deleteRenderedImageForProduct(productId) {
  if (!productId) return;

  try {
    const catalogues = getAllCatalogues();
    const authUserId = getPersistedAuthUserId() || "anonymous";
    const userFolder = `user-${authUserId}`;
    for (const cat of catalogues) {
      const folder = cat.folder || cat.label;
      const filename = `product_${productId}_${folder}.png`;
      const legacyFilePath = `${folder}/${filename}`;
      const userFilePath = `${userFolder}/${folder}/${filename}`;
      const userFilePathOld = `${userFolder}/${folder}/products/${filename}`;

      try {
        await Filesystem.deleteFile({
          path: legacyFilePath,
          directory: Directory.External,
        });
        console.log(`  ✓ Deleted rendered image: ${legacyFilePath}`);
      } catch (err) {
        // Ignore errors if file doesn't exist
      }

      try {
        await Filesystem.deleteFile({
          path: userFilePath,
          directory: Directory.External,
        });
        console.log(`  ✓ Deleted rendered image: ${userFilePath}`);
      } catch (err) {
        // Ignore errors if file doesn't exist
      }

      try {
        await Filesystem.deleteFile({
          path: userFilePathOld,
          directory: Directory.External,
        });
      } catch (err) {
        // Ignore errors
      }

      // Also remove from localStorage cache
      try {
        const storageKey = `rendered::${userFolder}::${folder}::${productId}`;
        localStorage.removeItem(storageKey);
      } catch (err) {
        // Ignore errors
      }
    }
  } catch (err) {
    console.warn(`⚠️ Could not clean up rendered images for product ${productId}:`, err.message);
  }
}

/**
 * Rename rendered images when catalogue name changes
 * Moves files from old folder/name pattern to new folder/name pattern
 */
export async function renameRenderedImagesForCatalogue(oldFolder, newFolder, oldLabel, newLabel) {
  if (!oldFolder || !newFolder) return;

  try {
    console.log(`📁 Renaming rendered images from folder "${oldFolder}" (label: "${oldLabel}") to folder "${newFolder}" (label: "${newLabel}")`);

    const authUserId = getPersistedAuthUserId() || "anonymous";
    const userFolder = `user-${authUserId}`;

    const renameInDir = async (baseDirOld, baseDirNew) => {
      let oldFiles = [];
      try {
        const result = await Filesystem.readdir({
          path: baseDirOld,
          directory: Directory.External,
        });
        oldFiles = result.files || [];
      } catch (err) {
        if (err.code !== "NotFound") {
          console.warn(`⚠️ Could not read old directory ${baseDirOld}:`, err.message);
        }
        return;
      }

      if (oldFiles.length === 0) return;

      for (const file of oldFiles) {
        try {
          const oldPath = `${baseDirOld}/${file.name}`;
          const fileMatch = file.name.match(/^product_([^_]+)_.*\.png$/);
          if (!fileMatch) continue;

          const productId = fileMatch[1];
          // Filenames use catalogue folder name as suffix in this app
          const newFileName = `product_${productId}_${newFolder}.png`;
          const newPath = `${baseDirNew}/${newFileName}`;

          const fileData = await Filesystem.readFile({
            path: oldPath,
            directory: Directory.External,
          });

          await Filesystem.writeFile({
            path: newPath,
            data: fileData.data,
            directory: Directory.External,
            recursive: true,
          });

          await Filesystem.deleteFile({
            path: oldPath,
            directory: Directory.External,
          });
        } catch {
          // best-effort rename
        }
      }

      // best-effort directory removal
      try {
        await Filesystem.rmdir({ path: baseDirOld, directory: Directory.External, recursive: false });
      } catch {}
    };

    // Legacy root rename: <oldFolder>/* -> <newFolder>/*
    await renameInDir(oldFolder, newFolder);

    // User-scoped rename (new layout):
    await renameInDir(`${userFolder}/${oldFolder}`, `${userFolder}/${newFolder}`);

    // User-scoped rename (old layout with extra products/ folder):
    await renameInDir(`${userFolder}/${oldFolder}/products`, `${userFolder}/${newFolder}/products`);

    console.log(`✅ Renaming completed for catalogue images (legacy + user-scoped)`);
  } catch (err) {
    console.warn(`⚠️  Could not rename catalogue images:`, err.message);
  }
}

/**
 * Delete all rendered images from a folder
 * Used when catalogue is deleted
 */
export async function deleteRenderedImagesFromFolder(folderName) {
  if (!folderName) return;

  try {
    console.log(`🗑️  Cleaning up rendered images from folder: ${folderName}`);

    // 1) Legacy root folder: <folderName>/
    try {
      const result = await Filesystem.readdir({
        path: folderName,
        directory: Directory.External,
      });
      if (result.files?.length) {
        for (const file of result.files) {
          try {
            await Filesystem.deleteFile({
              path: `${folderName}/${file.name}`,
              directory: Directory.External,
            });
          } catch (err) {}
        }
      }
    } catch (err) {}

    // 2) User folder: user-<uid>/<folderName>/
    try {
      const authUserId = getPersistedAuthUserId() || "anonymous";
      const userFolder = `user-${authUserId}`;
      const productsDir = `${userFolder}/${folderName}`;
      const result2 = await Filesystem.readdir({
        path: productsDir,
        directory: Directory.External,
      });
      if (result2.files?.length) {
        for (const file of result2.files) {
          try {
            await Filesystem.deleteFile({
              path: `${productsDir}/${file.name}`,
              directory: Directory.External,
            });
          } catch (err) {}
        }
      }
    } catch (err) {}

    // 3) Old user layout: user-<uid>/<folderName>/products/
    try {
      const authUserId = getPersistedAuthUserId() || "anonymous";
      const userFolder = `user-${authUserId}`;
      const oldDir = `${userFolder}/${folderName}/products`;
      const result3 = await Filesystem.readdir({
        path: oldDir,
        directory: Directory.External,
      });
      if (result3.files?.length) {
        for (const file of result3.files) {
          try {
            await Filesystem.deleteFile({
              path: `${oldDir}/${file.name}`,
              directory: Directory.External,
            });
          } catch (err) {}
        }
      }
    } catch (err) {}

    console.log(`✅ Cleanup completed for folder: ${folderName}`);
  } catch (err) {
    // Folder might not exist yet, which is fine
    if (err.code !== 'NotFound') {
      console.warn(`⚠️  Could not clean up folder ${folderName}:`, err.message);
    }
  }
}

export async function saveRenderedImage(product, type, units = {}) {
  const id = product.id || "temp-id";
  const fontColor = product.fontColor || "white";
  const bgColor = product.bgColor || "#add8e6";
  const imageBg = product.imageBgColor || "white";
  const badgeBg = imageBg.toLowerCase() === "white" ? "#fff" : "#000";
  const badgeText = imageBg.toLowerCase() === "white" ? "#000" : "#fff";
  const badgeBorder =
    imageBg.toLowerCase() === "white"
      ? "rgba(0, 0, 0, 0.4)"
      : "rgba(255, 255, 255, 0.4)";

  const getLighterColor = (color) => {
    if (color.startsWith("#") && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const lighten = (c) => Math.min(255, c + 40);
      return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
    }
    const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      const lighten = (c) => Math.min(255, c + 40);
      return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
    }
    return color;
  };

  await hydrateProductSourceForRender(product);

  // If product.image is still a remote URL, convert to data URL (native uses Capacitor HTTP; web uses fetch).
  if (typeof product.image === "string" && /^https?:\/\//i.test(product.image.trim())) {
    try {
      product.image = await fetchUrlAsDataUrl(product.image.trim());
    } catch (e) {
      console.warn("saveRenderedImage: could not inline remote image, will try canvas load:", e);
    }
  }

  // Calculate dimensions based on crop aspect ratio
  const cropAspectRatio = product.cropAspectRatio || 1;
  const baseWidth = 330;
  const baseHeight = baseWidth / cropAspectRatio;

  // Get catalogue-specific data if catalogueId is provided
  let catalogueData = product;
  if (units.catalogueId) {
    const catData = getCatalogueData(product, units.catalogueId);
    catalogueData = { ...product, ...catData };
  }

  // Support both legacy and dynamic catalogue parameters
  const priceField = units.priceField || (type === "wholesale" ? "price1" : type);
  const priceUnitField = units.priceUnitField || (type === "wholesale" ? "price1Unit" : `${type}Unit`);

  // Get price from catalogueData using dynamic field
  const price = catalogueData[priceField] !== undefined ? catalogueData[priceField] : catalogueData[priceField.replace(/\d/g, '')] || 0;
  const priceUnit = units[priceUnitField] || catalogueData[priceUnitField] || (units.price1Unit || units.wholesaleUnit);

  try {
    // Prepare product data for Canvas rendering
    const renderScale = 3;

    console.log(`🎨 Starting Canvas render for product: ${product.name || product.id}`);
    let pickedImage = pickRenderableImageForCanvas(product, catalogueData);
    if (pickedImage && /^https?:\/\//i.test(pickedImage)) {
      try {
        pickedImage = await fetchUrlAsDataUrl(pickedImage.trim());
      } catch (e) {
        console.warn("saveRenderedImage: could not inline imageUrl for canvas:", e);
      }
    }
    if (!pickedImage || (typeof pickedImage === "string" && pickedImage.length < 12)) {
      console.error("❌ Failed to load image for rendering (no renderable pixels).");
      console.error("Product object:", {
        id: product.id,
        name: product.name,
        imagePath: product.imagePath,
        imageUrl: product.imageUrl,
      });
      return;
    }
    console.log(`🖼️ Image source: ${pickedImage.startsWith("data:") ? "data URL" : "remote"}`);

    const productData = {
      name: catalogueData.name,
      subtitle: catalogueData.subtitle,
      image: pickedImage,
      price: price !== "" && price !== 0 ? price : undefined,
      priceUnit: price ? priceUnit : undefined,
      badge: catalogueData.badge,
      cropAspectRatio: cropAspectRatio,
    };

    // Add all enabled fields dynamically
    getAllFields()
      .filter(f => f.enabled && f.key.startsWith('field') && isFieldVisibleOnSurface(f, 'shareImage'))
      .forEach(field => {
        productData[field.key] = catalogueData[field.key] || "";
        const unitKey = `${field.key}Unit`;
        productData[unitKey] = catalogueData[unitKey] || "None";
      });

    // Get watermark settings with proper fallbacks (Free tier: forced default text/position)
    let isWatermarkEnabled = safeGetFromStorage("showWatermark", true);
    const isPro =
      typeof localStorage !== "undefined" && localStorage.getItem("isPro") === "true";
    let watermarkText = getEffectiveWatermarkText(isPro);
    let watermarkPosition = getEffectiveWatermarkPosition(isPro);

    // Additional safety check - ensure watermarkPosition is a string, not JSON
    if (typeof watermarkPosition !== 'string' || !watermarkPosition) {
      watermarkPosition = "bottom-left";
    }

    console.log(`✅ Watermark Settings:`, {
      enabled: isWatermarkEnabled,
      text: watermarkText,
      position: watermarkPosition,
      productName: product.name
    });

    // Render using Canvas API - Choose renderer based on CURRENT theme
    let canvas;
    try {
      // Always use the currently selected theme for rendering
      const selectedThemeId = safeGetFromStorage("selectedTheme", "classic");
      const currentTheme = getThemeById(selectedThemeId);
      const isGlassTheme = currentTheme.styles.layout === "glass";

      console.log(`🎨 Using ${isGlassTheme ? "Glass" : "Classic"} theme renderer for: ${product.name}`);

      const renderOptions = {
        width: baseWidth,
        scale: renderScale,
        bgColor: bgColor,
        imageBgColor: imageBg,
        fontColor: fontColor,
        backgroundColor: "#ffffff",
        currencySymbol: getCurrentCurrencySymbol(),
      };

      const watermarkOptions = {
        enabled: isWatermarkEnabled,
        text: watermarkText,
        position: watermarkPosition,
      };

      if (isGlassTheme) {
        canvas = await renderProductToCanvasGlass(productData, renderOptions, watermarkOptions);
      } else {
        canvas = await renderProductToCanvas(productData, renderOptions, watermarkOptions);
      }
      console.log(`✅ Canvas rendered successfully. Size: ${canvas.width}x${canvas.height}`);
    } catch (renderErr) {
      console.error(`❌ Canvas rendering failed:`, renderErr);
      throw renderErr;
    }

    let base64;
    try {
      base64 = canvasToBase64(canvas);
      console.log(`✅ Canvas converted to base64. Length: ${base64.length} chars`);
      if (!base64 || base64.length === 0) {
        throw new Error("Base64 conversion resulted in empty string");
      }
    } catch (b64Err) {
      console.error(`❌ Base64 conversion failed:`, b64Err);
      throw b64Err;
    }

    // Use folder name (which is set to catalogue name) for organizing rendered images
    let folder;
    let catalogueLabel;
    if (units.folder) {
      // Folder name passed directly (set to catalogue name/label)
      folder = units.folder;
      catalogueLabel = units.folder;
    } else if (units.catalogueLabel) {
      // Use catalogue label/name as folder name
      folder = units.catalogueLabel;
      catalogueLabel = units.catalogueLabel;
    } else if (units.catalogueId) {
      // Fallback: use catalogue ID if label not provided
      folder = units.catalogueId;
      catalogueLabel = units.catalogueId;
    } else {
      // Final fallback: use the type parameter as folder name
      // This ensures the correct folder is used even for old products
      folder = type;
      catalogueLabel = type;
    }

    // Filename includes catalogue label for proper identification and organization
    const filename = `product_${id}_${catalogueLabel}.png`;

    const userFolder = getUserFolderForRenderedImages(product);
    // Expected on-disk layout (simple):
    //   user-<uid>/<catalogue-folder>/<filename>
    const filePath = `${userFolder}/${folder}/${filename}`;

    try {
      console.log(`📝 Writing file to: ${filePath}`);
      console.log(`📁 Using directory: Directory.External (App-specific external storage)`);
      console.log(`📍 Android path: /storage/emulated/0/Android/data/com.catshare.official/files/${filePath}`);
      console.log(`📊 Base64 data details:`, {
        length: base64?.length || 0,
        isString: typeof base64 === 'string',
        first20chars: base64?.substring(0, 20) || 'N/A',
        isEmpty: !base64 || base64.length === 0,
      });

      if (!base64 || base64.length === 0) {
        throw new Error("Base64 data is empty - canvas may not have rendered correctly");
      }

      console.log(`📤 Starting writeFile operation...`);
      await Filesystem.writeFile({
        path: filePath,
        data: base64,
        directory: Directory.External,
        recursive: true,
      });

      console.log("✅ Image saved successfully:", filePath);
      console.log(`📝 Written base64 data length: ${base64.length} characters`);

      // Try to store rendered image in localStorage for quick access during sharing
      // This is optional and won't block if quota is exceeded
      try {
        const storageKey = `rendered::${userFolder}::${catalogueLabel}::${id}`;
        const dataToStore = JSON.stringify({
          base64,
          timestamp: Date.now(),
          filename,
          catalogueLabel,
        });

        // Check estimated size before storing (rough estimate: each character ~1 byte)
        const estimatedSizeKB = (dataToStore.length / 1024).toFixed(2);

        if (dataToStore.length > 2 * 1024 * 1024) {
          // Skip if larger than 2MB to preserve localStorage quota
          console.warn(`⚠️ Image too large for localStorage cache (${estimatedSizeKB}KB) - skipping cache. File saved to disk.`);
        } else {
          localStorage.setItem(storageKey, dataToStore);
          console.log(`💾 Stored rendered image in localStorage: ${storageKey} (${estimatedSizeKB}KB)`);
        }
      } catch (cacheErr) {
        // localStorage quota exceeded - this is not critical
        // The image is already saved to disk, which is what matters
        if (cacheErr.name === 'QuotaExceededError') {
          console.warn(`⚠️ localStorage quota exceeded - skipping cache. Image saved to disk successfully.`);
          console.warn(`💡 To free up space: Clear app cache or export products and delete old catalogs`);
        } else {
          console.warn(`⚠️ Could not cache image in localStorage:`, cacheErr.message);
        }
        // Don't rethrow - the image is safely saved to disk
      }

      // Verify the file was actually written
      try {
        console.log(`🔍 Verifying file at: ${filePath}`);
        const stat = await Filesystem.stat({
          path: filePath,
          directory: Directory.External,
        });
        console.log(`✅ File verified - exists at: ${filePath}`, stat);

        // Try to get the file URI to see the actual path
        try {
          const uriResult = await Filesystem.getUri({
            path: filePath,
            directory: Directory.External,
          });
          console.log(`📍 File URI: ${uriResult.uri}`);
        } catch (uriErr) {
          console.log(`⚠️ Could not get file URI: ${uriErr.message}`);
        }
      } catch (verifyErr) {
        console.error(`❌ CRITICAL: File write succeeded but file not found during verification: ${filePath}`, verifyErr);
        console.error(`This suggests the file was saved to a different location than expected`);
        throw new Error(`File verification failed - files may not be saved to correct location: ${verifyErr.message}`);
      }
    } catch (writeErr) {
      console.error(`❌ Failed to write file: ${filePath}`, writeErr);
      console.error(`📋 Error details:`, {
        message: writeErr.message,
        code: writeErr.code,
        folder,
        filename,
        directorySetting: "Directory.External",
        androidPath: `/storage/emulated/0/Android/data/com.catshare.official/files/${filePath}`
      });
      throw writeErr;
    }
  } catch (err) {
    console.error("❌ saveRenderedImage failed:", err.message || err);
    throw err; // Rethrow so caller knows rendering failed
  }
}
