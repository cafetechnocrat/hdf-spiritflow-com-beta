import type { CookieOptions } from "@supabase/ssr";

// "Keep Me Signed In" is remembered in this cookie. When it is present the
// sign-in lasts 8 hours. Without it the sign-in ends when the browser closes.
export const KEEP_COOKIE = "sf_keep";
export const KEEP_SECONDS = 8 * 60 * 60;

// Applies the session length to the cookies Supabase wants to set.
export function withSessionLength(
  options: CookieOptions,
  keepSignedIn: boolean,
): CookieOptions {
  // A cookie being deleted keeps its own expiry.
  if (options.maxAge === 0) return options;
  if (keepSignedIn) return { ...options, maxAge: KEEP_SECONDS };
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  void _maxAge;
  void _expires;
  return rest;
}
