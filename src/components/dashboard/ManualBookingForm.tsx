'use client';

import { useState, useMemo, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { addDays, countDays } from '@/lib/dates';
import { majorToMinor, minorToMajor, formatMoney } from '@/lib/money';
import type { ServiceType, UserRole } from '@/lib/schema';

interface ServiceOption {
  id: string;
  slug: string;
  type: ServiceType;
  name_en: string;
  name_ar: string;
  currency: string;
}

interface AvailableUnit {
  id: string;
  identifier: string;
  label_en: string;
  label_ar: string;
}

/**
 * Manual entry for a booking taken by phone or WhatsApp.
 *
 * It calls exactly the same availability endpoint the public site calls and
 * posts to a staff endpoint that runs the same engine, so an office booking can
 * never double-book a unit that a website booking already holds.
 */
export function ManualBookingForm({
  services,
  role,
}: {
  services: ServiceOption[];
  role: UserRole;
}) {
  const t = useTranslations('dashboard');
  const b = useTranslations('booking');
  const e = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

  const [slug, setSlug] = useState(services[0]?.slug ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [flightTime, setFlightTime] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [units, setUnits] = useState<AvailableUnit[] | null>(null);
  const [unitId, setUnitId] = useState('');
  const [priceMajor, setPriceMajor] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(() => services.find((s) => s.slug === slug), [services, slug]);
  const isFastTrack = service?.type === 'fasttrack';
  const effectiveEnd = isFastTrack && startDate ? addDays(startDate, 1) : endDate;

  async function check(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setUnits(null);
    setUnitId('');
    if (!slug || !startDate || !effectiveEnd) return;

    setChecking(true);
    try {
      const res = await fetch(
        `/api/availability?serviceSlug=${encodeURIComponent(slug)}&startDate=${startDate}&endDate=${effectiveEnd}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      setUnits(body.data.units);
      if (body.data.units.length > 0) setUnitId(body.data.units[0].id);
      setPriceMajor(String(minorToMajor(body.data.priceMinor)));
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setChecking(false);
    }
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!unitId) return;
    setSubmitting(true);
    setError(null);

    const form = new FormData(ev.currentTarget);
    const payload: Record<string, unknown> = {
      unitId,
      customerName: String(form.get('customerName') ?? ''),
      customerPhone: String(form.get('customerPhone') ?? ''),
      customerEmail: String(form.get('customerEmail') ?? '') || null,
      notes: String(form.get('notes') ?? ''),
      paymentNotes: String(form.get('paymentNotes') ?? ''),
      startDate,
      endDate: effectiveEnd,
      flightTime: isFastTrack ? flightTime : null,
      flightNumber: isFastTrack ? flightNumber || null : null,
      status: form.get('markConfirmed') ? 'confirmed' : 'pending',
      paymentStatus: String(form.get('paymentStatus') ?? 'unpaid'),
    };

    // Only an admin may set a price; the server enforces this too.
    if (role === 'admin' && priceMajor !== '') {
      const parsed = Number(priceMajor);
      if (Number.isFinite(parsed) && parsed >= 0) payload.priceMinorOverride = majorToMinor(parsed);
    }

    try {
      const res = await fetch('/api/staff/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      router.push(`/dashboard/bookings/${body.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
      setSubmitting(false);
    }
  }

  const days = startDate && effectiveEnd ? countDays(startDate, effectiveEnd) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={check} className="card h-fit p-6">
        <h2 className="text-lg">{t('pickService')}</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="service">{t('service')}</label>
            <select id="service" className="field" value={slug} onChange={(ev) => setSlug(ev.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.slug}>{ar ? s.name_ar : s.name_en}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="start">{isFastTrack ? b('flightDate') : b('startDate')}</label>
              <input
                id="start"
                type="date"
                className="field"
                value={startDate}
                onChange={(ev) => setStartDate(ev.target.value)}
                required
              />
            </div>
            {isFastTrack ? (
              <div>
                <label className="label" htmlFor="ftime">{b('flightTime')}</label>
                <input
                  id="ftime"
                  type="time"
                  className="field"
                  value={flightTime}
                  onChange={(ev) => setFlightTime(ev.target.value)}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="end">{b('endDate')}</label>
                <input
                  id="end"
                  type="date"
                  className="field"
                  min={startDate ? addDays(startDate, 1) : undefined}
                  value={endDate}
                  onChange={(ev) => setEndDate(ev.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {isFastTrack && (
            <div>
              <label className="label" htmlFor="fnum">{b('flightNumber')}</label>
              <input
                id="fnum"
                className="field"
                value={flightNumber}
                onChange={(ev) => setFlightNumber(ev.target.value)}
                maxLength={20}
              />
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary mt-5" disabled={checking}>
          {checking ? b('searching') : b('search')}
        </button>

        {units && units.length === 0 && (
          <p className="mt-4 rounded-[4px] border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {t('noUnitsFree')}
          </p>
        )}
      </form>

      {units && units.length > 0 && (
        <form onSubmit={submit} className="card p-6">
          <h2 className="text-lg">{t('customerDetails')}</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="unit">{t('unit')}</label>
              <select id="unit" className="field" value={unitId} onChange={(ev) => setUnitId(ev.target.value)}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(ar ? u.label_ar : u.label_en) || u.identifier}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="cname">{b('name')}</label>
                <input id="cname" name="customerName" className="field" required minLength={2} />
              </div>
              <div>
                <label className="label" htmlFor="cphone">{b('phone')}</label>
                <input id="cphone" name="customerPhone" type="tel" dir="ltr" className="field" required />
              </div>
              <div>
                <label className="label" htmlFor="cemail">{b('email')}</label>
                <input id="cemail" name="customerEmail" type="email" dir="ltr" className="field" />
              </div>
            </div>

            {role === 'admin' && (
              <div>
                <label className="label" htmlFor="price">{t('priceOverride')}</label>
                <input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className="field"
                  value={priceMajor}
                  onChange={(ev) => setPriceMajor(ev.target.value)}
                />
                <p className="hint">{t('priceOverrideHint')}</p>
              </div>
            )}

            <div>
              <label className="label" htmlFor="pstatus">{t('paymentStatus')}</label>
              <select id="pstatus" name="paymentStatus" className="field" defaultValue="unpaid">
                <option value="unpaid">unpaid</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="pnotes">{t('paymentNotes')}</label>
              <input id="pnotes" name="paymentNotes" className="field" maxLength={2000} />
            </div>

            <div>
              <label className="label" htmlFor="mnotes">{t('internalNotes')}</label>
              <textarea id="mnotes" name="notes" rows={3} className="field" maxLength={2000} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="markConfirmed" defaultChecked />
              {t('markConfirmed')}
            </label>
          </div>

          {days > 0 && service && priceMajor !== '' && Number(priceMajor) > 0 && (
            <p className="mt-4 text-sm text-ink-600">
              {b('total')}: {formatMoney(majorToMinor(Number(priceMajor)), service.currency, locale)}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-gold mt-5" disabled={submitting}>
            {submitting ? b('submitting') : t('newBooking')}
          </button>
        </form>
      )}
    </div>
  );
}
