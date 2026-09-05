'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { INQUIRY_SOURCES } from '@/lib/schema';

interface ServiceOption {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
}

/** Records a request that arrived by phone or WhatsApp, so nothing lives only in a chat. */
export function LogInquiryForm({ services }: { services: ServiceOption[] }) {
  const t = useTranslations('dashboard');
  const r = useTranslations('request');
  const src = useTranslations('source');
  const e = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(ev.currentTarget);

    try {
      const res = await fetch('/api/staff/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: String(form.get('serviceId') ?? '') || null,
          customerName: String(form.get('customerName') ?? ''),
          customerPhone: String(form.get('customerPhone') ?? ''),
          customerEmail: String(form.get('customerEmail') ?? '') || null,
          country: String(form.get('country') ?? '') || null,
          preferredStart: String(form.get('preferredStart') ?? '') || null,
          preferredEnd: String(form.get('preferredEnd') ?? '') || null,
          partySize: form.get('partySize') ? Number(form.get('partySize')) : null,
          flightNumber: String(form.get('flightNumber') ?? '') || null,
          message: String(form.get('message') ?? ''),
          source: String(form.get('source') ?? 'phone'),
          staffNotes: String(form.get('staffNotes') ?? ''),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      router.push(`/dashboard/inquiries/${body.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-3xl p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="source">{t('source')}</label>
          <select id="source" name="source" className="field" defaultValue="phone">
            {INQUIRY_SOURCES.filter((s) => s !== 'website').map((s) => (
              <option key={s} value={s}>{src(s)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="serviceId">{t('requestedService')}</label>
          <select id="serviceId" name="serviceId" className="field" defaultValue="">
            <option value="">{t('generalEnquiry')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{ar ? s.name_ar : s.name_en}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="customerName">{r('name')}</label>
          <input id="customerName" name="customerName" className="field" required minLength={2} />
        </div>

        <div>
          <label className="label" htmlFor="customerPhone">{r('phone')}</label>
          <input id="customerPhone" name="customerPhone" type="tel" dir="ltr" className="field" required />
        </div>

        <div>
          <label className="label" htmlFor="customerEmail">{r('email')}</label>
          <input id="customerEmail" name="customerEmail" type="email" dir="ltr" className="field" />
        </div>

        <div>
          <label className="label" htmlFor="country">{t('country')}</label>
          <input id="country" name="country" className="field" maxLength={80} />
        </div>

        <div>
          <label className="label" htmlFor="partySize">{t('partySize')}</label>
          <input id="partySize" name="partySize" type="number" min={1} max={50} dir="ltr" className="field" />
        </div>

        <div>
          <label className="label" htmlFor="preferredStart">{r('startDate')}</label>
          <input id="preferredStart" name="preferredStart" type="date" className="field" />
        </div>

        <div>
          <label className="label" htmlFor="preferredEnd">{r('endDate')}</label>
          <input id="preferredEnd" name="preferredEnd" type="date" className="field" />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="flightNumber">{t('flightNumber')}</label>
          <input id="flightNumber" name="flightNumber" dir="ltr" className="field" maxLength={20} />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="message">{t('guestMessage')}</label>
          <textarea id="message" name="message" rows={3} className="field" maxLength={2000} />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="staffNotes">{t('staffNotes')}</label>
          <textarea id="staffNotes" name="staffNotes" rows={2} className="field" maxLength={2000} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary mt-6" disabled={busy}>
        {busy ? t('saving') : t('logInquiry')}
      </button>
    </form>
  );
}
