import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Money } from '@/components/Money';
import type { ServiceHighlight, ServiceType } from '@/lib/schema';

export interface ServiceCard {
  id: string;
  slug: string;
  type: ServiceType;
  category_en: string;
  category_ar: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  highlights: ServiceHighlight[];
  image_url: string | null;
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

  // Group by the English key so grouping is stable across locales, but show
  // the heading in the reader's language.
  const categories = [...new Set(services.map((s) => s.category_en))];

  return (
    <div className="space-y-14">
      {categories.map((category) => {
        const inCategory = services.filter((s) => s.category_en === category);

        return (
          <section key={category}>
            <h2 className="text-xl text-ink-900">
              {ar ? inCategory[0]?.category_ar || category : category}
            </h2>
            <hr className="rule mt-3" />

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {inCategory.map((s) => (
                <article key={s.id} className="card flex flex-col overflow-hidden">
                  {s.image_url && (
                    <div className="relative aspect-[4/3] bg-sand-200">
                      <Image
                        src={s.image_url}
                        alt=""
                        fill
                        /*
                         * Three columns on desktop, two on tablet, one on a
                         * phone. Without this the browser downloads a
                         * full-width image for a third-width slot.
                         */
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg text-ink-900">{ar ? s.name_ar : s.name_en}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      {ar ? s.description_ar : s.description_en}
                    </p>

                    {s.highlights.length > 0 && (
                      <ul className="mt-4 flex-1 space-y-1.5">
                        {s.highlights.slice(0, 4).map((h, i) => (
                          <li key={i} className="flex gap-2 text-xs text-ink-600">
                            <span aria-hidden className="text-gold-500">·</span>
                            <span>{ar ? h.ar : h.en}</span>
                          </li>
                        ))}
                      </ul>
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
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
