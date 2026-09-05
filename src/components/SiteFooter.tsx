import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { OFFICE_PHONE_DISPLAY, telLink, whatsappLink } from '@/lib/contact';

export function SiteFooter() {
  const t = useTranslations('nav');
  const about = useTranslations('about');
  const brand = useTranslations('brand');

  return (
    <footer className="mt-24 border-t border-ink-800 bg-ink-950 text-sand-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3">
        <div>
          <p className="font-display text-xl text-sand-50">{brand('name')}</p>
          <p className="mt-2 max-w-xs text-sm text-ink-400">{brand('office')}</p>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/fast-track" className="text-ink-200 hover:text-gold-300">{t('fastTrack')}</Link>
          <Link href="/fleet" className="text-ink-200 hover:text-gold-300">{t('fleet')}</Link>
          <Link href="/stays" className="text-ink-200 hover:text-gold-300">{t('stays')}</Link>
          <Link href="/my-booking" className="text-ink-200 hover:text-gold-300">{t('myBooking')}</Link>
          <Link href="/dashboard" className="text-ink-400 hover:text-gold-300">{t('dashboard')}</Link>
        </nav>

        <div className="text-sm">
          <p className="text-ink-400">{about('phone')}</p>
          <a href={telLink} dir="ltr" className="mt-1 block text-gold-300 hover:text-gold-400">
            {OFFICE_PHONE_DISPLAY}
          </a>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-ink-200 hover:text-gold-300"
          >
            WhatsApp
          </a>
          <p className="mt-4 text-ink-400">{about('location')}</p>
        </div>
      </div>
      <div className="border-t border-ink-800 px-5 py-5">
        <p className="mx-auto max-w-6xl text-xs text-ink-600">
          © {new Date().getFullYear()} {brand('name')}
        </p>
      </div>
    </footer>
  );
}
