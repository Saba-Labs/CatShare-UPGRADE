import { jsPDF } from "jspdf";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileSharer } from "@byteowls/capacitor-filesharer";
import type { BusinessProfile } from "../config/businessProfile";
import { EMPTY_BUSINESS_PROFILE } from "../config/businessProfile";
import { fetchUrlAsDataUrl } from "./fetchImageCrossPlatform";
import { getAllFields, isFieldVisibleOnSurface } from "../config/fieldConfig";

interface ProductWithImage {
  id: string | number;
  name: string;
  subtitle?: string;
  image?: string; // base64 image data
  price?: string | number;
  /** Sale price when lower than `price` */
  offerPrice?: string | number;
  priceUnit?: string;
  bgColor?: string;
  fontColor?: string;
  field1?: string;
  field2?: string;
  field3?: string;
  field4?: string;
  field5?: string;
  field6?: string;
  field7?: string;
  field8?: string;
  field9?: string;
  field10?: string;
  field1Unit?: string;
  field2Unit?: string;
  field3Unit?: string;
  field4Unit?: string;
  field5Unit?: string;
  field6Unit?: string;
  field7Unit?: string;
  field8Unit?: string;
  field9Unit?: string;
  field10Unit?: string;
  [key: string]: any;
}

interface PDFGenerationOptions {
  products: ProductWithImage[];
  catalogueName?: string;
  /** Account company / seller details for PDF header (replaces catalogue name + date). */
  businessProfile?: BusinessProfile;
  currencySymbol?: string;
  fieldLabels?: { [key: string]: string };
}

  /** Google Play listing for CatShare (PDF footer link). */
const CATSHARE_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.catshare.official";

function sanitizePdfFilenameSegment(raw: string): string {
  const s = raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s.slice(0, 48) || "products";
}

export function pdfFilenamePrefix(
  businessProfile: BusinessProfile | undefined,
  catalogueFallback: string
): string {
  const name = businessProfile?.businessName?.trim();
  if (name) return sanitizePdfFilenameSegment(name);
  return sanitizePdfFilenameSegment(catalogueFallback);
}

/**
 * Get dimensions of an image from base64 data
 */
function getImageDimensions(
  base64Image: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    img.src = base64Image;
  });
}

type PdfLogoAsset = {
  dataUrl: string;
  format: "PNG" | "JPEG" | "WEBP";
  width: number;
  height: number;
};

function dataUrlToPdfImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const m = dataUrl.match(/^data:([^;]+);/i);
  const mime = (m?.[1] || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPEG";
  if (mime.includes("webp")) return "WEBP";
  return "PNG";
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** GIF frames → PNG (jsPDF has no GIF). */
async function rasterizeToPngDataUrl(dataUrl: string): Promise<{ dataUrl: string; format: "PNG" } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("load"));
      el.src = dataUrl;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), format: "PNG" };
  } catch {
    return null;
  }
}

/**
 * Normalize product image for jsPDF: correct PNG/JPEG/WEBP flag, and stable data URLs.
 * - data:/blob: → no network (mobile keeps fast local path).
 * - https: → fetchUrlAsDataUrl (native uses Capacitor HTTP; web uses fetch + CORS).
 */
async function resolveProductImageForPdf(
  src: string | undefined
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  const s = typeof src === "string" ? src.trim() : "";
  if (!s) return null;

  if (s.startsWith("data:")) {
    if (/data:image\/svg/i.test(s)) {
      console.warn("PDF: skipping SVG product image");
      return null;
    }
    if (/data:image\/gif/i.test(s)) {
      const r = await rasterizeToPngDataUrl(s);
      return r;
    }
    return { dataUrl: s, format: dataUrlToPdfImageFormat(s) };
  }

  if (s.startsWith("blob:")) {
    try {
      const res = await fetch(s);
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return null;
      const dataUrl = await readBlobAsDataUrl(blob);
      if (/data:image\/svg/i.test(dataUrl)) return null;
      if (/data:image\/gif/i.test(dataUrl)) {
        return rasterizeToPngDataUrl(dataUrl);
      }
      return { dataUrl, format: dataUrlToPdfImageFormat(dataUrl) };
    } catch {
      return null;
    }
  }

  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const dataUrl = await fetchUrlAsDataUrl(s);
      if (!dataUrl.startsWith("data:image/")) return null;
      if (/data:image\/svg/i.test(dataUrl)) return null;
      if (/data:image\/gif/i.test(dataUrl)) {
        return rasterizeToPngDataUrl(dataUrl);
      }
      return { dataUrl, format: dataUrlToPdfImageFormat(dataUrl) };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Load company logo for PDF. Uses fetchUrlAsDataUrl so native apps bypass WebView CORS (R2, etc.).
 */
async function loadPdfLogo(url: string | undefined): Promise<PdfLogoAsset | null> {
  const u = url?.trim();
  if (!u || (!u.startsWith("http://") && !u.startsWith("https://"))) return null;
  try {
    const dataUrl = await fetchUrlAsDataUrl(u);
    if (!dataUrl.startsWith("data:image/")) {
      console.warn("PDF: logo URL did not resolve to an image");
      return null;
    }
    if (/data:image\/svg/i.test(dataUrl)) {
      console.warn("PDF: SVG logos are not supported in PDF export");
      return null;
    }
    const dims = await getImageDimensions(dataUrl);
    const format = dataUrlToPdfImageFormat(dataUrl);
    return { dataUrl, format, width: dims.width, height: dims.height };
  } catch (e) {
    console.warn("PDF: could not load company logo", e);
    return null;
  }
}

/**
 * Render text (especially currency symbols like ₹) to a high-resolution base64 image
 */
function renderTextToImage(
  text: string,
  fontSize: number = 40,
  color: string = "#1d4ed8"
): { dataUrl: string; width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: "", width: 0, height: 0 };

  const font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);

  const scale = 2;
  canvas.width = (metrics.width + 20) * scale;
  canvas.height = fontSize * 1.5 * scale;

  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 10, (fontSize * 1.5) / 2);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: metrics.width + 20,
    height: fontSize * 1.5,
  };
}

// --- Helper Functions for Glass Theme ---

const drawGlassBackground = (
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
  accentBlue: number[]
) => {
  pdf.setFillColor(240, 249, 255); // Sky-50
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // @ts-ignore
  if (pdf.GState) {
    // @ts-ignore
    pdf.setGState(new pdf.GState({ opacity: 0.15 }));
  }

  pdf.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  pdf.circle(pageWidth, 0, 80, "F");

  pdf.setFillColor(147, 197, 253); // Blue-300
  pdf.circle(0, pageHeight / 2, 60, "F");

  pdf.setFillColor(191, 219, 254); // Blue-200
  pdf.circle(pageWidth, pageHeight, 100, "F");

  // @ts-ignore
  if (pdf.GState) {
    // @ts-ignore
    pdf.setGState(new pdf.GState({ opacity: 1.0 }));
  }
};

/** Minimal header: white strip, company text left, logo right (no nested boxes). */
const addCompanyHeader = (
  pdf: jsPDF,
  profile: BusinessProfile,
  pageWidth: number,
  margin: number,
  _contentWidth: number,
  _accentBlue: number[],
  textDark: number[],
  textMuted: number[],
  logo: PdfLogoAsset | null
): number => {
  const line = 3.9;
  const hasLogo = !!logo;
  const logoBox = 34;
  const logoGap = 10;
  const textColW = pageWidth - 2 * margin - (hasLogo ? logoBox + logoGap : 0);
  const textX = margin;
  const title = profile.businessName?.trim() || "Product catalogue";

  const rawAbout = profile.about?.trim();
  const rawDesc = profile.description?.trim();
  let tagline = "";
  if (rawAbout) tagline = rawAbout.length > 100 ? `${rawAbout.slice(0, 97)}…` : rawAbout;
  else if (rawDesc) tagline = rawDesc.length > 100 ? `${rawDesc.slice(0, 97)}…` : rawDesc;

  const address = profile.address?.trim() || "";
  const addrLines = address ? pdf.splitTextToSize(address, textColW) : [];
  const tagLines = tagline ? pdf.splitTextToSize(tagline, textColW) : [];

  const parts: string[] = [];
  if (profile.phone?.trim()) parts.push(profile.phone.trim());
  if (profile.email?.trim()) parts.push(profile.email.trim());
  if (profile.website?.trim()) {
    parts.push(profile.website.trim().replace(/^https?:\/\//i, ""));
  }
  const contactLine = parts.join("    ·    ");
  const contactLines = contactLine
    ? pdf.splitTextToSize(contactLine, textColW)
    : [];

  let ySim = 10 + 8;
  ySim += tagLines.length * 4;
  if (tagLines.length) ySim += 3;
  if (addrLines.length) ySim += addrLines.length * line + 3;
  else ySim += 1;
  if (contactLines.length) ySim += contactLines.length * line;
  ySim += 10;

  const logoBottom = hasLogo ? 8 + logoBox + 6 : 0;
  const headerHeight = Math.max(ySim, logoBottom);

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, headerHeight, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(0, headerHeight, pageWidth, headerHeight);

  let y = 10;
  pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(15);
  pdf.text(title, textX, y);
  y += 8;

  if (tagLines.length) {
    pdf.setFont(undefined, "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    for (const ln of tagLines) {
      pdf.text(ln, textX, y);
      y += 4;
    }
    pdf.setFont(undefined, "normal");
    y += 3;
  }

  if (addrLines.length) {
    pdf.setFontSize(8);
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    for (const ln of addrLines) {
      pdf.text(ln, textX, y);
      y += line;
    }
    y += 3;
  }

  if (contactLines.length) {
    pdf.setFont(undefined, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    for (const ln of contactLines) {
      pdf.text(ln, textX, y);
      y += line;
    }
  }

  if (hasLogo) {
    const lx = pageWidth - margin - logoBox;
    const ly = 8;
    pdf.setDrawColor(235, 238, 242);
    pdf.setLineWidth(0.3);
    (pdf as any).roundedRect(lx, ly, logoBox, logoBox, 2, 2, "S");

    const ar = logo!.width / logo!.height;
    let iw = 28;
    let ih = 28;
    if (ar >= 1) ih = iw / ar;
    else iw = ih * ar;
    const ix = lx + (logoBox - iw) / 2;
    const iy = ly + (logoBox - ih) / 2;
    try {
      pdf.addImage(logo!.dataUrl, logo!.format, ix, iy, iw, ih);
    } catch {
      pdf.setFontSize(8);
      pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      pdf.text("Logo", lx + logoBox / 2, ly + logoBox / 2 + 1, { align: "center" });
    }
  }

  return headerHeight;
};

const addFooter = (
  pdf: jsPDF,
  pageNum: number,
  pageWidth: number,
  pageHeight: number,
  textMuted: number[],
  footerBrand: string,
  accentBlue: number[]
) => {
  const lineYPage = pageHeight - 20;
  const lineYGen = pageHeight - 14;
  const lineYPlay = pageHeight - 8;

  // @ts-ignore
  if (pdf.GState) {
    // @ts-ignore
    pdf.setGState(new pdf.GState({ opacity: 0.5 }));
  }

  pdf.setFontSize(7);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  pdf.text(`${footerBrand} • PAGE ${pageNum}`, pageWidth / 2, lineYPage, {
    align: "center",
  });

  pdf.setFontSize(6.5);
  pdf.text("PDF generated by CatShare", pageWidth / 2, lineYGen, {
    align: "center",
  });

  const linkLabel = "Download on Google Play";
  pdf.setFontSize(7);
  pdf.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  const linkW = pdf.getTextWidth(linkLabel);
  const linkX = pageWidth / 2 - linkW / 2;
  // @ts-ignore — annotations plugin (included in default jsPDF build)
  pdf.textWithLink(linkLabel, linkX, lineYPlay, {
    url: CATSHARE_PLAY_STORE_URL,
  });

  // @ts-ignore
  if (pdf.GState) {
    // @ts-ignore
    pdf.setGState(new pdf.GState({ opacity: 1.0 }));
  }
};

/**
 * Generate a PDF with a modern "Glass" theme
 */
export async function generateProductPDF(
  options: PDFGenerationOptions
): Promise<Blob> {
  const {
    products,
    catalogueName = "Product Catalogue",
    businessProfile: businessProfileOpt,
    currencySymbol = "₹",
    fieldLabels = {},
  } = options;

  const profile: BusinessProfile = {
    ...EMPTY_BUSINESS_PROFILE,
    ...businessProfileOpt,
  };

  const logoAsset = await loadPdfLogo(profile.logoUrl);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;

  // Theme Colors
  const accentBlue = [59, 130, 246]; // #3b82f6
  const textDark = [15, 23, 42]; // Slate-900
  const textMuted = [100, 116, 139]; // Slate-500

  drawGlassBackground(pdf, pageWidth, pageHeight, accentBlue);
  const headerHeight = addCompanyHeader(
    pdf,
    profile,
    pageWidth,
    margin,
    contentWidth,
    accentBlue,
    textDark,
    textMuted,
    logoAsset
  );

  let currentY = headerHeight + 10;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Check for page break
    if (currentY > pageHeight - 85) {
      pdf.addPage();
      drawGlassBackground(pdf, pageWidth, pageHeight, accentBlue);
      // Company header only on page 1; later pages use top margin only
      currentY = margin + 10;
    }

    // --- Glass Product Card ---
    const cardHeight = 72;

    // 1. Subtle card shadow (simulated)
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 0.03 }));
    }
    pdf.setFillColor(0, 0, 0);
    (pdf as any).roundedRect(
      margin + 1,
      currentY + 1,
      contentWidth,
      cardHeight,
      4,
      4,
      "F"
    );

    // 2. Glass Background
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 0.6 }));
    }
    pdf.setFillColor(255, 255, 255);
    (pdf as any).roundedRect(
      margin,
      currentY,
      contentWidth,
      cardHeight,
      4,
      4,
      "F"
    );

    // 3. Glass Highlight Border (Thin white)
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 0.8 }));
    }
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.4);
    (pdf as any).roundedRect(
      margin,
      currentY,
      contentWidth,
      cardHeight,
      4,
      4,
      "S"
    );

    // Reset state
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 1.0 }));
    }

    // --- Content Layout ---
    let innerY = currentY + 8;

    // Product Name Header
    pdf.setFontSize(13);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
    const pName = product.name || "Unnamed Product";
    pdf.text(pName, margin + 8, innerY);

    if (product.subtitle) {
      const nameWidth = pdf.getTextWidth(pName);
      pdf.setFont(undefined, "italic");
      pdf.setFontSize(10);
      pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      pdf.text(`(${product.subtitle})`, margin + 8 + nameWidth + 2, innerY);
    }

    // Index badge (top right of card)
    pdf.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 0.1 }));
    }
    (pdf as any).roundedRect(
      pageWidth - margin - 15,
      currentY + 4,
      10,
      6,
      2,
      2,
      "F"
    );
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 1.0 }));
    }
    pdf.setFontSize(8);
    pdf.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
    pdf.text(`#${i + 1}`, pageWidth - margin - 10, currentY + 8.5, {
      align: "center",
    });

    innerY += 8;

    // --- Image ---
    let imageWidth = 48;
    let imageHeight = 48;

    if (product.image) {
      try {
        const resolved = await resolveProductImageForPdf(product.image);
        if (!resolved) {
          console.warn("PDF: could not resolve product image", product.id);
        } else {
          const imgDimensions = await getImageDimensions(resolved.dataUrl);
          const aspectRatio = imgDimensions.width / imgDimensions.height;
          imageHeight = imageWidth / aspectRatio;

          if (imageHeight > 50) {
            imageHeight = 50;
            imageWidth = imageHeight * aspectRatio;
          }

          pdf.setFillColor(255, 255, 255);
          pdf.rect(margin + 8, innerY, imageWidth, imageHeight, "F");

          pdf.addImage(
            resolved.dataUrl,
            resolved.format,
            margin + 8,
            innerY,
            imageWidth,
            imageHeight
          );
        }
      } catch (e) {
        console.warn("Image failed", e);
      }
    }

    // --- Details ---
    const detailsX = margin + imageWidth + 16;
    const detailsMaxWidth = contentWidth - imageWidth - 24;

    const visiblePdfFieldKeys = getAllFields()
      .filter((f) => f.enabled && f.key.startsWith("field") && isFieldVisibleOnSurface(f, "pdf"))
      .map((f) => f.key);
    const activeFields = visiblePdfFieldKeys.filter((f) => product[f]);
    const useColumns = activeFields.length > 5;
    const pRows = useColumns
      ? Math.ceil(activeFields.length / 2)
      : activeFields.length;

    let totalDetailsHeight = 0;
    if (activeFields.length > 0) {
      totalDetailsHeight += pRows * 6;
    }
    if (product.price || product.offerPrice) {
      if (activeFields.length > 0) {
        totalDetailsHeight += 6 + 5;
      } else {
        totalDetailsHeight += 10;
      }
    } else if (activeFields.length > 0) {
      totalDetailsHeight -= 1.5;
    }

    let detailsY = innerY;
    if (totalDetailsHeight < imageHeight) {
      detailsY = innerY + (imageHeight - totalDetailsHeight) / 2 + 2;
    }

    // Fields Grid
    pdf.setFontSize(8.5);
    for (let idx = 0; idx < activeFields.length; idx++) {
      const fieldKey = activeFields[idx];
      const label = fieldLabels[fieldKey] || fieldKey;
      const val = product[fieldKey];
      const unit = product[`${fieldKey}Unit`] || "";

      const isCol2 =
        useColumns && idx >= Math.ceil(activeFields.length / 2);
      const fX = isCol2
        ? detailsX + detailsMaxWidth / 2 + 4
        : detailsX;
      const fY =
        detailsY +
        (isCol2 ? idx - Math.ceil(activeFields.length / 2) : idx) * 6;

      pdf.setFont(undefined, "bold");
      pdf.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      const labelText = label.toUpperCase() + ":";
      pdf.text(labelText, fX, fY);

      pdf.setFont(undefined, "normal");
      pdf.setTextColor(textDark[0], textDark[1], textDark[2]);
      const lWidth = pdf.getTextWidth(labelText) + 3;
      pdf.text(
        `${val}${unit && unit !== "None" ? " " + unit : ""}`,
        fX + lWidth,
        fY
      );
    }

    // --- Price (Floating Glass Label Style) ---
    if (product.price || product.offerPrice) {
      const priceY =
        detailsY + (activeFields.length > 0 ? pRows * 6 + 6 : 0);

      const pUnit = product.priceUnit || "";
      const listN = parseFloat(String(product.price ?? "").trim()) || 0;
      const offerN = parseFloat(String(product.offerPrice ?? "").trim()) || 0;
      const sale = listN > 0 && offerN > 0 && offerN < listN;
      const pText = sale
        ? `PRICE : ${currencySymbol}${offerN}  (was ${currencySymbol}${listN})${pUnit ? " " + pUnit : ""}`.trim()
        : `PRICE : ${currencySymbol}${product.price}${pUnit ? " " + pUnit : ""}`.trim();

      // Price background pill
      pdf.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
      // @ts-ignore
      if (pdf.GState) {
        // @ts-ignore
        pdf.setGState(new pdf.GState({ opacity: 0.05 }));
      }
      (pdf as any).roundedRect(
        detailsX - 2,
        priceY - 5,
        detailsMaxWidth,
        10,
        2,
        2,
        "F"
      );
      // @ts-ignore
      if (pdf.GState) {
        // @ts-ignore
        pdf.setGState(new pdf.GState({ opacity: 1.0 }));
      }

      // Render price via Canvas
      const priceImage = renderTextToImage(pText, 44, "#2563eb");
      const imgH = 7.5;
      const imgW = (priceImage.width / priceImage.height) * imgH;
      pdf.addImage(priceImage.dataUrl, "PNG", detailsX, priceY - 4, imgW, imgH);
    }

    currentY += Math.max(cardHeight, imageHeight + 24) + 8;
  }

  // Finalize Footers
  const pageCount = (pdf as any).internal.getNumberOfPages();
  const footerBrand =
    profile.businessName?.trim() ||
    catalogueName.trim() ||
    "CatShare";
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    addFooter(pdf, i, pageWidth, pageHeight, textMuted, footerBrand, accentBlue);
  }

  return pdf.output("blob") as Blob;
}

export function downloadPDF(
  blob: Blob,
  filename: string = "products.pdf"
) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function sharePDF(
  blob: Blob,
  filename: string = "products.pdf",
  title: string = "Share Products PDF"
) {
  try {
    // 1. Convert blob to base64 (without data URL prefix)
    const base64Data = await blobToBase64(blob);

    // 2. Try FileSharer first (most reliable for files on mobile)
    try {
      console.log("📤 Attempting to share PDF via FileSharer...");
      await FileSharer.share({
        filename,
        base64Data,
        contentType: "application/pdf",
      });
      return true;
    } catch (shareErr) {
      console.warn("⚠️ FileSharer failed, trying Capacitor Share:", shareErr);

      // 3. Fallback: write to Cache dir and share via Capacitor Share
      try {
        const folderPath = "CatShare";
        const filePath = `${folderPath}/${filename}`;

        // Ensure the directory exists before writing
        await Filesystem.mkdir({
          path: folderPath,
          directory: Directory.Cache,
          recursive: true,
        }).catch(() => {
          // Ignore error — directory likely already exists
        });

        await Filesystem.writeFile({
          path: filePath,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        const fileResult = await Filesystem.getUri({
          path: filePath,
          directory: Directory.Cache,
        });

        if (fileResult.uri) {
          await Share.share({
            title,
            files: [fileResult.uri],
          });
          return true;
        }
      } catch (capShareErr) {
        console.warn("⚠️ Capacitor Share also failed:", capShareErr);
      }
    }
  } catch (err) {
    console.error("❌ PDF Share logic failed:", err);
  }

  // 4. Final fallback: trigger browser download
  console.log("📥 Falling back to browser download");
  downloadPDF(blob, filename);
  return false;
}

/**
 * Converts a Blob to a base64 string (WITHOUT the data URL prefix).
 * e.g. returns "JVBERi0x..." not "data:application/pdf;base64,JVBERi0x..."
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}