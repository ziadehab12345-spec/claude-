'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import type { UserRole } from '@/lib/schema';

/** Dashboard chrome: navigation, the language switch and sign out. */
export function DashboardNav({ name, role }: { name: string; role: UserRole }) {
  const t = useTranslations('dashboard');
  const nav = useTranslations('nav');
  const brand = useTranslations('brand');
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  const links = [
    { href: '/dashboard', label: t('inbox') },
    { href: '/dashboard/log', label: t('logInquiry') },
    ...(role === 'admin'
      ? [
          { href: '/dashboard/services', label: t('services') },
          { href: '/dashboard/staff', label: t('staff') },
        ]
      : []),
  ];

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/dashboard/login');
    router.refresh();
  }

  return (
    <header className="border-b border-ink-800 bg-ink-950 text-sand-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
        <Link href="/dashboard" className="font-display text-lg text-sand-50">
          {brand('name')}
        </Link>
        <span className="hidden text-xs text-ink-600 lg:inline">{t('title')}</span>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-[4px] px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-ink-800 text-sand-50' : 'text-ink-200 hover:bg-ink-900'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <span className="hidden text-xs text-ink-400 sm:inline">{t('signedInAs', { name })}</span>
          <Link
            href={pathname}
            locale={locale === 'ar' ? 'en' : 'ar'}
            className="rounded-[4px] px-2 py-1 text-xs text-ink-200 hover:bg-ink-900"
          >
            {nav('language')}
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="rounded-[4px] px-2 py-1 text-xs text-ink-200 hover:bg-ink-900"
          >
            {t('signOut')}
          </button>
        </div>
      </div>
    </header>
  );
}
