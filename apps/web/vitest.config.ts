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
          // wrangler.jsonc has no R2 binding until R2 is enabled (VNX-0711); tests keep an in-memory MEDIA bucket.
          r2Buckets: ["MEDIA"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_ORIGIN: "https://vnx.si",
            ADMIN_EMAILS: "owner@vnx.si",
            MAIL_DRIVER: "fake",
            // Pinned empty so a developer's .dev.vars key can never turn the suite into real mail (VNX-0803 F6).
            RESEND_API_KEY: "",
            TURNSTILE_DRIVER: "fake",
            OAUTH_DRIVER: "fake",
            // Pinned empty, like RESEND_API_KEY: a developer's .dev.vars credentials must never make the suite reach a real provider.
            GOOGLE_CLIENT_ID: "",
            GOOGLE_CLIENT_SECRET: "",
            LINKEDIN_CLIENT_ID: "",
            LINKEDIN_CLIENT_SECRET: "",
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
