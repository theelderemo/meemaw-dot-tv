import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Convenience redirects only - the real auth boundary is the server-side
// getUser() check in each protected page / route handler (coding-standards.md).
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  // With Fluid compute, don't put this client in a global -
  // always create a new one per request (Supabase SSR guide).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // No-cache headers from @supabase/ssr - responses that set auth
          // cookies must never be CDN-cached, or sessions could leak.
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims() - a subtle
  // mistake here can log users out at random (Supabase SSR guide).
  const { data } = await supabase.auth.getClaims();

  const isAuthed = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // Any response we build ourselves must carry the refreshed auth cookies
  // from supabaseResponse, or browser and server fall out of sync. Cookies
  // only - supabaseResponse is a NextResponse.next() whose x-middleware-*
  // headers would make Next treat our response as "continue to the route".
  const withAuthCookies = (response: NextResponse): NextResponse => {
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  const redirectTo = (destination: string): NextResponse => {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    return withAuthCookies(NextResponse.redirect(url));
  };

  if (!isAuthed) {
    if (pathname.startsWith("/api")) {
      return withAuthCookies(
        NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
      );
    }
    if (
      pathname === "/" ||
      pathname.startsWith("/account") ||
      pathname.startsWith("/browse") ||
      pathname.startsWith("/movies") ||
      pathname.startsWith("/my-list") ||
      pathname.startsWith("/profiles") ||
      pathname.startsWith("/search") ||
      pathname.startsWith("/tv") ||
      pathname.startsWith("/watch")
    ) {
      return redirectTo("/login");
    }
  }

  if (isAuthed && (pathname === "/" || pathname.startsWith("/login"))) {
    return redirectTo("/browse");
  }

  // IMPORTANT: return supabaseResponse as-is (Supabase SSR guide) - replacing
  // it without copying its cookies would terminate sessions prematurely.
  return supabaseResponse;
}
