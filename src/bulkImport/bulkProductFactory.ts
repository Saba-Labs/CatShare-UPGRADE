import { getAllCatalogues } from "../config/catalogueConfig";
import {
  getCatalogueData,
  initializeCatalogueData,
  type ProductWithCatalogueData,
} from "../config/catalogueProductUtils";

export type BulkRenderingType = "glass" | "classic";

export function buildBulkImportedProduct(options: {
  id: string;
  name: string;
  imagePath: string;
  imageUrl: string;
  imageVersion: number;
  cropAspectRatio: number;
  suggestedColors?: string[];
  fontColor: string;
  bgColor: string;
  imageBgColor: string;
  renderingType: BulkRenderingType;
}): ProductWithCatalogueData {
  const seed: ProductWithCatalogueData = {
    id: options.id,
    name: options.name,
    subtitle: "",
    privateNotes: "",
    category: [],
  };
  seed.catalogueData = initializeCatalogueData(seed);
  const formData = seed;

  const defaultCatalogueData = getCatalogueData(formData, "cat1");
  const allCatalogues = getAllCatalogues();

  const newItem: ProductWithCatalogueData = {
    ...formData,
    id: options.id,
    name: options.name,
    imagePath: options.imagePath,
    imageUrl: options.imageUrl,
    imageVersion: options.imageVersion,
    suggestedColors:
      options.suggestedColors && options.suggestedColors.length > 0
        ? options.suggestedColors
        : undefined,
    fontColor: options.fontColor || "white",
    imageBgColor: options.imageBgColor || "white",
    bgColor: options.bgColor || "#add8e6",
    cropAspectRatio: options.cropAspectRatio,
    renderingType: options.renderingType,
  };

  if (newItem.image) {
    delete newItem.image;
  }

  for (const cat of allCatalogues) {
    const catData = getCatalogueData(formData, cat.id);
    newItem[cat.priceField] = catData[cat.priceField] || "";
    newItem[cat.priceUnitField] = catData[cat.priceUnitField] || "/ piece";
    newItem[cat.stockField] = catData[cat.stockField] !== false;
  }

  newItem.price1 = newItem.price1 || "";
  newItem.price1Unit = newItem.price1Unit || "/ piece";

  for (let i = 1; i <= 10; i++) {
    newItem[`field${i}`] = defaultCatalogueData[`field${i}`] || "";
    newItem[`field${i}Unit`] = defaultCatalogueData[`field${i}Unit`] || "None";
  }

  newItem.badge = defaultCatalogueData.badge || "";
  newItem.wholesaleUnit = defaultCatalogueData.price1Unit || "/ piece";
  newItem.packageUnit = defaultCatalogueData.field2Unit || "pcs / set";
  newItem.ageUnit = defaultCatalogueData.field3Unit || "months";
  newItem.wholesale = newItem.price1 || "";
  newItem.stock = newItem[allCatalogues[0]?.stockField || "wholesaleStock"] !== false;

  if (newItem.catalogueData) {
    for (const cat of allCatalogues) {
      if (newItem.catalogueData[cat.id]) {
        newItem.catalogueData[cat.id].badge = newItem.badge;
      }
    }
  }

  return newItem;
}
