import { getTranslations, setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/lib/metadata';
import { OFFICE_PHONE_DISPLAY, telLink, whatsappLink } from '@/lib/contact';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const seo = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({
    locale,
    path: '/about',
    title: seo('aboutTitle'),
    description: seo('aboutDescription'),
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="text-4xl">{t('title')}</h1>
      <p className="mt-5 leading-relaxed text-ink-600">{t('body')}</p>
      <p className="mt-4 leading-relaxed text-ink-600">{t('body2')}</p>

      <hr className="rule my-10" />

      <h2 className="text-xl">{t('whyTitle')}</h2>
      <ul className="mt-5 space-y-3">
        {([1, 2, 3, 4] as const).map((n) => (
          <li key={n} className="flex gap-3 text-sm text-ink-700">
            <span aria-hidden className="text-gold-500">·</span>
            <span>{t(`why${n}`)}</span>
          </li>
        ))}
      </ul>

      <hr className="rule my-10" />

      <h2 className="text-xl">{t('contactTitle')}</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="text-ink-400">{t('phone')}</dt>
          <dd className="mt-1">
            <a href={telLink} dir="ltr" className="text-ink-900 underline decoration-gold-400 underline-offset-4">
              {OFFICE_PHONE_DISPLAY}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-ink-400">WhatsApp</dt>
          <dd className="mt-1">
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-900 underline decoration-gold-400 underline-offset-4"
            >
              {OFFICE_PHONE_DISPLAY}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-ink-400">{t('location')}</dt>
          <dd className="mt-1 text-ink-700">{t('hours')}</dd>
        </div>
      </dl>
    </div>
  );
}
