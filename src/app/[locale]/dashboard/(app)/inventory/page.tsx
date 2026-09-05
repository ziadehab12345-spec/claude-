import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listAllServices } from '@/lib/services';
import { getSessionUser } from '@/lib/session';
import { InventoryManager } from '@/components/dashboard/InventoryManager';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSessionUser();
  if (session?.role !== 'admin') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('dashboard');
  const [services, units] = await Promise.all([
    listAllServices(db),
    db
      .selectFrom('units')
      .select(['id', 'service_id', 'identifier', 'label_en', 'active', 'attributes'])
      .orderBy('identifier', 'asc')
      .execute(),
  ]);

  return (
    <>
      <h1 className="text-2xl">{t('servicesTitle')}</h1>
      <div className="mt-8">
        <InventoryManager
          services={services.map((s) => ({
            ...s,
            base_price_minor: Number(s.base_price_minor),
            unit_count: Number(s.unit_count),
          }))}
          units={units}
        />
      </div>
    </>
  );
}
