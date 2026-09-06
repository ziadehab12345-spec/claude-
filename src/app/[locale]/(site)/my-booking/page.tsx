import { getTranslations, setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/lib/metadata';
import { BookingLookup } from '@/components/BookingLookup';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const seo = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({
    locale,
    path: '/my-booking',
    title: seo('lookupTitle'),
    description: seo('lookupDescription'),
  });
}

export default async function MyBookingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('lookup');

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="text-3xl">{t('title')}</h1>
      <p className="mt-3 text-ink-600">{t('body')}</p>
      <BookingLookup />
    </div>
  );
}
