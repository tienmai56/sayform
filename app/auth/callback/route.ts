import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/goals';
}

function signInErrorUrl(origin: string, destination: string, message: string) {
  const signInUrl = new URL('/signin', origin);
  signInUrl.searchParams.set('next', destination);
  signInUrl.searchParams.set('error', message);
  return signInUrl;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = safeNext(url.searchParams.get('next'));

  if (isSupabaseConfigured() && code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const email = data.user?.email?.trim().toLowerCase() ?? '';
      const { data: accessRequest, error: accessError } = email
        ? await supabase
            .from('access_requests')
            .select('status')
            .eq('email', email)
            .maybeSingle()
        : { data: null, error: null };

      if (!accessError && accessRequest?.status === 'approved') {
        return NextResponse.redirect(new URL(destination, url.origin));
      }

      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.redirect(
        signInErrorUrl(
          url.origin,
          destination,
          'Please request access first',
        ),
      );
    }
  }

  return NextResponse.redirect(
    signInErrorUrl(
      url.origin,
      destination,
      'We could not complete sign-in. Please try again.',
    ),
  );
}
