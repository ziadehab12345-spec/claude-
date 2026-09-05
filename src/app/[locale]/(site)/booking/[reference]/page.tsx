import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { whatsappLink } from '@/lib/contact';

export const dynamic = 'force-dynamic';

/**
 * Confirmation page.
 *
 * It deliberately shows only the reference and the next steps, taken from the
 * URL. It does not look the booking up, so a stranger who guesses a reference
 * learns nothing about the customer. Full details live behind /my-booking,
 * which requires the phone number on the booking.
 */
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('confirmation');
  const nav = await getTranslations('nav');

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <div className="card p-10 text-center">
        <span aria-hidden className="font-display text-5xl text-gold-400">✓</span>
        <h1 className="mt-4 text-3xl">{t('title')}</h1>
        <p className="mt-3 text-ink-600">{t('body')}</p>

        <div className="mt-8 rounded-[4px] border border-gold-400/40 bg-gold-400/10 p-6">
          <p className="text-xs tracking-[0.16em] text-gold-600 uppercase">{t('reference')}</p>
          <p dir="ltr" className="mt-1 font-display text-3xl text-ink-900">
            {decodeURIComponent(reference)}
          </p>
        </div>

        <ol className="mt-8 space-y-3 text-start text-sm text-ink-600">
          <li className="flex gap-3"><span className="text-gold-500">1</span>{t('step1')}</li>
          <li className="flex gap-3"><span className="text-gold-500">2</span>{t('step2')}</li>
          <li className="flex gap-3"><span className="text-gold-500">3</span>{t('step3')}</li>
        </ol>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a
            href={whatsappLink(`${decodeURIComponent(reference)}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gold"
          >
            {t('contactUs')}
          </a>
          <Link href="/my-booking" className="btn btn-outline">{nav('myBooking')}</Link>
        </div>
      </div>
    </div>
  );
}
