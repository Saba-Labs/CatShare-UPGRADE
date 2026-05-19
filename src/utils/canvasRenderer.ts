/**
 * Canvas API Rendering Utility
 * Replaces html2canvas with native Canvas API for better performance
 */

import { Capacitor } from '@capacitor/core';
import {
  fetchPublicImageProxyAsDataUrl,
  isPublicR2ImageUrlForProxy,
} from './publicImageProxyClient';

const LOAD_TIMEOUT_MS = 30000;

/**
 * Native app WebView: loading https R2 URLs via <img crossOrigin> or fetch() hits CORS for
 * capacitor:// / ionic:// origins. Use Capacitor HTTP (fetchUrlAsDataUrl) on the main thread instead.
 * Web Workers have no `window` — keep browser fetch/img path there.
 */
function shouldLoadHttpsViaCapacitorHttp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function loadImageWithOptionalCrossOrigin(
  src: string,
  crossOriginAnonymous: boolean
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      reject(new Error(`Image load timeout after ${LOAD_TIMEOUT_MS / 1000}s: ${src.substring(0, 50)}...`));
    }, LOAD_TIMEOUT_MS);

    img.onload = () => {
      clearTimeout(timeout);
      console.log(`[loadImage] Successfully loaded image. Dimensions: ${img.width}x${img.height}`);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load image: ${src.substring(0, 100)}`));
    };

    if (crossOriginAnonymous && (src.startsWith('http://') || src.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }

    img.src = src;
  });
}

/**
 * Load an image from URL or data URI and return as Image object.
 * - Native (main thread): https → Capacitor HTTP → data URL (avoids WebView CORS on R2).
 * - Web: https → crossOrigin img, then fetch→blob fallback.
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  if (!src) {
    throw new Error('Image source is empty or undefined');
  }

  console.log(`[loadImage] Loading image with source type:`, {
    isDataUrl: src.startsWith('data:'),
    isBlob: src.startsWith('blob:'),
    isHttp: src.startsWith('http'),
    srcLength: src.length,
  });

  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return loadImageWithOptionalCrossOrigin(src, false);
  }

  if (src.startsWith('http://') || src.startsWith('https://')) {
    if (shouldLoadHttpsViaCapacitorHttp()) {
      try {
        const { fetchUrlAsDataUrl } = await import('./fetchImageCrossPlatform');
        const dataUrl = await fetchUrlAsDataUrl(src.trim());
        return await loadImageWithOptionalCrossOrigin(dataUrl, false);
      } catch (e) {
        console.error('[loadImage] native Capacitor HTTP load failed:', e);
        throw e instanceof Error ? e : new Error(String(e));
      }
    }

    try {
      return await loadImageWithOptionalCrossOrigin(src, true);
    } catch (firstErr) {
      console.warn('[loadImage] crossOrigin load failed, trying fetch → blob:', firstErr);
      try {
        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          return await loadImageWithOptionalCrossOrigin(objectUrl, false);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (secondErr) {
        if (isPublicR2ImageUrlForProxy(src)) {
          try {
            const dataUrl = await fetchPublicImageProxyAsDataUrl(src);
            return await loadImageWithOptionalCrossOrigin(dataUrl, false);
          } catch (proxyErr) {
            console.error('[loadImage] same-origin proxy failed:', proxyErr);
          }
        }
        console.error('[loadImage] fetch→blob fallback failed:', secondErr);
        throw secondErr instanceof Error ? secondErr : new Error(String(secondErr));
      }
    }
  }

  return loadImageWithOptionalCrossOrigin(src, false);
}

/**
 * Measure text width in canvas context
 */
function measureText(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const previousFont = ctx.font;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  ctx.font = previousFont;
  return width;
}

/**
 * Draw wrapped text on canvas
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

/**
 * Parse CSS color string to RGB values
 */
function colorToRgb(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  // Handle rgb() format
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  // Default to black
  return { r: 0, g: 0, b: 0 };
}

/**
 * Check if color is light or dark
 */
export function isLightColor(color: string): boolean {
  if (color.toLowerCase() === 'white' || color === '#ffffff') return true;
  const rgb = colorToRgb(color);
  const luminance = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return luminance > 128;
}

/**
 * Lighten a color by specified amount
 */
export function lightenColor(color: string, amount: number): string {
  const rgb = colorToRgb(color);
  return `rgb(${Math.min(255, rgb.r + amount)}, ${Math.min(255, rgb.g + amount)}, ${Math.min(255, rgb.b + amount)})`;
}

/**
 * Draw a rounded rectangle on canvas context
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a stadium shape (rounded only on left and right sides, straight on top and bottom)
 */
function drawStadiumShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const radius = height / 2; // Semicircle radius for left and right
  ctx.beginPath();
  ctx.moveTo(x + radius, y); // Top-left start
  ctx.lineTo(x + width - radius, y); // Top line (straight)
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2); // Right semicircle
  ctx.lineTo(x + radius, y + height); // Bottom line (straight)
  ctx.arc(x + radius, y + radius, radius, Math.PI / 2, -Math.PI / 2); // Left semicircle
  ctx.closePath();
}

export interface ProductRenderOptions {
  width: number;
  height?: number;
  scale: number;
  bgColor: string;
  imageBgColor: string;
  fontColor: string;
  backgroundColor: string;
  currencySymbol?: string;
}

export interface ProductData {
  name: string;
  subtitle?: string;
  image: string;
  field1?: string;
  field2?: string;
  field2Unit?: string;
  field3?: string;
  field3Unit?: string;
  field4?: string;
  field4Unit?: string;
  field5?: string;
  field5Unit?: string;
  field6?: string;
  field6Unit?: string;
  field7?: string;
  field7Unit?: string;
  field8?: string;
  field8Unit?: string;
  field9?: string;
  field9Unit?: string;
  field10?: string;
  field10Unit?: string;
  price?: string | number;
  /** Sale/unit price when lower than `price` (list/MRP) */
  offerPrice?: string | number;
  priceUnit?: string;
  badge?: string;
  cropAspectRatio?: number;
  variantGroups?: Array<{ id: string; name: string; options: string[] }>;
}

import { getFieldConfig, getAllFields } from '../config/fieldConfig';
import { formatVariantOptions } from './productVariants';
import { drawCanvasCataloguePriceLine, hasCanvasRenderablePrice } from './canvasProductPriceDraw';
import { getThemeById } from '../config/themeConfig';

/**
 * Draw detailed product card to canvas
 * Mimics the Save.jsx rendering: image + title + fields + price + watermark
 */
export async function renderProductToCanvas(
  product: ProductData,
  options: ProductRenderOptions,
  watermarkConfig?: {
    enabled: boolean;
    text: string;
    position: string;
  }
): Promise<HTMLCanvasElement> {
  console.log(`[renderProductToCanvas] Starting render for product:`, product.name);
  console.log(`[renderProductToCanvas] Options:`, options);

  const scale = options.scale || 3;
  const baseWidth = options.width;
  const cropAspectRatio = product.cropAspectRatio || 1;

  // Get all enabled fields
  const allEnabledFields = getAllFields().filter(f => f.enabled && f.key.startsWith('field'));

  // Calculate required height for all content
  // Image section: baseWidth / cropAspectRatio
  // Details section: padding + title + subtitle + fields + price bar
  const imageSectionBaseHeight = baseWidth / cropAspectRatio;
  const detailsPaddingBase = 4; // Updated: 8 -> 4 (matching "4px 8px" padding in HTML)
  const titleFontSizeBase = 27;
  const subtitleFontSizeBase = 17;
  const fieldFontSizeBase = 16;
  const fieldLineHeightBase = fieldFontSizeBase * 1.4;
  const priceBarHeightBase = product.price ? 28 : 0;

  // Spacing constants (must match the spacing used in height calculation)
  const spacingAfterTitle = 12;
  const spacingAfterSubtitle = 10;
  const spacingBeforeFields = 12;
  const spacingAfterFields = 12;

  // Estimate details height
  let detailsHeight = detailsPaddingBase; // top padding (4px)
  detailsHeight += 10; // extra top spacing before title
  detailsHeight += titleFontSizeBase + spacingAfterTitle; // title + spacing

  if (product.subtitle) {
    detailsHeight += subtitleFontSizeBase + spacingAfterSubtitle; // subtitle + spacing after
  }

  const variantLineCount = product.variantGroups?.length ?? 0;
  if (variantLineCount > 0) {
    detailsHeight += variantLineCount * (fieldLineHeightBase + 2);
  }

  detailsHeight += spacingBeforeFields; // spacing before fields

  // Field heights (only count non-empty enabled visible fields)
  allEnabledFields.forEach(field => {
    const visibilityKey = `${field.key}Visible`;
    const isVisible = product[visibilityKey] !== false; // Default to visible

    if (product[field.key] && isVisible) {
      detailsHeight += fieldLineHeightBase + 2;
    }
  });

  detailsHeight += spacingAfterFields; // spacing after fields
  detailsHeight += priceBarHeightBase;
  detailsHeight += detailsPaddingBase; // bottom padding (4px)

  const baseHeight = imageSectionBaseHeight + detailsHeight;

  // Canvas dimensions at scale
  const canvasWidth = baseWidth * scale;
  const canvasHeight = baseHeight * scale;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  let currentY = 0;

  // ===== IMAGE SECTION =====
  const imageBg = options.imageBgColor;
  const imageHeight = imageSectionBaseHeight * scale;

  // Draw image background with shadow effect
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 20 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8 * scale;
  ctx.fillStyle = imageBg;
  ctx.fillRect(0, currentY, canvasWidth, imageHeight);
  ctx.restore();

  // Load and draw image
  try {
    if (!product.image) {
      throw new Error('Product image is not set');
    }

    console.log(`Loading image: ${product.image}`);
    const img = await loadImage(product.image);
    console.log(`Image loaded successfully. Dimensions: ${img.width}x${img.height}`);

    // Center image in the available space
    const imgScaledWidth = canvasWidth;
    const imgScaledHeight = (img.height / img.width) * canvasWidth;

    if (imgScaledHeight >= imageHeight) {
      // Image is taller, fit by width
      ctx.drawImage(img, 0, currentY, canvasWidth, imageHeight);
    } else {
      // Image is wider, center vertically
      const offsetY = currentY + (imageHeight - imgScaledHeight) / 2;
      ctx.drawImage(img, 0, offsetY, canvasWidth, imgScaledHeight);
    }
    console.log(`Image drawn to canvas`);
  } catch (err) {
    console.error('Failed to load image:', err);
    // Draw placeholder instead of silently failing
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, currentY, canvasWidth, imageHeight);
    ctx.fillStyle = '#999999';
    ctx.font = `${Math.floor(20 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image not found', canvasWidth / 2, currentY + imageHeight / 2);
  }

  // Draw badge if present (rounded pill shape matching create product preview)
  if (product.badge) {
    const badgeBg = isLightColor(imageBg) ? '#fff' : '#000';
    const badgeText = isLightColor(imageBg) ? '#000' : '#fff';
    const badgeBorder = isLightColor(imageBg) ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';

    const badgeText_str = product.badge.toUpperCase();
    const badgeFontSize = Math.floor(13 * scale); // Slightly smaller font size
    const badgeFont = `400 ${badgeFontSize}px Arial, sans-serif`; // Normal weight (removed bold)

    ctx.font = badgeFont;
    const badgeMetrics = ctx.measureText(badgeText_str);

    // Padding: horizontal 10px, vertical 7px (balanced padding)
    const badgePaddingH = 10 * scale; // Horizontal padding
    const badgePaddingV = 7 * scale; // Vertical padding
    const badgeWidth = badgeMetrics.width + badgePaddingH * 2;
    const badgeHeight = badgeFontSize + badgePaddingV * 2;

    const badgeX = canvasWidth - badgeWidth - 12 * scale;
    const badgeY = currentY + imageHeight - badgeHeight - 12 * scale;

    // Draw shadow first
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1 * scale;

    // Draw stadium shape badge background (rounded left and right sides, straight top and bottom)
    ctx.fillStyle = badgeBg;
    ctx.globalAlpha = 0.95;
    drawStadiumShape(ctx, badgeX, badgeY, badgeWidth, badgeHeight);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    // Badge border
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 1 * scale;
    drawStadiumShape(ctx, badgeX, badgeY, badgeWidth, badgeHeight);
    ctx.stroke();

    // Badge text - perfectly centered vertically and horizontally
    ctx.fillStyle = badgeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const badgeTextOffsetY = 1 * scale; // Minimal offset to move text down for better visual vertical centering
    ctx.fillText(badgeText_str, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + badgeTextOffsetY);
  }

  currentY += imageHeight;

  // ===== DETAILS SECTION =====
  const detailsBgColor = lightenColor(options.bgColor, 40);
  const renderDetailsPadding = detailsPaddingBase * scale;

  ctx.fillStyle = detailsBgColor;
  ctx.fillRect(0, currentY, canvasWidth, canvasHeight - currentY);

  // Draw shadow gradient on details section (naturally falling from image)
  const shadowGradient = ctx.createLinearGradient(0, currentY, 0, currentY + 25 * scale);
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
  shadowGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGradient;
  ctx.fillRect(0, currentY, canvasWidth, 25 * scale);

  ctx.fillStyle = options.fontColor;
  ctx.textAlign = 'left';

  // Add top spacing before title
  currentY += 10 * scale;

  // Title
  const renderTitleFontSize = Math.floor(titleFontSizeBase * scale);
  const titleFont = `normal ${renderTitleFontSize}px Arial, sans-serif`;
  ctx.font = titleFont;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 5 * scale;
  ctx.shadowOffsetX = 3 * scale;
  ctx.shadowOffsetY = 3 * scale;
  ctx.textAlign = 'center';
  ctx.fillText(product.name, canvasWidth / 2, currentY + renderTitleFontSize * 0.8);
  ctx.shadowColor = 'transparent';
  ctx.textAlign = 'left';

  currentY += renderTitleFontSize + spacingAfterTitle * scale; // Title height + spacing

  // Subtitle
  if (product.subtitle) {
    const renderSubtitleFontSize = Math.floor(subtitleFontSizeBase * scale);
    const subtitleFont = `italic ${renderSubtitleFontSize}px Arial, sans-serif`;
    ctx.font = subtitleFont;
    ctx.textAlign = 'center';
    ctx.fillText(`(${product.subtitle})`, canvasWidth / 2, currentY + renderSubtitleFontSize * 0.8);
    ctx.textAlign = 'left';
    currentY += renderSubtitleFontSize + spacingAfterSubtitle * scale; // subtitle height + spacing
  }

  const renderFieldFontSize = Math.floor(fieldFontSizeBase * scale);
  const renderFieldLineHeight = renderFieldFontSize * 1.4;

  // Variant groups (Size, Colour, …)
  if (product.variantGroups?.length) {
    ctx.font = `${renderFieldFontSize}px Arial, sans-serif`;
    const variantGroups = product.variantGroups;
    let maxVariantLabelWidth = 0;
    variantGroups.forEach((vg) => {
      maxVariantLabelWidth = Math.max(
        maxVariantLabelWidth,
        ctx.measureText(vg.name).width
      );
    });
    const vFieldsLeftPadding = 24 * scale;
    const vColonX = vFieldsLeftPadding + maxVariantLabelWidth + 6 * scale;
    const vValueX = vColonX + 16 * scale;

    variantGroups.forEach((vg) => {
      ctx.fillText(vg.name, vFieldsLeftPadding, currentY + renderFieldFontSize * 0.8);
      ctx.fillText(':', vColonX, currentY + renderFieldFontSize * 0.8);
      ctx.fillText(
        formatVariantOptions(vg.options),
        vValueX,
        currentY + renderFieldFontSize * 0.8
      );
      currentY += renderFieldLineHeight + 2 * scale;
    });
  }

  currentY += spacingBeforeFields * scale;

  // Fields - Match HTML format with aligned colons
  const fieldFont = `${renderFieldFontSize}px Arial, sans-serif`;

  ctx.font = fieldFont;
  ctx.textAlign = 'left';

  // Measure the longest label of ENABLED and NON-EMPTY fields to align colons
  const activeFields = allEnabledFields.filter(f => !!product[f.key]);
  let maxLabelWidth = 0;
  activeFields.forEach(field => {
    const metrics = ctx.measureText(field.label);
    maxLabelWidth = Math.max(maxLabelWidth, metrics.width);
  });

  const fieldsLeftPadding = 24 * scale; // Increased left padding for fields
  const colonX = fieldsLeftPadding + maxLabelWidth + 6 * scale; // Colon position aligned
  const valueX = colonX + 16 * scale; // Space after colon

  const maxValueWidth = canvasWidth - valueX - 24 * scale;

  activeFields.forEach(field => {
    // Check if field should be visible
    const visibilityKey = `${field.key}Visible`;
    const isVisible = product[visibilityKey] !== false; // Default to visible

    if (!isVisible) return;

    ctx.fillText(field.label, fieldsLeftPadding, currentY + renderFieldFontSize * 0.8);
    ctx.fillText(':', colonX, currentY + renderFieldFontSize * 0.8);

    const unitKey = `${field.key}Unit`;
    const val = product[field.key];
    const unit = product[unitKey];
    const displayText = unit && unit !== 'None' ? `${val} ${unit}` : val;

    // Check if value fits on the same line
    const valueMetrics = ctx.measureText(displayText);
    if (valueMetrics.width > maxValueWidth) {
      // Value is too long, put it on the next line
      ctx.fillText(displayText, fieldsLeftPadding, currentY + renderFieldLineHeight + renderFieldFontSize * 0.8);
      currentY += renderFieldLineHeight * 2 + 2 * scale;
    } else {
      // Value fits on same line
      ctx.fillText(displayText, valueX, currentY + renderFieldFontSize * 0.8);
      currentY += renderFieldLineHeight + 2 * scale;
    }
  });

  currentY += spacingAfterFields * scale;

  // ===== PRICE BAR =====
  if (hasCanvasRenderablePrice(product)) {
    // Fill entire remaining canvas with price bar background to avoid gaps
    const remainingHeight = canvasHeight - currentY;
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, currentY, canvasWidth, remainingHeight); // Fill to bottom of canvas

    const priceFontSize = Math.floor(18 * scale);
    const priceFont = `${priceFontSize}px Arial, sans-serif`;
    ctx.font = priceFont;
    ctx.fillStyle = options.fontColor;

    // Center price text vertically in the remaining space
    const priceTextY = currentY + remainingHeight / 2; // Exact center without offset
    const currencySymbol = options.currencySymbol || '₹';
    drawCanvasCataloguePriceLine(ctx, canvasWidth / 2, priceTextY, product, currencySymbol, options.fontColor, scale);

    currentY += remainingHeight;
  }

  // ===== WATERMARK =====
  if (watermarkConfig?.enabled && watermarkConfig.text) {
    const watermarkFontSize = Math.floor(10 * scale);
    const watermarkFont = `${watermarkFontSize}px Arial, sans-serif`;
    ctx.font = watermarkFont;

    const isLightBg = isLightColor(imageBg);
    ctx.fillStyle = isLightBg ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.4)';

    // Position calculation for image section only
    const imageWrapWidth = canvasWidth;
    const imageWrapHeight = baseWidth / cropAspectRatio * scale;
    const imageWrapOffsetTop = 0;
    const padding = 10 * scale;

    let watermarkX = canvasWidth / 2;
    let watermarkY = imageWrapOffsetTop + imageWrapHeight - padding;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Normalize position value (handle hyphens, underscores, and camelCase)
    let normalizedPosition = (watermarkConfig.position || 'bottom-center').toString();

    // Strip JSON quotes if present
    if (normalizedPosition.startsWith('"') && normalizedPosition.endsWith('"')) {
      normalizedPosition = normalizedPosition.substring(1, normalizedPosition.length - 1);
    }

    normalizedPosition = normalizedPosition
      .replace(/_/g, '-')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();

    console.log(`[Watermark Position] Config: ${watermarkConfig.position}, Normalized: ${normalizedPosition}`);

    switch (normalizedPosition) {
      case 'top-left':
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        watermarkX = padding;
        watermarkY = imageWrapOffsetTop + padding;
        break;
      case 'top-center':
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        watermarkX = imageWrapWidth / 2;
        watermarkY = imageWrapOffsetTop + padding;
        break;
      case 'top-right':
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        watermarkX = imageWrapWidth - padding;
        watermarkY = imageWrapOffsetTop + padding;
        break;
      case 'middle-left':
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        watermarkX = padding;
        watermarkY = imageWrapOffsetTop + imageWrapHeight / 2;
        break;
      case 'middle-center':
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        watermarkX = imageWrapWidth / 2;
        watermarkY = imageWrapOffsetTop + imageWrapHeight / 2;
        break;
      case 'middle-right':
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        watermarkX = imageWrapWidth - padding;
        watermarkY = imageWrapOffsetTop + imageWrapHeight / 2;
        break;
      case 'bottom-left':
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        watermarkX = padding;
        watermarkY = imageWrapOffsetTop + imageWrapHeight - padding;
        break;
      case 'bottom-right':
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        watermarkX = imageWrapWidth - padding;
        watermarkY = imageWrapOffsetTop + imageWrapHeight - padding;
        break;
      case 'bottom-center':
      default:
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        watermarkX = imageWrapWidth / 2;
        watermarkY = imageWrapOffsetTop + imageWrapHeight - padding;
        break;
    }

    ctx.fillText(watermarkConfig.text, watermarkX, watermarkY);
  }

  console.log(`[renderProductToCanvas] Canvas rendered successfully. Size: ${canvas.width}x${canvas.height}`);
  return canvas;
}

/**
 * Convert canvas to blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/png');
  });
}

/**
 * Convert canvas to base64 PNG
 */
export function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * Render simple card element to canvas
 * For quick downloads from CatalogueView, Wholesale, Resell
 */
export async function renderElementToCanvas(
  element: HTMLElement,
  options: { scale: number; backgroundColor: string; width: number; height: number }
): Promise<HTMLCanvasElement> {
  const scale = options.scale || 3;
  const width = options.width * scale;
  const height = options.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // For simple card elements, we'll measure and render the visible image
  const img = element.querySelector('img') as HTMLImageElement;
  if (img && img.src) {
    try {
      const loadedImg = await loadImage(img.src);
      // Draw image centered
      const imgAspectRatio = loadedImg.width / loadedImg.height;
      const containerAspectRatio = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let drawX = 0;
      let drawY = 0;

      if (imgAspectRatio > containerAspectRatio) {
        // Image is wider
        drawHeight = width / imgAspectRatio;
        drawY = (height - drawHeight) / 2;
      } else {
        // Image is taller
        drawWidth = height * imgAspectRatio;
        drawX = (width - drawWidth) / 2;
      }

      ctx.drawImage(loadedImg, drawX, drawY, drawWidth, drawHeight);
    } catch (err) {
      console.warn('Failed to load image for card:', err);
    }
  }

  return canvas;
}
