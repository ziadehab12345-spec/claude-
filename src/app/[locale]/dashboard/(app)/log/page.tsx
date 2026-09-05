import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listPublicServices } from '@/lib/services';
import { LogInquiryForm } from '@/components/dashboard/LogInquiryForm';

export const dynamic = 'force-dynamic';

export default async function LogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const services = await listPublicServices(db);

  return (
    <>
      <h1 className="text-2xl">{t('logInquiry')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">{t('logIntro')}</p>
      <div className="mt-8">
        <LogInquiryForm services={services} />
      </div>
    </>
  );
}
