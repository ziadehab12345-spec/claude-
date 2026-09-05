import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { ServiceGrid, type ServiceCard } from '@/components/ServiceGrid';

export const dynamic = 'force-dynamic';

export default async function FleetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('services');
  const services = (await listPublicServices(db, 'car')) as ServiceCard[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow">{t('car')}</p>
      <h1 className="mt-2 text-4xl">{t('car')}</h1>
      <p className="mt-3 max-w-xl text-ink-600">{t('carBlurb')}</p>
      <div className="mt-12">
        <ServiceGrid services={services} locale={locale} />
      </div>
    </div>
  );
}
