import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { RequestForm } from '@/components/RequestForm';

export const dynamic = 'force-dynamic';

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale } = await params;
  const { service } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('request');
  const services = await listPublicServices(db);
  const preselected = services.some((s) => s.slug === service) ? service : undefined;

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <h1 className="text-4xl">{t('title')}</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-600">{t('intro')}</p>
      <div className="mt-10">
        <RequestForm services={services} initialServiceSlug={preselected} />
      </div>
    </div>
  );
}
