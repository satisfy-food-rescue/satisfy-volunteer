import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPO_PUSH_URL, chunk, isExpoPushToken, sendExpoPush, type PushMessage } from "@/lib/expo-push";

const message: PushMessage = { title: "Cover needed", body: "Tomorrow 9am", data: { url: "/app/shifts/s1", kind: "LAST_MINUTE_CALLOUT" } };
const token = (i: number) => `ExponentPushToken[device-${i}]`;

type Sent = { to: string; title: string; body: string; sound: string; data: unknown }[];

/** A fake Expo endpoint: answers each message with the ticket `ticketFor` gives. */
function fakeExpo(ticketFor: (to: string) => object, status = 200) {
  const calls: { headers: Record<string, string>; body: Sent }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(url).toBe(EXPO_PUSH_URL);
    const body = JSON.parse(String(init?.body)) as Sent;
    calls.push({ headers: init?.headers as Record<string, string>, body });
    const json = status === 200 ? { data: body.map((m) => ticketFor(m.to)) } : { errors: [{ code: "INTERNAL_SERVER_ERROR", message: "down" }] };
    return new Response(JSON.stringify(json), { status });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("isExpoPushToken", () => {
  it("accepts Expo tokens in both spellings", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const t of ["", "ExponentPushToken[]", "ExponentPushToken[a b]", "fcm:abc", "ExponentPushToken[abc", " ExponentPushToken[abc]"]) {
      expect(isExpoPushToken(t)).toBe(false);
    }
  });
});

describe("chunk", () => {
  it("splits into runs of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("sendExpoPush", () => {
  it("sends at most 100 messages per request, each with sound and data", async () => {
    const expo = fakeExpo(() => ({ status: "ok", id: "t" }));
    const tokens = Array.from({ length: 250 }, (_, i) => token(i));
    const result = await sendExpoPush(tokens, message, { fetch: expo.fetch, accessToken: "" });
    expect(expo.calls.map((c) => c.body.length)).toEqual([100, 100, 50]);
    expect(expo.calls[0].body[0]).toEqual({ to: token(0), title: "Cover needed", body: "Tomorrow 9am", sound: "default", data: message.data });
    expect(result).toEqual({ delivered: tokens, unregistered: [] });
  });

  it("sends the access token only when one is set", async () => {
    const expo = fakeExpo(() => ({ status: "ok", id: "t" }));
    await sendExpoPush([token(1)], message, { fetch: expo.fetch, accessToken: "secret" });
    await sendExpoPush([token(1)], message, { fetch: expo.fetch, accessToken: "" });
    expect(expo.calls[0].headers.authorization).toBe("Bearer secret");
    expect(expo.calls[1].headers.authorization).toBeUndefined();
  });

  it("reports DeviceNotRegistered tokens for cleanup and logs other ticket errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const expo = fakeExpo((to) =>
      to === token(1)
        ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
        : to === token(2)
          ? { status: "error", message: "too big", details: { error: "MessageTooBig" } }
          : { status: "ok", id: "t" },
    );
    const result = await sendExpoPush([token(0), token(1), token(2)], message, { fetch: expo.fetch, accessToken: "" });
    expect(result).toEqual({ delivered: [token(0)], unregistered: [token(1)] });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain("too big");
  });

  it("never throws: a failed request is logged and the next chunk still goes", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let call = 0;
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (call++ === 0) throw new TypeError("network down");
      const body = JSON.parse(String(init?.body)) as Sent;
      return Response.json({ data: body.map(() => ({ status: "ok", id: "t" })) });
    }) as unknown as typeof globalThis.fetch;
    const tokens = Array.from({ length: 150 }, (_, i) => token(i));
    const result = await sendExpoPush(tokens, message, { fetch, accessToken: "" });
    expect(result.delivered).toEqual(tokens.slice(100));
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("logs a non-2xx response and delivers nothing from that chunk", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const expo = fakeExpo(() => ({}), 500);
    expect(await sendExpoPush([token(0)], message, { fetch: expo.fetch, accessToken: "" })).toEqual({ delivered: [], unregistered: [] });
    expect(error).toHaveBeenCalledTimes(1);
  });
});
