import type { ProductWithCatalogueData } from '../config/catalogueProductUtils';
import { productHandle } from './websiteStorefront';
import type { StoreCategory } from './storefrontCategories';

export type StoreLinkGroup = 'pages' | 'shop' | 'categories' | 'products';

export interface StoreLinkOption {
  id: string;
  label: string;
  href: string;
  group: StoreLinkGroup;
}

export interface StoreLinkPageRef {
  title: string;
  slug: string;
}

const GROUP_LABELS: Record<StoreLinkGroup, string> = {
  pages: 'Pages',
  shop: 'Shop',
  categories: 'Categories',
  products: 'Products',
};

export function storeLinkGroupLabel(group: StoreLinkGroup): string {
  return GROUP_LABELS[group];
}

/** Relative storefront paths for the link picker (works in builder preview and live site). */
export function buildStoreLinkOptions(input: {
  customPages?: StoreLinkPageRef[];
  products?: ProductWithCatalogueData[];
  categories?: StoreCategory[];
}): StoreLinkOption[] {
  const options: StoreLinkOption[] = [];

  options.push({
    id: 'page-home',
    label: 'Home',
    href: '/',
    group: 'pages',
  });

  for (const page of input.customPages || []) {
    const slug = (page.slug || '').replace(/^\/+/, '');
    if (!slug) continue;
    options.push({
      id: `page-${slug}`,
      label: page.title || slug,
      href: `/${slug}`,
      group: 'pages',
    });
  }

  options.push({
    id: 'shop-all',
    label: 'All products',
    href: '/collections/all',
    group: 'shop',
  });

  for (const category of input.categories || []) {
    options.push({
      id: `cat-${category.id}`,
      label: category.label,
      href: `/collections/all?category=${encodeURIComponent(category.id)}`,
      group: 'categories',
    });
  }

  const products = [...(input.products || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  for (const product of products) {
    const handle = productHandle(product);
    options.push({
      id: `product-${product.id}`,
      label: product.name || handle,
      href: `/products/${handle}`,
      group: 'products',
    });
  }

  return options;
}

export function groupStoreLinkOptions(options: StoreLinkOption[]): Array<{ group: StoreLinkGroup; label: string; items: StoreLinkOption[] }> {
  const order: StoreLinkGroup[] = ['pages', 'shop', 'categories', 'products'];
  return order
    .map((group) => ({
      group,
      label: GROUP_LABELS[group],
      items: options.filter((o) => o.group === group),
    }))
    .filter((g) => g.items.length > 0);
}
