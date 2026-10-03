import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/env.ts";
import { onLocalized } from "../../src/http/localized.ts";
import { localeMiddleware } from "../../src/i18n/middleware.ts";
import { testEnv } from "../helpers.ts";

function build() {
  const app = new Hono<AppEnv>();
  app.use("*", localeMiddleware);
  onLocalized(app, "get", "/", (c) => c.text(c.get("locale")));
  onLocalized(app, "get", "/x", (c) => c.text(c.get("locale")));
  return app;
}

describe("onLocalized", () => {
  const cases: [string, number, string?][] = [
    ["/", 200, "en"],
    ["/vi", 200, "vi"],
    ["/vi/", 200, "vi"],
    ["/zh-hans", 200, "zh-Hans"],
    ["/zh-hant/", 200, "zh-Hant"],
    ["/vi/x", 200, "vi"],
    ["/x", 200, "en"],
    ["/vietnam", 404],
  ];
  for (const [url, status, body] of cases) {
    it(`${url} -> ${status}`, async () => {
      const res = await build().request(url, {}, testEnv);
      expect(res.status).toBe(status);
      if (body) expect(await res.text()).toBe(body);
    });
  }
});
