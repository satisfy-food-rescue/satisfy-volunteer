import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER, SESSION_COOKIE } from "@/lib/auth-shared";

// A cheap first gate for signed-in areas: no session cookie means straight to
// sign-in, keeping the destination so links in emails land where they point
// after signing in. Real validation happens in requireVolunteer/requireAdmin,
// which read the path header set here for the same reason.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = pathname + search;
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const forwarded = new Headers(request.headers);
  forwarded.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
