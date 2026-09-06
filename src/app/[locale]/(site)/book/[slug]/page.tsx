import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { getServiceBySlug } from '@/lib/services';
import { BookingFlow } from '@/components/BookingFlow';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

/**
 * Each service gets its own title and description from the catalogue, so a
 * search for "Mercedes Maybach with driver Cairo" can land on the right page
 * rather than the generic fleet list.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const service = await getServiceBySlug(db, slug);
  if (!service) return {};

  const ar = locale === 'ar';
  return pageMetadata({
    locale,
    path: `/book/${slug}`,
    title: ar ? service.name_ar : service.name_en,
    description: (ar ? service.description_ar : service.description_en) || undefined,
    image: service.image_url,
  });
}

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
      {description && <p className="mt-3 max-w-xl leading-relaxed text-ink-600">{description}</p>}

      {service.highlights.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow">{t('whatsIncluded')}</p>
          <ul className="mt-3 grid max-w-2xl gap-2 sm:grid-cols-2">
            {service.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-700">
                <span aria-hidden className="text-gold-500">·</span>
                <span>{locale === 'ar' ? h.ar : h.en}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
