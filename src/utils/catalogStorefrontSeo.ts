import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import type { StoreMarketingSettings } from '../types/storeMarketingSettings';
import { parseGoogleSiteVerificationToken } from '../types/storeMarketingSettings';
import {
  absoluteStoreUrl,
  getWebsiteProductImageUrl,
  productHandle,
} from './websiteStorefront';
import type { ResolvedStorefrontSeo } from './storefrontSeo';

export type CatalogStorefrontPageKind = 'home' | 'product';

export interface CatalogStorefrontSeoContext {
  slug: string;
  storeName: string;
  storeDescription?: string;
  logoUrl?: string;
  marketing: StoreMarketingSettings;
  pageKind: CatalogStorefrontPageKind;
  product?: ProductWithCatalogueData | null;
  onSubdomain?: boolean;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function resolveCatalogPath(ctx: CatalogStorefrontSeoContext): string {
  const { slug, pageKind, product, onSubdomain } = ctx;
  const base = onSubdomain ? '' : `/store/${slug}`;
  if (pageKind === 'product' && product) {
    return `${base}/products/${productHandle(product)}`;
  }
  return base || '/';
}

export function resolveCatalogStorefrontSeo(ctx: CatalogStorefrontSeoContext): ResolvedStorefrontSeo {
  const { seo } = ctx.marketing;
  const siteName = ctx.storeName || 'Store';
  const defaultDesc =
    seo.metaDescription?.trim() ||
    ctx.storeDescription?.trim() ||
    `Shop ${siteName} online. Browse products and place orders easily.`;

  let title = seo.metaTitle?.trim() || siteName;
  let description = defaultDesc;

  if (ctx.pageKind === 'product' && ctx.product) {
    title = `${ctx.product.name} | ${siteName}`;
    description = truncate(
      (ctx.product.description as string) ||
        (ctx.product.subtitle as string) ||
        `Buy ${ctx.product.name} from ${siteName}.`,
      160
    );
  } else if (ctx.pageKind === 'home' && seo.metaTitle?.trim()) {
    title = seo.metaTitle.trim();
    description = truncate(defaultDesc, 160);
  }

  const path = resolveCatalogPath(ctx);
  const canonical = absoluteStoreUrl(ctx.slug, path);
  const ogImage =
    (ctx.pageKind === 'product' && ctx.product && getWebsiteProductImageUrl(ctx.product)) ||
    seo.ogImageUrl?.trim() ||
    ctx.logoUrl;

  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: absoluteStoreUrl(ctx.slug, ctx.onSubdomain ? '/' : `/store/${ctx.slug}`),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: siteName,
      url: canonical,
      description: truncate(description, 300),
      ...(ogImage ? { image: ogImage } : {}),
    },
  ];

  if (ctx.pageKind === 'product' && ctx.product) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: ctx.product.name,
      description: truncate(String(ctx.product.description || ctx.product.subtitle || ''), 500),
      ...(ogImage ? { image: ogImage } : {}),
    });
  }

  return {
    title: truncate(title, 70),
    description: truncate(description, 160),
    canonical,
    ogImage,
    keywords: seo.keywords?.trim() || undefined,
    robots: 'index, follow, max-image-preview:large',
    jsonLd,
  };
}

export function resolveCatalogGoogleSiteVerification(marketing: StoreMarketingSettings): string | undefined {
  const token = parseGoogleSiteVerificationToken(marketing.tracking.googleSearchConsoleVerification);
  return token || undefined;
}
