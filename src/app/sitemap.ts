import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { absoluteUrl } from '@/config/site';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

/** Static pages, as paths without a locale prefix. */
const STATIC_PATHS = ['', '/fast-track', '/fleet', '/stays', '/about', '/my-booking'] as const;

/**
 * Every public page, in both locales, each entry declaring its counterpart so a
 * search engine indexes the Arabic and English versions as one page in two
 * languages rather than as duplicates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * Deliberately not caught. A sitemap that silently omits every service page
   * because the database was briefly unreachable tells crawlers those pages do
   * not exist, and they drop out of the index. Failing the request instead
   * makes the crawler come back.
   */
  const services = await listPublicServices(db);
  const servicePaths = services.map((s) => `/book/${s.slug}`);
  const allPaths = [...STATIC_PATHS, ...servicePaths];
  const now = new Date();

  return allPaths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${path}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : path.startsWith('/book/') ? 0.7 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, absoluteUrl(`/${l}${path}`)]),
        ),
      },
    })),
  );
}
