import { Share } from "@capacitor/share";
import { hydrateProductSourceForRender } from "./utils/productSourceImage";
import {
  findRenderedImagePath,
  getRenderedImage,
  getRenderedImageUri,
  renderProductImageOnTheFly,
  type RenderedImageCatalogueRef,
} from "./utils/renderingUtils";
import { getCatalogueById, getCatalogueByFolder } from "./config/catalogueConfig";
import { getPersistedAuthUserId } from "./utils/authUserId";
import { safeGetFromStorage, getStorageKey } from "./utils/safeStorage";
import { logRenderStarted, logRenderCompleted, logShareInitiated, logShareCompleted } from "./config/analyticsEvents";

interface HandleShareParams {
  selected: any[];
  setProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setProcessingIndex: React.Dispatch<React.SetStateAction<number>>;
  setProcessingTotal: React.Dispatch<React.SetStateAction<number>>;
  folder?: string | null;
  mode?: string;
  products?: any[];
}

const RENDER_TIMEOUT_MS = 120_000;

function resolveCatalogueRef(
  catalogueId: string | undefined,
  catalogueLabel: string,
  authUserId: string | null
): RenderedImageCatalogueRef {
  const uid = authUserId || undefined;
  let cat = catalogueId ? getCatalogueById(catalogueId, uid) : undefined;
  if (!cat && catalogueId) {
    const legacyFolder =
      catalogueId === "wholesale"
        ? "Wholesale"
        : catalogueId === "resell"
          ? "Resell"
          : catalogueId === "retail"
            ? "Retail"
            : catalogueLabel;
    cat = getCatalogueByFolder(legacyFolder, uid);
  }
  if (!cat) {
    cat = getCatalogueByFolder(catalogueLabel, uid);
  }
  if (cat) {
    return { label: cat.label, folder: cat.folder || cat.label };
  }
  return { label: catalogueLabel, folder: catalogueLabel };
}

function productHasSourceImage(product: any): boolean {
  return !!(product?.image || product?.imagePath || product?.imageUrl);
}

export async function handleShare({
  selected,
  setProcessing,
  setProcessingIndex,
  setProcessingTotal,
  folder = null,
  mode = "resell",
  products = undefined,
}: HandleShareParams) {
  if (!selected || selected.length === 0) {
    alert("No products selected.");
    return;
  }

  setProcessing(true);
  setProcessingTotal(selected.length);
  setProcessingIndex(0);

  const targetFolder = folder || (mode === "wholesale" ? "Wholesale" : mode === "retail" ? "Retail" : "Resell");
  const catalogueLabel = targetFolder;
  const authUserId = getPersistedAuthUserId();
  const catalogue = resolveCatalogueRef(mode, catalogueLabel, authUserId);
  const fileUris: string[] = [];

  let allProducts = products;
  if (!allProducts) {
    if (authUserId) {
      allProducts = safeGetFromStorage(getStorageKey("products", authUserId), []);
    } else {
      allProducts = JSON.parse(localStorage.getItem("products") || "[]");
    }
  }
  if (!products && (mode === "retail" || mode === "cat2")) {
    const retailStorageKey = authUserId
      ? getStorageKey("retailProducts", authUserId)
      : "retailProducts";
    const retailProducts = safeGetFromStorage(retailStorageKey, []);
    if (retailProducts.length > 0) {
      allProducts = [...retailProducts, ...allProducts];
    }
  }

  const selectedProducts = selected
    .map((id) => allProducts.find((p: any) => String(p.id) === String(id)))
    .filter(Boolean) as any[];

  if (selectedProducts.length === 0) {
    setProcessing(false);
    alert("No matching products found for the current selection.");
    return;
  }

  const needsRendering: any[] = [];

  for (const product of selectedProducts) {
    const existingPath = await findRenderedImagePath(product.id, catalogue, authUserId);
    if (existingPath) {
      console.log(`✅ Rendered image already exists for ${product.name}`);
      continue;
    }
    if (productHasSourceImage(product)) {
      needsRendering.push(product);
      console.log(`🎨 Product ${product.name} needs rendering for ${catalogue.label}`);
    } else {
      console.warn(`⚠️ Product ${product.name} has no image, cannot share or render`);
    }
  }

  if (needsRendering.length > 0) {
    console.log(`🎨 Share.ts: ${needsRendering.length} products need rendering`);
    logRenderStarted(needsRendering.length === 1 ? "single" : "all");

    setProcessing(true);
    setProcessingIndex(0);
    setProcessingTotal(needsRendering.length);

    window.dispatchEvent(
      new CustomEvent("processingPhaseChange", {
        detail: {
          phase: "rendering",
          totalToRender: needsRendering.length,
          totalToShare: selected.length,
          message: "Rendering images...",
        },
      })
    );

    for (const product of needsRendering) {
      await hydrateProductSourceForRender(product);
    }

    const completionPromise = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener("renderComplete", completionHandler);
        reject(new Error("Rendering timed out"));
      }, RENDER_TIMEOUT_MS);

      const completionHandler = () => {
        window.clearTimeout(timer);
        window.removeEventListener("renderComplete", completionHandler);
        resolve();
      };
      window.addEventListener("renderComplete", completionHandler, { once: true });
    });

    console.log("📤 Dispatching requestRenderSelectedPNGs with " + needsRendering.length + " products");
    window.dispatchEvent(
      new CustomEvent("requestRenderSelectedPNGs", {
        detail: {
          products: needsRendering,
          showOverlay: false,
          catalogue,
          catalogueId: mode,
        },
      })
    );

    try {
      await completionPromise;
      logRenderCompleted(needsRendering.length === 1 ? "single" : "all", true);
      console.log("✅ Rendering complete, proceeding with sharing...");
    } catch (renderErr) {
      console.warn("⚠️ Background rendering did not complete in time, will try on-the-fly fallback", renderErr);
      logRenderCompleted(needsRendering.length === 1 ? "single" : "all", false);
    }

    window.dispatchEvent(
      new CustomEvent("processingPhaseChange", {
        detail: {
          phase: "sharing",
          totalToRender: needsRendering.length,
          totalToShare: selected.length,
          message: "Preparing files for sharing...",
        },
      })
    );
  } else {
    console.log("✅ All images already rendered, skipping rendering phase");
    window.dispatchEvent(
      new CustomEvent("processingPhaseChange", {
        detail: {
          phase: "sharing",
          totalToRender: 0,
          totalToShare: selected.length,
          message: "Preparing files for sharing...",
        },
      })
    );
  }

  setProcessingIndex(0);
  setProcessingTotal(selected.length);

  let completedCount = 0;
  const updateProgress = () => {
    completedCount++;
    setProcessingIndex(completedCount);
  };

  const failedProducts: string[] = [];

  for (const id of selected) {
    try {
      let uri = await getRenderedImageUri(id, catalogue, authUserId);

      if (!uri) {
        const product = allProducts.find((p: any) => String(p.id) === String(id));
        if (product) {
          const dataUrl = await renderProductImageOnTheFly(
            product,
            catalogue.label,
            mode
          );
          if (dataUrl) {
            uri = dataUrl;
          }
        }
      }

      if (!uri) {
        const imageDataUrl = await getRenderedImage(
          String(id),
          catalogue.label,
          catalogue.folder
        );
        if (imageDataUrl) {
          uri = imageDataUrl;
        }
      }

      if (uri) {
        fileUris.push(uri);
      } else {
        failedProducts.push(String(id));
      }
    } catch (err) {
      console.error(`❌ Error getting rendered image for product ${id}:`, err);
      failedProducts.push(String(id));
    } finally {
      updateProgress();
    }
  }

  if (fileUris.length === 0) {
    console.error(`❌ Share failed: No rendered images available. Failed products:`, failedProducts);
    setProcessing(false);
    alert(
      "❌ Cannot share: No rendered images available.\n\nPlease ensure you have:\n1. Selected at least one product\n2. That product has an image\n\nThe app will automatically render products before sharing. If rendering failed, please:\n- Check that products have images\n- Try rendering manually first\n\nFailed products: " +
        failedProducts.join(", ")
    );
    return;
  }

  try {
    console.log(`\n📤 Preparing to share:`);
    console.log(`   Files collected: ${fileUris.length}`);
    fileUris.forEach((uri, idx) => {
      console.log(`   [${idx + 1}] ${uri.substring(0, 100)}${uri.length > 100 ? "..." : ""}`);
    });

    logShareInitiated(`native_${targetFolder.toLowerCase()}`);

    try {
      await Share.share({
        files: fileUris,
        dialogTitle: "Share Products",
      });

      console.log("✅ Share successful!", fileUris.length, "products");
      logShareCompleted(`native_${targetFolder.toLowerCase()}`, true);
    } catch (nativeShareErr) {
      console.warn("⚠️ Native Share API failed, attempting fallback...", nativeShareErr);

      if (navigator.share && fileUris.length > 0) {
        try {
          const dataUrl = fileUris[0];
          if (dataUrl.startsWith("data:")) {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], `product_${Date.now()}.png`, { type: "image/png" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: "CatShare Products",
                text: `Sharing ${fileUris.length} product${fileUris.length > 1 ? "s" : ""}`,
              });
              logShareCompleted("web_api", true);
            } else {
              throw new Error("Web Share API cannot share files");
            }
          } else {
            await navigator.share({
              title: "CatShare Products",
              text: `Sharing ${fileUris.length} product${fileUris.length > 1 ? "s" : ""}`,
              url: window.location.href,
            });
            logShareCompleted("web_api_url", true);
          }
        } catch (webShareErr) {
          console.warn("⚠️ Web Share API also failed, trying download fallback...", webShareErr);

          if (fileUris.length > 0 && fileUris[0].startsWith("data:")) {
            const link = document.createElement("a");
            link.href = fileUris[0];
            link.download = `product_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert(
              `✅ Image download started!\n\nNote: ${fileUris.length} product${fileUris.length > 1 ? "s" : ""} ready. Use your device's native share option from the downloaded file.`
            );
          } else {
            throw webShareErr;
          }
        }
      } else if (fileUris.length > 0 && fileUris[0].startsWith("data:")) {
        const link = document.createElement("a");
        link.href = fileUris[0];
        link.download = `product_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert(
          `✅ Image download started!\n\nNote: ${fileUris.length} product${fileUris.length > 1 ? "s" : ""} ready. Use your device's native share option from the downloaded file.`
        );
      } else {
        throw new Error("No Share API available and unable to download files");
      }
    }
  } catch (err) {
    console.error("❌ Share/Download failed:", err);
    alert(
      "Sharing failed: " +
        (err as Error).message +
        "\n\nTry saving the image and share it manually using your device's sharing options."
    );
  } finally {
    setProcessing(false);
  }
}
