import { expect, it, vi } from "vitest";
import { testEnv } from "../helpers.ts";
const daily = vi.hoisted(() => ({ runDaily: vi.fn(async () => []) }));
const hourly = vi.hoisted(() => ({ runHourly: vi.fn(async () => []) }));
vi.mock("../../src/jobs/daily.ts", () => daily);
vi.mock("../../src/jobs/hourly.ts", () => hourly);

const call = async (cron: string) => {
  const worker = (await import("../../src/index.ts?test" as string)).default;
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
  await worker.scheduled?.({ cron, scheduledTime: Date.parse("2026-10-05T12:05:00.000Z"), noRetry() {} } as ScheduledController, testEnv, ctx);
  await Promise.all(pending); return pending;
};

it.each([["0 1 * * *", daily.runDaily], ["5 * * * *", hourly.runHourly]])("dispatches %s", async (cron, job) => { vi.clearAllMocks(); await call(cron); expect(job).toHaveBeenCalledWith(testEnv, new Date("2026-10-05T12:05:00.000Z")); });
it("warns and skips an unknown cron", async () => { vi.clearAllMocks(); const warn = vi.spyOn(console, "warn").mockImplementation(() => {}); expect(await call("17 * * * *")).toHaveLength(0); expect(daily.runDaily).not.toHaveBeenCalled(); expect(hourly.runHourly).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledWith(JSON.stringify({ job: "scheduler", event: "unknown_cron", cron: "17 * * * *" })); });
