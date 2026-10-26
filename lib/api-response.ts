import { NextResponse } from 'next/server';
import { z, ZodError, type ZodType } from 'zod';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>) {
  try {
    const value = schema.parse(await request.json());
    return { data: value } as const;
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: apiError(
          400,
          'invalid_request',
          'The request contains invalid fields.',
          z.flattenError(error),
        ),
      } as const;
    }
    return {
      error: apiError(
        400,
        'invalid_json',
        'The request body must be valid JSON.',
      ),
    } as const;
  }
}

export async function requireApiUser() {
  if (!isSupabaseConfigured()) {
    return {
      error: apiError(
        503,
        'supabase_not_configured',
        'Supabase is not configured. The browser demo remains available until credentials are added.',
      ),
    } as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email =
    typeof data?.claims?.email === 'string'
      ? data.claims.email.toLowerCase()
      : '';

  if (error || !userId) {
    return {
      error: apiError(401, 'unauthorized', 'Sign in to continue.'),
    } as const;
  }

  if (!email) {
    return {
      error: apiError(
        403,
        'access_not_approved',
        'This account has not been approved.',
      ),
    } as const;
  }

  const { data: accessRequest, error: accessError } = await supabase
    .from('access_requests')
    .select('status')
    .eq('email', email)
    .maybeSingle();

  if (accessError) return { error: databaseError(accessError) } as const;
  if (accessRequest?.status !== 'approved') {
    return {
      error: apiError(
        403,
        'access_not_approved',
        'This account has not been approved.',
      ),
    } as const;
  }

  return { supabase, userId } as const;
}

export function databaseError(error: { message: string; code?: string }) {
  console.error('Database operation failed', {
    code: error.code,
    message: error.message,
  });
  return apiError(
    500,
    'database_error',
    'The request could not be completed. Please try again.',
  );
}
