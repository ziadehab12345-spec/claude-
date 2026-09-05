'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

/** Public site navigation, with the AR/EN switch that keeps the current page. */
export function SiteHeader() {
  const t = useTranslations('nav');
  const brand = useTranslations('brand');
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/fast-track', label: t('fastTrack') },
    { href: '/fleet', label: t('fleet') },
    { href: '/stays', label: t('stays') },
    { href: '/about', label: t('about') },
  ] as const;

  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-xl text-ink-900">{brand('name')}</span>
          <span className="mt-0.5 text-[0.625rem] tracking-[0.16em] text-gold-600 uppercase">
            {brand('tagline')}
          </span>
        </Link>

        <nav className="ms-auto hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors hover:text-ink-900 ${
                pathname === l.href ? 'text-ink-900' : 'text-ink-600'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 md:ms-0">
          <Link
            href={pathname}
            locale={otherLocale}
            className="btn btn-ghost btn-sm"
            aria-label={t('language')}
          >
            {t('language')}
          </Link>
          <Link href="/request" className="btn btn-gold btn-sm hidden sm:inline-flex">
            {t('request')}
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden>☰</span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-sand-200 px-5 py-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block py-2 text-sm text-ink-700"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/request" className="block py-2 text-sm text-ink-700" onClick={() => setOpen(false)}>
            {t('request')}
          </Link>
        </nav>
      )}
    </header>
  );
}
