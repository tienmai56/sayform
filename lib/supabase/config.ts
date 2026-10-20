const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
      supabasePublishableKey &&
      !supabaseUrl.includes('your-project') &&
      !supabasePublishableKey.includes('your-publishable-key'),
  );
}

export function getSupabaseConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Add the public URL and publishable key to .env.local.');
  }

  return {
    url: supabaseUrl as string,
    publishableKey: supabasePublishableKey as string,
  };
}
