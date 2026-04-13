// cropUtils.ts
export const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<string> => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;

  await new Promise((resolve) => {
    image.onload = resolve;
  });

  // Step 1: Create a canvas from the cropped area
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext("2d");

  if (!cropCtx) throw new Error("Could not get canvas context");

  cropCtx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Step 2: Downscale if larger than 600x600
  const maxSize = 600;
  const scale = Math.min(
    1,
    maxSize / cropCanvas.width,
    maxSize / cropCanvas.height
  );

  const outputWidth = Math.floor(cropCanvas.width * scale);
  const outputHeight = Math.floor(cropCanvas.height * scale);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext("2d");

  if (!outputCtx) throw new Error("Could not get output canvas context");

  outputCtx.drawImage(cropCanvas, 0, 0, outputWidth, outputHeight);

  // Step 3: Export to Base64 JPEG (80% quality)
  return outputCanvas.toDataURL("image/jpeg", 0.8);
};

/**
 * Center-crop loaded image to a target aspect ratio (width / height), then apply the same
 * downscale + JPEG export as {@link getCroppedImg} (max dimension 600).
 */
export async function getCenterCroppedImg(
  imageSrc: string,
  aspectRatio: number
): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image for crop"));
  });

  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!iw || !ih) throw new Error("Invalid image dimensions");

  const imgAspect = iw / ih;
  let cropW: number;
  let cropH: number;
  let cropX: number;
  let cropY: number;

  if (imgAspect > aspectRatio) {
    cropH = ih;
    cropW = ih * aspectRatio;
    cropX = (iw - cropW) / 2;
    cropY = 0;
  } else {
    cropW = iw;
    cropH = iw / aspectRatio;
    cropX = 0;
    cropY = (ih - cropH) / 2;
  }

  return getCroppedImg(imageSrc, {
    x: cropX,
    y: cropY,
    width: cropW,
    height: cropH,
  });
}

/**
 * Scale entire image to fit within maxSize on the longest edge; export JPEG.
 * Returns data URL and width/height ratio for {@link ProductWithCatalogueData.cropAspectRatio}.
 */
export async function getScaledFullImageDataUrl(
  imageSrc: string,
  maxSize = 600
): Promise<{ dataUrl: string; cropAspectRatio: number }> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
  });

  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!iw || !ih) throw new Error("Invalid image dimensions");

  const scale = Math.min(1, maxSize / Math.max(iw, ih));
  const outW = Math.max(1, Math.floor(iw * scale));
  const outH = Math.max(1, Math.floor(ih * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(image, 0, 0, outW, outH);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { dataUrl, cropAspectRatio: outW / outH };
}
