import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function NotFound() {
  const t = await getTranslations('errors');
  const c = await getTranslations('confirmation');

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="text-center">
        <p className="font-display text-6xl text-gold-400">404</p>
        <p className="mt-3 text-ink-600">{t('notFound')}</p>
        <Link href="/" className="btn btn-outline mt-8">{c('backHome')}</Link>
      </div>
    </div>
  );
}
