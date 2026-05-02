/**
 * Data Migration Utility
 * 
 * Handles migration of old product data to new catalogue system
 * Ensures backward compatibility - old data works without any changes
 */

import { getCataloguesDefinition, setCataloguesDefinition, DEFAULT_CATALOGUES } from "../config/catalogueConfig";
import { getAllProducts } from "../config/productUtils";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { getPersistedAuthUserId } from "./authUserId";
import { getStorageKey, getUserImagePath, safeGetFromStorage, safeSetProductsCache, safeSetDeletedProductsCache } from "./safeStorage";
import { getFieldsDefinition, setFieldsDefinition } from "../config/fieldConfig";

/**
 * Move base64 images to Filesystem and remove from localStorage
 * This is CRITICAL for preventing QuotaExceededError
 */
export async function cleanupProductStorage(): Promise<void> {
  try {
    const stored = localStorage.getItem("products");
    if (!stored) return;

    const products = JSON.parse(stored);
    let modified = false;

    for (const p of products) {
      // 1. If product has base64 image, move it to Filesystem
      if (p.image && typeof p.image === 'string' && p.image.startsWith("data:image")) {
        const id = p.id || Date.now().toString();
        const imagePath = `catalogue/product-${id}.png`;
        const base64Data = p.image.split(",")[1];

        try {
          await Filesystem.writeFile({
            path: imagePath,
            data: base64Data,
            directory: Directory.Data,
            recursive: true,
          });

          p.imagePath = imagePath;
          delete p.image;
          modified = true;
          console.log(`📦 Moved image for product ${id} to Filesystem`);
        } catch (fsErr) {
          console.error(`❌ Failed to move image for product ${id}:`, fsErr);
        }
      } else if (p.image) {
        // If image exists but isn't base64 (maybe a legacy path),
        // and we already have imagePath, just delete the redundant field.
        if (p.imagePath) {
          delete p.image;
          modified = true;
        }
      }

      // 2. Clean up other redundant base64 data if any
      // Some old versions might have stored rendered images in products (rare but possible)
      if (p.renderedImage) {
        delete p.renderedImage;
        modified = true;
      }
    }

    if (modified) {
      localStorage.setItem("products", JSON.stringify(products));
      console.log("✅ Cleanup: All base64 images moved to Filesystem and localStorage freed");
    }
  } catch (err) {
    console.error("❌ Failed to cleanup product storage:", err);
  }
}

/**
 * Check if this is the first time the app is running with the new catalogue system
 * by checking if cataloguesDefinition exists in localStorage
 */
export function isFirstTimeWithNewSystem(): boolean {
  return localStorage.getItem("cataloguesDefinition") === null;
}

/**
 * Initialize catalogues on first run with new system
 * If there's legacy product data, this ensures backwards compatibility
 */
export function initializeCataloguesIfNeeded(): void {
  if (!isFirstTimeWithNewSystem()) {
    return; // Already initialized
  }

  // First time setup - set default catalogues
  try {
    localStorage.setItem(
      "cataloguesDefinition",
      JSON.stringify({
        version: 1,
        catalogues: DEFAULT_CATALOGUES,
        lastUpdated: Date.now(),
      })
    );
    console.log("✅ Initialized default catalogues for first run");
  } catch (err) {
    console.error("❌ Failed to initialize catalogues:", err);
  }
}

/**
 * Verify that all products have required stock fields
 * Creates missing stock fields for catalogues to prevent errors
 */
export function ensureProductsHaveStockFields(): void {
  try {
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    const definition = JSON.parse(
      localStorage.getItem("cataloguesDefinition") || JSON.stringify({
        catalogues: DEFAULT_CATALOGUES,
      })
    );
    const catalogues = definition.catalogues || DEFAULT_CATALOGUES;

    let modified = false;

    for (const product of products) {
      // Ensure catalogueData structure exists (for new multi-catalogue system)
      if (!product.catalogueData) {
        product.catalogueData = {};
        modified = true;
      }

      for (const cat of catalogues) {
        // Initialize catalogueData for this catalogue if missing
        if (!product.catalogueData[cat.id]) {
          product.catalogueData[cat.id] = {
            enabled: cat.id === 'cat1' ? true : false, // Enable cat1 by default for old products
            field1: product.field1 || "",
            field2: product.field2 || "",
            field3: product.field3 || "",
            field2Unit: product.field2Unit || product.packageUnit || "pcs / set",
            field3Unit: product.field3Unit || product.ageUnit || "months",
            badge: product.badge || "",
            [cat.priceField]: product[cat.priceField] || "",
            [cat.priceUnitField]: product[cat.priceUnitField] || "/ piece",
            [cat.stockField]: product[cat.stockField] !== undefined ? product[cat.stockField] : true,
          };
          modified = true;
        } else {
          // For existing catalogueData, ensure badge field is present
          // This handles restored backups where badge might already be in catalogueData
          if (!product.catalogueData[cat.id].badge && product.badge) {
            product.catalogueData[cat.id].badge = product.badge;
            modified = true;
          }
        }

        // Ensure stock field exists on product level (for backward compatibility)
        if (product[cat.stockField] === undefined) {
          product[cat.stockField] = product.catalogueData[cat.id]?.[cat.stockField] ?? true;
          modified = true;
        }

        // Ensure price field exists (at least empty string)
        if (product[cat.priceField] === undefined) {
          product[cat.priceField] = product.catalogueData[cat.id]?.[cat.priceField] ?? "";
          modified = true;
        }

        // Ensure unit field exists
        if (product[cat.priceUnitField] === undefined) {
          product[cat.priceUnitField] = product.catalogueData[cat.id]?.[cat.priceUnitField] ?? "/ piece";
          modified = true;
        }
      }
    }

    if (modified) {
      localStorage.setItem("products", JSON.stringify(products));
      console.log("✅ Ensured all products have required stock fields and catalogueData structure");
    }
  } catch (err) {
    console.error("❌ Failed to ensure stock fields:", err);
  }
}

/**
 * Validate catalogue configuration
 * Ensures:
 * - At least one catalogue exists
 * - All catalogues have required fields
 * - All field names are unique
 * - AUTOMATICALLY FIXES DUPLICATES
 */
export function validateCatalogueConfig(): boolean {
  try {
    const definition = getCataloguesDefinition();
    let modified = false;

    if (!definition.catalogues || definition.catalogues.length === 0) {
      console.error("❌ No catalogues defined, resetting to defaults");
      localStorage.setItem("cataloguesDefinition", JSON.stringify({
        version: 1,
        catalogues: DEFAULT_CATALOGUES,
        lastUpdated: Date.now()
      }));
      return true;
    }

    const priceFields = new Set<string>();
    const stockFields = new Set<string>();
    const validCatalogues = [];

    for (const cat of definition.catalogues) {
      // Check required fields
      if (!cat.id || !cat.label || !cat.priceField || !cat.stockField) {
        console.warn(`⚠️ Catalogue ${cat.label || 'Unknown'} missing required fields, removing`);
        modified = true;
        continue;
      }

      // Check for duplicates
      if (priceFields.has(cat.priceField)) {
        console.error(`❌ Duplicate price field detected: ${cat.priceField}. Removing duplicate catalogue: ${cat.label}`);
        modified = true;
        continue;
      }
      if (stockFields.has(cat.stockField)) {
        console.error(`❌ Duplicate stock field detected: ${cat.stockField}. Removing duplicate catalogue: ${cat.label}`);
        modified = true;
        continue;
      }

      priceFields.add(cat.priceField);
      stockFields.add(cat.stockField);
      validCatalogues.push(cat);
    }

    if (modified) {
      definition.catalogues = validCatalogues;
      setCataloguesDefinition(definition);
      console.log("✅ Automatically fixed catalogue configuration issues");
    }

    console.log("✅ Catalogue configuration check complete");
    return true;
  } catch (err) {
    console.error("❌ Failed to validate catalogue config:", err);
    return false;
  }
}

/**
 * Migrate from old 2-catalogue system to new single-catalogue default
 * For existing users: remove cat2 (Resell) if there's no resell data in products
 * This ensures users see "Master" as the default, not "Catalogue 2"
 */
export function migrateFromTwoCataloguesToOne(): void {
  try {
    const definition = getCataloguesDefinition();
    const uid = getPersistedAuthUserId();
    const products = uid
      ? getAllProducts(uid)
      : JSON.parse(localStorage.getItem("products") || "[]");

    // Check if cat2 (Resell) exists
    const cat2Index = definition.catalogues.findIndex((c) => c.id === "cat2");
    if (cat2Index === -1) {
      return; // Nothing to migrate
    }

    // Check if there's any resell data in products
    const hasResellData = products.some(
      (p: any) =>
        (p.resellStock !== undefined && p.resellStock !== null) ||
        (p.price2 !== undefined && p.price2 !== null) ||
        (p.catalogueData?.cat2?.enabled === true)
    );

    // If no resell data, remove cat2 from catalogues
    if (!hasResellData) {
      definition.catalogues = definition.catalogues.filter((c) => c.id !== "cat2");
      setCataloguesDefinition(definition);
      console.log("✅ Migrated from 2-catalogue to 1-catalogue system (removed empty Resell catalogue)");
    } else {
      // Resell data exists, but make sure it's NOT marked as default
      if (definition.catalogues[cat2Index].isDefault === true) {
        definition.catalogues[cat2Index].isDefault = false;
        setCataloguesDefinition(definition);
        console.log("✅ Resell catalogue kept for backward compatibility, but unmarked as default");
      } else {
        console.log("ℹ️ Keeping Resell catalogue - resell data found in products");
      }
    }
  } catch (err) {
    console.error("❌ Failed to migrate catalogue structure:", err);
  }
}

/**
 * Migration: Ensure watermark is enabled by default for existing users
 * if they haven't explicitly set it or if it was the old default false.
 * Also migrates watermark position from bottom-center to bottom-left.
 */
export function migrateWatermarkDefault(): void {
  try {
    const showWatermark = localStorage.getItem("showWatermark");
    const watermarkPosition = localStorage.getItem("watermarkPosition");
    const hasMigrated = localStorage.getItem("hasMigratedWatermarkDefault");

    if (!hasMigrated) {
      // If never set OR if set to false (old default), force to true for migration
      // This ensures existing users who were on the old 'false' default get the new 'true' default once.
      if (showWatermark === null || showWatermark === "false") {
        localStorage.setItem("showWatermark", "true");
        console.log("✅ Migrated watermark default to enabled");
      }

      // Migrate position from bottom-center to bottom-left
      if (watermarkPosition === null || watermarkPosition === '"bottom-center"' || watermarkPosition === 'bottom-center') {
        localStorage.setItem("watermarkPosition", "bottom-left");
        console.log("✅ Migrated watermark position to bottom-left");
      }

      localStorage.setItem("hasMigratedWatermarkDefault", "true");
    } else {
      // Even if migrated once, if it's still bottom-center, migrate it (handling cases where it might have been reset or missed)
      if (watermarkPosition === '"bottom-center"' || watermarkPosition === 'bottom-center') {
        localStorage.setItem("watermarkPosition", "bottom-left");
        console.log("✅ Forced migration of watermark position to bottom-left");
      }
    }
  } catch (err) {
    console.error("❌ Failed to migrate watermark settings:", err);
  }
}

/**
 * Run all migration and validation steps
 * Should be called on app startup
 */
export async function runMigrations(): Promise<void> {
  console.log("🔄 Running data migrations...");

  // Step 0: Critical cleanup for storage quota
  await cleanupProductStorage();

  // Step 1: Initialize catalogues if needed
  initializeCataloguesIfNeeded();

  // Step 2: Migrate from old 2-catalogue to 1-catalogue system if applicable
  migrateFromTwoCataloguesToOne();

  // Step 3: Migrate watermark default
  migrateWatermarkDefault();

  // Step 4: Ensure all products have required fields
  ensureProductsHaveStockFields();

  // Step 4b: Move source images to user-<uid>/Products/product-<id>.png (native only)
  const uid = getPersistedAuthUserId();
  if (uid && Capacitor.isNativePlatform()) {
    const pk = getStorageKey("products", uid);
    const dk = getStorageKey("deletedProducts", uid);
    const prods = safeGetFromStorage(pk, []);
    const del = safeGetFromStorage(dk, []);
    if (Array.isArray(prods) && prods.length > 0) {
      await migrateProductImagePaths(prods, uid);
      safeSetProductsCache(uid, prods);
    }
    if (Array.isArray(del) && del.length > 0) {
      await migrateProductImagePaths(del, uid);
      safeSetDeletedProductsCache(uid, del);
    }
  }

  // Step 5: Validate configuration
  const isValid = validateCatalogueConfig();

  if (isValid) {
    console.log("✅ All migrations completed successfully");
  } else {
    console.warn(
      "⚠️ Migrations completed with warnings - some validation checks failed"
    );
  }
}

/**
 * Get migration status for display in UI
 * Returns info about what needs to be done
 */
export function getMigrationStatus(): {
  needsMigration: boolean;
  message: string;
  hasLegacyData: boolean;
} {
  const hasLegacyData =
    localStorage.getItem("products")?.includes('"price1"') ||
    localStorage.getItem("products")?.includes('"wholesaleStock"') ||
    false;

  const hasNewSystem = localStorage.getItem("cataloguesDefinition") !== null;

  return {
    needsMigration: hasLegacyData && !hasNewSystem,
    message: hasNewSystem
      ? "Using new catalogue system (compatible with legacy data)"
      : "Legacy product system detected",
    hasLegacyData,
  };
}

/**
 * Migrate image paths to per-user format
 * Moves images from old paths (e.g., catalogue/product-id.png) to user-specific paths
 * @param products - Array of products to migrate
 * @param userId - The user ID for the new path
 */
export async function migrateProductImagePaths(products: any[], userId: string): Promise<void> {
  try {
    for (const product of products) {
      if (!product.imagePath) continue;

      const productsFolderPath = getUserImagePath(product.id, userId);
      const sourceSuffix = `product-${product.id}.png`;

      // Move user-<uid>/<Catalogue>/product-<id>.png → user-<uid>/Products/product-<id>.png
      if (
        product.imagePath.startsWith(`user-${userId}/`) &&
        !product.imagePath.includes("/Products/") &&
        product.imagePath.endsWith(sourceSuffix)
      ) {
        const oldCatalogueScopedPath = product.imagePath;
        if (oldCatalogueScopedPath !== productsFolderPath) {
          try {
            let result: any;
            try {
              result = await Filesystem.readFile({
                path: oldCatalogueScopedPath,
                directory: Directory.External,
              });
            } catch {
              result = await Filesystem.readFile({
                path: oldCatalogueScopedPath,
                directory: Directory.Data,
              });
            }
            await Filesystem.writeFile({
              path: productsFolderPath,
              data: result.data,
              directory: Directory.External,
              recursive: true,
            });
            product.imagePath = productsFolderPath;
            try {
              await Filesystem.deleteFile({ path: oldCatalogueScopedPath, directory: Directory.External });
            } catch {
              try {
                await Filesystem.deleteFile({ path: oldCatalogueScopedPath, directory: Directory.Data });
              } catch {}
            }
            console.log(`✅ Migrated source image for product ${product.id} → Products folder`);
          } catch (e) {
            console.warn(`⚠️ Products-folder migration failed for ${product.id}:`, e);
          }
        }
        continue;
      }

      // If already in user-specific format but still uses legacy "/products/" segment, fix it.
      if (product.imagePath.startsWith(`user-${userId}/`)) {
        if (product.imagePath.includes("/products/")) {
          const oldPath = product.imagePath;
          const newImagePath = product.imagePath.replace("/products/", "/");

          try {
            let result: any;
            try {
              result = await Filesystem.readFile({
                path: oldPath,
                directory: Directory.External,
              });
            } catch {
              result = await Filesystem.readFile({
                path: oldPath,
                directory: Directory.Data,
              });
            }

            await Filesystem.writeFile({
              path: newImagePath,
              data: result.data,
              directory: Directory.External,
              recursive: true,
            });

            // best-effort cleanup
            try {
              await Filesystem.deleteFile({ path: oldPath, directory: Directory.External });
            } catch {
              try {
                await Filesystem.deleteFile({ path: oldPath, directory: Directory.Data });
              } catch {}
            }

            product.imagePath = newImagePath;
          } catch {
            // Keep existing path if migration fails
          }
        }

        continue; // Already migrated (or attempted fix)
      }

      // Old format was typically "<folder>/product-<id>.png" (e.g. "catalogue/product-123.png")
      // We'll keep that <folder> name as the "catalogue folder" when migrating.
      const oldCatalogueFolder = product.imagePath.split("/")[0] || "catalogue";

      // Generate new user-specific path
      const newImagePath = getUserImagePath(product.id, userId, oldCatalogueFolder);

      try {
        const oldPath = product.imagePath;

        // Old unkeyed images might exist in Directory.Data (legacy) or Directory.External (newer).
        let result: any | null = null;
        try {
          result = await Filesystem.readFile({
            path: oldPath,
            directory: Directory.Data,
          });
        } catch {
          result = await Filesystem.readFile({
            path: oldPath,
            directory: Directory.External,
          });
        }

        // Write to the new user-specific path (External so user folders are visible)
        await Filesystem.writeFile({
          path: newImagePath,
          data: result.data,
          directory: Directory.External,
          recursive: true,
        });

        // Update product reference
        product.imagePath = newImagePath;

        console.log(`✅ Migrated image for product ${product.id} to user-specific path`);

        // Try to delete old file (non-critical, so catch errors)
        try {
          // Try to delete from both directories (whichever succeeds first will clean up)
          try {
            await Filesystem.deleteFile({
              path: oldPath,
              directory: Directory.Data,
            });
          } catch {
            await Filesystem.deleteFile({
              path: oldPath,
              directory: Directory.External,
            });
          }
        } catch (delErr) {
          // Old file might not exist, that's ok
        }
      } catch (err) {
        console.warn(`⚠️ Could not migrate image for product ${product.id}:`, err);
        // Keep the original imagePath reference even if we can't migrate the file
      }
    }
  } catch (err) {
    console.error(`❌ Error during image path migration:`, err);
  }
}

/**
 * Best-effort migration for rendered PNGs:
 * Move legacy rendered files from:
 *   <catalogue-folder>/product_<id>_<catalogue-folder>.png
 * to:
 *   user-<userId>/<catalogue-folder>/products/product_<id>_<catalogue-folder>.png
 */
export async function migrateLegacyRenderedImagesToUserFolder(
  products: any[],
  userId: string
): Promise<void> {
  try {
    const migrationKey = `renderedImagesMigrationDone::${userId}`;
    if (localStorage.getItem(migrationKey) === "done") return;

    const definition = getCataloguesDefinition(userId);
    const catalogues = definition?.catalogues || [];
    const userFolder = `user-${userId}`;

    let movedCount = 0;

    for (const product of products) {
      if (!product?.id) continue;

      for (const cat of catalogues) {
        const folder = cat.folder || cat.label;
        const filename = `product_${product.id}_${folder}.png`;

        const legacyPath = `${folder}/${filename}`;
        // New simple user-scoped rendered layout:
        // user-<uid>/<catalogue-folder>/<filename>
        const userPath = `${userFolder}/${folder}/${filename}`;

        // If already migrated, skip
        try {
          await Filesystem.stat({
            path: userPath,
            directory: Directory.External,
          });
          continue;
        } catch {
          // Continue to attempt legacy->user migration
        }

        try {
        const legacyFile = await Filesystem.readFile({
            path: legacyPath,
            directory: Directory.External,
          });

          await Filesystem.writeFile({
            path: userPath,
            data: legacyFile.data,
            directory: Directory.External,
            recursive: true,
          });

          movedCount++;

          // Cleanup legacy file (best-effort)
          try {
            await Filesystem.deleteFile({
              path: legacyPath,
              directory: Directory.External,
            });
          } catch {
            // Non-critical
          }
        } catch {
          // Legacy file might not exist - ignore
        }
      }
    }

    localStorage.setItem(migrationKey, "done");
    console.log(`✅ Migrated ${movedCount} legacy rendered images into user folder for user ${userId}`);
  } catch (err) {
    console.warn("⚠️ migrateLegacyRenderedImagesToUserFolder failed:", err);
  }
}

/**
 * Migrate unkeyed localStorage data to per-user keyed data
 * This runs once per user on first login to convert old data format
 * @param userId - The user ID to migrate data for
 */
export function migrateUnkeyedDataToUserKeyed(userId: string): void {
  try {
    console.log(`🔄 Starting per-user data migration for user: ${userId}`);

    // Check if migration has already been done for this user
    const migrationKey = `dataKeyedMigration::${userId}`;
    const globalMigrationKey = `unkeyedToUserKeyed::done`;
    if (localStorage.getItem(globalMigrationKey) === "done") {
      console.log(`⏭️ Unkeyed data already migrated on this device (global)`);
      return;
    }
    if (localStorage.getItem(migrationKey) === 'done') {
      console.log(`⏭️  Data migration already completed for user ${userId}`);
      return;
    }

    // Read all unkeyed data from localStorage
    const unKeyedProducts = localStorage.getItem('products');
    const unKeyedDeleted = localStorage.getItem('deletedProducts');
    const unKeyedCategories = localStorage.getItem('categories');
    const unKeyedCatalogues = localStorage.getItem('cataloguesDefinition');
    const unKeyedFields = localStorage.getItem('fieldsDefinition');

    let hasMigratedData = false;

    // Migrate products to keyed storage
    if (unKeyedProducts) {
      try {
        const products = JSON.parse(unKeyedProducts);
        if (Array.isArray(products) && products.length > 0) {
          const keyedKey = getStorageKey('products', userId);
          localStorage.setItem(keyedKey, unKeyedProducts);
          hasMigratedData = true;
          console.log(`✅ Migrated ${products.length} products to keyed storage`);
        }
      } catch (err) {
        console.warn(`⚠️  Failed to migrate products:`, err);
      }
    }

    // Migrate deleted products to keyed storage
    if (unKeyedDeleted) {
      try {
        const deleted = JSON.parse(unKeyedDeleted);
        if (Array.isArray(deleted) && deleted.length > 0) {
          const keyedKey = getStorageKey('deletedProducts', userId);
          localStorage.setItem(keyedKey, unKeyedDeleted);
          hasMigratedData = true;
          console.log(`✅ Migrated ${deleted.length} deleted products to keyed storage`);
        }
      } catch (err) {
        console.warn(`⚠️  Failed to migrate deletedProducts:`, err);
      }
    }

    // Migrate categories to keyed storage
    if (unKeyedCategories) {
      try {
        const categories = JSON.parse(unKeyedCategories);
        if (Array.isArray(categories) && categories.length > 0) {
          const keyedKey = getStorageKey('categories', userId);
          localStorage.setItem(keyedKey, unKeyedCategories);
          hasMigratedData = true;
          console.log(`✅ Migrated ${categories.length} categories to keyed storage`);
        }
      } catch (err) {
        console.warn(`⚠️  Failed to migrate categories:`, err);
      }
    }

    // Migrate catalogues definition to keyed storage
    if (unKeyedCatalogues) {
      try {
        const catalogues = JSON.parse(unKeyedCatalogues);
        const keyedKey = getStorageKey('cataloguesDefinition', userId);
        localStorage.setItem(keyedKey, unKeyedCatalogues);
        hasMigratedData = true;
        console.log(`✅ Migrated catalogues definition to keyed storage`);
      } catch (err) {
        console.warn(`⚠️  Failed to migrate cataloguesDefinition:`, err);
      }
    }

    // Migrate fields definition to keyed storage
    if (unKeyedFields) {
      try {
        const fields = JSON.parse(unKeyedFields);
        const keyedKey = getStorageKey('fieldsDefinition', userId);
        localStorage.setItem(keyedKey, unKeyedFields);
        hasMigratedData = true;
        console.log(`✅ Migrated fields definition to keyed storage`);
      } catch (err) {
        console.warn(`⚠️  Failed to migrate fieldsDefinition:`, err);
      }
    }

    // Mark migration as done but keep unkeyed originals intact.
    // They will only be deleted after the user completes cloud sync or
    // chooses "Delete offline data" in the popup. This prevents data loss
    // if the cloud sync fails.
    localStorage.setItem(migrationKey, "done");
    if (hasMigratedData) {
      console.log(`✅ Per-user data migration completed for ${userId} (unkeyed originals preserved until cloud sync)`);
    } else {
      console.log(`ℹ️  No unkeyed data found to migrate for user ${userId}`);
    }

    localStorage.setItem(globalMigrationKey, "done");
  } catch (err) {
    console.error(`❌ Error during per-user data migration:`, err);
  }
}
