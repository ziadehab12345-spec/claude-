'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import type { ServiceType } from '@/lib/schema';

interface ServiceRow {
  id: string;
  type: ServiceType;
  slug: string;
  name_en: string;
  name_ar: string;
  category_en: string;
  category_ar: string;
  active: boolean;
}

/**
 * Admin control over what the public site shows.
 *
 * There is nothing to price and nothing to count, so the only decision left is
 * whether a service appears at all — for example while a hotel partnership is
 * paused.
 */
export function ServiceVisibility({ services }: { services: ServiceRow[] }) {
  const t = useTranslations('dashboard');
  const svc = useTranslations('services');
  const e = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, active: boolean) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? e('generic'));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
    } finally {
      setBusy(null);
    }
  }

  const types = [...new Set(services.map((s) => s.type))];

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-8">
        {types.map((type) => (
          <section key={type}>
            <h2 className="text-lg text-ink-900">{svc(type)}</h2>
            <div className="card mt-3 divide-y divide-sand-100">
              {services
                .filter((s) => s.type === type)
                .map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-48 flex-1">
                      <p className="text-sm text-ink-900">{ar ? s.name_ar : s.name_en}</p>
                      <p className="text-xs text-ink-400">{ar ? s.category_ar : s.category_en}</p>
                    </div>
                    <span className={`text-xs ${s.active ? 'text-success' : 'text-ink-400'}`}>
                      {s.active ? t('visible') : t('hidden')}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy === s.id}
                      onClick={() => void toggle(s.id, !s.active)}
                    >
                      {s.active ? t('hide') : t('show')}
                    </button>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
