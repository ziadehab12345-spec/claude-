import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Money } from '@/components/Money';
import type { ServiceType } from '@/lib/schema';

export interface ServiceCard {
  id: string;
  slug: string;
  type: ServiceType;
  category: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  base_price_minor: string | number | bigint;
  currency: string;
  unit_count: number;
}

const PRICE_UNIT: Record<ServiceType, 'perDay' | 'perNight' | 'perService'> = {
  car: 'perDay',
  hotel: 'perNight',
  apartment: 'perNight',
  fasttrack: 'perService',
};

/**
 * The catalogue grid, grouped by category.
 *
 * Prices come from the database. A service with no price set shows
 * "price on request" rather than a fabricated number.
 */
export async function ServiceGrid({
  services,
  locale,
}: {
  services: ServiceCard[];
  locale: string;
}) {
  const t = await getTranslations('services');
  const ar = locale === 'ar';

  if (services.length === 0) {
    return <p className="py-16 text-center text-ink-400">{t('noneAvailable')}</p>;
  }

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <div className="space-y-14">
      {categories.map((category) => (
        <section key={category}>
          <h2 className="text-xl text-ink-900">{category}</h2>
          <hr className="rule mt-3" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services
              .filter((s) => s.category === category)
              .map((s) => (
                <article key={s.id} className="card flex flex-col p-6">
                  <h3 className="text-lg text-ink-900">{ar ? s.name_ar : s.name_en}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                    {ar ? s.description_ar : s.description_en}
                  </p>
                  {s.type === 'car' && (
                    <p className="mt-3 text-xs text-gold-600">{t('includesDriver')}</p>
                  )}
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="text-sm text-ink-700">
                      <span className="block text-xs text-ink-400">{t('from')}</span>
                      <Money
                        minor={Number(s.base_price_minor)}
                        currency={s.currency}
                        locale={locale}
                        onRequestLabel={t('priceOnRequest')}
                      />
                      {Number(s.base_price_minor) > 0 && (
                        <span className="ms-1 text-xs text-ink-400">{t(PRICE_UNIT[s.type])}</span>
                      )}
                    </p>
                    <Link href={`/book/${s.slug}`} className="btn btn-outline btn-sm">
                      {t('viewOptions')}
                    </Link>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
