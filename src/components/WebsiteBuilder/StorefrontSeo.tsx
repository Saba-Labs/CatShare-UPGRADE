import { useEffect } from 'react';
import type { ResolvedStorefrontSeo } from '../../utils/storefrontSeo';

interface StorefrontSeoProps {
  seo: ResolvedStorefrontSeo;
  googleSiteVerification?: string;
  faviconUrl?: string;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export default function StorefrontSeo({ seo, googleSiteVerification, faviconUrl }: StorefrontSeoProps) {
  useEffect(() => {
    document.title = seo.title;

    upsertMeta('name', 'description', seo.description);
    upsertMeta('name', 'robots', seo.robots);
    if (seo.keywords) upsertMeta('name', 'keywords', seo.keywords);

    upsertMeta('property', 'og:title', seo.title);
    upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', seo.canonical);
    if (seo.ogImage) upsertMeta('property', 'og:image', seo.ogImage);

    upsertMeta('name', 'twitter:card', seo.ogImage ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', seo.title);
    upsertMeta('name', 'twitter:description', seo.description);
    if (seo.ogImage) upsertMeta('name', 'twitter:image', seo.ogImage);

    if (googleSiteVerification) {
      upsertMeta('name', 'google-site-verification', googleSiteVerification);
    }

    upsertLink('canonical', seo.canonical);
    if (faviconUrl) upsertLink('icon', faviconUrl);

    const scriptId = 'storefront-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(seo.jsonLd.length === 1 ? seo.jsonLd[0] : seo.jsonLd);

    return () => {
      const s = document.getElementById(scriptId);
      if (s) s.remove();
    };
  }, [seo, googleSiteVerification, faviconUrl]);

  return null;
}
