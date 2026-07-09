import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filesystem, Directory } from "@capacitor/filesystem";
import Cropper from "react-easy-crop";
import { FiArrowLeft, FiImage, FiEdit2, FiChevronLeft, FiChevronRight, FiDroplet } from "react-icons/fi";
import { getCroppedImg, getCenterCroppedImg, getScaledFullImageDataUrl } from "../cropUtils";
import { getPalette, normalizeProductFontColor } from "../colorUtils";
import { saveRenderedImage } from "../Save";
import { uploadProductImageToR2 } from "../services/r2Upload";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { useSubscription } from "../context/SubscriptionContext";
import { getAllCatalogues } from "../config/catalogueConfig";
import {
  getCatalogueData,
  isProductEnabledForCatalogue,
} from "../config/catalogueProductUtils";
import { getPersistedAuthUserId } from "../utils/authUserId";
import {
  safeGetFromStorage,
  safeSetInStorage,
  getStorageKey,
  getUserImagePath,
} from "../utils/safeStorage";
import { FREE_MAX_PRODUCTS } from "../config/freeTierLimits";
import { getAllProducts } from "../config/productUtils";
import { logProductAdded, logBulkImportImages } from "../config/analyticsEvents";
import { buildBulkImportedProduct, type BulkRenderingType } from "../bulkImport/bulkProductFactory";
import { dedupeDisplayNamesFromFilenames } from "../bulkImport/fileNameUtils";
import type { ProductWithCatalogueData } from "../config/catalogueProductUtils";
import { useCloudWriteGate } from "../hooks/useCloudWriteGate";

const MAX_IMAGES_PER_BATCH = 100;
const UPLOAD_CONCURRENCY = 2;

export type FramingMode = "square" | "portrait" | "full";

export type ImageAspectChoice = "square" | "portrait";

type PerImageColors = {
  bgColor: string;
};

type PixelCropRect = { x: number; y: number; width: number; height: number };

/** Middle stop for Glass-style card gradient (aligned with CreateProduct preview). */
function darkenColorForCardGradient(color: string): string {
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const d = (c: number) => Math.max(0, c - 40);
    return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
  }
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const d = (c: number) => Math.max(0, c - 40);
    return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
  }
  return color;
}

function newProductId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToPaletteAsync(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        resolve(getPalette(img, 12));
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

function isRatingMilestone(count: number): boolean {
  let milestone = 10;
  let increment = 15;
  while (milestone < count) {
    milestone += increment;
    increment += 5;
  }
  return count === milestone;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export default function CreateBulk() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentTheme } = useTheme();
  const { isPro } = useSubscription();
  const { guardCloudWrite } = useCloudWriteGate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authUserId = getPersistedAuthUserId();

  const [files, setFiles] = useState<File[]>([]);
  const [framing, setFraming] = useState<FramingMode>("square");
  /** Per-file custom crop (data URL); null = use automatic center crop for square/portrait */
  const [cropOverrides, setCropOverrides] = useState<(string | null)[]>([]);
  /** Last committed crop rect in **original file** pixel space — restores Cropper on re-open without hiding full image */
  const [cropAreaCommittedInOriginal, setCropAreaCommittedInOriginal] =
    useState<(PixelCropRect | null)[]>([]);
  /** Per-file aspect when using square/portrait mode (each image can differ) */
  const [imageAspects, setImageAspects] = useState<ImageAspectChoice[]>([]);
  const [editingCropIndex, setEditingCropIndex] = useState<number | null>(null);
  /** Full-image mode: set backgrounds without crop UI */
  const [colorOnlyIndex, setColorOnlyIndex] = useState<number | null>(null);
  const [paletteForEditor, setPaletteForEditor] = useState<string[]>([]);
  /** Card background colour per file (from theme until user picks a swatch) */
  const [perImageColors, setPerImageColors] = useState<PerImageColors[]>([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  /** Matches react-easy-crop crop viewport width so the gradient strip lines up with the image */
  const [cropViewportWidthPx, setCropViewportWidthPx] = useState<number | null>(
    null
  );
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<PixelCropRect | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [postImportSummary, setPostImportSummary] = useState<{
    created: number;
    failed: number;
    navigationPath: string;
    newIds: string[];
  } | null>(null);

  const objectUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => {
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [objectUrls]);

  useEffect(() => {
    setCropOverrides(files.map(() => null));
    setCropAreaCommittedInOriginal(files.map(() => null));
    setImageAspects(
      files.map(() => (framing === "portrait" ? "portrait" : "square"))
    );
    setPerImageColors(
      files.map(() => ({
        bgColor: currentTheme.styles.bgColor,
      }))
    );
  }, [files, framing, currentTheme.styles.bgColor]);

  useEffect(() => {
    setEditingCropIndex(null);
    setColorOnlyIndex(null);
  }, [framing]);

  const activePaletteIndex = editingCropIndex ?? colorOnlyIndex;
  useEffect(() => {
    if (activePaletteIndex == null) {
      setPaletteForEditor([]);
      return;
    }
    const src =
      cropOverrides[activePaletteIndex] ?? objectUrls[activePaletteIndex];
    if (!src) {
      setPaletteForEditor([]);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        setPaletteForEditor(getPalette(img, 12));
      } catch {
        setPaletteForEditor([]);
      }
    };
    img.onerror = () => setPaletteForEditor([]);
    img.src = src;
  }, [activePaletteIndex, objectUrls, cropOverrides]);

  useEffect(() => {
    if (editingCropIndex != null && editingCropIndex >= files.length) {
      setEditingCropIndex(null);
    }
  }, [files.length, editingCropIndex]);

  const aspectAtEditor =
    editingCropIndex != null ? imageAspects[editingCropIndex] : null;

  useEffect(() => {
    setCroppedAreaPixels(null);
  }, [editingCropIndex, aspectAtEditor]);

  useEffect(() => {
    if (editingCropIndex == null) {
      setCropViewportWidthPx(null);
    }
  }, [editingCropIndex]);

  /** Wired to Cropper `setCropSize` so we get a width on every layout pass (not only when size delta changes). */
  const setCropViewportWidthFromCropper = useCallback(
    (size: { width: number; height: number }) => {
      setCropViewportWidthPx(size.width);
    },
    []
  );

  const onCropComplete = useCallback(
    (
      _: unknown,
      area: { x: number; y: number; width: number; height: number }
    ) => {
      setCroppedAreaPixels(area);
    },
    []
  );

  const commitCropAtIndex = async (index: number): Promise<boolean> => {
    if (!croppedAreaPixels) {
      return true;
    }
    const src = objectUrls[index];
    if (!src) return false;
    try {
      const cropped = await getCroppedImg(src, croppedAreaPixels);
      setCropOverrides((prev) => {
        const next = [...prev];
        while (next.length < files.length) next.push(null);
        next[index] = cropped;
        return next;
      });
      setCropAreaCommittedInOriginal((prev) => {
        const next = [...prev];
        while (next.length < files.length) next.push(null);
        next[index] = { ...croppedAreaPixels };
        return next;
      });
      return true;
    } catch (e) {
      console.error(e);
      showToast("Could not save crop.", "error");
      return false;
    }
  };

  const applyCropModal = async () => {
    if (editingCropIndex == null) return;
    const ok = await commitCropAtIndex(editingCropIndex);
    if (ok) setEditingCropIndex(null);
  };

  const goToAdjacentCrop = async (direction: -1 | 1) => {
    if (editingCropIndex == null) return;
    const idx = editingCropIndex;
    const ok = await commitCropAtIndex(idx);
    if (!ok) return;
    const next = idx + direction;
    if (next < 0) return;
    if (next >= files.length) {
      setEditingCropIndex(null);
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setEditingCropIndex(next);
  };

  const cropperAspect =
    editingCropIndex != null && imageAspects[editingCropIndex] === "portrait"
      ? 3 / 4
      : 1;

  const setAspectForEditingIndex = (choice: ImageAspectChoice) => {
    if (editingCropIndex == null) return;
    const i = editingCropIndex;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageAspects((prev) => {
      const next = [...prev];
      while (next.length < files.length) next.push("square");
      next[i] = choice;
      return next;
    });
    setCropAreaCommittedInOriginal((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(null);
      next[i] = null;
      return next;
    });
    setCropOverrides((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(null);
      next[i] = null;
      return next;
    });
  };

  const patchPerImageColors = (index: number, patch: Partial<PerImageColors>) => {
    setPerImageColors((prev) => {
      const next = [...prev];
      const base: PerImageColors = {
        bgColor: currentTheme.styles.bgColor,
      };
      while (next.length <= index) next.push({ ...base });
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const openCropEditor = (i: number) => {
    setColorOnlyIndex(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setEditingCropIndex(i);
  };

  const openColorEditor = (i: number) => {
    setEditingCropIndex(null);
    setColorOnlyIndex(i);
  };

  const closeColorOnlyModal = () => setColorOnlyIndex(null);

  const goToAdjacentColorOnly = (direction: -1 | 1) => {
    if (colorOnlyIndex == null) return;
    const next = colorOnlyIndex + direction;
    if (next < 0 || next >= files.length) return;
    setColorOnlyIndex(next);
  };

  function bulkColorPickerEl(
    fileIndex: number,
    opts?: { compact?: boolean }
  ) {
    const compact = opts?.compact ?? false;
    const c: PerImageColors = {
      bgColor:
        perImageColors[fileIndex]?.bgColor ?? currentTheme.styles.bgColor,
    };
    const themeCard = currentTheme.styles.bgColor;
    const swatchRing = (selected: boolean) =>
      selected
        ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900"
        : "ring-1 ring-white/20";
    const sw = compact ? "w-8 h-8" : "w-9 h-9";
    const gap = compact ? "gap-1.5" : "gap-2";

    return (
      <div
        className={`shrink-0 border-t border-gray-800 bg-gray-900 px-3 ${
          compact
            ? "space-y-1.5 py-2"
            : "max-h-[36vh] space-y-3 overflow-y-auto py-3"
        }`}
      >
        {!compact && (
          <p className="text-[11px] leading-snug text-gray-400">
            Colours are sampled from this photo (like Create Product). Card = gradient background on the
            product card.
          </p>
        )}
        <div>
          <div
            className={`font-semibold text-gray-200 ${compact ? "mb-1 text-[10px]" : "mb-1.5 text-xs"}`}
          >
            Card background
          </div>
          <div className={`flex flex-wrap ${gap}`}>
            <button
              type="button"
              title="Theme default"
              onClick={() =>
                patchPerImageColors(fileIndex, { bgColor: themeCard })
              }
              className={`rounded-full ${sw} ${swatchRing(c.bgColor === themeCard)}`}
              style={{ backgroundColor: themeCard }}
            />
            {paletteForEditor.map((col, pi) => (
              <button
                key={`card-${fileIndex}-${pi}-${col}`}
                type="button"
                onClick={() => patchPerImageColors(fileIndex, { bgColor: col })}
                className={`rounded-full ${sw} ${swatchRing(c.bgColor === col)}`}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /** Gradient strip only — width matches crop viewport (`matchWidthPx`) or reference image (parent `w-fit`). */
  function cardPreviewStripEl(
    fileIndex: number,
    opts?: { matchWidthPx?: number | null }
  ) {
    const cardBg =
      perImageColors[fileIndex]?.bgColor ?? currentTheme.styles.bgColor;
    const mid = darkenColorForCardGradient(cardBg);
    const w = opts?.matchWidthPx;
    return (
      <div
        className={`mt-2 shrink-0 h-6 border-t border-black ${w == null ? "w-full" : "mx-auto"}`}
        style={{
          ...(typeof w === "number"
            ? { width: w, maxWidth: "100%" }
            : undefined),
          backgroundImage: `linear-gradient(135deg, ${cardBg} 0%, ${mid} 50%, ${cardBg} 100%)`,
        }}
        aria-hidden
      />
    );
  }

  const renderingType: BulkRenderingType =
    currentTheme.styles.layout === "glass" ? "glass" : "classic";

  const onPickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const arr = Array.from(list).filter((f) => /^image\//i.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
    if (arr.length === 0) {
      showToast("No supported images selected.", "warning");
      return;
    }
    if (arr.length > MAX_IMAGES_PER_BATCH) {
      showToast(`Select at most ${MAX_IMAGES_PER_BATCH} images at once.`, "warning");
      setFiles(arr.slice(0, MAX_IMAGES_PER_BATCH));
    } else {
      setFiles(arr);
    }
    e.target.value = "";
  }, [showToast]);

  const runImport = async () => {
    if (files.length === 0) {
      showToast("Choose one or more images first.", "warning");
      return;
    }

    if (!isPro) {
      const count = getAllProducts(authUserId || undefined).length;
      if (count + files.length > FREE_MAX_PRODUCTS) {
        showToast(
          `Free plan allows up to ${FREE_MAX_PRODUCTS} products. You can add ${Math.max(0, FREE_MAX_PRODUCTS - count)} more, or upgrade to Pro.`,
          "warning"
        );
        return;
      }
    }

    if (authUserId && !guardCloudWrite()) return;

    setIsImporting(true);
    setStatusLine("Preparing…");

    const displayNames = dedupeDisplayNamesFromFilenames(files.map((f) => f.name));
    const catalogues = getAllCatalogues();

    type Prepared = {
      displayName: string;
      dataUrl: string;
      cropAspectRatio: number;
      suggestedColors: string[];
    };

    const prepared: Prepared[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setStatusLine(`Processing ${i + 1} / ${files.length}…`);
        const file = files[i];
        const rawUrl = await readFileAsDataUrl(file);
        let dataUrl: string;
        let cropAspectRatio: number;

        if (framing === "full") {
          const full = await getScaledFullImageDataUrl(rawUrl, 600);
          dataUrl = full.dataUrl;
          cropAspectRatio = full.cropAspectRatio;
        } else {
          const aspectChoice = imageAspects[i] ?? (framing === "portrait" ? "portrait" : "square");
          const aspectNum = aspectChoice === "portrait" ? 3 / 4 : 1;
          dataUrl =
            cropOverrides[i] != null
              ? cropOverrides[i]!
              : await getCenterCroppedImg(rawUrl, aspectNum);
          cropAspectRatio = aspectNum;
        }

        const suggestedColors = await dataUrlToPaletteAsync(dataUrl);
        prepared.push({
          displayName: displayNames[i],
          dataUrl,
          cropAspectRatio,
          suggestedColors,
        });
      }

      const authUserIdNow = getPersistedAuthUserId();
      const productsStorageKeyNow = authUserIdNow
        ? getStorageKey("products", authUserIdNow)
        : "products";
      const useUserImagesNow = Boolean(authUserIdNow);

      type Built = { product: ProductWithCatalogueData; error?: string };

      const builtResults = await mapPool(prepared, UPLOAD_CONCURRENCY, async (prep, index) => {
        const id = newProductId();
        const imagePath = useUserImagesNow
          ? getUserImagePath(id, authUserIdNow || undefined)
          : `catalogue/product-${id}.png`;

        try {
          if (prep.dataUrl.startsWith("data:image")) {
            const base64 = prep.dataUrl.split(",")[1];
            await Filesystem.writeFile({
              path: imagePath,
              data: base64,
              directory: Directory.External,
              recursive: true,
            });
          }

          const uploaded = await uploadProductImageToR2({ productId: id, dataUrl: prep.dataUrl });
          if (!uploaded?.url) {
            return { product: null as any, error: "Upload returned no URL" };
          }

          const pc = perImageColors[index] ?? {
            bgColor: currentTheme.styles.bgColor,
          };

          const product = buildBulkImportedProduct({
            id,
            name: prep.displayName,
            imagePath,
            imageUrl: uploaded.url,
            imageVersion: uploaded.imageVersion ?? Date.now(),
            cropAspectRatio: prep.cropAspectRatio,
            suggestedColors: prep.suggestedColors.length > 0 ? prep.suggestedColors : undefined,
            fontColor: normalizeProductFontColor(currentTheme.styles.fontColor),
            bgColor: pc.bgColor,
            imageBgColor: currentTheme.styles.imageBgColor,
            renderingType,
          });

          return { product, error: undefined };
        } catch (e: any) {
          return {
            product: null as any,
            error: e?.message || String(e),
          };
        }
      });

      const successful = builtResults.filter((b) => b.product && !b.error) as { product: ProductWithCatalogueData }[];
      const failed = builtResults.filter((b) => b.error);

      if (successful.length === 0) {
        showToast(
          failed.length ? `Import failed: ${failed[0].error}` : "No products were created.",
          "error"
        );
        setIsImporting(false);
        setStatusLine("");
        return;
      }

      const all = safeGetFromStorage(productsStorageKeyNow, []);
      const newIds: string[] = [];
      const merged = [...all];
      for (const { product } of successful) {
        merged.push(product);
        newIds.push(String(product.id));
      }

      const ok = safeSetInStorage(productsStorageKeyNow, merged);
      if (!ok) {
        showToast(
          "Save failed: storage quota exceeded. Free space or remove old products, then try again.",
          "error"
        );
        setIsImporting(false);
        setStatusLine("");
        return;
      }

      logProductAdded(merged.length);
      logBulkImportImages(successful.length, framing);

      window.dispatchEvent(
        new CustomEvent("product-added", {
          detail: { onlyProductIds: newIds, forceCloudSync: true },
        })
      );

      if (failed.length > 0) {
        showToast(
          `Created ${successful.length} products. ${failed.length} failed — check filenames and connection.`,
          "warning"
        );
      } else {
        showToast(`Created ${successful.length} products.`, "success");
      }

      const totalProducts = merged.length;
      const shouldShowRating = isRatingMilestone(totalProducts);
      const basePath = "/";
      const navigationPath = shouldShowRating
        ? `${basePath}?showRating=true&productCount=${totalProducts}`
        : basePath;
      setIsImporting(false);
      setStatusLine("");
      setFiles([]);
      setPostImportSummary({
        created: successful.length,
        failed: failed.length,
        navigationPath,
        newIds,
      });

      void (async () => {
        for (const { product } of successful) {
          try {
            const enabledCats = catalogues.filter((cat) =>
              isProductEnabledForCatalogue(product, cat.id)
            );
            for (const cat of enabledCats) {
              const catData = getCatalogueData(product, cat.id);
              const renderOptions: Record<string, unknown> = {
                catalogueId: cat.id,
                catalogueLabel: cat.label,
                folder: cat.folder || cat.label,
                priceField: cat.priceField,
                priceUnitField: cat.priceUnitField,
                price1Unit: catData.price1Unit || "/ piece",
                wholesaleUnit: catData.price1Unit || "/ piece",
              };
              for (let j = 1; j <= 10; j++) {
                renderOptions[`field${j}Unit`] = catData[`field${j}Unit`] || "None";
              }
              const legacyType =
                cat.id === "cat1" ? "wholesale" : cat.id === "cat2" ? "resell" : cat.id;
              await saveRenderedImage(product, legacyType, renderOptions);
            }
          } catch (err) {
            console.warn("Bulk import: background render failed for a product:", err);
          }
        }
      })();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Import failed.", "error");
      setIsImporting(false);
      setStatusLine("");
    }
  };

  const openMasterBulkEditorFromHome = useCallback((newIds: string[]) => {
    // First open the side drawer UI, then open Bulk Editor inside it.
    window.dispatchEvent(new CustomEvent("toggle-menu"));
    let attempts = 0;
    const maxAttempts = 12;
    const tick = () => {
      attempts += 1;
      const sideDrawerState = (window as any).__sideDrawerState;
      if (sideDrawerState?.openBulkEdit) {
        sideDrawerState.openBulkEdit({
          catalogueId: "cat1",
          autoSelectAllFields: true,
          autoStartEdit: true,
          scrollToProductIds: newIds,
          showOnlyProductIds: true,
        });
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(tick, 120);
      }
    };
    setTimeout(tick, 120);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="sticky top-0 z-50 h-[40px] shrink-0 bg-black" />

      <header className="sticky top-[40px] z-40 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back"
        >
          <FiArrowLeft className="text-xl text-gray-800 dark:text-gray-100" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex-1">
          Bulk add from gallery
        </h1>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full pb-24 space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Each photo becomes one new product with default catalogue fields. Names come from file names.
          Use{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">Bulk Editor</span> afterward
          to set prices and details.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 font-semibold hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition disabled:opacity-50"
        >
          <FiImage size={22} />
          {files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose images"}
        </button>

        {files.length > 0 && (framing === "square" || framing === "portrait") && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Per-image focus
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Tap Adjust on any photo to crop and choose its background colour.
            </p>
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-3 px-2 py-2.5 first:pt-2 last:pb-2"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 ring-1 ring-gray-200/80 dark:ring-gray-700">
                    <img
                      src={cropOverrides[i] ?? objectUrls[i]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(imageAspects[i] ?? "square") === "portrait" ? "3:4" : "1:1"}
                      {" · "}
                      {cropOverrides[i] ? "Custom crop" : "Center crop (default)"}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{
                          backgroundColor:
                            perImageColors[i]?.bgColor ?? currentTheme.styles.bgColor,
                        }}
                        title="Card colour"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => openCropEditor(i)}
                    className="group flex items-center gap-2 shrink-0 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-700/70 bg-gradient-to-br from-indigo-50 via-white to-indigo-100 dark:from-indigo-900/40 dark:via-indigo-900/25 dark:to-indigo-800/35 text-indigo-700 dark:text-indigo-200 text-sm font-semibold hover:from-indigo-100 hover:to-indigo-200 dark:hover:from-indigo-900/55 dark:hover:to-indigo-800/45 shadow-sm hover:shadow disabled:opacity-50 min-h-[44px] transition-all"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 dark:bg-indigo-950/70 border border-indigo-200/90 dark:border-indigo-700/80">
                      <FiEdit2 size={14} />
                    </span>
                    Adjust
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {files.length > 0 && framing === "full" && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Background colours
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Full photo is used as-is. Tap Colours to set the card background colour from each photo&apos;s
              palette.
            </p>
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
              {files.map((file, i) => (
                <li
                  key={`full-${file.name}-${i}`}
                  className="flex items-center gap-3 px-2 py-2.5 first:pt-2 last:pb-2"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 ring-1 ring-gray-200/80 dark:ring-gray-700">
                    <img
                      src={objectUrls[i]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{
                          backgroundColor:
                            perImageColors[i]?.bgColor ?? currentTheme.styles.bgColor,
                        }}
                        title="Card colour"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => openColorEditor(i)}
                    className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 min-h-[44px]"
                  >
                    <FiDroplet size={16} />
                    Colours
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isImporting && statusLine && (
          <div className="text-sm text-center text-blue-700 dark:text-blue-300 animate-pulse">{statusLine}</div>
        )}

        <button
          type="button"
          disabled={isImporting || files.length === 0}
          onClick={() => void runImport()}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? "Importing…" : "Create products"}
        </button>
      </main>

      {postImportSummary && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Products created
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {postImportSummary.failed > 0
                ? `${postImportSummary.created} products created. ${postImportSummary.failed} failed.`
                : `${postImportSummary.created} products created successfully.`}{" "}
              Open Bulk Editor now to fill prices, stock, and details quickly.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => {
                  const path = postImportSummary.navigationPath;
                  setPostImportSummary(null);
                  navigate(path);
                }}
              >
                Maybe later
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
                onClick={() => {
                  const path = postImportSummary.navigationPath;
                  const ids = postImportSummary.newIds;
                  setPostImportSummary(null);
                  navigate(path);
                  setTimeout(() => {
                    openMasterBulkEditorFromHome(ids);
                  }, 220);
                }}
              >
                Open Bulk Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCropIndex != null && objectUrls[editingCropIndex] && (
        <div className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-black">
          <div className="h-[40px] w-full shrink-0 bg-black" aria-hidden />

          {/* 1. Image + card preview strip — grows to fill space between chrome and controls */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden">
              <Cropper
                key={`${editingCropIndex}-${imageAspects[editingCropIndex] ?? "square"}`}
                image={objectUrls[editingCropIndex]}
                crop={crop}
                zoom={zoom}
                aspect={cropperAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                setCropSize={setCropViewportWidthFromCropper}
                {...(cropAreaCommittedInOriginal[editingCropIndex] != null
                  ? {
                      initialCroppedAreaPixels:
                        cropAreaCommittedInOriginal[editingCropIndex]!,
                    }
                  : {})}
              />
            </div>
            {cardPreviewStripEl(editingCropIndex, {
              matchWidthPx: cropViewportWidthPx,
            })}
          </div>

          {/* 2. Zoom */}
          <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-3 py-2.5">
            <label className="flex items-center gap-3 text-sm text-white">
              <span className="w-14 shrink-0 text-gray-400">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
            </label>
          </div>

          {/* 3. Color (compact — no internal scroll) */}
          {bulkColorPickerEl(editingCropIndex, { compact: true })}

          {/* 4. Shape */}
          <div className="flex shrink-0 justify-center gap-2 border-t border-gray-800 bg-gray-900 px-3 py-2">
            <button
              type="button"
              onClick={() => setAspectForEditingIndex("square")}
              className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-bold transition ${
                imageAspects[editingCropIndex] !== "portrait"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Square 1:1
            </button>
            <button
              type="button"
              onClick={() => setAspectForEditingIndex("portrait")}
              className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-bold transition ${
                imageAspects[editingCropIndex] === "portrait"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Portrait 3:4
            </button>
          </div>

          {/* 5. Cancel / navigation / Done */}
          <div
            className="flex shrink-0 items-center justify-between gap-1 border-t border-gray-800 bg-gray-950 px-2 py-2.5"
            style={{
              paddingBottom: "max(10px, env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              onClick={() => setEditingCropIndex(null)}
              className="min-h-[44px] shrink-0 px-2 py-2 text-sm font-semibold text-white/90"
            >
              Cancel
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
              <button
                type="button"
                aria-label="Previous image"
                disabled={editingCropIndex <= 0}
                onClick={() => void goToAdjacentCrop(-1)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-white hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
              >
                <FiChevronLeft size={28} />
              </button>
              <span className="truncate px-1 text-center text-sm font-semibold text-white">
                {editingCropIndex + 1} / {files.length}
              </span>
              <button
                type="button"
                aria-label={
                  editingCropIndex >= files.length - 1
                    ? "Save and finish"
                    : "Next image"
                }
                onClick={() => void goToAdjacentCrop(1)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 text-white hover:bg-white/10"
              >
                <FiChevronRight size={28} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void applyCropModal()}
              className="min-h-[44px] shrink-0 px-2 py-2 text-sm font-bold text-blue-400"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {colorOnlyIndex != null && objectUrls[colorOnlyIndex] && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-y-auto overscroll-contain">
          <div className="h-[40px] w-full shrink-0 bg-black" aria-hidden />

          <div className="flex items-center justify-between gap-1 border-b border-gray-800 bg-gray-950 px-2 py-3">
            <button
              type="button"
              onClick={closeColorOnlyModal}
              className="text-white/90 text-sm font-semibold py-2 px-2 min-h-[44px] shrink-0"
            >
              Cancel
            </button>
            <div className="flex items-center gap-1 min-w-0 flex-1 justify-center">
              <button
                type="button"
                aria-label="Previous image"
                disabled={colorOnlyIndex <= 0}
                onClick={() => goToAdjacentColorOnly(-1)}
                className="p-2 rounded-lg text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              >
                <FiChevronLeft size={28} />
              </button>
              <span className="text-white font-semibold text-sm truncate text-center px-1">
                Colours {colorOnlyIndex + 1} / {files.length}
              </span>
              <button
                type="button"
                aria-label={
                  colorOnlyIndex >= files.length - 1 ? "Done" : "Next image"
                }
                onClick={() => {
                  if (colorOnlyIndex >= files.length - 1) {
                    closeColorOnlyModal();
                  } else {
                    goToAdjacentColorOnly(1);
                  }
                }}
                className="p-2 rounded-lg text-white hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              >
                <FiChevronRight size={28} />
              </button>
            </div>
            <button
              type="button"
              onClick={closeColorOnlyModal}
              className="text-blue-400 text-sm font-bold py-2 px-2 min-h-[44px] shrink-0"
            >
              Done
            </button>
          </div>
          <div className="px-4 py-3 bg-gray-950 border-b border-gray-800 flex justify-center">
            <div className="flex min-w-0 flex-col items-stretch w-fit max-w-full">
              <img
                src={objectUrls[colorOnlyIndex]}
                alt=""
                className="max-h-36 w-auto max-w-full rounded-lg object-contain"
              />
              {cardPreviewStripEl(colorOnlyIndex)}
            </div>
          </div>
          {bulkColorPickerEl(colorOnlyIndex)}
          <div className="flex-1 min-h-0" />
        </div>
      )}
    </div>
  );
}
