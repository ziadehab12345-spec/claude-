import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { getServiceBySlug } from '@/lib/services';
import { BookingFlow } from '@/components/BookingFlow';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

const BACK_ROUTE = {
  fasttrack: '/fast-track',
  car: '/fleet',
  hotel: '/stays',
  apartment: '/stays',
} as const;

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const service = await getServiceBySlug(db, slug);
  if (!service) notFound();

  const t = await getTranslations('services');
  const name = locale === 'ar' ? service.name_ar : service.name_en;
  const description = locale === 'ar' ? service.description_ar : service.description_en;

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <Link href={BACK_ROUTE[service.type]} className="text-sm text-ink-400 hover:text-ink-900">
        ← {t(service.type)}
      </Link>
      <h1 className="mt-3 text-4xl">{name}</h1>
      {description && <p className="mt-3 max-w-xl text-ink-600">{description}</p>}
      {service.type === 'car' && <p className="mt-2 text-sm text-gold-600">{t('includesDriver')}</p>}

      <div className="mt-12">
        <BookingFlow
          slug={service.slug}
          serviceType={service.type}
          serviceName={name}
          currency={service.currency}
        />
      </div>
    </div>
  );
}
