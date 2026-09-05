import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { listInquiries, countInquiries, inquiryCountsByStatus } from '@/lib/inquiries';
import { Link } from '@/i18n/routing';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { InquiryFilters } from '@/components/dashboard/InquiryFilters';
import { INQUIRY_STATUSES, type InquiryStatus } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function InboxPage({
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
  const st = await getTranslations('inquiryStatus');
  const src = await getTranslations('source');
  const ar = locale === 'ar';
  const page = Math.max(1, Number(q.page ?? 1) || 1);

  const filters = {
    status: q.status ? ([q.status] as InquiryStatus[]) : undefined,
    search: q.search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [inquiries, total, counts] = await Promise.all([
    listInquiries(db, filters),
    countInquiries(db, filters),
    inquiryCountsByStatus(db),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (p: number) => {
    const next = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    next.set('page', String(p));
    return `/dashboard?${next}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">{t('inbox')}</h1>
        <Link href="/dashboard/log" className="btn btn-primary btn-sm">{t('logInquiry')}</Link>
      </div>

      {/* Status counts double as one-click filters. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {INQUIRY_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard?status=${s}`}
            className={`rounded-[4px] border px-3 py-1.5 text-sm ${
              q.status === s ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-sand-200 bg-white text-ink-700'
            }`}
          >
            {st(s)} <span className="text-xs opacity-70">{counts[s]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <InquiryFilters />
      </div>

      {inquiries.length === 0 ? (
        <p className="card mt-6 p-10 text-center text-ink-400">{t('noResults')}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-xs tracking-wide text-ink-400 uppercase">
                <Th>{t('reference')}</Th>
                <Th>{t('customer')}</Th>
                <Th>{t('requestedService')}</Th>
                <Th>{t('preferredDates')}</Th>
                <Th>{t('filterStatus')}</Th>
                <Th>{t('source')}</Th>
                <Th>{t('received')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {inquiries.map((i) => (
                <tr key={i.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                  <Td><span dir="ltr" className="font-medium">{i.reference}</span></Td>
                  <Td>
                    <span className="block">{i.customer_name}</span>
                    <span dir="ltr" className="block text-xs text-ink-400">{i.customer_phone}</span>
                  </Td>
                  <Td>
                    {i.service_name_en
                      ? ar ? i.service_name_ar : i.service_name_en
                      : <span className="text-ink-400">{t('generalEnquiry')}</span>}
                  </Td>
                  <Td>
                    {i.preferred_start ? (
                      <span dir="ltr" className="whitespace-nowrap">
                        {i.preferred_start}{i.preferred_end ? ` → ${i.preferred_end}` : ''}
                      </span>
                    ) : (
                      <span className="text-ink-400">{t('notSpecified')}</span>
                    )}
                  </Td>
                  <Td><StatusBadge status={i.status} /></Td>
                  <Td><span className="text-xs text-ink-400">{src(i.source)}</span></Td>
                  <Td>
                    <time dir="ltr" className="text-xs text-ink-400" dateTime={new Date(i.created_at).toISOString()}>
                      {new Date(i.created_at).toISOString().slice(0, 10)}
                    </time>
                  </Td>
                  <Td>
                    <Link href={`/dashboard/inquiries/${i.id}`} className="btn btn-outline btn-sm">
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
        <nav className="mt-5 flex flex-wrap items-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageLink(p)}
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
