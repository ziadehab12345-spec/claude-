import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { ServiceGrid, type ServiceCard } from '@/components/ServiceGrid';

export const dynamic = 'force-dynamic';

/** Hotels and serviced apartments share a page; both are date-range stays. */
export default async function StaysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('services');

  const [hotels, apartments] = await Promise.all([
    listPublicServices(db, 'hotel'),
    listPublicServices(db, 'apartment'),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow">{t('hotel')}</p>
      <h1 className="mt-2 text-4xl">{t('hotel')} · {t('apartment')}</h1>
      <p className="mt-3 max-w-xl text-ink-600">{t('hotelBlurb')}</p>
      <div className="mt-12 space-y-16">
        <ServiceGrid services={hotels as ServiceCard[]} locale={locale} />
        <ServiceGrid services={apartments as ServiceCard[]} locale={locale} />
      </div>
    </div>
  );
}
