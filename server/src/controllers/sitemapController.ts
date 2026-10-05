import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { Service } from '../models/Service';
import { BlogPost } from '../models/BlogPost';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';

export const getSitemapXml = asyncHandler(async (_req: Request, res: Response) => {
  const baseUrl = (env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');

  const [products, services, blogs] = await Promise.all([
    Product.find({ isActive: true, isDeleted: false }).select('slug updatedAt'),
    Service.find({ isActive: true, isDeleted: false }).select('slug updatedAt'),
    BlogPost.find({ isPublished: true }).select('slug updatedAt')
  ]);

  const staticRoutes = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/products', priority: '0.9', changefreq: 'daily' },
    { loc: '/services', priority: '0.9', changefreq: 'weekly' },
    { loc: '/book-service', priority: '0.8', changefreq: 'monthly' },
    { loc: '/about', priority: '0.6', changefreq: 'monthly' },
    { loc: '/contact', priority: '0.7', changefreq: 'monthly' },
    { loc: '/faq', priority: '0.6', changefreq: 'weekly' },
    { loc: '/gallery', priority: '0.5', changefreq: 'weekly' },
    { loc: '/blog', priority: '0.8', changefreq: 'daily' },
    { loc: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
    { loc: '/terms', priority: '0.3', changefreq: 'yearly' }
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of staticRoutes) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.loc}</loc>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  for (const prod of products) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/product/${prod.slug}</loc>\n`;
    xml += `    <lastmod>${(prod.updatedAt || new Date()).toISOString().split('T')[0]}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  for (const srv of services) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/services/${srv.slug}</loc>\n`;
    xml += `    <lastmod>${(srv.updatedAt || new Date()).toISOString().split('T')[0]}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  for (const b of blogs) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/blog/${b.slug}</loc>\n`;
    xml += `    <lastmod>${(b.updatedAt || new Date()).toISOString().split('T')[0]}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=86400');
  res.send(xml);
});
