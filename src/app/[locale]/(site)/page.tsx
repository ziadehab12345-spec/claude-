import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { whatsappLink } from '@/lib/contact';
import type { ServiceType } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const SERVICE_ROUTES: Record<ServiceType, string> = {
  fasttrack: '/fast-track',
  car: '/fleet',
  hotel: '/stays',
  apartment: '/stays',
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const s = await getTranslations('services');

  const services = await listPublicServices(db);
  const typesPresent = (['fasttrack', 'car', 'hotel', 'apartment'] as const).filter((type) =>
    services.some((svc) => svc.type === type),
  );

  return (
    <>
      <section className="relative overflow-hidden bg-ink-950 text-sand-50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(201,167,101,0.22), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(201,167,101,0.10), transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <h1 className="max-w-3xl text-4xl leading-tight sm:text-6xl">{t('heroTitle')}</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-200 sm:text-lg">
            {t('heroSubtitle')}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/fast-track" className="btn btn-gold">
              {t('heroCta')}
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-light"
            >
              {t('heroSecondary')}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl sm:text-4xl">{t('servicesTitle')}</h2>
        <p className="mt-3 max-w-xl text-ink-600">{t('servicesSubtitle')}</p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-[4px] border border-sand-200 bg-sand-200 sm:grid-cols-2">
          {typesPresent.map((type) => (
            <Link
              key={type}
              href={SERVICE_ROUTES[type]}
              className="group bg-white p-8 transition-colors hover:bg-sand-100"
            >
              <h3 className="text-xl text-ink-900">{s(type)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{s(`${type}Blurb`)}</p>
              <span className="mt-5 inline-block text-xs font-semibold tracking-[0.14em] text-gold-600 uppercase">
                {s('viewOptions')} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-sand-200 bg-sand-100">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:grid-cols-3">
          {(['Privacy', 'Bilingual', 'Family'] as const).map((k) => (
            <div key={k}>
              <h3 className="text-lg text-ink-900">{t(`trust${k}`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(`trust${k}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl">{t('howTitle')}</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n}>
              <span className="font-display text-4xl text-gold-400">{n}</span>
              <h3 className="mt-2 text-lg text-ink-900">{t(`howStep${n}`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{t(`howStep${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="card flex flex-col items-start gap-4 bg-ink-900 p-10 text-sand-50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl text-sand-50">{t('ctaTitle')}</h2>
            <p className="mt-1 text-sm text-ink-200">{t('ctaBody')}</p>
          </div>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gold shrink-0"
          >
            {t('heroSecondary')}
          </a>
        </div>
      </section>
    </>
  );
}
