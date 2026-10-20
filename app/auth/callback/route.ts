import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/goals';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = safeNext(url.searchParams.get('next'));

  if (isSupabaseConfigured() && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }

  const loginUrl = new URL('/login', url.origin);
  loginUrl.searchParams.set('error', 'We could not complete sign-in. Please try again.');
  return NextResponse.redirect(loginUrl);
}
