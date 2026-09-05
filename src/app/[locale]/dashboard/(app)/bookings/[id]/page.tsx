import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { getBookingById } from '@/lib/bookings';
import { listAuditForEntity } from '@/lib/audit';
import { getSessionUser } from '@/lib/session';
import { formatMoney } from '@/lib/money';
import { countDays } from '@/lib/dates';
import { Link } from '@/i18n/routing';
import { StatusBadge, PaymentBadge } from '@/components/dashboard/StatusBadge';
import { BookingActions } from '@/components/dashboard/BookingActions';
import { whatsappLink } from '@/lib/contact';

export const dynamic = 'force-dynamic';

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const booking = await getBookingById(db, id);
  if (!booking) notFound();

  const [audit, session] = await Promise.all([
    listAuditForEntity(db, 'booking', id),
    getSessionUser(),
  ]);

  const t = await getTranslations('dashboard');
  const b = await getTranslations('booking');
  const src = await getTranslations('source');
  const ar = locale === 'ar';
  const days = countDays(booking.start_date, booking.end_date);

  return (
    <>
      <Link href="/dashboard" className="text-sm text-ink-400 hover:text-ink-900">← {t('bookings')}</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl" dir="ltr">{booking.reference}</h1>
        <StatusBadge status={booking.status} />
        <PaymentBadge status={booking.payment_status} />
        <span className="text-xs text-ink-400">{src(booking.source)}</span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg">{t('customerDetails')}</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={b('name')} value={booking.customer_name} />
              <Field label={b('phone')} value={booking.customer_phone} ltr />
              <Field label={b('email')} value={booking.customer_email ?? '—'} ltr />
              <Field
                label={t('service')}
                value={ar ? booking.service_name_ar : booking.service_name_en}
              />
              <Field label={t('unit')} value={booking.unit_identifier} ltr />
              <Field
                label={t('dates')}
                value={`${booking.start_date} → ${booking.end_date}`}
                ltr
              />
              <Field
                label={t('price')}
                value={
                  Number(booking.price_minor) > 0
                    ? `${formatMoney(Number(booking.price_minor), booking.currency, locale)}${
                        booking.price_overridden ? ' *' : ''
                      }`
                    : '—'
                }
              />
              <Field
                label={booking.service_type === 'car' ? b('days', { count: days }) : b('nights', { count: days })}
                value={String(days)}
              />
              {booking.flight_time && <Field label={b('flightTime')} value={booking.flight_time} ltr />}
              {booking.flight_number && <Field label={b('flightNumber')} value={booking.flight_number} ltr />}
            </dl>

            {booking.notes && (
              <div className="mt-5">
                <p className="label">{b('notes')}</p>
                <p className="text-sm whitespace-pre-wrap text-ink-700">{booking.notes}</p>
              </div>
            )}

            <a
              href={whatsappLink(booking.reference)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm mt-6"
            >
              WhatsApp
            </a>
          </section>

          <section className="card p-6">
            <h2 className="text-lg">{t('auditTitle')}</h2>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">{t('auditEmpty')}</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {audit.map((entry) => (
                  <li key={String(entry.id)} className="border-s-2 border-sand-200 ps-4 text-sm">
                    <p className="text-ink-900">{entry.action}</p>
                    <p className="text-xs text-ink-400">
                      {entry.actor_name ?? entry.actor_label} ·{' '}
                      <time dateTime={new Date(entry.created_at).toISOString()} dir="ltr">
                        {new Date(entry.created_at).toISOString().replace('T', ' ').slice(0, 16)}
                      </time>
                    </p>
                    <pre className="mt-1 overflow-x-auto text-xs text-ink-600" dir="ltr">
                      {JSON.stringify(entry.details)}
                    </pre>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <BookingActions
          bookingId={booking.id}
          status={booking.status}
          paymentStatus={booking.payment_status}
          paymentNotes={booking.payment_notes}
          notes={booking.notes}
          priceMinor={Number(booking.price_minor)}
          role={session?.role ?? 'staff'}
        />
      </div>
    </>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900" dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}
