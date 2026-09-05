'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('dashboard');
  const e = useTranslations('errors');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(ev.currentTarget);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      });

      if (res.status === 429) throw new Error(e('rateLimited'));
      if (!res.ok) throw new Error(t('signInFailed'));

      // A full navigation, so the server renders the next page with the new
      // session cookie already in place.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : e('generic'));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-8">
      <h1 className="text-2xl">{t('signIn')}</h1>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">{t('email')}</label>
          <input id="email" name="email" type="email" dir="ltr" className="field" required autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('password')}</label>
          <input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            className="field"
            required
            autoComplete="current-password"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-[4px] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary mt-6 w-full" disabled={loading}>
        {loading ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
