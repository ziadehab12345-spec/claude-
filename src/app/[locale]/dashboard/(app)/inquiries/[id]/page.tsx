import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { getInquiryById } from '@/lib/inquiries';
import { listAuditForEntity } from '@/lib/audit';
import { Link } from '@/i18n/routing';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { InquiryActions } from '@/components/dashboard/InquiryActions';

export const dynamic = 'force-dynamic';

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const inquiry = await getInquiryById(db, id);
  if (!inquiry) notFound();

  const audit = await listAuditForEntity(db, 'inquiry', id);
  const t = await getTranslations('dashboard');
  const src = await getTranslations('source');
  const r = await getTranslations('request');
  const ar = locale === 'ar';

  const serviceName = inquiry.service_name_en
    ? ar ? inquiry.service_name_ar : inquiry.service_name_en
    : inquiry.service_label || t('generalEnquiry');

  return (
    <>
      <Link href="/dashboard" className="text-sm text-ink-400 hover:text-ink-900">← {t('inbox')}</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl" dir="ltr">{inquiry.reference}</h1>
        <StatusBadge status={inquiry.status} />
        <span className="text-xs text-ink-400">{src(inquiry.source)}</span>
        {inquiry.handled_by_name && (
          <span className="text-xs text-ink-400">
            {t('handledBy')}: {inquiry.handled_by_name}
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg">{t('customer')}</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={r('name')} value={inquiry.customer_name} />
              <Field label={r('phone')} value={inquiry.customer_phone} ltr />
              <Field label={r('email')} value={inquiry.customer_email ?? '—'} ltr />
              <Field label={t('country')} value={inquiry.country ?? '—'} />
              <Field label={t("requestedService")} value={serviceName ?? t("generalEnquiry")} />
              <Field
                label={t('preferredDates')}
                value={
                  inquiry.preferred_start
                    ? `${inquiry.preferred_start}${inquiry.preferred_end ? ` → ${inquiry.preferred_end}` : ''}`
                    : t('notSpecified')
                }
                ltr={!!inquiry.preferred_start}
              />
              <Field label={t('partySize')} value={inquiry.party_size ? String(inquiry.party_size) : '—'} />
              <Field label={t('flightNumber')} value={inquiry.flight_number ?? '—'} ltr />
              <Field
                label={t('received')}
                value={new Date(inquiry.created_at).toISOString().replace('T', ' ').slice(0, 16)}
                ltr
              />
            </dl>

            {inquiry.message && (
              <div className="mt-6">
                <p className="label">{t('guestMessage')}</p>
                <p className="rounded-[4px] bg-sand-100 p-4 text-sm whitespace-pre-wrap text-ink-700">
                  {inquiry.message}
                </p>
              </div>
            )}
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
                      <time dir="ltr" dateTime={new Date(entry.created_at).toISOString()}>
                        {new Date(entry.created_at).toISOString().replace('T', ' ').slice(0, 16)}
                      </time>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <InquiryActions
          inquiryId={inquiry.id}
          reference={inquiry.reference}
          status={inquiry.status}
          staffNotes={inquiry.staff_notes}
          customerPhone={inquiry.customer_phone}
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
