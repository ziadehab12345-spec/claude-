'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import type { InquiryStatus } from '@/lib/schema';
import { whatsappLink } from '@/lib/contact';

/**
 * Follow-up controls for one request.
 *
 * Any status can follow any other. This is the office's to-do list, not a
 * state machine guarding money or inventory, so a request closed by mistake
 * reopens in one click.
 */
export function InquiryActions({
  inquiryId,
  reference,
  status,
  staffNotes,
  customerPhone,
}: {
  inquiryId: string;
  reference: string;
  status: InquiryStatus;
  staffNotes: string;
  customerPhone: string;
}) {
  const t = useTranslations('dashboard');
  const e = useTranslations('errors');
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState(staffNotes);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/staff/inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? e('generic'));
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setBusy(false);
    }
  }

  const actions: { to: InquiryStatus; label: string; primary?: boolean }[] =
    status === 'closed'
      ? [{ to: 'new', label: t('reopen') }]
      : [
          ...(status === 'new' ? [{ to: 'contacted' as const, label: t('markContacted'), primary: true }] : []),
          ...(status !== 'confirmed' ? [{ to: 'confirmed' as const, label: t('markConfirmed'), primary: status === 'contacted' }] : []),
          { to: 'closed' as const, label: t('markClosed') },
        ];

  return (
    <div className="card p-6">
      <a
        href={whatsappLink(reference)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-gold w-full"
      >
        {t('openWhatsapp')}
      </a>
      <a href={`tel:${customerPhone.replace(/\s/g, '')}`} className="btn btn-outline mt-3 w-full">
        {t('callGuest')}
      </a>

      <hr className="rule my-6" />

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            disabled={busy}
            onClick={() => void patch({ status: a.to })}
            className={`btn btn-sm ${a.primary ? 'btn-primary' : 'btn-outline'}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <label className="label" htmlFor="notes">{t('staffNotes')}</label>
        <textarea
          id="notes"
          rows={5}
          className="field"
          value={notes}
          maxLength={2000}
          onChange={(ev) => setNotes(ev.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && <p className="mt-4 text-sm text-success">{t('saved')}</p>}

      <button
        type="button"
        className="btn btn-primary mt-4 w-full"
        disabled={busy || notes === staffNotes}
        onClick={() => void patch({ staffNotes: notes })}
      >
        {busy ? t('saving') : t('save')}
      </button>
    </div>
  );
}
