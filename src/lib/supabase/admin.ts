import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase client with the service role key. It bypasses Row Level Security,
// so use it only in server code, for work no signed-in user may do directly
// (for example writing sign-in events to the audit log).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin settings are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
