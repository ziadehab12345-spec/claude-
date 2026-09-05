'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import type { UserRole } from '@/lib/schema';

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

/** Admin screen for staff accounts. Accounts are deactivated, never deleted. */
export function StaffManager({ users, currentUserId }: { users: StaffRow[]; currentUserId: string }) {
  const t = useTranslations('dashboard');
  const e = useTranslations('errors');
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function create(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const data = new FormData(form);
    const ok = await call('/api/admin/users', 'POST', {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      role: String(data.get('role') ?? 'staff'),
    });
    if (ok) form.reset();
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand-200 text-xs tracking-wide text-ink-400 uppercase">
              <th className="px-4 py-3 text-start font-semibold">{t('name')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('email')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('role')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-sand-100 last:border-0">
                <td className="px-4 py-3">
                  {u.name}
                  {!u.active && <span className="ms-2 text-xs text-ink-400">({t('inactive')})</span>}
                </td>
                <td className="px-4 py-3" dir="ltr">{u.email}</td>
                <td className="px-4 py-3">{u.role === 'admin' ? t('admin') : t('staffRole')}</td>
                <td className="flex flex-wrap gap-2 px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => {
                      const password = window.prompt(`${t('newPassword')} — ${t('passwordHint')}`);
                      if (password) void call(`/api/admin/users/${u.id}`, 'PATCH', { password });
                    }}
                  >
                    {t('newPassword')}
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => void call(`/api/admin/users/${u.id}`, 'PATCH', { active: !u.active })}
                    >
                      {u.active ? t('deactivate') : t('activate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="card mt-8 p-6">
        <h2 className="text-lg">{t('addStaff')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-name">{t('name')}</label>
            <input id="new-name" name="name" className="field" required minLength={2} />
          </div>
          <div>
            <label className="label" htmlFor="new-email">{t('email')}</label>
            <input id="new-email" name="email" type="email" dir="ltr" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="new-password">{t('password')}</label>
            <input
              id="new-password"
              name="password"
              type="password"
              dir="ltr"
              className="field"
              required
              minLength={12}
              autoComplete="new-password"
            />
            <p className="hint">{t('passwordHint')}</p>
          </div>
          <div>
            <label className="label" htmlFor="new-role">{t('role')}</label>
            <select id="new-role" name="role" className="field" defaultValue="staff">
              <option value="staff">{t('staffRole')}</option>
              <option value="admin">{t('admin')}</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary mt-5" disabled={busy}>
          {t('addStaff')}
        </button>
      </form>
    </>
  );
}
