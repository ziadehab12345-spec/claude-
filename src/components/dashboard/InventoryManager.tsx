'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { majorToMinor, minorToMajor } from '@/lib/money';
import type { ServiceType } from '@/lib/schema';

interface ServiceRow {
  id: string;
  type: ServiceType;
  slug: string;
  category: string;
  name_en: string;
  name_ar: string;
  base_price_minor: number;
  currency: string;
  active: boolean;
  unit_count: number;
}

interface UnitRow {
  id: string;
  service_id: string;
  identifier: string;
  label_en: string;
  active: boolean;
  attributes: Record<string, unknown>;
}

/**
 * Admin inventory: base prices and the units behind each service.
 *
 * Prices live only here. Nothing in the codebase hardcodes an amount, so this
 * screen is the single place a price can change.
 */
export function InventoryManager({
  services,
  units,
}: {
  services: ServiceRow[];
  units: UnitRow[];
}) {
  const t = useTranslations('dashboard');
  const e = useTranslations('errors');
  const svc = useTranslations('services');
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(services.map((s) => [s.id, String(minorToMajor(Number(s.base_price_minor)))])),
  );

  const missingPrices = services.filter((s) => Number(s.base_price_minor) <= 0).length;
  const placeholders = units.filter((u) => u.identifier.startsWith('PLACEHOLDER-')).length;

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? e('generic'));
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {(missingPrices > 0 || placeholders > 0) && (
        <div className="mb-6 space-y-2">
          {missingPrices > 0 && (
            <p className="rounded-[4px] border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {t('priceWarning', { count: missingPrices })}
            </p>
          )}
          {placeholders > 0 && (
            <p className="rounded-[4px] border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {t('placeholderWarning', { count: placeholders })}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {services.map((s) => {
          const serviceUnits = units.filter((u) => u.service_id === s.id);
          const open = openId === s.id;

          return (
            <section key={s.id} className="card">
              <div className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-48 flex-1">
                  <p className="text-sm text-ink-900">{ar ? s.name_ar : s.name_en}</p>
                  <p className="text-xs text-ink-400">
                    {svc(s.type)} · {s.category} · {serviceUnits.length} {t('unitsTitle')}
                  </p>
                </div>

                <div className="flex items-end gap-2">
                  <div>
                    <label className="label" htmlFor={`price-${s.id}`}>
                      {t('basePrice')} ({s.currency})
                    </label>
                    <input
                      id={`price-${s.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      dir="ltr"
                      className="field w-32"
                      value={prices[s.id] ?? ''}
                      onChange={(ev) => setPrices((p) => ({ ...p, [s.id]: ev.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => {
                      const value = Number(prices[s.id]);
                      if (!Number.isFinite(value) || value < 0) return;
                      void call(`/api/admin/services/${s.id}`, 'PATCH', {
                        basePriceMinor: majorToMinor(value),
                      });
                    }}
                  >
                    {t('save')}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => void call(`/api/admin/services/${s.id}`, 'PATCH', { active: !s.active })}
                >
                  {s.active ? t('deactivate') : t('activate')}
                </button>

                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(open ? null : s.id)}>
                  {t('unitsTitle')} {open ? '▲' : '▼'}
                </button>
              </div>

              {open && (
                <div className="border-t border-sand-200 p-4">
                  <ul className="space-y-2">
                    {serviceUnits.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-3 text-sm">
                        <span dir="ltr" className={u.identifier.startsWith('PLACEHOLDER-') ? 'text-warning' : ''}>
                          {u.identifier}
                        </span>
                        <span className="text-ink-400">{u.label_en}</span>
                        <span className={`text-xs ${u.active ? 'text-success' : 'text-ink-400'}`}>
                          {u.active ? t('active') : t('inactive')}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm ms-auto"
                          disabled={busy}
                          onClick={() => {
                            const next = window.prompt(t('identifier'), u.identifier);
                            if (next && next !== u.identifier) {
                              void call(`/api/admin/units/${u.id}`, 'PATCH', { identifier: next });
                            }
                          }}
                        >
                          {t('identifier')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busy}
                          onClick={() => void call(`/api/admin/units/${u.id}`, 'PATCH', { active: !u.active })}
                        >
                          {u.active ? t('deactivate') : t('activate')}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-4"
                    disabled={busy}
                    onClick={() => {
                      const identifier = window.prompt(t('identifier'));
                      if (identifier) {
                        void call('/api/admin/units', 'POST', {
                          serviceId: s.id,
                          identifier,
                          labelEn: `${s.name_en} — ${identifier}`,
                          labelAr: `${s.name_ar} — ${identifier}`,
                        });
                      }
                    }}
                  >
                    {t('addUnit')}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
