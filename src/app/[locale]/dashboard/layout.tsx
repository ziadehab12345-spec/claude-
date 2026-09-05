import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';

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
