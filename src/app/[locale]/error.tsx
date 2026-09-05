'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Shown when a page throws. The message is deliberately generic — an internal
 * error string or SQL fragment must never reach a customer. The detail goes to
 * the server log instead.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const c = useTranslations('common');

  useEffect(() => {
    console.error('[page] unhandled error', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="text-center">
        <p className="text-ink-600">{t('generic')}</p>
        <button type="button" onClick={reset} className="btn btn-outline mt-6">
          {c('back')}
        </button>
      </div>
    </div>
  );
}
