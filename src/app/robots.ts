import type { MetadataRoute } from 'next';
import { absoluteUrl, isIndexable } from '@/config/site';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // A preview deployment serves the same content as production; letting it be
  // crawled would split the site's ranking across two domains.
  if (!isIndexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing here is secret, but there is no reason to spend crawl budget
        // on the staff dashboard or the API.
        disallow: ['/api/', '/ar/dashboard', '/en/dashboard'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
