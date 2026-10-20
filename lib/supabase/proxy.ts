import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';

const protectedPrefixes = ['/goals', '/practice', '/history', '/session'];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  if (!isSignedIn && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return copyAuthState(response, NextResponse.redirect(loginUrl));
  }

  if (isSignedIn && request.nextUrl.pathname === '/login') {
    const goalsUrl = request.nextUrl.clone();
    goalsUrl.pathname = '/goals';
    goalsUrl.search = '';
    return copyAuthState(response, NextResponse.redirect(goalsUrl));
  }

  if (isSignedIn && request.nextUrl.pathname === '/') {
    const goalsUrl = request.nextUrl.clone();
    goalsUrl.pathname = '/goals';
    return copyAuthState(response, NextResponse.redirect(goalsUrl));
  }

  return response;
}
