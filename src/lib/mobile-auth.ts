// Bearer-token auth for the native app (src/app/api/mobile). Tokens are
// 32 random bytes, base64url; only their SHA-256 is stored, in the same
// Session table shape as the production build, so this ports straight over.
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Volunteer } from "@/generated/prisma/client";
import type { ApiFailure, MutationOk } from "@satisfy/core/api";
import { db } from "./db";
import type { ActionResult } from "./volunteer-actions";

// Phones stay signed in while they are used: a session expires 180 days after
// it was last seen. lastSeenAt is written at most daily to keep reads cheap.
const SESSION_DAYS = 180;
const TOUCH_AFTER_MS = 24 * 3_600_000;
const DAY_MS = 86_400_000;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Starts a session and returns the raw token. It is never stored. */
export async function createMobileSession(volunteerId: string, userAgent: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { tokenHash: hashToken(token), volunteerId, expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS), userAgent: userAgent?.slice(0, 300) ?? null },
  });
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
  if (!session) return null;
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
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
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
      console.error(`${request.method} ${request.nextUrl.pathname} failed`, e);
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
