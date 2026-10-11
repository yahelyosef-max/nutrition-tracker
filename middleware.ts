import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "./lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/manifest.webmanifest", "/icon.svg", "/setup"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Missing configuration: show a readable page instead of crashing.
  if (!supabaseConfigured()) {
    if (path === "/setup") return NextResponse.next();
    const to = request.nextUrl.clone();
    to.pathname = "/setup";
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    if (!data.user && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      const to = request.nextUrl.clone();
      to.pathname = "/login";
      return NextResponse.redirect(to);
    }
  } catch {
    // Supabase unreachable or misconfigured: let pages handle it rather than failing every request.
    if (!PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      const to = request.nextUrl.clone();
      to.pathname = "/login";
      return NextResponse.redirect(to);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
