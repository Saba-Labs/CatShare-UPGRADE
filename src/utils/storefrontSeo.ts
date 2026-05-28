import type { HomepageLayout, WebsiteModeConfig, WebsiteSeoSettings } from '../types/homepage';
import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import {
  absoluteStoreUrl,
  getWebsiteProductImageUrl,
  getWebsiteProductPrice,
  productHandle,
  slugifyStorefront,
} from './websiteStorefront';

export type StorefrontPageKind = 'home' | 'collection' | 'product' | 'custom';

export interface StorefrontSeoContext {
  slug: string;
  storeName: string;
  storeDescription?: string;
  logoUrl?: string;
  catalogueId?: string | null;
  websiteConfig: WebsiteModeConfig;
  pageKind: StorefrontPageKind;
  pathname: string;
  product?: ProductWithCatalogueData | null;
  customPageTitle?: string;
  customPageSlug?: string;
  onSubdomain?: boolean;
}

export interface ResolvedStorefrontSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  keywords?: string;
  robots: string;
  jsonLd: Record<string, unknown>[];
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function resolvePath(ctx: StorefrontSeoContext): string {
  const { slug, pageKind, product, customPageSlug, onSubdomain } = ctx;
  const base = onSubdomain ? '' : `/store/${slug}`;
  switch (pageKind) {
    case 'home':
      return base || '/';
    case 'collection':
      return `${base}/collections/all`;
    case 'product':
      return product ? `${base}/products/${productHandle(product)}` : base;
    case 'custom':
      return customPageSlug ? `${base}/${slugifyStorefront(customPageSlug)}` : base;
    default:
      return base || '/';
  }
}

export function resolveStorefrontSeo(ctx: StorefrontSeoContext): ResolvedStorefrontSeo {
  const seo: WebsiteSeoSettings = ctx.websiteConfig.seo || {};
  const siteName = ctx.websiteConfig.siteSettings.websiteName || ctx.storeName || 'Store';
  const defaultDesc =
    seo.metaDescription?.trim() ||
    ctx.storeDescription?.trim() ||
    `Shop ${siteName} online. Browse products and order easily.`;

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
  } else if (ctx.pageKind === 'collection') {
    title = `Shop all products | ${siteName}`;
    description = truncate(`Browse the full catalogue at ${siteName}. ${defaultDesc}`, 160);
  } else if (ctx.pageKind === 'custom' && ctx.customPageTitle) {
    title = `${ctx.customPageTitle} | ${siteName}`;
    description = truncate(`${ctx.customPageTitle} — ${siteName}`, 160);
  } else if (ctx.pageKind === 'home' && seo.metaTitle?.trim()) {
    title = seo.metaTitle.trim();
    description = truncate(defaultDesc, 160);
  }

  const path = resolvePath(ctx);
  const canonical = absoluteStoreUrl(ctx.slug, path);
  const ogImage =
    (ctx.pageKind === 'product' && ctx.product && getWebsiteProductImageUrl(ctx.product)) ||
    seo.ogImageUrl ||
    ctx.logoUrl;

  const allowIndexing = seo.allowIndexing !== false;
  const robots = allowIndexing ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';

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
    const price = getWebsiteProductPrice(ctx.product, ctx.catalogueId);
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: ctx.product.name,
      description: truncate(String(ctx.product.description || ctx.product.subtitle || ''), 500),
      ...(ogImage ? { image: ogImage } : {}),
      ...(price != null
        ? {
            offers: {
              '@type': 'Offer',
              price: price,
              priceCurrency: 'INR',
              availability: 'https://schema.org/InStock',
            },
          }
        : {}),
    });
  }

  return {
    title: truncate(title, 70),
    description: truncate(description, 160),
    canonical,
    ogImage,
    keywords: seo.keywords?.trim() || undefined,
    robots,
    jsonLd,
  };
}

export function collectSitemapPaths(
  slug: string,
  layout: HomepageLayout | null,
  products: ProductWithCatalogueData[],
  onSubdomain = false
): string[] {
  const base = onSubdomain ? '' : `/store/${slug}`;
  const paths = [base || '/', `${base}/collections/all`];
  const custom = layout?.websiteConfig?.pages?.custom || [];
  for (const page of custom) {
    if (page.slug) paths.push(`${base}/${slugifyStorefront(page.slug)}`);
  }
  for (const product of products) {
    paths.push(`${base}/products/${productHandle(product)}`);
  }
  return [...new Set(paths)];
}
