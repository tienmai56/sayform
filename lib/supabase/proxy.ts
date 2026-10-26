import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';

const protectedPrefixes = [
  '/goals',
  '/practice',
  '/history',
  '/session',
  '/exercises',
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function copyAuthState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  let hasApprovedAccess = false;
  const shouldCheckAccess =
    isSignedIn &&
    (isProtectedPath(pathname) ||
      pathname === '/login' ||
      pathname === '/signin' ||
      pathname === '/');

  if (shouldCheckAccess) {
    const email =
      typeof data?.claims?.email === 'string'
        ? data.claims.email.toLowerCase()
        : '';
    if (email) {
      const { data: accessRequest } = await supabase
        .from('access_requests')
        .select('status')
        .eq('email', email)
        .maybeSingle();
      hasApprovedAccess = accessRequest?.status === 'approved';
    }
  }

  if (!isSignedIn && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return copyAuthState(response, NextResponse.redirect(loginUrl));
  }

  if (
    isSignedIn &&
    !hasApprovedAccess &&
    (isProtectedPath(pathname) || pathname === '/signin')
  ) {
    await supabase.auth.signOut({ scope: 'local' });
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/signin';
    signInUrl.search = '';
    signInUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    signInUrl.searchParams.set('error', 'Please request access first');
    return copyAuthState(response, NextResponse.redirect(signInUrl));
  }

  if (
    isSignedIn &&
    hasApprovedAccess &&
    (pathname === '/login' || pathname === '/signin')
  ) {
    const goalsUrl = request.nextUrl.clone();
    goalsUrl.pathname = '/goals';
    goalsUrl.search = '';
    return copyAuthState(response, NextResponse.redirect(goalsUrl));
  }

  if (isSignedIn && hasApprovedAccess && pathname === '/') {
    const goalsUrl = request.nextUrl.clone();
    goalsUrl.pathname = '/goals';
    return copyAuthState(response, NextResponse.redirect(goalsUrl));
  }

  return response;
}
