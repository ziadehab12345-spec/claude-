import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

/**
 * robots.txt asks crawlers not to come here; this tells any that arrive anyway
 * not to index what they find. A staff page in search results would leak
 * customer names.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The dashboard shell is added by the authenticated group layout, not here,
 * so the login page can render without navigation.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <div className="min-h-screen bg-sand-100">{children}</div>;
}
