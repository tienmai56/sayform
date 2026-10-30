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
      'Coach matching requests are not available yet.',
    );
  }

  const parsed = await parseBody(request, accessRequestSchema);
  if ('error' in parsed) return parsed.error;

  const email = parsed.data.email.toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase.from('access_requests').insert({
    email,
    current_role: parsed.data.currentRole,
    company: parsed.data.company,
    coaching_goals: parsed.data.goals,
    speaking_challenges: parsed.data.challenges,
    session_budget: parsed.data.sessionBudget,
    request_type: 'coach_matching',
  });

  // Repeated requests should not reveal whether an email is already registered.
  if (error?.code === '23505') return NextResponse.json({ ok: true });
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    return apiError(503, 'coach_matching_unavailable', 'Coach matching requests are temporarily unavailable. Please try again later.');
  }
  if (error) return databaseError(error);

  return NextResponse.json({ ok: true }, { status: 201 });
}
