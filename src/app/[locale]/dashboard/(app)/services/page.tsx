import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listAllServices } from '@/lib/services';
import { getSessionUser } from '@/lib/session';
import { ServiceVisibility } from '@/components/dashboard/ServiceVisibility';

export const dynamic = 'force-dynamic';

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (session?.role !== 'admin') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('dashboard');
  const services = await listAllServices(db);

  return (
    <>
      <h1 className="text-2xl">{t('services')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">{t('servicesIntro')}</p>
      <div className="mt-8">
        <ServiceVisibility services={services} />
      </div>
    </>
  );
}
