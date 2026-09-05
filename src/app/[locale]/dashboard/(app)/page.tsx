import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listBookings, countBookings } from '@/lib/bookings';
import { Link } from '@/i18n/routing';
import { formatMoney } from '@/lib/money';
import { StatusBadge, PaymentBadge } from '@/components/dashboard/StatusBadge';
import { BookingFilters } from '@/components/dashboard/BookingFilters';
import type { BookingStatus, ServiceType } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const q = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const src = await getTranslations('source');
  const ar = locale === 'ar';
  const page = Math.max(1, Number(q.page ?? 1) || 1);

  const filters = {
    status: q.status ? ([q.status] as BookingStatus[]) : undefined,
    serviceType: q.serviceType as ServiceType | undefined,
    from: q.from,
    to: q.to,
    search: q.search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [bookings, total] = await Promise.all([
    listBookings(db, filters),
    countBookings(db, filters),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const queryFor = (p: number) => {
    const next = new URLSearchParams(
      Object.entries(q).filter(([, v]) => v) as [string, string][],
    );
    next.set('page', String(p));
    return `/dashboard?${next}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">{t('bookings')}</h1>
        <Link href="/dashboard/new" className="btn btn-primary btn-sm">{t('newBooking')}</Link>
      </div>

      <div className="mt-5">
        <BookingFilters />
      </div>

      {bookings.length === 0 ? (
        <p className="card mt-6 p-10 text-center text-ink-400">{t('noResults')}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-start text-xs tracking-wide text-ink-400 uppercase">
                <Th>{t('reference')}</Th>
                <Th>{t('customer')}</Th>
                <Th>{t('service')}</Th>
                <Th>{t('dates')}</Th>
                <Th>{t('filterStatus')}</Th>
                <Th>{t('paymentStatus')}</Th>
                <Th>{t('price')}</Th>
                <Th>{t('source')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                  <Td><span dir="ltr" className="font-medium">{b.reference}</span></Td>
                  <Td>
                    <span className="block">{b.customer_name}</span>
                    <span dir="ltr" className="block text-xs text-ink-400">{b.customer_phone}</span>
                  </Td>
                  <Td>{ar ? b.service_name_ar : b.service_name_en}</Td>
                  <Td>
                    <span dir="ltr" className="whitespace-nowrap">{b.start_date} → {b.end_date}</span>
                  </Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td><PaymentBadge status={b.payment_status} /></Td>
                  <Td>
                    {Number(b.price_minor) > 0
                      ? formatMoney(Number(b.price_minor), b.currency, locale)
                      : '—'}
                  </Td>
                  <Td><span className="text-xs text-ink-400">{src(b.source)}</span></Td>
                  <Td>
                    <Link href={`/dashboard/bookings/${b.id}`} className="btn btn-outline btn-sm">
                      {t('view')}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-5 flex items-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={queryFor(p)}
              className={`rounded-[4px] px-3 py-1 text-sm ${
                p === page ? 'bg-ink-900 text-sand-50' : 'bg-white text-ink-700 hover:bg-sand-200'
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-start font-semibold">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
