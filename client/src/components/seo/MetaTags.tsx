import { useEffect } from 'react';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'product';
}

export function MetaTags({
  title = 'Fire Safety Platform — Certified Equipment, Refilling & AMC Services',
  description = 'ISO certified fire protection equipment, extinguisher refilling, safety audits, and AMC compliance services with digital passports.',
  image = '/logo.png',
  canonicalUrl,
  type = 'website'
}: MetaTagsProps) {
  useEffect(() => {
    // Set document title
    document.title = title.includes('Fire Safety Platform') ? title : `${title} | Fire Safety Platform`;

    // Helper to update meta tag content
    const updateMetaTag = (selector: string, attr: string, value: string) => {
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement('meta');
        if (selector.includes('name=')) {
          tag.setAttribute('name', selector.replace('meta[name="', '').replace('"]', ''));
        } else if (selector.includes('property=')) {
          tag.setAttribute('property', selector.replace('meta[property="', '').replace('"]', ''));
        }
        document.head.appendChild(tag);
      }
      tag.setAttribute(attr, value);
    };

    updateMetaTag('meta[name="description"]', 'content', description);
    updateMetaTag('meta[property="og:title"]', 'content', title);
    updateMetaTag('meta[property="og:description"]', 'content', description);
    updateMetaTag('meta[property="og:image"]', 'content', image);
    updateMetaTag('meta[property="og:type"]', 'content', type);
    if (canonicalUrl) {
      updateMetaTag('meta[property="og:url"]', 'content', canonicalUrl);
    }
    updateMetaTag('meta[name="twitter:card"]', 'content', 'summary_large_image');
    updateMetaTag('meta[name="twitter:title"]', 'content', title);
    updateMetaTag('meta[name="twitter:description"]', 'content', description);
    updateMetaTag('meta[name="twitter:image"]', 'content', image);
  }, [title, description, image, canonicalUrl, type]);

  return null;
}
