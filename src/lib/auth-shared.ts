// Auth constants and pure helpers with no server dependencies, shared by the
// proxy (src/proxy.ts), server code and tests.

export const SESSION_COOKIE = "sfr_session";

/** Request header the proxy sets so server code knows the current path. */
export const PATH_HEADER = "x-sfr-path";

export const PASSWORD_MIN = 8;

/**
 * Only same-origin relative paths are allowed as post-sign-in destinations,
 * never an absolute or protocol-relative URL smuggled in through `?next=`.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  // Browsers strip tabs and newlines and treat "\" as "/", so "/\t/evil.com"
  // or "/\\evil.com" would become protocol-relative. Refuse control characters
  // and backslashes outright, then check the result stays on this origin.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  const base = "http://same.origin";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  return url.pathname + url.search + url.hash;
}

/** Where someone lands after signing in. Admins cannot be sent into the
 *  volunteer app by a stale `next`, and volunteers never into /admin. */
export function postSignInPath(role: "ADMIN" | "VOLUNTEER", next?: string | null): string {
  const home = role === "ADMIN" ? "/admin" : "/app";
  const safe = safeNextPath(next);
  if (!safe) return home;
  if (role !== "ADMIN" && safe.startsWith("/admin")) return home;
  return safe;
}
