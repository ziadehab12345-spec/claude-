'use client';

import { useState, useMemo, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { formatMoney } from '@/lib/money';
import { addDays, countDays, todayInCairo } from '@/lib/dates';
import type { ServiceType } from '@/lib/schema';

interface AvailableUnit {
  id: string;
  identifier: string;
  label_en: string;
  label_ar: string;
}

interface AvailabilityResponse {
  priceMinor: number;
  availableCount: number;
  units: AvailableUnit[];
  service: { currency: string };
}

/**
 * The customer-facing booking flow.
 *
 * Availability is never computed here. The browser asks the server which units
 * are free and can only choose from that answer; the server checks again when
 * the booking is submitted, and the database checks a third time. A stale tab
 * cannot book a unit that was taken while it sat open.
 */
export function BookingFlow({
  slug,
  serviceType,
  serviceName,
  currency,
}: {
  slug: string;
  serviceType: ServiceType;
  serviceName: string;
  currency: string;
}) {
  const t = useTranslations('booking');
  const e = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const isFastTrack = serviceType === 'fasttrack';
  const isStay = serviceType === 'hotel' || serviceType === 'apartment';

  const today = todayInCairo();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [flightTime, setFlightTime] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [result, setResult] = useState<AvailabilityResponse | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fast Track occupies exactly one day, so the customer picks a flight date
  // and the range is derived. Everything else takes an explicit range.
  const effectiveEnd = isFastTrack && startDate ? addDays(startDate, 1) : endDate;

  const nights = useMemo(
    () => (startDate && effectiveEnd ? countDays(startDate, effectiveEnd) : 0),
    [startDate, effectiveEnd],
  );

  async function checkAvailability(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setUnitId(null);
    setResult(null);

    if (!startDate || !effectiveEnd) return;
    if (startDate < today) return setError(t('pastDate'));
    if (effectiveEnd <= startDate) return setError(t('endBeforeStart'));

    setChecking(true);
    try {
      const res = await fetch(
        `/api/availability?serviceSlug=${encodeURIComponent(slug)}&startDate=${startDate}&endDate=${effectiveEnd}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      setResult(body.data);
      if (body.data.units.length === 1) setUnitId(body.data.units[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setChecking(false);
    }
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!unitId) return;
    setError(null);
    setSubmitting(true);

    const form = new FormData(ev.currentTarget);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          customerName: String(form.get('customerName') ?? ''),
          customerPhone: String(form.get('customerPhone') ?? ''),
          customerEmail: String(form.get('customerEmail') ?? '') || null,
          notes: String(form.get('notes') ?? ''),
          startDate,
          endDate: effectiveEnd,
          flightTime: isFastTrack ? flightTime : null,
          flightNumber: isFastTrack ? flightNumber || null : null,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Someone else took it while this form was open. Re-check so the
          // customer sees the truth instead of a dead end.
          setResult(null);
          setUnitId(null);
          throw new Error(e('unavailable'));
        }
        if (res.status === 429) throw new Error(e('rateLimited'));
        throw new Error(body?.error?.message ?? e('generic'));
      }

      router.push(`/booking/${body.data.reference}?phone=${encodeURIComponent(String(form.get('customerPhone') ?? ''))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
      setSubmitting(false);
    }
  }

  const totalMinor = result?.priceMinor ?? 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        <form onSubmit={checkAvailability} className="card p-6">
          <h2 className="text-lg text-ink-900">{isFastTrack ? t('flightDate') : t('selectDates')}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="startDate">
                {isFastTrack ? t('flightDate') : isStay ? t('checkIn') : t('pickUp')}
              </label>
              <input
                id="startDate"
                type="date"
                className="field"
                min={today}
                value={startDate}
                onChange={(ev) => setStartDate(ev.target.value)}
                required
              />
            </div>

            {isFastTrack ? (
              <div>
                <label className="label" htmlFor="flightTime">{t('flightTime')}</label>
                <input
                  id="flightTime"
                  type="time"
                  className="field"
                  value={flightTime}
                  onChange={(ev) => setFlightTime(ev.target.value)}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="endDate">
                  {isStay ? t('checkOut') : t('dropOff')}
                </label>
                <input
                  id="endDate"
                  type="date"
                  className="field"
                  min={startDate ? addDays(startDate, 1) : addDays(today, 1)}
                  value={endDate}
                  onChange={(ev) => setEndDate(ev.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {isFastTrack && (
            <div className="mt-4">
              <label className="label" htmlFor="flightNumber">{t('flightNumber')}</label>
              <input
                id="flightNumber"
                type="text"
                className="field"
                value={flightNumber}
                onChange={(ev) => setFlightNumber(ev.target.value)}
                maxLength={20}
              />
              <p className="hint">{t('flightNumberHint')}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary mt-5" disabled={checking}>
            {checking ? t('searching') : t('search')}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </p>
        )}

        {result && result.units.length === 0 && (
          <p className="mt-6 rounded-[4px] border border-sand-300 bg-sand-100 p-4 text-sm text-ink-700">
            {t('noneForDates')}
          </p>
        )}

        {result && result.units.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg text-ink-900">{t('availableOptions')}</h2>
            <ul className="mt-4 space-y-2">
              {result.units.map((u) => {
                const label = (locale === 'ar' ? u.label_ar : u.label_en) || u.identifier;
                const selected = unitId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setUnitId(u.id)}
                      aria-pressed={selected}
                      className={`flex w-full items-center justify-between rounded-[4px] border p-4 text-start transition-colors ${
                        selected
                          ? 'border-gold-400 bg-gold-400/10'
                          : 'border-sand-200 bg-white hover:border-sand-300'
                      }`}
                    >
                      <span className="text-sm text-ink-900">{label}</span>
                      <span className="text-xs font-semibold tracking-wide text-gold-600 uppercase">
                        {selected ? t('selected') : t('select')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {unitId && (
          <form onSubmit={submit} className="card mt-8 p-6">
            <h2 className="text-lg text-ink-900">{t('yourDetails')}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="customerName">{t('name')}</label>
                <input id="customerName" name="customerName" className="field" required minLength={2} maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="customerPhone">{t('phone')}</label>
                <input id="customerPhone" name="customerPhone" type="tel" dir="ltr" className="field" required />
                <p className="hint">{t('phoneHint')}</p>
              </div>
              <div>
                <label className="label" htmlFor="customerEmail">{t('email')}</label>
                <input id="customerEmail" name="customerEmail" type="email" dir="ltr" className="field" />
                <p className="hint">{t('emailHint')}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="notes">{t('notes')}</label>
                <textarea id="notes" name="notes" rows={3} className="field" maxLength={2000} />
                <p className="hint">{t('notesHint')}</p>
              </div>
            </div>

            <button type="submit" className="btn btn-gold mt-6" disabled={submitting}>
              {submitting ? t('submitting') : t('submit')}
            </button>
          </form>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <p className="eyebrow">{t('summary')}</p>
          <h2 className="mt-2 text-lg text-ink-900">{serviceName}</h2>

          {startDate && (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">{isFastTrack ? t('flightDate') : t('startDate')}</dt>
                <dd dir="ltr">{startDate}</dd>
              </div>
              {!isFastTrack && effectiveEnd && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-400">{t('endDate')}</dt>
                  <dd dir="ltr">{effectiveEnd}</dd>
                </div>
              )}
              {isFastTrack && flightTime && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-400">{t('flightTime')}</dt>
                  <dd dir="ltr">{flightTime}</dd>
                </div>
              )}
              {!isFastTrack && nights > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-400">&nbsp;</dt>
                  <dd className="text-ink-600">{isStay ? t('nights', { count: nights }) : t('days', { count: nights })}</dd>
                </div>
              )}
            </dl>
          )}

          <hr className="rule my-4" />

          {totalMinor > 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-400">{t('total')}</span>
              <span className="font-display text-2xl text-ink-900">
                {formatMoney(totalMinor, currency, locale)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-ink-400">{t('priceNotSet')}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
