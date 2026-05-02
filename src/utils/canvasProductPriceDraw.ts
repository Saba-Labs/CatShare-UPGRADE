/**
 * Draw catalogue price (and optional offer) on product share canvases.
 * List price is in `product.price`; sale price in `product.offerPrice` when lower than list.
 */

export type CanvasPriceProduct = {
  price?: string | number;
  offerPrice?: string | number;
  priceUnit?: string;
};

function parseNum(v: unknown): number {
  const n = parseFloat(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function hasCanvasRenderablePrice(product: CanvasPriceProduct): boolean {
  return parseNum(product.price) > 0 || parseNum(product.offerPrice) > 0;
}

/**
 * Draw centered "Price : …" line; offer first, list struck through, unit once at end.
 */
export function drawCanvasCataloguePriceLine(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  product: CanvasPriceProduct,
  currencySymbol: string,
  fontColor: string,
  scale: number
): void {
  const sym = currencySymbol || '₹';
  const list = parseNum(product.price);
  const offer = parseNum(product.offerPrice);
  const sale = list > 0 && offer > 0 && offer < list;
  const unit =
    product.priceUnit && String(product.priceUnit).trim() !== '' && product.priceUnit !== 'None'
      ? ` ${product.priceUnit}`
      : '';

  const label = 'Price   :   ';
  ctx.fillStyle = fontColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  type Seg = { t: string; strike?: boolean };
  const segments: Seg[] = [{ t: label }];
  if (sale) {
    segments.push({ t: `${sym}${offer}` });
    segments.push({ t: ' ' });
    segments.push({ t: `${sym}${list}`, strike: true });
    segments.push({ t: unit });
  } else {
    const show = list > 0 ? list : offer;
    segments.push({ t: `${sym}${show}${unit}` });
  }

  const baseFont = ctx.font;
  const strikeFont = baseFont.replace(
    /(\d+(?:\.\d+)?)(px|pt)/,
    (_, n: string, u: string) => `${Math.max(8, Math.round(parseFloat(n) * 0.75))}${u}`
  );

  let totalW = 0;
  segments.forEach((s) => {
    ctx.font = s.strike ? strikeFont : baseFont;
    totalW += ctx.measureText(s.t).width;
  });

  let x = centerX - totalW / 2;
  segments.forEach((s) => {
    ctx.font = s.strike ? strikeFont : baseFont;
    const w = ctx.measureText(s.t).width;
    ctx.fillStyle = fontColor;
    if (s.strike && s.t.length > 0) {
      ctx.globalAlpha = 0.75;
      ctx.fillText(s.t, x, centerY);
      const strikeY = centerY + Math.max(2, 3 * scale * 0.75);
      ctx.strokeStyle = fontColor;
      ctx.lineWidth = Math.max(1, 1.2 * scale * 0.75);
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(x, strikeY);
      ctx.lineTo(x + w, strikeY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1;
      ctx.fillText(s.t, x, centerY);
    }
    x += w;
  });
  ctx.font = baseFont;
}
