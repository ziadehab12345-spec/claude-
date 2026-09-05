import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { SESSION_COOKIE, readSessionToken } from './lib/session-token';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Two jobs: resolve the locale for every page, and keep signed-out visitors out
 * of the dashboard.
 *
 * The middleware only verifies the cookie signature — it runs on the edge and
 * cannot reach Postgres. Every dashboard API route re-checks the account
 * against the database, so this is a redirect for convenience, not the
 * security boundary.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const dashboardMatch = pathname.match(/^\/(ar|en)\/dashboard(\/.*)?$/);
  if (dashboardMatch) {
    const locale = dashboardMatch[1]!;
    const isLoginPage = pathname === `/${locale}/dashboard/login`;
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const user = token ? await readSessionToken(token) : null;

    if (!user && !isLoginPage) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/dashboard/login`;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (user && isLoginPage) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/dashboard`;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
