import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "./env";
import { KEEP_COOKIE, withSessionLength } from "./session-cookies";

// Pages anyone can open without signing in.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/health"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Refreshes the Supabase Auth session on each request, passes the new cookies
// on, and sends signed out visitors to the login page. This is the first gate.
// Role checks happen in the pages and in the database.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicEnv();
  const keepSignedIn = request.cookies.get(KEEP_COOKIE)?.value === "1";

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(
            name,
            value,
            withSessionLength(options, keepSignedIn),
          ),
        );
      },
    },
  });

  // Validates the token and refreshes it when needed. Do not add code
  // between creating the client and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    // Keep any refreshed session cookies on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && !isPublic(pathname)) return redirectTo("/login");
  if (signedIn && pathname === "/login") return redirectTo("/");

  return response;
}
