import { setRequestLocale, getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/dashboard/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const brand = await getTranslations('brand');

  // Only same-origin paths are accepted, so ?next= cannot bounce a signed-in
  // staff member to another site.
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : `/${locale}/dashboard`;

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-display text-2xl">{brand('name')}</p>
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
