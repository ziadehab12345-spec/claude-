import type { Metadata } from 'next';
import { absoluteUrl, isIndexable, siteOrigin, SITE_NAME_AR, SITE_NAME_EN } from '@/config/site';
import { routing } from '@/i18n/routing';

/**
 * Builds the metadata for one page in one locale.
 *
 * Both locales are real pages with real content, so each declares the other via
 * hreflang and both point at a canonical URL. Without that, Google treats the
 * Arabic and English versions as duplicates and picks one for everybody.
 */
export function pageMetadata(opts: {
  locale: string;
  /** Path without the locale prefix, e.g. "/fleet". Use "" for the homepage. */
  path: string;
  title: string;
  description?: string;
  /** Absolute or root-relative image for link previews. */
  image?: string | null;
}): Metadata {
  const { locale, path, title } = opts;
  const description = opts.description ?? undefined;
  const canonical = absoluteUrl(`/${locale}${path}`);

  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = absoluteUrl(`/${l}${path}`);
  // Tells a search engine which version to show a visitor whose language we
  // have no page for.
  languages['x-default'] = absoluteUrl(`/${routing.defaultLocale}${path}`);

  /*
   * The generated card at /opengraph-image, named explicitly. Next's file
   * convention would supply it automatically, but only for pages that do not
   * set `openGraph` themselves — and every page here does, to get its own
   * title and canonical URL. Without this, those pages ship no og:image at all
   * and a shared link previews as a bare grey box.
   */
  const image = opts.image ?? absoluteUrl('/opengraph-image');
  const images = [{ url: image, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: locale === 'ar' ? SITE_NAME_AR : SITE_NAME_EN,
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    // Preview deployments share the production content, so keep them out of
    // the index rather than competing with the real domain.
    robots: isIndexable()
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
  };
}

export function organisationJsonLd(locale: string) {
  const name = locale === 'ar' ? SITE_NAME_AR : SITE_NAME_EN;
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    '@id': `${siteOrigin()}/#organisation`,
    name,
    alternateName: locale === 'ar' ? SITE_NAME_EN : SITE_NAME_AR,
    url: absoluteUrl(`/${locale}`),
    telephone: '+201222332929',
    address: {
      '@type': 'PostalAddress',
      addressLocality: locale === 'ar' ? 'القاهرة' : 'Cairo',
      addressCountry: 'EG',
    },
    areaServed: 'EG',
    availableLanguage: ['ar', 'en'],
    sameAs: ['https://wa.me/201222332929'],
  };
}
