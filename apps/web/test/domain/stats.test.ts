import { describe, expect, it } from "vitest";
import { STAT_FIELDS, utcDay } from "../../src/domain/stats.ts";

describe("product stats (spec §8.11)", () => {
  it("counts exactly the four fields of product_daily_stats", () => {
    expect([...STAT_FIELDS]).toEqual(["views", "demo_clicks", "outbound_clicks", "inquiries"]);
  });

  it("takes the day in UTC from an ISO string or a Date", () => {
    expect(utcDay("2026-10-05T23:59:59.999Z")).toBe("2026-10-05");
    expect(utcDay("2026-10-06T00:00:00.000Z")).toBe("2026-10-06");
    expect(utcDay(new Date("2026-10-05T17:30:00.000-07:00"))).toBe("2026-10-06");
  });

  it("rejects anything that is not a date", () => {
    expect(() => utcDay("not a date")).toThrow();
  });
});
