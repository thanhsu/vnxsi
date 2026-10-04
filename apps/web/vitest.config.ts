import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // The pool bundles an older workerd than wrangler.jsonc's compatibility_date allows.
          compatibilityDate: "2026-08-01",
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_ORIGIN: "https://vnx.si",
            ADMIN_EMAILS: "owner@vnx.si",
            MAIL_DRIVER: "fake",
            TURNSTILE_DRIVER: "fake",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      include: ["test/**/*.test.{ts,tsx}"],
    },
  };
});
