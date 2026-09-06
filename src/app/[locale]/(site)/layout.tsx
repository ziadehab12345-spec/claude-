import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/** Public site chrome. The dashboard has its own layout. */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-screen flex-col">
      {/*
        Visible only on keyboard focus. Without it, every tab through the page
        starts by walking the whole navigation again.
      */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-[4px] focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sand-50"
      >
        {t('skipToContent')}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
