/**
 * Site-wide constants that depend on where the site is deployed.
 *
 * The canonical origin has to be absolute for Open Graph tags, the sitemap and
 * canonical links, and those are wrong in a way nobody notices until the site
 * is already indexed. It comes from the environment so a preview deployment
 * does not advertise itself as the production domain.
 */
export const SITE_NAME_EN = 'Ahl Cairo';
export const SITE_NAME_AR = 'أهل كايرو';

export const PRODUCTION_ORIGIN = 'https://cairopeople.com';

function normalise(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Order matters: an explicit SITE_URL wins, then Vercel's own per-deployment
 * URL so previews are self-consistent, then the production domain.
 *
 * SITE_URL has no NEXT_PUBLIC_ prefix on purpose. Next inlines NEXT_PUBLIC_
 * variables at build time, so a prefixed value would be frozen into the
 * bundle and changing it would need a rebuild rather than a restart. Nothing
 * client-side needs this — it feeds canonical URLs, hreflang, the sitemap and
 * link previews, all rendered on the server.
 *
 * NEXT_PUBLIC_SITE_URL is still read as a fallback so an existing deployment
 * that sets it keeps working.
 */
export function siteOrigin(): string {
  const explicit = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return normalise(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return normalise(`https://${vercel}`);

  return PRODUCTION_ORIGIN;
}

export function absoluteUrl(path = '/'): string {
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Only the production domain should ever be indexed. */
export function isIndexable(): boolean {
  return siteOrigin() === PRODUCTION_ORIGIN;
}
