import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
      APP_ORIGIN: string;
      ADMIN_EMAILS: string;
      MAIL_DRIVER: string;
    }
  }
}

export {};
