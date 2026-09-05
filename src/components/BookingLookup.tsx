'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatMoney } from '@/lib/money';

interface FoundBooking {
  reference: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  customerName: string;
  startDate: string;
  endDate: string;
  flightTime: string | null;
  serviceNameEn: string;
  serviceNameAr: string;
  priceMinor: number;
  currency: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
}

/** Lets a customer check their own booking with a reference plus phone number. */
export function BookingLookup() {
  const t = useTranslations('lookup');
  const s = useTranslations('status');
  const p = useTranslations('payment');
  const b = useTranslations('booking');
  const e = useTranslations('errors');
  const locale = useLocale();

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<FoundBooking | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    setBooking(null);

    const form = new FormData(ev.currentTarget);
    const query = new URLSearchParams({
      reference: String(form.get('reference') ?? ''),
      phone: String(form.get('phone') ?? ''),
    });

    try {
      const res = await fetch(`/api/bookings/lookup?${query}`);
      const body = await res.json();
      if (res.status === 404) throw new Error(t('notFound'));
      if (res.status === 429) throw new Error(e('rateLimited'));
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      setBooking(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="card mt-8 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reference">{t('reference')}</label>
            <input id="reference" name="reference" dir="ltr" className="field" required placeholder="AC-26000001" />
          </div>
          <div>
            <label className="label" htmlFor="phone">{t('phone')}</label>
            <input id="phone" name="phone" type="tel" dir="ltr" className="field" required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary mt-5" disabled={loading}>
          {loading ? b('searching') : t('submit')}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {booking && (
        <div className="card mt-6 p-6">
          <p className="eyebrow">{booking.reference}</p>
          <h2 className="mt-2 text-xl text-ink-900">
            {locale === 'ar' ? booking.serviceNameAr : booking.serviceNameEn}
          </h2>
          <dl className="mt-5 space-y-2 text-sm">
            <Row label={b('name')} value={booking.customerName} />
            <Row label={b('startDate')} value={booking.startDate} ltr />
            <Row label={b('endDate')} value={booking.endDate} ltr />
            {booking.flightTime && <Row label={b('flightTime')} value={booking.flightTime} ltr />}
            <Row label={t('title')} value={s(booking.status)} />
            <Row label={p(booking.paymentStatus)} value={p(booking.paymentStatus)} />
            {booking.priceMinor > 0 && (
              <Row label={b('total')} value={formatMoney(booking.priceMinor, booking.currency, locale)} />
            )}
          </dl>
        </div>
      )}
    </>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-sand-100 pb-2">
      <dt className="text-ink-400">{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}
