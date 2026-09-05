import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

export const dynamic = 'force-dynamic';

/**
 * Guard for every authenticated dashboard page.
 *
 * The middleware already checks the cookie signature, but this re-reads the
 * account from the database so a deactivated or demoted staff member loses
 * access on their next page load rather than when their token expires.
 */
export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (!session) redirect(`/${locale}/dashboard/login`);

  const user = await db
    .selectFrom('users')
    .select(['id', 'name', 'role', 'active'])
    .where('id', '=', session.id)
    .executeTakeFirst();

  if (!user || !user.active) redirect(`/${locale}/dashboard/login`);

  return (
    <>
      <DashboardNav name={user.name} role={user.role} />
      <div className="mx-auto max-w-7xl px-5 py-8">{children}</div>
    </>
  );
}
