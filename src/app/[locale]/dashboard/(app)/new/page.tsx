import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { getSessionUser } from '@/lib/session';
import { ManualBookingForm } from '@/components/dashboard/ManualBookingForm';

export const dynamic = 'force-dynamic';

export default async function NewBookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const [services, session] = await Promise.all([listPublicServices(db), getSessionUser()]);

  return (
    <>
      <h1 className="text-2xl">{t('newBooking')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">{t('manualIntro')}</p>
      <div className="mt-8">
        <ManualBookingForm services={services} role={session?.role ?? 'staff'} />
      </div>
    </>
  );
}
