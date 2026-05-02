import { Filesystem, Directory } from "@capacitor/filesystem";
import { fetchUrlAsDataUrl } from "./fetchImageCrossPlatform";
import { hydrateProductSourceForRender, pickRenderableImageForCanvas } from "./productSourceImage";
import { renderProductToCanvas, canvasToBase64 } from "./canvasRenderer";
import { renderProductToCanvasGlass } from "./canvasRenderer-glass";
import { getCatalogueData } from "../config/catalogueProductUtils";
import { getPersistedAuthUserId } from "./authUserId";
import { safeGetFromStorage } from "./safeStorage";
import { getAllFields, isFieldVisibleOnSurface } from "../config/fieldConfig";
import { getThemeById } from "../config/themeConfig";
import { offerPriceFieldFor } from "./offerPriceUtils";

/**
 * Retrieve a rendered image from localStorage or filesystem
 * Returns the base64 data URL for the image
 */
export async function getRenderedImage(
  productId: string,
  catalogueLabel: string
): Promise<string | null> {
  const authUserId = getPersistedAuthUserId();
  const userFolder = authUserId ? `user-${authUserId}` : null;

  // First try localStorage
  const storageKey = userFolder
    ? `rendered::${userFolder}::${catalogueLabel}::${productId}`
    : `rendered::${catalogueLabel}::${productId}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.base64) {
        console.log(`✅ Retrieved rendered image from localStorage: ${storageKey}`);
        return `data:image/png;base64,${data.base64}`;
      }
    }
  } catch (err) {
    console.warn(`⚠️ Could not parse stored image data for ${storageKey}:`, err);
  }

  // Try filesystem as fallback
  const filename = `product_${productId}_${catalogueLabel}.png`;
  const legacyFilePath = `${catalogueLabel}/${filename}`;
  const userFilePathNew = userFolder
    ? `${userFolder}/${catalogueLabel}/${filename}`
    : null;
  const userFilePathOld =
    userFolder ? `${userFolder}/${catalogueLabel}/products/${filename}` : null;

  try {
    if (userFilePathNew) {
      const fileData = await Filesystem.readFile({
        path: userFilePathNew,
        directory: Directory.External,
      });
      console.log(`✅ Retrieved rendered image from filesystem: ${userFilePathNew}`);
      return `data:image/png;base64,${fileData.data}`;
    }
    if (userFilePathOld) {
      const fileData = await Filesystem.readFile({
        path: userFilePathOld,
        directory: Directory.External,
      });
      console.log(`✅ Retrieved rendered image from legacy user layout: ${userFilePathOld}`);
      return `data:image/png;base64,${fileData.data}`;
    }
    const fileData = await Filesystem.readFile({
      path: legacyFilePath,
      directory: Directory.External,
    });
    console.log(`✅ Retrieved rendered image from filesystem: ${legacyFilePath}`);
    return `data:image/png;base64,${fileData.data}`;
  } catch (err) {
    // Try legacy as fallback even if userFilePath was set
    try {
      if (userFilePathNew) {
        const fileData = await Filesystem.readFile({
          path: legacyFilePath,
          directory: Directory.External,
        });
        return `data:image/png;base64,${fileData.data}`;
      }
    } catch {}
    console.log(`⚠️ Rendered image not found in filesystem.`);
    return null;
  }
}

/**
 * Render a product image on-the-fly and return as base64 data URL
 * @param product The product object to render
 * @param catalogueLabel The catalogue label for the product
 * @param catalogueId The catalogue ID for getting catalogue-specific data
 * @param themeId The theme ID to use for rendering (optional, defaults to stored theme)
 */
export async function renderProductImageOnTheFly(
  product: any,
  catalogueLabel: string,
  catalogueId?: string,
  themeId?: string
): Promise<string | null> {
  const storedThemeId = themeId || localStorage.getItem("selectedTheme") || "classic";
  const theme = getThemeById(storedThemeId);
  const isGlassTheme = theme.styles.layout === "glass";

  try {
    await hydrateProductSourceForRender(product);

    // Get catalogue-specific data if catalogueId is provided
    let catalogueData = product;
    if (catalogueId) {
      const catData = getCatalogueData(product, catalogueId);
      catalogueData = { ...product, ...catData };
    }

    let image = pickRenderableImageForCanvas(product, catalogueData);
    if (image && /^https?:\/\//i.test(image)) {
      try {
        image = await fetchUrlAsDataUrl(image.trim());
      } catch (e) {
        console.warn("renderProductImageOnTheFly: could not inline URL:", e);
      }
    }

    const cropAspectRatio = product.cropAspectRatio || theme.rendering.cropAspectRatio;
    const baseWidth = theme.rendering.cardWidth;

    // Get styling settings - use product colors if set, otherwise use theme defaults
    const fontColor = product.fontColor || theme.styles.fontColor;
    const bgColor = product.bgColor || theme.styles.bgColor;
    const imageBg = product.imageBgColor || theme.styles.imageBgColor;

    // Get price field
    const priceField = catalogueId === "cat2" ? "price2" : catalogueId === "cat1" ? "price1" : "price1";
    const priceUnitField = catalogueId === "cat2" ? "price2Unit" : catalogueId === "cat1" ? "price1Unit" : "price1Unit";
    const offerField = offerPriceFieldFor(priceField);
    const price = catalogueData[priceField] || 0;
    const rawOffer = catalogueData[offerField];
    const listNum = parseFloat(String(price ?? "").trim()) || 0;
    const offerNum = parseFloat(String(rawOffer ?? "").trim()) || 0;
    const saleActive = listNum > 0 && offerNum > 0 && offerNum < listNum;
    const priceUnit = catalogueData[priceUnitField] || "/ piece";
    const isWatermarkEnabled = safeGetFromStorage("showWatermark", true);
    const watermarkText = safeGetFromStorage("watermarkText", "Created using CatShare");
    const watermarkPosition = safeGetFromStorage("watermarkPosition", "bottom-left");

    // Build productData with all enabled fields dynamically
    const productData: any = {
      name: catalogueData.name,
      subtitle: catalogueData.subtitle,
      image,
      price: price !== "" && price !== 0 ? price : undefined,
      offerPrice: saleActive ? offerNum : undefined,
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

    console.log(`🎨 On-the-fly rendering product: ${product.name || product.id}`);
    console.log(`🎨 Theme: ${storedThemeId}, Colors - BG: ${bgColor}, Font: ${fontColor}, Image BG: ${imageBg}`);

    const renderOptions = {
      width: baseWidth,
      scale: 3,
      bgColor: bgColor,
      imageBgColor: imageBg,
      fontColor: fontColor,
      backgroundColor: "#ffffff",
    };
    const watermarkOptions = {
      enabled: isWatermarkEnabled,
      text: watermarkText,
      position: watermarkPosition,
    };

    const canvas = isGlassTheme
      ? await renderProductToCanvasGlass(productData, renderOptions, watermarkOptions)
      : await renderProductToCanvas(productData, renderOptions, watermarkOptions);

    const base64 = canvasToBase64(canvas);
    console.log(`✅ Product rendered on-the-fly successfully`);
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error(`❌ Error during rendering:`, err);
    // Try to render with empty image as fallback - still render the product card
    try {
      // Build fallback productData with all enabled fields
      const fallbackProductData: any = {
        name: product.name || "Product",
        subtitle: product.subtitle || "",
        image: "", // Empty image will be skipped by canvas renderer
        price: product.price || 0,
        priceUnit: product.priceUnit || "",
        badge: product.badge || "",
        cropAspectRatio: product.cropAspectRatio || 1,
      };

      // Add all enabled fields dynamically for fallback too
      getAllFields()
        .filter(f => f.enabled && f.key.startsWith('field') && isFieldVisibleOnSurface(f, 'shareImage'))
        .forEach(field => {
          fallbackProductData[field.key] = product[field.key] || "";
          const unitKey = `${field.key}Unit`;
          fallbackProductData[unitKey] = product[unitKey] || "None";
        });

      const fallbackRenderOptions = {
        width: 330,
        scale: 3,
        bgColor: product.bgColor || "#add8e6",
        imageBgColor: product.imageBgColor || "white",
        fontColor: product.fontColor || "white",
        backgroundColor: "#ffffff",
      };
      const fallbackWatermarkOptions = {
        enabled: false,
        text: "",
        position: "bottom-left",
      };

      const fallbackCanvas = isGlassTheme
        ? await renderProductToCanvasGlass(fallbackProductData, fallbackRenderOptions, fallbackWatermarkOptions)
        : await renderProductToCanvas(fallbackProductData, fallbackRenderOptions, fallbackWatermarkOptions);

      const fallbackBase64 = canvasToBase64(fallbackCanvas);
      console.log(`✅ Product rendered with fallback (no image)`);
      return `data:image/png;base64,${fallbackBase64}`;
    } catch (fallbackErr) {
      console.error(`❌ Fallback render also failed:`, fallbackErr);
      return null;
    }
  }
}
