'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';

const STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;
const TYPES = ['fasttrack', 'car', 'hotel', 'apartment'] as const;

/** Filters are held in the URL so a staff member can bookmark or share a view. */
export function BookingFilters() {
  const t = useTranslations('dashboard');
  const s = useTranslations('status');
  const svc = useTranslations('services');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['search', 'status', 'serviceType', 'from', 'to']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    router.push(`${pathname}?${next}`);
  }

  return (
    <form onSubmit={apply} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-52 flex-1">
        <label className="label" htmlFor="search">{t('search')}</label>
        <input id="search" name="search" className="field" defaultValue={params.get('search') ?? ''} />
      </div>

      <div>
        <label className="label" htmlFor="status">{t('filterStatus')}</label>
        <select id="status" name="status" className="field" defaultValue={params.get('status') ?? ''}>
          <option value="">{t('filterAll')}</option>
          {STATUSES.map((v) => (
            <option key={v} value={v}>{s(v)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="serviceType">{t('filterService')}</label>
        <select id="serviceType" name="serviceType" className="field" defaultValue={params.get('serviceType') ?? ''}>
          <option value="">{t('filterAll')}</option>
          {TYPES.map((v) => (
            <option key={v} value={v}>{svc(v)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="from">{t('from')}</label>
        <input id="from" name="from" type="date" className="field" defaultValue={params.get('from') ?? ''} />
      </div>

      <div>
        <label className="label" htmlFor="to">{t('to')}</label>
        <input id="to" name="to" type="date" className="field" defaultValue={params.get('to') ?? ''} />
      </div>

      <button type="submit" className="btn btn-primary btn-sm">{t('apply')}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(pathname)}>
        {t('clear')}
      </button>
    </form>
  );
}
