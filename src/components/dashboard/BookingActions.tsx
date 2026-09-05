'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import type { BookingStatus, PaymentStatus, UserRole } from '@/lib/schema';
import { minorToMajor, majorToMinor } from '@/lib/money';

/**
 * Status actions and the editable fields on a booking.
 *
 * The buttons shown are the transitions the server actually allows, so the UI
 * cannot offer an action that will be rejected.
 */
export function BookingActions({
  bookingId,
  status,
  paymentStatus,
  paymentNotes,
  notes,
  priceMinor,
  role,
}: {
  bookingId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentNotes: string;
  notes: string;
  priceMinor: number;
  role: UserRole;
}) {
  const t = useTranslations('dashboard');
  const p = useTranslations('payment');
  const e = useTranslations('errors');
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [payment, setPayment] = useState<PaymentStatus>(paymentStatus);
  const [payNotes, setPayNotes] = useState(paymentNotes);
  const [internalNotes, setInternalNotes] = useState(notes);
  const [priceMajor, setPriceMajor] = useState(String(minorToMajor(priceMinor)));

  const transitions: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    cancelled: [],
    completed: [],
  };
  const editable = status === 'pending' || status === 'confirmed';

  async function changeStatus(to: BookingStatus) {
    if (to === 'cancelled' && !window.confirm(t('confirmCancel'))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/bookings/${bookingId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const payload: Record<string, unknown> = {
        paymentStatus: payment,
        paymentNotes: payNotes,
        notes: internalNotes,
      };
      if (role === 'admin') {
        const parsed = Number(priceMajor);
        if (Number.isFinite(parsed) && parsed >= 0) payload.priceMinor = majorToMinor(parsed);
      }

      const res = await fetch(`/api/staff/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      {transitions[status].length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {transitions[status].map((to) => (
            <button
              key={to}
              type="button"
              disabled={busy}
              onClick={() => changeStatus(to)}
              className={`btn btn-sm ${to === 'cancelled' ? 'btn-outline' : 'btn-primary'}`}
            >
              {to === 'confirmed' ? t('confirm') : to === 'cancelled' ? t('cancel') : t('complete')}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="payment">{t('paymentStatus')}</label>
          <select
            id="payment"
            className="field"
            value={payment}
            disabled={!editable}
            onChange={(ev) => setPayment(ev.target.value as PaymentStatus)}
          >
            {(['unpaid', 'partial', 'paid'] as const).map((v) => (
              <option key={v} value={v}>{p(v)}</option>
            ))}
          </select>
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
              disabled={!editable}
              onChange={(ev) => setPriceMajor(ev.target.value)}
            />
            <p className="hint">{t('priceOverrideHint')}</p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="payNotes">{t('paymentNotes')}</label>
          <textarea
            id="payNotes"
            rows={2}
            className="field"
            value={payNotes}
            disabled={!editable}
            onChange={(ev) => setPayNotes(ev.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="notes">{t('internalNotes')}</label>
          <textarea
            id="notes"
            rows={3}
            className="field"
            value={internalNotes}
            disabled={!editable}
            onChange={(ev) => setInternalNotes(ev.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && <p className="mt-4 text-sm text-success">{t('saved')}</p>}

      {editable && (
        <button type="button" className="btn btn-primary mt-5" disabled={busy} onClick={save}>
          {busy ? t('saving') : t('save')}
        </button>
      )}
    </div>
  );
}
