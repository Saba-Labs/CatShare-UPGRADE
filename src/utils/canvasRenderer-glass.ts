/**
 * Glass Theme Canvas Rendering Utility
 * Renders products with glass morphism aesthetic
 * OPTIMIZED: Matches reference image with perfect translucency
 */

import { loadImage } from './canvasRenderer';
import { isLightColor, lightenColor } from './canvasRenderer';
import { drawCanvasCataloguePriceLine, hasCanvasRenderablePrice } from './canvasProductPriceDraw';
import { getAllFields } from '../config/fieldConfig';
import { formatVariantOptions } from './productVariants';

export interface ProductData {
  name: string;
  subtitle?: string;
  image?: string;
  price?: string | number;
  offerPrice?: string | number;
  priceUnit?: string;
  badge?: string;
  cropAspectRatio?: number;
  variantGroups?: Array<{ id: string; name: string; options: string[] }>;
  [key: string]: any;
}

export interface ProductRenderOptions {
  width: number;
  scale: number;
  bgColor: string;
  imageBgColor: string;
  fontColor: string;
  backgroundColor: string;
  currencySymbol?: string;
}

function drawStadiumShape(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const radius = Math.min(width, height) / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * Box blur implementation for backdrop blur effect
 */
function applyBoxBlur(
  imageData: ImageData,
  width: number,
  height: number,
  radius: number
): ImageData {
  const pixels = imageData.data;
  const output = new ImageData(width, height);
  const outPixels = output.data;

  // Horizontal pass
  const tempData = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.min(Math.max(x + dx, 0), width - 1);
        const idx = (y * width + nx) * 4;
        r += pixels[idx];
        g += pixels[idx + 1];
        b += pixels[idx + 2];
        a += pixels[idx + 3];
        count++;
      }
      
      const idx = (y * width + x) * 4;
      tempData[idx] = r / count;
      tempData[idx + 1] = g / count;
      tempData[idx + 2] = b / count;
      tempData[idx + 3] = a / count;
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.min(Math.max(y + dy, 0), height - 1);
        const idx = (ny * width + x) * 4;
        r += tempData[idx];
        g += tempData[idx + 1];
        b += tempData[idx + 2];
        a += tempData[idx + 3];
        count++;
      }
      
      const idx = (y * width + x) * 4;
      outPixels[idx] = r / count;
      outPixels[idx + 1] = g / count;
      outPixels[idx + 2] = b / count;
      outPixels[idx + 3] = a / count;
    }
  }

  return output;
}

export async function renderProductToCanvasGlass(
  product: ProductData,
  options: ProductRenderOptions,
  watermarkConfig?: {
    enabled: boolean;
    text: string;
    position: string;
  }
): Promise<HTMLCanvasElement> {
  console.log(`[renderProductToCanvasGlass] Starting render for product:`, product.name);
  console.log(`[renderProductToCanvasGlass] Options:`, options);

  const scale = options.scale || 3;
  const baseWidth = options.width;
  const cropAspectRatio = product.cropAspectRatio || 1;

  // Get all enabled fields
  const allEnabledFields = getAllFields().filter(f => f.enabled && f.key.startsWith('field'));

  // Calculate required height
  const imageSectionBaseHeight = baseWidth / cropAspectRatio;
  const detailsPaddingBase = 8;
  const titleFontSizeBase = 27;
  const subtitleFontSizeBase = 17;
  const fieldFontSizeBase = 16;
  const fieldLineHeightBase = fieldFontSizeBase * 1.4;
  const priceBarHeightBase = product.price ? 40 : 0;

  const spacingAfterTitle = 12;
  const spacingAfterSubtitle = 10;
  const spacingBeforeFields = 12;
  const spacingAfterFields = 12;

  let detailsHeight = detailsPaddingBase;
  detailsHeight += 10;
  detailsHeight += titleFontSizeBase + spacingAfterTitle;

  if (product.subtitle) {
    detailsHeight += subtitleFontSizeBase + spacingAfterSubtitle;
  }

  const variantLineCount = product.variantGroups?.length ?? 0;
  if (variantLineCount > 0) {
    detailsHeight += variantLineCount * (fieldLineHeightBase + 2);
  }

  detailsHeight += spacingBeforeFields;

  allEnabledFields.forEach(field => {
    const visibilityKey = `${field.key}Visible`;
    const isVisible = product[visibilityKey] !== false;

    if (product[field.key] && isVisible) {
      detailsHeight += fieldLineHeightBase + 2;
    }
  });

  detailsHeight += spacingAfterFields;
  detailsHeight += priceBarHeightBase;
  detailsHeight += detailsPaddingBase;

  const baseHeight = imageSectionBaseHeight + detailsHeight;
  const cardMarginSides = 16;
  const cardMarginBottom = 30;

  const canvasWidth = baseWidth * scale;
  const canvasHeight = (baseHeight + cardMarginBottom) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background with gradient
  const gradientBg = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradientBg.addColorStop(0, options.bgColor);
  gradientBg.addColorStop(0.5, lightenColor(options.bgColor, -20));
  gradientBg.addColorStop(1, options.bgColor);
  ctx.fillStyle = gradientBg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  let currentY = 0;

  // ===== IMAGE SECTION =====
  const imageBg = options.imageBgColor;
  const imageHeight = imageSectionBaseHeight * scale;

  ctx.fillStyle = imageBg;
  ctx.fillRect(0, currentY, canvasWidth, imageHeight);

  // Load and draw image
  try {
    if (!product.image) {
      throw new Error('Product image is not set');
    }

    console.log(`Loading image: ${product.image}`);
    const img = await loadImage(product.image);
    console.log(`Image loaded successfully. Dimensions: ${img.width}x${img.height}`);

    const imgScaledWidth = canvasWidth;
    const imgScaledHeight = (img.height / img.width) * canvasWidth;

    if (imgScaledHeight >= imageHeight) {
      ctx.drawImage(img, 0, currentY, canvasWidth, imageHeight);
    } else {
      const offsetY = currentY + (imageHeight - imgScaledHeight) / 2;
      ctx.drawImage(img, 0, offsetY, canvasWidth, imgScaledHeight);
    }
    console.log(`Image drawn to canvas`);
  } catch (err) {
    console.error('Failed to load image:', err);
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, currentY, canvasWidth, imageHeight);
    ctx.fillStyle = '#999999';
    ctx.font = `${Math.floor(20 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image not found', canvasWidth / 2, currentY + imageHeight / 2);
  }

  // Draw badge
  if (product.badge) {
    const isWhiteBg = isLightColor(imageBg);
    // Match UI component logic: white text on white bg, otherwise use font color
    const badgeTextColor = isWhiteBg ? '#ffffff' : options.fontColor;

    const badgeText_str = product.badge.toUpperCase();
    const badgeFontSize = Math.floor(13 * scale);
    const badgeFont = `600 ${badgeFontSize}px Arial, sans-serif`;

    ctx.font = badgeFont;
    const badgeMetrics = ctx.measureText(badgeText_str);

    const badgePaddingH = 14 * scale;
    const badgePaddingV = 8 * scale;
    const badgeWidth = badgeMetrics.width + badgePaddingH * 2;
    const badgeHeight = badgeFontSize + badgePaddingV * 2;

    const badgeX = canvasWidth - badgeWidth - 12 * scale;
    const badgeY = currentY + 12 * scale;

    // Badge backdrop blur using temporary canvas
    const badgeTempCanvas = document.createElement('canvas');
    badgeTempCanvas.width = badgeWidth;
    badgeTempCanvas.height = badgeHeight;
    const badgeTempCtx = badgeTempCanvas.getContext('2d');
    
    if (badgeTempCtx) {
      badgeTempCtx.drawImage(canvas, badgeX, badgeY, badgeWidth, badgeHeight, 0, 0, badgeWidth, badgeHeight);
      const badgeBackdrop = badgeTempCtx.getImageData(0, 0, badgeWidth, badgeHeight);
      const blurredBadgeBackdrop = applyBoxBlur(badgeBackdrop, badgeWidth, badgeHeight, 8);
      badgeTempCtx.putImageData(blurredBadgeBackdrop, 0, 0);
      ctx.drawImage(badgeTempCanvas, 0, 0, badgeWidth, badgeHeight, badgeX, badgeY, badgeWidth, badgeHeight);
    }

    // Badge glass overlay - enhanced for better visibility
    ctx.save();
    ctx.globalAlpha = 0.3;
    const badgeGlassGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeHeight);
    badgeGlassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    badgeGlassGradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
    ctx.fillStyle = badgeGlassGradient;
    drawStadiumShape(ctx, badgeX, badgeY, badgeWidth, badgeHeight);
    ctx.fill();
    ctx.restore();

    // Badge border - more visible
    ctx.strokeStyle = isWhiteBg ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.8 * scale;
    drawStadiumShape(ctx, badgeX, badgeY, badgeWidth, badgeHeight);
    ctx.stroke();

    // Badge text
    ctx.fillStyle = badgeTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const badgeTextOffsetY = 1 * scale;
    ctx.fillText(badgeText_str, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + badgeTextOffsetY);
  }

  currentY += imageHeight;

  // ===== GLASS CARD DETAILS SECTION =====
  const cardMargin = cardMarginSides * scale;
  const cardX = cardMargin;
  const cardY = currentY - 20 * scale;
  const cardWidth = canvasWidth - 2 * cardMargin;
  const cardHeight = detailsHeight * scale + 28 * scale;
  const cardPadding = 16 * scale;

  // Create backdrop blur effect using temporary canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cardWidth;
  tempCanvas.height = cardHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (tempCtx) {
    tempCtx.drawImage(canvas, cardX, cardY, cardWidth, cardHeight, 0, 0, cardWidth, cardHeight);
    const backdropImageData = tempCtx.getImageData(0, 0, cardWidth, cardHeight);
    const blurRadius = 40; // Optimized: reduced from 80 for better performance (500-600ms instead of 800ms+)
    const blurredBackdrop = applyBoxBlur(backdropImageData, cardWidth, cardHeight, blurRadius);
    tempCtx.putImageData(blurredBackdrop, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, cardWidth, cardHeight, cardX, cardY, cardWidth, cardHeight);
  }

  // PERFECT GLASS MORPHISM: Frosted glass with visible gradient through
  ctx.save();
  ctx.globalAlpha = 0.40; // Increased opacity to compensate for reduced blur radius
  const baseGlassGradient = ctx.createLinearGradient(0, cardY, 0, cardY + cardHeight);
  baseGlassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
  baseGlassGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.42)');
  baseGlassGradient.addColorStop(1, 'rgba(255, 255, 255, 0.45)');
  ctx.fillStyle = baseGlassGradient;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16 * scale);
  ctx.fill();
  ctx.restore();

  // Glass highlight for depth
  ctx.save();
  ctx.globalAlpha = 0.20;
  const highlightGradient = ctx.createLinearGradient(0, cardY, 0, cardY + cardHeight * 0.4);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlightGradient;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16 * scale);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.70)';
  ctx.lineWidth = 1.8 * scale;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16 * scale);
  ctx.stroke();

  // Inner shadow
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 1 * scale;
  drawRoundedRect(ctx, cardX + 1.5 * scale, cardY + 1.5 * scale, cardWidth - 3 * scale, cardHeight - 3 * scale, 14 * scale);
  ctx.stroke();

  // Draw content
  currentY = cardY + 25 * scale;

  const textColor = options.fontColor || '#000000';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';

  // Title
  const renderTitleFontSize = Math.floor(titleFontSizeBase * scale);
  const titleFont = `600 ${renderTitleFontSize}px Arial, sans-serif`;
  ctx.font = titleFont;
  ctx.fillText(product.name, canvasWidth / 2, currentY + renderTitleFontSize * 0.8);

  currentY += renderTitleFontSize + spacingAfterTitle * scale;

  // Subtitle
  if (product.subtitle) {
    const renderSubtitleFontSize = Math.floor(subtitleFontSizeBase * scale);
    const subtitleFont = `italic ${renderSubtitleFontSize}px Arial, sans-serif`;
    ctx.font = subtitleFont;
    ctx.fillText(`(${product.subtitle})`, canvasWidth / 2, currentY + renderSubtitleFontSize * 0.8);
    currentY += renderSubtitleFontSize + spacingAfterSubtitle * scale;
  }

  const renderFieldFontSize = Math.floor(fieldFontSizeBase * scale);
  const renderFieldLineHeight = renderFieldFontSize * 1.4;

  if (product.variantGroups?.length) {
    ctx.font = `500 ${renderFieldFontSize}px Arial, sans-serif`;
    ctx.fillStyle = textColor;
    const variantGroups = product.variantGroups;
    let maxVariantLabelWidth = 0;
    variantGroups.forEach((vg) => {
      maxVariantLabelWidth = Math.max(maxVariantLabelWidth, ctx.measureText(vg.name).width);
    });
    const fieldPadding = 20 * scale;
    const leftX = cardX + cardPadding + fieldPadding;
    const vColonX = leftX + maxVariantLabelWidth + 6 * scale;
    const vValueX = vColonX + 16 * scale;
    variantGroups.forEach((vg) => {
      ctx.fillText(vg.name, leftX, currentY + renderFieldFontSize * 0.8);
      ctx.fillText(':', vColonX, currentY + renderFieldFontSize * 0.8);
      ctx.fillText(formatVariantOptions(vg.options), vValueX, currentY + renderFieldFontSize * 0.8);
      currentY += renderFieldLineHeight + 2 * scale;
    });
  }

  currentY += spacingBeforeFields * scale;

  // Fields
  const fieldFont = `500 ${renderFieldFontSize}px Arial, sans-serif`;
  const fieldPadding = 20 * scale;

  ctx.font = fieldFont;
  ctx.fillStyle = textColor;

  const activeFields = allEnabledFields.filter(f => !!product[f.key]);

  // Measure the longest label to align colons properly
  let maxLabelWidth = 0;
  activeFields.forEach(field => {
    const visibilityKey = `${field.key}Visible`;
    const isVisible = product[visibilityKey] !== false;
    if (isVisible) {
      const metrics = ctx.measureText(field.label);
      maxLabelWidth = Math.max(maxLabelWidth, metrics.width);
    }
  });

  const leftX = cardX + cardPadding + fieldPadding;
  const colonX = leftX + maxLabelWidth + 6 * scale;
  const valueX = colonX + 10 * scale;
  const maxValueWidth = cardWidth - (valueX - cardX) - fieldPadding - 10 * scale;

  activeFields.forEach(field => {
    const visibilityKey = `${field.key}Visible`;
    const isVisible = product[visibilityKey] !== false;

    if (!isVisible) return;

    const unitKey = `${field.key}Unit`;
    const val = product[field.key];
    const unit = product[unitKey];
    const displayValue = unit && unit !== 'None' ? `${val} ${unit}` : `${val}`;

    const fieldLineY = currentY + renderFieldFontSize * 0.8;

    ctx.textAlign = 'left';
    ctx.fillText(field.label, leftX, fieldLineY);
    ctx.fillText(':', colonX, fieldLineY);

    // Check if value fits on the same line
    const valueMetrics = ctx.measureText(displayValue);
    if (valueMetrics.width > maxValueWidth) {
      // Value is too long, put it on the next line
      ctx.fillText(displayValue, leftX, fieldLineY + renderFieldLineHeight);
      currentY += renderFieldLineHeight * 2 + 2 * scale;
    } else {
      // Value fits on same line
      ctx.fillText(displayValue, valueX, fieldLineY);
      currentY += renderFieldLineHeight + 2 * scale;
    }
  });

  currentY += spacingAfterFields * scale;

  // ===== PRICE BUTTON =====
  if (hasCanvasRenderablePrice(product)) {
    const priceBgColor = options.bgColor;
    const priceBarHeight = priceBarHeightBase * scale;
    const priceBarY = currentY + 8 * scale;
    const priceButtonWidth = cardWidth - 2 * cardPadding;
    const priceButtonX = cardX + cardPadding;
    const priceButtonRadius = 10 * scale;

    ctx.fillStyle = priceBgColor;
    drawRoundedRect(ctx, priceButtonX, priceBarY, priceButtonWidth, priceBarHeight, priceButtonRadius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1 * scale;
    drawRoundedRect(ctx, priceButtonX, priceBarY, priceButtonWidth, priceBarHeight, priceButtonRadius);
    ctx.stroke();

    const priceFontSize = Math.floor(20 * scale);
    const priceFont = `600 ${priceFontSize}px Arial, sans-serif`;
    ctx.font = priceFont;
    ctx.fillStyle = options.fontColor === 'white' ? '#fff' : '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const currencySymbol = options.currencySymbol || '₹';
    const fontCol = options.fontColor === 'white' ? '#fff' : '#000';
    drawCanvasCataloguePriceLine(
      ctx,
      priceButtonX + priceButtonWidth / 2,
      priceBarY + priceBarHeight / 2,
      product,
      currencySymbol,
      fontCol,
      scale
    );

    currentY += priceBarHeight + 8 * scale;
  }

  // ===== WATERMARK =====
  if (watermarkConfig?.enabled && watermarkConfig.text) {
    const watermarkFontSize = Math.floor(10 * scale);
    const watermarkFont = `${watermarkFontSize}px Arial, sans-serif`;
    ctx.font = watermarkFont;

    let normalizedPosition = (watermarkConfig.position || 'bottom-center').toString();

    if (normalizedPosition.startsWith('"') && normalizedPosition.endsWith('"')) {
      normalizedPosition = normalizedPosition.substring(1, normalizedPosition.length - 1);
    }

    normalizedPosition = normalizedPosition
      .replace(/_/g, '-')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();

    const isBottom = normalizedPosition.startsWith('bottom');
    const targetBg = isBottom ? options.bgColor : imageBg;
    const isLightBg = isLightColor(targetBg);
    ctx.fillStyle = isLightBg ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.4)';

    const imageWrapWidth = canvasWidth;
    const imageWrapHeight = baseWidth / cropAspectRatio * scale;
    const imageWrapOffsetTop = 0;
    const padding = 5 * scale;

    let watermarkX = canvasWidth / 2;
    let watermarkY = imageWrapOffsetTop + imageWrapHeight - padding;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

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
      case 'bottom-left':
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        watermarkX = padding;
        watermarkY = canvasHeight - padding;
        break;
      case 'bottom-right':
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        watermarkX = imageWrapWidth - padding;
        watermarkY = canvasHeight - padding;
        break;
      case 'bottom-center':
      default:
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        watermarkX = imageWrapWidth / 2;
        watermarkY = canvasHeight - padding;
        break;
    }

    ctx.fillText(watermarkConfig.text, watermarkX, watermarkY);
  }

  console.log(`[renderProductToCanvasGlass] Canvas rendered successfully. Size: ${canvas.width}x${canvas.height}`);
  return canvas;
}
