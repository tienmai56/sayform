import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody } from '@/lib/api-response';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { accessRequestSchema } from '@/lib/validation';

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiError(
      503,
      'supabase_not_configured',
      'Access requests are not available yet.',
    );
  }

  const parsed = await parseBody(request, accessRequestSchema);
  if ('error' in parsed) return parsed.error;

  const email = parsed.data.email.toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase.from('access_requests').insert({
    email,
    target_roles: parsed.data.targetRoles,
  });

  // Repeated requests should not reveal whether an email is already registered.
  if (error?.code === '23505') return NextResponse.json({ ok: true });
  if (error) return databaseError(error);

  return NextResponse.json({ ok: true }, { status: 201 });
}
