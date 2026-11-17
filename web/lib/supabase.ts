import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser/read client with the publishable key. Row Level Security limits it to reading
// license_events. Null until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are
// set; callers then fall back to reading the contract directly.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey, { auth: { persistSession: false } }) : null;
