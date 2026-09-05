import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
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
}

/**
 * The catalogue grid, grouped by category.
 *
 * No prices appear anywhere: the office quotes each request itself, so the
 * card ends in a request button rather than a number.
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

  // Group by the English key so grouping is stable, show the reader's language.
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

            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {inCategory.map((s) => (
                <article key={s.id} className="card flex flex-col overflow-hidden">
                  {s.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={800}
                      height={600}
                      className="h-44 w-full bg-sand-200 object-cover"
                    />
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

                    <Link
                      href={`/request?service=${s.slug}`}
                      className="btn btn-outline btn-sm mt-6 self-start"
                    >
                      {t('requestThis')}
                    </Link>
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
