import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { StaffManager } from '@/components/dashboard/StaffManager';

export const dynamic = 'force-dynamic';

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (session?.role !== 'admin') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('dashboard');
  const users = await db
    .selectFrom('users')
    .select(['id', 'name', 'email', 'role', 'active'])
    .orderBy('created_at', 'asc')
    .execute();

  return (
    <>
      <h1 className="text-2xl">{t('staff')}</h1>
      <div className="mt-8">
        <StaffManager users={users} currentUserId={session.id} />
      </div>
    </>
  );
}
