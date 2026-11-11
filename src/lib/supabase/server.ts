import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "./env";
import { KEEP_COOKIE, withSessionLength } from "./session-cookies";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Create a new client per request. Do not keep it in a global variable.
// Pass keepSignedIn when signing in, to choose the session length for that
// sign in. Otherwise the choice saved at sign in is used.
export async function createClient(options?: { keepSignedIn?: boolean }) {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();
  const keepSignedIn =
    options?.keepSignedIn ?? cookieStore.get(KEEP_COOKIE)?.value === "1";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
            cookieStore.set(
              name,
              value,
              withSessionLength(cookieOptions, keepSignedIn),
            ),
          );
        } catch {
          // Called from a Server Component, where cookies cannot be set.
          // The proxy refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}
