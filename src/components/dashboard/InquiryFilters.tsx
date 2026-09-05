'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { INQUIRY_STATUSES } from '@/lib/schema';

/** Filters live in the URL so a view can be bookmarked or shared. */
export function InquiryFilters() {
  const t = useTranslations('dashboard');
  const s = useTranslations('inquiryStatus');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['search', 'status']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    router.push(`${pathname}?${next}`);
  }

  return (
    <form onSubmit={apply} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-56 flex-1">
        <label className="label" htmlFor="search">{t('search')}</label>
        <input id="search" name="search" className="field" defaultValue={params.get('search') ?? ''} />
      </div>

      <div>
        <label className="label" htmlFor="status">{t('filterStatus')}</label>
        <select id="status" name="status" className="field" defaultValue={params.get('status') ?? ''}>
          <option value="">{t('filterAll')}</option>
          {INQUIRY_STATUSES.map((v) => (
            <option key={v} value={v}>{s(v)}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn-primary btn-sm">{t('apply')}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(pathname)}>
        {t('clear')}
      </button>
    </form>
  );
}
