import { useEffect } from 'react';

const SITE_NAME = 'Fire Safety Platform';
const DEFAULT_TITLE = `${SITE_NAME} — Certified Equipment, Refilling & AMC Services`;
const DEFAULT_DESCRIPTION =
  'ISO certified fire protection equipment, extinguisher refilling, safety audits, and AMC compliance services with digital passports.';

interface MetaTagsProps {
  title?: string;
  description?: string;
  /** Absolute URL or a site-relative path; made absolute for og:image / twitter:image. */
  image?: string;
  /** Defaults to the current page's URL without its query string or hash. */
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'product';
  /** Keeps the page out of search results (login, cart, checkout, account pages). */
  noindex?: boolean;
  /** Structured data (schema.org) injected as <script type="application/ld+json">. */
  jsonLd?: Record<string, unknown>;
}

/** Shortens text for meta descriptions without cutting a word in half. */
export function truncate(text: string | undefined, max = 155): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

type Restore = () => void;

function upsertMeta(attr: 'name' | 'property', key: string, content: string): Restore {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const created = !el;
  const previous = el?.getAttribute('content') ?? null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  const target = el;
  return () => {
    if (created) target.remove();
    else if (previous !== null) target.setAttribute('content', previous);
  };
}

function upsertCanonical(href: string): Restore {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const created = !el;
  const previous = el?.getAttribute('href') ?? null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  const target = el;
  return () => {
    if (created) target.remove();
    else if (previous !== null) target.setAttribute('href', previous);
  };
}

function injectJsonLd(json: string): Restore {
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  // "<" is escaped so product text can never close the script tag early.
  el.textContent = json.replace(/</g, '\\u003c');
  document.head.appendChild(el);
  return () => el.remove();
}

/**
 * Sets this page's title, description, canonical URL, Open Graph / Twitter tags (and optionally robots + JSON-LD)
 * with plain DOM updates, and puts everything back the way it was when the page unmounts, so one page's tags never
 * leak into the next. Render at most one per page.
 */
export function MetaTags({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = '/logo.png',
  canonicalUrl,
  type = 'website',
  noindex = false,
  jsonLd
}: MetaTagsProps) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const restores: Restore[] = [];
    const previousTitle = document.title;

    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const pageUrl = canonicalUrl || `${window.location.origin}${window.location.pathname}`;
    const imageUrl = new URL(image, window.location.origin).href;

    document.title = fullTitle;
    restores.push(() => { document.title = previousTitle; });

    restores.push(upsertMeta('name', 'description', description));
    restores.push(upsertMeta('property', 'og:title', fullTitle));
    restores.push(upsertMeta('property', 'og:description', description));
    restores.push(upsertMeta('property', 'og:image', imageUrl));
    restores.push(upsertMeta('property', 'og:type', type));
    restores.push(upsertMeta('property', 'og:url', pageUrl));
    restores.push(upsertMeta('property', 'og:site_name', SITE_NAME));
    restores.push(upsertMeta('name', 'twitter:card', 'summary_large_image'));
    restores.push(upsertMeta('name', 'twitter:title', fullTitle));
    restores.push(upsertMeta('name', 'twitter:description', description));
    restores.push(upsertMeta('name', 'twitter:image', imageUrl));
    restores.push(upsertCanonical(pageUrl));
    if (noindex) restores.push(upsertMeta('name', 'robots', 'noindex, nofollow'));
    if (jsonLdKey) restores.push(injectJsonLd(jsonLdKey));

    return () => {
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
    };
  }, [title, description, image, canonicalUrl, type, noindex, jsonLdKey]);

  return null;
}
