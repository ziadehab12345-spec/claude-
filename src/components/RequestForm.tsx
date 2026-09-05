'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { whatsappLink, telLink, OFFICE_PHONE_DISPLAY } from '@/lib/contact';

interface ServiceOption {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  category_en: string;
  category_ar: string;
}

/**
 * The public request form.
 *
 * This is a request, not a reservation. Nothing here checks a calendar, holds a
 * date or quotes a price — the office does all of that by hand. The form's only
 * job is to capture enough for the office to call back, and to record it so a
 * guest who never opens WhatsApp is not lost.
 *
 * WhatsApp and phone sit beside the form throughout, because that is how most
 * guests actually prefer to reach the office.
 */
export function RequestForm({
  services,
  initialServiceSlug,
}: {
  services: ServiceOption[];
  initialServiceSlug?: string;
}) {
  const t = useTranslations('request');
  const e = useTranslations('errors');
  const locale = useLocale();
  const ar = locale === 'ar';

  const [serviceSlug, setServiceSlug] = useState(initialServiceSlug ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Grouped so a long catalogue stays navigable in the dropdown.
  const groups = [...new Set(services.map((s) => s.category_en))];

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);

    const form = new FormData(ev.currentTarget);
    const start = String(form.get('preferredStart') ?? '');
    const end = String(form.get('preferredEnd') ?? '');
    if (start && end && end < start) {
      setError(t('endBeforeStart'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: services.find((s) => s.slug === serviceSlug)?.id ?? null,
          customerName: String(form.get('customerName') ?? ''),
          customerPhone: String(form.get('customerPhone') ?? ''),
          customerEmail: String(form.get('customerEmail') ?? '') || null,
          country: String(form.get('country') ?? '') || null,
          preferredStart: start || null,
          preferredEnd: end || null,
          partySize: form.get('partySize') ? Number(form.get('partySize')) : null,
          flightNumber: String(form.get('flightNumber') ?? '') || null,
          message: String(form.get('message') ?? ''),
        }),
      });
      const body = await res.json();

      if (res.status === 429) throw new Error(e('rateLimited'));
      if (!res.ok) throw new Error(body?.error?.message ?? e('generic'));

      setReference(body.data.reference);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div className="card p-10 text-center">
        <span aria-hidden className="font-display text-5xl text-gold-400">✓</span>
        <h2 className="mt-4 text-2xl">{t('successTitle')}</h2>
        <p className="mt-3 text-ink-600">{t('successBody')}</p>

        <div className="mt-8 rounded-[4px] border border-gold-400/40 bg-gold-400/10 p-6">
          <p className="text-xs tracking-[0.16em] text-gold-600 uppercase">{t('reference')}</p>
          <p dir="ltr" className="mt-1 font-display text-3xl text-ink-900">{reference}</p>
        </div>

        <p className="mt-6 text-sm text-ink-600">{t('successWhatsapp')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a
            href={whatsappLink(reference)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gold"
          >
            {t('whatsappCta')}
          </a>
          <button type="button" className="btn btn-outline" onClick={() => setReference(null)}>
            {t('another')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <form onSubmit={submit} className="card p-6 sm:p-8">
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="service">{t('service')}</label>
            <select
              id="service"
              className="field"
              value={serviceSlug}
              onChange={(ev) => setServiceSlug(ev.target.value)}
            >
              <option value="">{t('servicePlaceholder')}</option>
              {groups.map((g) => (
                <optgroup
                  key={g}
                  label={ar ? services.find((s) => s.category_en === g)?.category_ar || g : g}
                >
                  {services
                    .filter((s) => s.category_en === g)
                    .map((s) => (
                      <option key={s.id} value={s.slug}>{ar ? s.name_ar : s.name_en}</option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
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

            <div>
              <label className="label" htmlFor="country">{t('country')}</label>
              <input id="country" name="country" className="field" maxLength={80} />
              <p className="hint">{t('countryHint')}</p>
            </div>

            <div>
              <label className="label" htmlFor="partySize">{t('partySize')}</label>
              <input id="partySize" name="partySize" type="number" min={1} max={50} dir="ltr" className="field" />
            </div>
          </div>

          <fieldset>
            <legend className="label">{t('dates')}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="hint" htmlFor="preferredStart">{t('startDate')}</label>
                <input id="preferredStart" name="preferredStart" type="date" className="field mt-1" />
              </div>
              <div>
                <label className="hint" htmlFor="preferredEnd">{t('endDate')}</label>
                <input id="preferredEnd" name="preferredEnd" type="date" className="field mt-1" />
              </div>
            </div>
            <p className="hint">{t('datesHint')}</p>
          </fieldset>

          <div>
            <label className="label" htmlFor="flightNumber">{t('flightNumber')}</label>
            <input id="flightNumber" name="flightNumber" dir="ltr" className="field" maxLength={20} />
            <p className="hint">{t('flightHint')}</p>
          </div>

          <div>
            <label className="label" htmlFor="message">{t('message')}</label>
            <textarea id="message" name="message" rows={4} className="field" maxLength={2000} />
            <p className="hint">{t('messageHint')}</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-gold mt-7" disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </button>
      </form>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <p className="eyebrow">{t('orWhatsapp')}</p>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gold mt-4 w-full"
          >
            {t('whatsappCta')}
          </a>
          <a href={telLink} className="btn btn-outline mt-3 w-full">{t('callCta')}</a>
          <p dir="ltr" className="mt-4 text-center text-sm text-ink-600">{OFFICE_PHONE_DISPLAY}</p>
        </div>
      </aside>
    </div>
  );
}
