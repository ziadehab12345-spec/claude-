import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { ServiceGrid, type ServiceCard } from '@/components/ServiceGrid';

export const dynamic = 'force-dynamic';

export default async function FastTrackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('services');
  const services = (await listPublicServices(db, 'fasttrack')) as ServiceCard[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow">{t('fasttrack')}</p>
      <h1 className="mt-2 text-4xl">{t('fasttrack')}</h1>
      <p className="mt-3 max-w-xl text-ink-600">{t('fasttrackBlurb')}</p>
      <div className="mt-12">
        <ServiceGrid services={services} locale={locale} />
      </div>
    </div>
  );
}
