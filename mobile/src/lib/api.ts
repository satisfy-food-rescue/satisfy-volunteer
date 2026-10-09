import type { ApiFailure } from "@satisfy/core/api";

import { API_URL } from "./config";

/** A failed request. `message` is written for the volunteer and safe to show. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const OFFLINE_MESSAGE = "Can't reach Satisfy right now. Check your connection and try again.";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(value: string | null) {
  token = value;
}

/** Called when a signed-in request comes back 401, e.g. the session expired. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal };

/** Calls /api/mobile{path} and returns the parsed JSON, or throws ApiError. */
export async function api<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  const sentToken = token;
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/mobile${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(sentToken && { Authorization: `Bearer ${sentToken}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
  const data: unknown = await response.json().catch(() => null);
  if (response.ok) return data as T;
  // Only sign out if the token that failed is still the current one.
  if (response.status === 401 && sentToken && sentToken === token) onUnauthorized?.();
  const message = (data as ApiFailure | null)?.error ?? `Something went wrong (${response.status}). Please try again.`;
  throw new ApiError(message, response.status);
}
