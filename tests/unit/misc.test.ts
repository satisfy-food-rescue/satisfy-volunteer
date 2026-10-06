import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { take, reset } from "@/lib/rate-limit";
import { deviceLabel } from "@/lib/webauthn";
import { normaliseEmail, sortRoles } from "@/lib/domain";

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("rejects any password for an account without one", async () => {
    expect(await verifyPassword("", null)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});

describe("rate limiting", () => {
  const limit = { limit: 3, windowMs: 1000 };

  it("allows up to the limit inside the window", () => {
    const key = `t:${Math.random()}`;
    expect([take(key, limit, 0), take(key, limit, 10), take(key, limit, 20), take(key, limit, 30)]).toEqual([true, true, true, false]);
  });

  it("frees up as attempts age out", () => {
    const key = `t:${Math.random()}`;
    take(key, limit, 0);
    take(key, limit, 1);
    take(key, limit, 2);
    expect(take(key, limit, 500)).toBe(false);
    expect(take(key, limit, 1001)).toBe(true);
  });

  it("can be reset after a success", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) take(key, limit, i);
    reset(key);
    expect(take(key, limit, 3)).toBe(true);
  });
});

describe("helpers", () => {
  it("normalises emails", () => {
    expect(normaliseEmail("  Margaret.Fairweather@Example.NZ ")).toBe("margaret.fairweather@example.nz");
  });

  it("orders and filters roles", () => {
    expect(sortRoles(["VOLUNTEER_DRIVER", "bogus", "WAREHOUSE", "WAREHOUSE"])).toEqual(["WAREHOUSE", "VOLUNTEER_DRIVER"]);
  });

  it("names devices for the passkey list", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("iPhone (Safari)");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Windows PC (Edge)");
    expect(deviceLabel(null)).toBe("This device");
  });
});
