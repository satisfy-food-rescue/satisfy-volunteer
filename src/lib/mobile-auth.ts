import "server-only";
// Bearer-token auth for the native app (src/app/api/mobile). Tokens are 32
// random bytes, base64url; only their SHA-256 is stored, in the Session table
// alongside the website's cookie sessions (client APP).
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Volunteer } from "@/generated/prisma/client";
import type { ApiFailure, MutationOk } from "@satisfy/core/api";
import { db } from "./db";
import { pkceChallenge } from "./oauth";
import { hashToken, newToken } from "./session";
import type { ActionResult } from "./volunteer-actions";

// Phones stay signed in while they are used: a session expires 180 days after
// it was last seen. lastSeenAt is written at most daily to keep reads cheap.
const SESSION_DAYS = 180;
const TOUCH_AFTER_MS = 24 * 3_600_000;
const DAY_MS = 86_400_000;

/** Starts a session and returns the raw token. It is never stored. */
export async function createMobileSession(volunteerId: string, userAgent: string | null): Promise<string> {
  const token = newToken();
  const now = new Date();
  await db.$transaction([
    db.session.create({
      data: { tokenHash: hashToken(token), volunteerId, client: "APP", expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS), userAgent: userAgent?.slice(0, 300) ?? null },
    }),
    db.volunteer.update({ where: { id: volunteerId }, data: { lastSignInAt: now } }),
  ]);
  return token;
}

function bearer(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

/** The volunteer behind the request's bearer token, or null when the token is
 *  missing, unknown or expired, or the volunteer is no longer active. */
export async function volunteerFromRequest(request: Request): Promise<Volunteer | null> {
  const token = bearer(request);
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { volunteer: true } });
  if (!session || session.client !== "APP") return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.volunteer.status !== "ACTIVE") return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_DAYS * DAY_MS) } });
  }
  return session.volunteer;
}

/** Ends the session behind the request's bearer token. */
export async function endMobileSession(request: Request): Promise<void> {
  const token = bearer(request);
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token), client: "APP" } });
}

// Google sign-in handoff ------------------------------------------------------
//
// The app opens /auth/google?app=<challenge> in the system browser. Google
// sends the browser back to the website, which redirects to the app's scheme
// with a one-time code. Another app could register the same scheme and catch
// that redirect, so the code only redeems with the verifier behind the
// challenge, which never left the app (PKCE, RFC 7636).

/** The address the system browser hands back to the native app. Must match
 *  the scheme in mobile/app.config.ts. */
export const APP_RETURN_URL = "satisfy://auth";
const APP_CODE_TTL_MS = 2 * 60_000;

export function appRedirect(params: Record<string, string>): string {
  return `${APP_RETURN_URL}?${new URLSearchParams(params).toString()}`;
}

export async function issueAppSignInCode(volunteerId: string, codeChallenge: string): Promise<string> {
  const code = newToken();
  await db.authToken.create({
    data: { tokenHash: hashToken(code), volunteerId, purpose: "APP_SIGN_IN", codeChallenge, expiresAt: new Date(Date.now() + APP_CODE_TTL_MS) },
  });
  return code;
}

/** Redeems a handoff code once. Null when it is unknown, used, expired, for
 *  someone no longer active, or the verifier does not match. */
export async function redeemAppSignInCode(code: string, verifier: string): Promise<Volunteer | null> {
  const token = await db.authToken.findUnique({ where: { tokenHash: hashToken(code) }, include: { volunteer: true } });
  if (!token || token.purpose !== "APP_SIGN_IN" || !token.codeChallenge) return null;
  // Claim it first, whatever happens next: a code is good for one attempt.
  const claim = await db.authToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claim.count === 0 || token.expiresAt <= new Date() || token.volunteer.status !== "ACTIVE") return null;
  const expected = Buffer.from(token.codeChallenge);
  const actual = Buffer.from(pkceChallenge(verifier));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return token.volunteer;
}

// Responses -------------------------------------------------------------------

/** JSON with the payload type checked against the contract at the call site. */
export function json<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function failure(status: number, error: string): Response {
  return json<ApiFailure>({ error }, status);
}

/** A shared volunteer action's result as the contract's MutationOk or failure. */
export function mutation(result: ActionResult): Response {
  if (result.ok) return json<MutationOk>({ message: result.message ?? "Done." });
  return failure(result.notFound ? 404 : 422, result.error);
}

class BadRequest extends Error {}

/** Parses a JSON body. Invalid JSON or a schema mismatch is a 400. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const raw = await request.text();
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new BadRequest();
  }
  return schema.parse(body);
}

// Handlers --------------------------------------------------------------------

type Context<P> = { params: Promise<P> };
type Handler<P> = (request: NextRequest, ctx: Context<P>) => Promise<Response>;

/** Error handling for every mobile route: validation is a 400, anything
 *  unexpected a logged 500 with a message the app can show. */
export function apiHandler<P = Record<string, never>>(fn: Handler<P>): Handler<P> {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (e instanceof z.ZodError || e instanceof BadRequest) return failure(400, "Please check the details and try again.");
      // The path is client-controlled, so it is an argument, never part of
      // console's format string (a "%s" in it would be interpreted).
      console.error("%s %s failed", request.method, request.nextUrl.pathname, e);
      return failure(500, "Something went wrong. Please try again.");
    }
  };
}

/** apiHandler for signed-in routes: a missing, unknown or expired token is a
 *  401, which signs the app out. */
export function mobileHandler<P = Record<string, never>>(
  fn: (me: Volunteer, request: NextRequest, ctx: Context<P>) => Promise<Response>,
): Handler<P> {
  return apiHandler<P>(async (request, ctx) => {
    const me = await volunteerFromRequest(request);
    if (!me) return failure(401, "Please sign in again.");
    return fn(me, request, ctx);
  });
}
