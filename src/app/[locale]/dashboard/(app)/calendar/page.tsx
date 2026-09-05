import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { buildAvailabilityCalendar } from '@/lib/availability';
import { addDays, eachDate, todayInCairo } from '@/lib/dates';
import { Link } from '@/i18n/routing';
import type { ServiceType } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const TYPES: ServiceType[] = ['fasttrack', 'car', 'hotel', 'apartment'];
const DEFAULT_DAYS = 28;

/**
 * The unit-by-date availability grid.
 *
 * Rendered on the server from one pass over the bookings and blocks in the
 * window, so the office sees the same state the availability engine enforces.
 */
export default async function CalendarPage({
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
  const svc = await getTranslations('services');
  const ar = locale === 'ar';

  const from = q.from ?? todayInCairo();
  const days = Math.min(Math.max(Number(q.days ?? DEFAULT_DAYS) || DEFAULT_DAYS, 7), 90);
  const to = addDays(from, days);
  const serviceType = TYPES.includes(q.serviceType as ServiceType)
    ? (q.serviceType as ServiceType)
    : undefined;

  const rows = await buildAvailabilityCalendar(db, { from, to, serviceType });
  const dates = eachDate(from, to);

  const link = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { from, days: String(days), serviceType, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/dashboard/calendar?${p}`;
  };

  return (
    <>
      <h1 className="text-2xl">{t('calendar')}</h1>
      <p className="mt-2 text-sm text-ink-600">{t('calendarIntro')}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={link({ serviceType: undefined })} className={`btn btn-sm ${!serviceType ? 'btn-primary' : 'btn-outline'}`}>
          {t('filterAll')}
        </Link>
        {TYPES.map((type) => (
          <Link
            key={type}
            href={link({ serviceType: type })}
            className={`btn btn-sm ${serviceType === type ? 'btn-primary' : 'btn-outline'}`}
          >
            {svc(type)}
          </Link>
        ))}

        <span className="ms-auto flex items-center gap-2">
          <Link href={link({ from: addDays(from, -days) })} className="btn btn-ghost btn-sm">←</Link>
          <span dir="ltr" className="text-sm text-ink-600">{from} → {addDays(to, -1)}</span>
          <Link href={link({ from: addDays(from, days) })} className="btn btn-ghost btn-sm">→</Link>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-600">
        <Legend className="bg-white border-sand-300" label={t('legendAvailable')} />
        <Legend className="bg-warning/25 border-warning/50" label={t('legendPending')} />
        <Legend className="bg-success/25 border-success/50" label={t('legendConfirmed')} />
        <Legend className="bg-ink-400/25 border-ink-400/50" label={t('legendBlocked')} />
      </div>

      {rows.length === 0 ? (
        <p className="card mt-6 p-10 text-center text-ink-400">{t('noResults')}</p>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 min-w-44 border-b border-e border-sand-200 bg-white px-3 py-2 text-start">
                  {t('unit')}
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className="border-b border-sand-200 px-1 py-2 text-center font-normal text-ink-400"
                    dir="ltr"
                  >
                    <span className="block">{d.slice(8)}</span>
                    <span className="block text-[0.625rem]">{d.slice(5, 7)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unitId}>
                  <th className="sticky start-0 z-10 border-b border-e border-sand-200 bg-white px-3 py-2 text-start font-normal">
                    <span className="block text-ink-900">
                      {ar ? row.serviceNameAr : row.serviceNameEn}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-400" dir="ltr">
                      {row.identifier}
                    </span>
                  </th>
                  {row.cells.map((cell) => {
                    const style =
                      cell.state === 'blocked'
                        ? 'bg-ink-400/25'
                        : cell.state === 'booked'
                          ? cell.bookingStatus === 'confirmed'
                            ? 'bg-success/25'
                            : 'bg-warning/25'
                          : 'bg-white';
                    const title = cell.bookingReference
                      ? `${cell.bookingReference} · ${cell.customerName}`
                      : undefined;
                    return (
                      <td key={cell.date} className={`border-b border-e border-sand-100 p-0 ${style}`}>
                        {cell.bookingId ? (
                          <Link
                            href={`/dashboard/bookings/${cell.bookingId}`}
                            title={title}
                            className="block h-7 w-full"
                          >
                            <span className="sr-only">{title}</span>
                          </Link>
                        ) : (
                          <span className="block h-7 w-full" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-4 rounded-[2px] border ${className}`} />
      {label}
    </span>
  );
}
