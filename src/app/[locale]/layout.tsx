import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, directionOf } from '@/i18n/routing';
import { siteOrigin, SITE_NAME_AR, SITE_NAME_EN } from '@/config/site';
import { organisationJsonLd } from '@/lib/metadata';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const seo = await getTranslations({ locale, namespace: 'seo' });
  const name = locale === 'ar' ? SITE_NAME_AR : SITE_NAME_EN;

  return {
    // Every relative URL in a child page's metadata resolves against this.
    // Without it Next falls back to localhost and ships broken preview links.
    metadataBase: new URL(siteOrigin()),
    title: { default: seo('homeTitle'), template: `%s — ${name}` },
    description: seo('homeDescription'),
    applicationName: name,
    formatDetection: { telephone: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={directionOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
          Tells search engines this is one business with a phone number and a
          location, rather than leaving them to infer it from the page text.
        */}
        <script
          type="application/ld+json"
          // The value is built from constants in this repository, not user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationJsonLd(locale)) }}
        />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
