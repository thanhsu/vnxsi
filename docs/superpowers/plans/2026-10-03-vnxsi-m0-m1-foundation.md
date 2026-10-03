# VNX.SI M0–M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

**Goal:** Chuyển `apps/web` từ Worker tĩnh + waitlist sang ứng dụng Hono có TypeScript, test trong workerd, CI, i18n 4 locale, layout JSX và đăng nhập bằng magic link, mà production không đổi.

**Architecture:**
- Một Worker `vnxsi-web` chạy Hono, render JSX phía server, dữ liệu trong D1.
- Module tách theo `docs/architecture/ARCHITECTURE.md` mục 2: `domain/` thuần, `db/` truy vấn, `routes/` ghép lại, `views/` chỉ trình bày.
- Mọi request không khớp route rơi về static assets, nên landing cũ ở `/` vẫn chạy cho tới M7.

**Tech Stack:**
- Node 22, TypeScript 5.9, Hono 4.13 (JSX), Zod 4.
- Wrangler 4, Vitest 4.1 + `@cloudflare/vitest-pool-workers` 0.22, D1.
- GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`. Cũng đọc `docs/roadmap/WAVE1-ROADMAP.md` (M0, M1), ADR-001, ADR-002, ADR-003.

## Global Constraints

- Mọi lệnh chạy từ gốc repo trừ khi ghi khác; code nằm trong `apps/web/`.
- Phiên bản pin:
  - `hono@^4.13.12`, `zod@^4.6.5`
  - `wrangler@^4.147.0`, `typescript@~5.9.3`
  - `vitest@~4.1.11`, `@cloudflare/vitest-pool-workers@^0.22.0`
  - Không dùng TypeScript 7.
  - Không thêm dependency nào khác.
- Locale: `en` (không tiền tố), `vi` (`/vi`), `zh-Hans` (`/zh-hans`), `zh-Hant` (`/zh-hant`). EN là chuẩn.
- ID là ULID; thời gian lưu ISO-8601 UTC; DB chỉ lưu SHA-256 của token và session id.
- **Magic link:**
  - Token 32 byte base64url (43 ký tự), sống 15 phút, dùng một lần.
  - Session cookie `__Host-vnx_session`: HttpOnly, Secure, SameSite=Lax, Path=/, sống 30 ngày.
- **Rate limit đăng nhập:** 5 lần/giờ mỗi email, 20 lần/giờ mỗi IP, đếm bằng bảng D1 `rate_limits`.
- Mọi request không phải GET/HEAD/OPTIONS phải có header `Origin` trùng origin của URL, nếu không trả 403.
- `src/domain/` không import `hono`, không import `src/db/`, không nhắc `D1Database`. `src/views/` không import `src/db/`.
- Không đổi hành vi `/api/waitlist` và không đổi `public/index.html`.
- Không deploy production trong plan này.

## Review Focus

1. **Token bị dùng lại hoặc dùng song song** (bấm link 2 lần, 2 tab): lần thứ hai phải thất bại, không tạo 2 session. Test ở Task 10.
2. **Email viết hoa hoặc có khoảng trắng** (`  Lan@Example.VN `): coi là cùng một user với `lan@example.vn`, cũng như khi so `ADMIN_EMAILS`. Test ở Task 11.
3. **Tham số `next` độc hại** (`//evil.com`, `https://evil.com`, `/\evil`): không redirect ra ngoài site. Test ở Task 11.
4. **Chuỗi người dùng chứa HTML** (`<script>` trong email hoặc trong văn bản thuần): luôn bị escape trong trang và trong email HTML. Test ở Task 5 và Task 9.
5. **Đường dẫn locale lạ** (`/vi`, `/vi/`, `/zh-hans/login`, `/ZH-HANS/login`, `/vietnam`): không nhận nhầm locale. `/vietnam` không phải `vi`. Chữ hoa không được coi là locale. Test ở Task 6.

---

### Task 1: VNX-0001 — Commit nền

**Files:** không tạo file mới; commit trạng thái hiện tại.

**Interfaces:**
- Consumes: không có.
- Produces: commit đầu tiên trên `main`, làm mốc cho mọi diff review sau này.

- [ ] **Step 1: Kiểm tra không có bí mật trong cây thư mục**

Run: `git status --porcelain && git check-ignore -v apps/web/.dev.vars .dev.vars || true`
Expected: danh sách file untracked; không có `.dev.vars` nào bị đưa vào (file đó gitignore hoặc không tồn tại).

Run: `grep -rIl --exclude-dir=node_modules --exclude-dir=.wrangler -E "re_[A-Za-z0-9]{20,}|sk-ant-|0x4AAAA" . || echo "no secrets found"`
Expected: `no secrets found`.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: baseline before marketplace pivot (landing, waitlist, docs)"
```

Expected: commit thành công; `git log --oneline` có đúng 1 dòng.

---

### Task 2: VNX-0002 — Toolchain TypeScript + Vitest trong workerd

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/test/apply-migrations.ts`
- Create: `apps/web/test/env.d.ts`
- Create (generated): `apps/web/worker-configuration.d.ts`
- Modify: `apps/web/test/waitlist.test.ts` (chuyển `node:test` sang Vitest)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `src/waitlist.ts` (`parseWaitlist`), `src/worker.ts` (`handleWaitlist`, `Env`). Các file này giữ nguyên ở task này.
- Produces:
  - Script `npm run typecheck -w apps/web` và `npm test` (Vitest).
  - Biến test `env.TEST_MIGRATIONS`.
  - Binding test: `APP_ORIGIN = "https://vnx.si"`, `ADMIN_EMAILS = "owner@vnx.si"`, `MAIL_DRIVER = "fake"`.

- [ ] **Step 1: Cài dependency**

```bash
npm install -w apps/web hono@^4.13.12 zod@^4.6.5
npm install -w apps/web -D typescript@~5.9.3 vitest@~4.1.11 @cloudflare/vitest-pool-workers@^0.22.0 wrangler@^4.147.0
```

Expected: `apps/web/package.json` có `dependencies` (hono, zod) và `devDependencies` (typescript, vitest, @cloudflare/vitest-pool-workers, wrangler).

- [ ] **Step 2: Sửa scripts trong `apps/web/package.json`**

Thay khối `"scripts"` bằng:

```json
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "cf:typegen": "wrangler types",
    "typecheck": "wrangler types && tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:local": "wrangler d1 migrations apply vnxsi --local",
    "db:migrate:remote": "wrangler d1 migrations apply vnxsi --remote"
  },
```

- [ ] **Step 3: Tạo `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "types": ["@cloudflare/vitest-pool-workers/types", "vite/client"]
  },
  "include": ["src", "test", "worker-configuration.d.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Tạo `apps/web/vitest.config.ts`**

```ts
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
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_ORIGIN: "https://vnx.si",
            ADMIN_EMAILS: "owner@vnx.si",
            MAIL_DRIVER: "fake",
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
```

Nếu `cloudflareTest` báo sai option, mở `node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.d.mts` và theo đúng `WorkersPoolOptions` ở đó. Ghi sai khác vào báo cáo.

- [ ] **Step 5: Tạo `apps/web/test/apply-migrations.ts` và `apps/web/test/env.d.ts`**

```ts
// apps/web/test/apply-migrations.ts
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

```ts
// apps/web/test/env.d.ts
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
```

- [ ] **Step 6: Sinh kiểu runtime và gitignore**

Run: `npm run cf:typegen -w apps/web`
Expected: tạo `apps/web/worker-configuration.d.ts` có `interface Env` chứa `DB: D1Database` và `ASSETS: Fetcher`.

Thêm vào cuối `.gitignore` ở gốc repo (file sinh ra được tạo lại trong CI):

```
apps/web/worker-configuration.d.ts
```

- [ ] **Step 7: Chuyển `apps/web/test/waitlist.test.ts` sang Vitest**

Thay toàn bộ file bằng:

```ts
import { describe, expect, it } from "vitest";
import { parseWaitlist } from "../src/waitlist.ts";
import { handleWaitlist, type Env } from "../src/worker.ts";

const valid = {
  email: "  Lan.Nguyen@Example.vn ",
  personas: ["developer", "tech-lead", "developer", "hacker"],
  consent: true,
  message: "Review merge requests and run the test suite before I look",
  spendBand: "20-100",
  utmSource: "facebook",
  lang: "vi",
};

describe("parseWaitlist", () => {
  it("normalizes email and filters personas", () => {
    const r = parseWaitlist(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.email).toBe("lan.nguyen@example.vn");
    expect(r.entry.personas).toEqual(["developer", "tech-lead"]);
    expect(r.entry.spendBand).toBe("20-100");
    expect(r.entry.utmSource).toBe("facebook");
    expect(r.entry.lang).toBe("vi");
  });

  it("unknown or missing lang falls back to en", () => {
    for (const lang of ["fr", undefined, 42]) {
      const r = parseWaitlist({ ...valid, lang });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.entry.lang).toBe("en");
    }
  });

  it("rejects bad email and missing consent", () => {
    expect(parseWaitlist({ ...valid, email: "not-an-email" }).ok).toBe(false);
    expect((parseWaitlist({ ...valid, consent: false }) as { field?: string }).field).toBe("consent");
  });

  it("personas are optional (coming-soon form sends none)", () => {
    for (const personas of [undefined, [], ["hacker", "user"]]) {
      const r = parseWaitlist({ ...valid, personas });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.entry.personas).toEqual([]);
    }
  });

  it("error messages follow lang", () => {
    const vi = parseWaitlist({ ...valid, email: "x" });
    const en = parseWaitlist({ ...valid, email: "x", lang: "en" });
    expect(vi.ok || en.ok).toBe(false);
    if (vi.ok || en.ok) return;
    expect(vi.error).toBe("Email chưa đúng định dạng.");
    expect(en.error).toBe("That email address doesn't look right.");
  });

  it("ignores unknown or legacy spend band and truncates message", () => {
    const r = parseWaitlist({ ...valid, spendBand: "1-10m", message: "x".repeat(5000) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.spendBand).toBeNull();
    expect(r.entry.message?.length).toBe(1000);
  });
});

function fakeEnv() {
  const calls: unknown[][] = [];
  const db = {
    prepare: () => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          calls.push(args);
          return { success: true };
        },
      }),
    }),
  };
  return { env: { DB: db } as unknown as Env, calls };
}

function post(body: unknown) {
  return new Request("https://vnx.si/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("handleWaitlist", () => {
  it("stores a valid signup with lang", async () => {
    const { env, calls } = fakeEnv();
    const res = await handleWaitlist(post(valid), env);
    expect(res.status).toBe(200);
    expect(calls.length).toBe(1);
    expect(calls[0]?.[0]).toBe("lan.nguyen@example.vn");
    expect(calls[0]?.[1]).toBe(JSON.stringify(["developer", "tech-lead"]));
    expect(calls[0]?.[10]).toBe("vi");
  });

  it("validation error is returned in the requested lang", async () => {
    const { env } = fakeEnv();
    const res = await handleWaitlist(post({ ...valid, consent: false, lang: "en" }), env);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; field: string };
    expect(data.field).toBe("consent");
    expect(data.error).toBe("Please agree so we can store your email.");
  });

  it("honeypot returns ok without storing", async () => {
    const { env, calls } = fakeEnv();
    const res = await handleWaitlist(post({ ...valid, website: "spam.example" }), env);
    expect(res.status).toBe(200);
    expect(calls.length).toBe(0);
  });

  it("invalid JSON and wrong method", async () => {
    const { env } = fakeEnv();
    expect((await handleWaitlist(post("{oops"), env)).status).toBe(400);
    expect((await handleWaitlist(new Request("https://vnx.si/api/waitlist"), env)).status).toBe(405);
  });
});
```

- [ ] **Step 8: Chạy test và typecheck**

Run: `npm test`
Expected: PASS, 10 test.

Run: `npm run typecheck -w apps/web`
Expected: không có lỗi. Nếu `src/worker.ts` báo lỗi kiểu do `Env` của nó trùng tên với `Env` toàn cục sinh ra, đổi tên interface trong `src/worker.ts` thành `WorkerEnv` và sửa import trong test tương ứng.

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/tsconfig.json apps/web/vitest.config.ts apps/web/test .gitignore
git commit -m "chore(web): add TypeScript, Vitest workers pool and port waitlist tests"
```

---

### Task 3: VNX-0003 — Khung app Hono + test kiến trúc

**Files:**
- Create: `apps/web/src/env.ts`
- Create: `apps/web/src/http/request-id.ts`
- Create: `apps/web/src/app.ts`
- Create: `apps/web/src/index.ts`
- Create: `apps/web/src/routes/waitlist.ts` (chuyển nội dung từ `src/worker.ts`)
- Delete: `apps/web/src/worker.ts`
- Modify: `apps/web/wrangler.jsonc`
- Modify: `apps/web/test/waitlist.test.ts:3` (import)
- Create: `apps/web/test/helpers.ts`
- Test: `apps/web/test/app.test.ts`, `apps/web/test/architecture.test.ts`

**Interfaces:**
- Consumes: `parseWaitlist`, `MESSAGES` từ `src/waitlist.ts`.
- Produces:
  - `Bindings` interface: `DB`, `ASSETS`, `APP_ORIGIN`, `ADMIN_EMAILS?`, `MAIL_DRIVER?`, `MAIL_FROM?`, `RESEND_API_KEY?`, `TURNSTILE_SECRET?`.
  - `AppEnv = { Bindings: Bindings; Variables: { requestId: string } }`.
  - `createApp(): Hono<AppEnv>`.
  - `handleWaitlist(request: Request, env: Pick<Bindings, "DB" | "TURNSTILE_SECRET">): Promise<Response>`.
  - Test helpers `testEnv: Bindings` và `formPost(path, fields, headers?)`.

- [ ] **Step 1: Viết test fail `apps/web/test/app.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { testEnv } from "./helpers.ts";

describe("app skeleton", () => {
  it("serves /api/health", async () => {
    const res = await createApp().request("https://vnx.si/api/health", {}, testEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns JSON 404 for unknown /api routes", async () => {
    const res = await createApp().request("https://vnx.si/api/nope", {}, testEnv);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Not found" });
  });

  it("keeps /api/waitlist validation behaviour", async () => {
    const res = await createApp().request(
      "https://vnx.si/api/waitlist",
      { method: "POST", headers: { "content-type": "application/json", origin: "https://vnx.si" }, body: "{oops" },
      testEnv,
    );
    expect(res.status).toBe(400);
  });

  it("falls back to static assets for unmatched paths", async () => {
    const res = await createApp().request("https://vnx.si/", {}, testEnv);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<html");
  });

  it("renders a 500 with a reference id when a handler throws", async () => {
    const app = createApp();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    const res = await app.request("https://vnx.si/boom", { headers: { "cf-ray": "ray-123" } }, testEnv);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("ray-123");
  });
});
```

- [ ] **Step 2: Tạo `apps/web/test/helpers.ts`**

```ts
import { env } from "cloudflare:workers";
import type { Bindings } from "../src/env.ts";

export const testEnv = env as unknown as Bindings;

export function formPost(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request(`https://vnx.si${path}`, {
    method: "POST",
    headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields),
  });
}
```

- [ ] **Step 3: Chạy test để thấy fail**

Run: `npm test -- test/app.test.ts`
Expected: FAIL với lỗi không tìm thấy `../src/app.ts`.

- [ ] **Step 4: Tạo `apps/web/src/env.ts`**

```ts
export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  ADMIN_EMAILS?: string;
  MAIL_DRIVER?: string;
  MAIL_FROM?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
  };
};
```

- [ ] **Step 5: Tạo `apps/web/src/http/request-id.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") ?? crypto.randomUUID());
  await next();
};
```

- [ ] **Step 6: Tạo `apps/web/src/routes/waitlist.ts`** (nội dung cũ của `src/worker.ts`, đổi kiểu `Env` sang `Bindings`)

```ts
import { MESSAGES, parseWaitlist, type WaitlistEntry } from "../waitlist.ts";
import type { Bindings } from "../env.ts";

type WaitlistEnv = Pick<Bindings, "DB" | "TURNSTILE_SECRET">;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function verifyTurnstile(secret: string, token: unknown, ip: string | null): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const outcome = (await res.json()) as { success?: boolean };
  return outcome.success === true;
}

export async function saveEntry(db: D1Database, entry: WaitlistEntry, country: string | null, now: string) {
  // Re-signing up merges personas and keeps the latest message instead of failing.
  await db
    .prepare(
      `INSERT INTO waitlist
         (email, personas, message, spend_band, consent_at, created_at, updated_at,
          referrer, utm_source, utm_medium, utm_campaign, country, lang)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT(email) DO UPDATE SET
         personas = excluded.personas,
         message = COALESCE(excluded.message, waitlist.message),
         spend_band = COALESCE(excluded.spend_band, waitlist.spend_band),
         consent_at = excluded.consent_at,
         lang = excluded.lang,
         updated_at = excluded.updated_at`,
    )
    .bind(
      entry.email,
      JSON.stringify(entry.personas),
      entry.message,
      entry.spendBand,
      now,
      entry.referrer,
      entry.utmSource,
      entry.utmMedium,
      entry.utmCampaign,
      country,
      entry.lang,
    )
    .run();
}

export async function handleWaitlist(request: Request, env: WaitlistEnv): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: MESSAGES.en.invalid }, 400);
  }

  const parsed = parseWaitlist(body);
  if (!parsed.ok) {
    // Pretend success to bots so they don't retry.
    if (parsed.field === "website") return json({ ok: true });
    return json({ ok: false, error: parsed.error, field: parsed.field }, 400);
  }

  if (env.TURNSTILE_SECRET) {
    const token = (body as Record<string, unknown>).turnstileToken;
    const passed = await verifyTurnstile(env.TURNSTILE_SECRET, token, request.headers.get("cf-connecting-ip"));
    if (!passed) return json({ ok: false, error: MESSAGES[parsed.entry.lang].human }, 403);
  }

  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;
  await saveEntry(env.DB, parsed.entry, country, new Date().toISOString());
  return json({ ok: true });
}
```

Xóa `apps/web/src/worker.ts`. Trong `apps/web/test/waitlist.test.ts` thay dòng import thứ 3 và kiểu `Env`:

```ts
import { handleWaitlist } from "../src/routes/waitlist.ts";
import type { Bindings as Env } from "../src/env.ts";
```

- [ ] **Step 7: Tạo `apps/web/src/app.ts`**

```ts
import { Hono } from "hono";
import type { AppEnv } from "./env.ts";
import { requestId } from "./http/request-id.ts";
import { handleWaitlist } from "./routes/waitlist.ts";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.all("/api/waitlist", (c) => handleWaitlist(c.req.raw, c.env));
  app.all("/api/*", (c) => c.json({ ok: false, error: "Not found" }, 404));

  app.onError((err, c) => {
    const id = c.get("requestId");
    console.error(JSON.stringify({ requestId: id, path: c.req.path, error: String(err) }));
    if (c.req.path.startsWith("/api/")) return c.json({ ok: false, error: "Internal error", requestId: id }, 500);
    return c.text(`Something went wrong. Reference: ${id}`, 500);
  });

  app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}
```

- [ ] **Step 8: Tạo `apps/web/src/index.ts`**

```ts
import { createApp } from "./app.ts";
import type { Bindings } from "./env.ts";

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Bindings>;
```

- [ ] **Step 9: Sửa `apps/web/wrangler.jsonc`**

Thay toàn bộ file bằng (giữ nguyên `database_id` và routes):

```jsonc
{
  // vnxsi-web: Hono app + static assets on one Worker (ADR-001).
  "name": "vnxsi-web",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    // Every request reaches Hono first; unmatched paths fall back to ASSETS (app.notFound).
    "run_worker_first": true
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "vnxsi",
      "database_id": "40caf091-7723-4278-9f46-c07069440e73",
      "migrations_dir": "migrations"
    }
  ],
  "vars": {
    // Used to build absolute links in emails.
    "APP_ORIGIN": "https://vnx.si"
  },
  "workers_dev": true,
  "routes": [
    { "pattern": "vnx.si", "custom_domain": true },
    { "pattern": "www.vnx.si", "custom_domain": true }
  ],
  "observability": { "enabled": true }
  // Secrets (wrangler secret put …): TURNSTILE_SECRET, RESEND_API_KEY, ADMIN_EMAILS.
  // Optional var: MAIL_FROM (default "VNX.SI <noreply@vnx.si>").
}
```

- [ ] **Step 10: Viết test kiến trúc `apps/web/test/architecture.test.ts`**

```ts
import { describe, expect, it } from "vitest";

const domain = import.meta.glob("../src/domain/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const views = import.meta.glob("../src/views/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("module boundaries (ARCHITECTURE.md §2)", () => {
  it("domain/ imports neither hono nor db and never touches D1", () => {
    for (const [file, src] of Object.entries(domain)) {
      expect(src, file).not.toMatch(/from\s+["']hono(\/[^"']*)?["']/);
      expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\/[^"']*["']/);
      expect(src, file).not.toMatch(/D1Database/);
    }
  });

  it("views/ never import db", () => {
    for (const [file, src] of Object.entries(views)) {
      expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\/[^"']*["']/);
    }
  });
});
```

- [ ] **Step 11: Chạy toàn bộ test và typecheck**

Run: `npm test`
Expected: PASS, gồm 5 test app, 2 test kiến trúc, 10 test waitlist.

Run: `npm run typecheck -w apps/web`
Expected: không có lỗi.

- [ ] **Step 12: Kiểm tay ở máy local**

Run: `npm run dev` (dừng bằng Ctrl+C sau khi kiểm)
- `curl -s localhost:8787/api/health` → `{"ok":true}`.
- `curl -s localhost:8787/ | head -5` → HTML của landing cũ.

- [ ] **Step 13: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): Hono app skeleton with asset fallback and architecture test"
```

---

### Task 4: VNX-0004 — CI và security CI

**Files:**
- Create: `.github/workflows/web-ci.yml`
- Create: `.github/workflows/security-ci.yml`

**Interfaces:**
- Consumes: `npm run typecheck -w apps/web`, `npm test`.
- Produces: 2 workflow, chạy khi push lên `main` và khi có pull request.

- [ ] **Step 1: Tạo `.github/workflows/web-ci.yml`**

```yaml
name: web-ci
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck -w apps/web
      - run: npm test
```

- [ ] **Step 2: Tạo `.github/workflows/security-ci.yml`**

```yaml
name: security-ci
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
  pull-requests: read
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: moderate
```

- [ ] **Step 3: Kiểm cú pháp YAML ở máy local**

Run: `node -e "for (const f of ['web-ci','security-ci']) { const s=require('fs').readFileSync('.github/workflows/'+f+'.yml','utf8'); if(!/^name: /m.test(s)||/\t/.test(s)) throw new Error(f); } console.log('ok')"`
Expected: `ok`.

Repo chưa có remote GitHub. Hai workflow này chạy lần đầu khi Owner push. Ghi vào báo cáo là chưa kiểm được trên GitHub.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: add web test workflow and security scanning"
```

---

### Task 5: VNX-0101 — ULID và render văn bản thuần

**Files:**
- Create: `apps/web/src/lib/ulid.ts`
- Create: `apps/web/src/domain/text.ts`
- Test: `apps/web/test/lib/ulid.test.ts`, `apps/web/test/domain/text.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `ulid(now?: number, random?: (n: number) => Uint8Array): string`: 26 ký tự Crockford base32, 10 ký tự đầu là thời gian.
  - `type TextBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] }`.
  - `parsePlainText(input: string): TextBlock[]`.

- [ ] **Step 1: Viết test fail**

```ts
// apps/web/test/lib/ulid.test.ts
import { describe, expect, it } from "vitest";
import { ulid } from "../../src/lib/ulid.ts";

const zeros = (n: number) => new Uint8Array(n);

describe("ulid", () => {
  it("is 26 Crockford base32 characters", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("sorts by time", () => {
    expect(ulid(1_000, zeros) < ulid(2_000, zeros)).toBe(true);
    expect(ulid(1_700_000_000_000, zeros).slice(0, 10)).toBe("01HF7YAT00");
  });

  it("differs between calls in the same millisecond", () => {
    expect(ulid(5)).not.toBe(ulid(5));
  });
});
```

```ts
// apps/web/test/domain/text.test.ts
import { describe, expect, it } from "vitest";
import { parsePlainText } from "../../src/domain/text.ts";

describe("parsePlainText", () => {
  it("splits paragraphs on blank lines", () => {
    expect(parsePlainText("One\nline two\n\nSecond")).toEqual([
      { kind: "p", text: "One\nline two" },
      { kind: "p", text: "Second" },
    ]);
  });

  it("turns '- ' lines into a list and keeps surrounding text", () => {
    expect(parsePlainText("Intro\n- a\n- b\nOutro")).toEqual([
      { kind: "p", text: "Intro" },
      { kind: "ul", items: ["a", "b"] },
      { kind: "p", text: "Outro" },
    ]);
  });

  it("normalizes CRLF and ignores empty input", () => {
    expect(parsePlainText("a\r\n\r\nb")).toEqual([
      { kind: "p", text: "a" },
      { kind: "p", text: "b" },
    ]);
    expect(parsePlainText("  \n\n ")).toEqual([]);
  });

  it("keeps HTML as literal text (escaping happens at render)", () => {
    expect(parsePlainText("<script>x</script>")).toEqual([{ kind: "p", text: "<script>x</script>" }]);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/lib test/domain`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết code**

```ts
// apps/web/src/lib/ulid.ts
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function defaultRandom(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function ulid(now: number = Date.now(), random: (n: number) => Uint8Array = defaultRandom): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ENCODING.charAt(t % 32) + time;
    t = Math.floor(t / 32);
  }
  const bytes = random(16);
  let rand = "";
  for (let i = 0; i < 16; i++) rand += ENCODING.charAt((bytes[i] ?? 0) % 32);
  return time + rand;
}
```

```ts
// apps/web/src/domain/text.ts
export type TextBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const BULLET = /^\s*-\s+(.*)$/;

export function parsePlainText(input: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const paragraphs = input.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    let lines: string[] = [];
    let items: string[] = [];
    const flushLines = () => {
      if (lines.length) blocks.push({ kind: "p", text: lines.join("\n") });
      lines = [];
    };
    const flushItems = () => {
      if (items.length) blocks.push({ kind: "ul", items });
      items = [];
    };
    for (const raw of paragraph.split("\n")) {
      if (!raw.trim()) continue;
      const bullet = BULLET.exec(raw);
      if (bullet) {
        flushLines();
        items.push((bullet[1] ?? "").trim());
      } else {
        flushItems();
        lines.push(raw.trim());
      }
    }
    flushLines();
    flushItems();
  }
  return blocks;
}
```

- [ ] **Step 4: Chạy test**

Run: `npm test -- test/lib test/domain`
Expected: PASS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/src/domain apps/web/test/lib apps/web/test/domain
git commit -m "feat(web): add ULID generator and plain-text block parser"
```

---

### Task 6: VNX-0102 — i18n 4 locale

**Files:**
- Create: `apps/web/src/i18n/locales.ts`
- Create: `apps/web/src/i18n/messages/en.ts`, `vi.ts`, `zh-hans.ts`, `zh-hant.ts`
- Create: `apps/web/src/i18n/t.ts`
- Create: `apps/web/src/i18n/middleware.ts`
- Create: `apps/web/src/http/localized.ts`
- Modify: `apps/web/src/env.ts` (thêm `locale` vào `Variables`)
- Modify: `apps/web/src/app.ts` (gắn `localeMiddleware`)
- Test: `apps/web/test/i18n/locales.test.ts`, `apps/web/test/i18n/parity.test.ts`

**Interfaces:**
- Consumes: `AppEnv` (Task 3).
- Produces:
  - `LOCALES`, `type Locale`, `isLocale(v)`.
  - `localeFromPath(pathname): { locale: Locale; rest: string }`.
  - `localizedPath(locale, path): string`.
  - `alternates(origin, rest): { hreflang: string; href: string }[]`.
  - `LOCALE_LABEL: Record<Locale, string>`.
  - `type MessageKey`, `t(locale, key, params?)`, `translator(locale)`, `type Translate`.
  - `localeMiddleware`.
  - `onLocalized(app, method, path, ...handlers)`.

- [ ] **Step 1: Viết test fail**

```ts
// apps/web/test/i18n/locales.test.ts
import { describe, expect, it } from "vitest";
import { alternates, localeFromPath, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";

describe("locale paths", () => {
  it("detects locale prefixes exactly", () => {
    expect(localeFromPath("/")).toEqual({ locale: "en", rest: "/" });
    expect(localeFromPath("/login")).toEqual({ locale: "en", rest: "/login" });
    expect(localeFromPath("/vi")).toEqual({ locale: "vi", rest: "/" });
    expect(localeFromPath("/vi/")).toEqual({ locale: "vi", rest: "/" });
    expect(localeFromPath("/zh-hans/login")).toEqual({ locale: "zh-Hans", rest: "/login" });
    expect(localeFromPath("/zh-hant/p/x")).toEqual({ locale: "zh-Hant", rest: "/p/x" });
  });

  it("does not treat look-alike paths as locales", () => {
    expect(localeFromPath("/vietnam")).toEqual({ locale: "en", rest: "/vietnam" });
    expect(localeFromPath("/ZH-HANS/login")).toEqual({ locale: "en", rest: "/ZH-HANS/login" });
  });

  it("builds localized paths", () => {
    expect(localizedPath("en", "/login")).toBe("/login");
    expect(localizedPath("vi", "/login")).toBe("/vi/login");
    expect(localizedPath("vi", "/")).toBe("/vi/");
    expect(localizedPath("zh-Hant", "/")).toBe("/zh-hant/");
  });

  it("lists hreflang alternates including x-default", () => {
    const alts = alternates("https://vnx.si", "/login");
    expect(alts.map((a) => a.hreflang)).toEqual(["en", "vi", "zh-Hans", "zh-Hant", "x-default"]);
    expect(alts[1]).toEqual({ hreflang: "vi", href: "https://vnx.si/vi/login" });
    expect(alts[4]).toEqual({ hreflang: "x-default", href: "https://vnx.si/login" });
  });
});

describe("t()", () => {
  it("translates and interpolates", () => {
    expect(t("vi", "login.sent.body", { email: "a@b.vn" })).toContain("a@b.vn");
    expect(t("zh-Hans", "nav.signIn")).toBe("登录");
  });
});
```

```ts
// apps/web/test/i18n/parity.test.ts
import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/messages/en.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { zhHans } from "../../src/i18n/messages/zh-hans.ts";
import { zhHant } from "../../src/i18n/messages/zh-hant.ts";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("locale parity (ADR-003)", () => {
  for (const [name, messages] of Object.entries({ vi, zhHans, zhHant })) {
    it(`${name} has exactly the EN keys, none empty, same placeholders`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), key).not.toBe("");
        expect(placeholders(value), key).toEqual(placeholders(en[key as keyof typeof en]));
      }
    });
  }
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/i18n`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Tạo `apps/web/src/i18n/locales.ts`**

```ts
export const LOCALES = ["en", "vi", "zh-Hans", "zh-Hant"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const PREFIX: Record<Locale, string> = { en: "", vi: "/vi", "zh-Hans": "/zh-hans", "zh-Hant": "/zh-hant" };

export const LOCALE_LABEL: Record<Locale, string> = { en: "EN", vi: "VI", "zh-Hans": "简体", "zh-Hant": "繁體" };

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

export function localeFromPath(pathname: string): { locale: Locale; rest: string } {
  for (const locale of LOCALES) {
    const prefix = PREFIX[locale];
    if (!prefix) continue;
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return { locale, rest: pathname.slice(prefix.length) || "/" };
    }
  }
  return { locale: DEFAULT_LOCALE, rest: pathname };
}

export function localizedPath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : "/" + path;
  const prefix = PREFIX[locale];
  if (!prefix) return clean;
  return clean === "/" ? prefix + "/" : prefix + clean;
}

export function alternates(origin: string, rest: string): { hreflang: string; href: string }[] {
  return [
    ...LOCALES.map((locale) => ({ hreflang: locale as string, href: origin + localizedPath(locale, rest) })),
    { hreflang: "x-default", href: origin + localizedPath(DEFAULT_LOCALE, rest) },
  ];
}
```

- [ ] **Step 4: Tạo 4 file message**

```ts
// apps/web/src/i18n/messages/en.ts
export const en = {
  "site.tagline": "The marketplace for AI-built products and the people who build them.",
  "nav.products": "Products",
  "nav.findBuilders": "Find builders",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.language": "Language",
  "footer.terms": "Terms",
  "footer.privacy": "Privacy",
  "error.notFound.title": "Page not found",
  "error.notFound.body": "The page you are looking for does not exist or has moved.",
  "error.forbidden.title": "You can't open this page",
  "error.forbidden.body": "Your account doesn't have access to this page.",
  "error.server.title": "Something went wrong",
  "error.server.body": "Please try again. If it keeps happening, send us this reference: {id}",
  "error.backHome": "Back to home",
  "login.title": "Sign in to VNX.SI",
  "login.intro": "Enter your email and we'll send you a sign-in link. No password needed.",
  "login.emailLabel": "Email",
  "login.submit": "Send sign-in link",
  "login.sent.title": "Check your inbox",
  "login.sent.body": "We sent a sign-in link to {email}. It works once and expires in 15 minutes.",
  "login.error.email": "That email address doesn't look right.",
  "login.error.rateLimited": "Too many attempts. Please wait an hour and try again.",
  "login.error.sendFailed": "We couldn't send the email. Please try again in a few minutes.",
  "auth.invalidLink.title": "This sign-in link no longer works",
  "auth.invalidLink.body": "Links work once and expire after 15 minutes. Request a new one.",
  "auth.invalidLink.cta": "Get a new link",
  "email.login.subject": "Your VNX.SI sign-in link",
  "email.login.intro": "Click the link below to sign in to VNX.SI. It works once and expires in 15 minutes.",
  "email.login.ignore": "If you didn't ask for this, you can ignore this email.",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
```

```ts
// apps/web/src/i18n/messages/vi.ts
import type { Messages } from "./en.ts";

export const vi: Messages = {
  "site.tagline": "Chợ cho sản phẩm được xây bằng AI và những người xây chúng.",
  "nav.products": "Sản phẩm",
  "nav.findBuilders": "Tìm builder",
  "nav.signIn": "Đăng nhập",
  "nav.signOut": "Đăng xuất",
  "nav.language": "Ngôn ngữ",
  "footer.terms": "Điều khoản",
  "footer.privacy": "Quyền riêng tư",
  "error.notFound.title": "Không tìm thấy trang",
  "error.notFound.body": "Trang bạn tìm không tồn tại hoặc đã chuyển chỗ.",
  "error.forbidden.title": "Bạn không mở được trang này",
  "error.forbidden.body": "Tài khoản của bạn không có quyền vào trang này.",
  "error.server.title": "Có lỗi xảy ra",
  "error.server.body": "Vui lòng thử lại. Nếu vẫn lỗi, gửi cho chúng tôi mã này: {id}",
  "error.backHome": "Về trang chủ",
  "login.title": "Đăng nhập VNX.SI",
  "login.intro": "Nhập email, chúng tôi sẽ gửi link đăng nhập. Không cần mật khẩu.",
  "login.emailLabel": "Email",
  "login.submit": "Gửi link đăng nhập",
  "login.sent.title": "Kiểm tra hộp thư",
  "login.sent.body": "Chúng tôi đã gửi link đăng nhập tới {email}. Link dùng được một lần và hết hạn sau 15 phút.",
  "login.error.email": "Email chưa đúng định dạng.",
  "login.error.rateLimited": "Bạn đã thử quá nhiều lần. Vui lòng đợi một giờ rồi thử lại.",
  "login.error.sendFailed": "Không gửi được email. Vui lòng thử lại sau vài phút.",
  "auth.invalidLink.title": "Link đăng nhập này không còn dùng được",
  "auth.invalidLink.body": "Link chỉ dùng được một lần và hết hạn sau 15 phút. Hãy xin link mới.",
  "auth.invalidLink.cta": "Lấy link mới",
  "email.login.subject": "Link đăng nhập VNX.SI của bạn",
  "email.login.intro": "Bấm vào link dưới đây để đăng nhập VNX.SI. Link dùng được một lần và hết hạn sau 15 phút.",
  "email.login.ignore": "Nếu bạn không yêu cầu, hãy bỏ qua email này.",
};
```

```ts
// apps/web/src/i18n/messages/zh-hans.ts
import type { Messages } from "./en.ts";

export const zhHans: Messages = {
  "site.tagline": "AI 构建产品及其开发者的交易市场。",
  "nav.products": "产品",
  "nav.findBuilders": "寻找开发者",
  "nav.signIn": "登录",
  "nav.signOut": "退出登录",
  "nav.language": "语言",
  "footer.terms": "条款",
  "footer.privacy": "隐私",
  "error.notFound.title": "页面不存在",
  "error.notFound.body": "你要找的页面不存在或已移动。",
  "error.forbidden.title": "你无法打开此页面",
  "error.forbidden.body": "你的账户没有访问此页面的权限。",
  "error.server.title": "出错了",
  "error.server.body": "请重试。如果问题持续，请把这个编号发给我们：{id}",
  "error.backHome": "返回首页",
  "login.title": "登录 VNX.SI",
  "login.intro": "输入邮箱，我们会发送登录链接给你。无需密码。",
  "login.emailLabel": "邮箱",
  "login.submit": "发送登录链接",
  "login.sent.title": "请查看邮箱",
  "login.sent.body": "我们已向 {email} 发送登录链接。链接仅可使用一次，15 分钟后失效。",
  "login.error.email": "邮箱格式不正确。",
  "login.error.rateLimited": "尝试次数过多，请一小时后再试。",
  "login.error.sendFailed": "邮件发送失败，请几分钟后再试。",
  "auth.invalidLink.title": "此登录链接已失效",
  "auth.invalidLink.body": "链接仅可使用一次，并在 15 分钟后失效。请重新获取。",
  "auth.invalidLink.cta": "获取新链接",
  "email.login.subject": "你的 VNX.SI 登录链接",
  "email.login.intro": "点击下方链接登录 VNX.SI。链接仅可使用一次，15 分钟后失效。",
  "email.login.ignore": "如果这不是你本人的操作，请忽略此邮件。",
};
```

```ts
// apps/web/src/i18n/messages/zh-hant.ts
import type { Messages } from "./en.ts";

export const zhHant: Messages = {
  "site.tagline": "AI 打造產品及其開發者的交易市集。",
  "nav.products": "產品",
  "nav.findBuilders": "尋找開發者",
  "nav.signIn": "登入",
  "nav.signOut": "登出",
  "nav.language": "語言",
  "footer.terms": "條款",
  "footer.privacy": "隱私",
  "error.notFound.title": "找不到頁面",
  "error.notFound.body": "你要找的頁面不存在或已移動。",
  "error.forbidden.title": "你無法開啟此頁面",
  "error.forbidden.body": "你的帳戶沒有存取此頁面的權限。",
  "error.server.title": "發生錯誤",
  "error.server.body": "請再試一次。如果問題持續，請將此編號提供給我們：{id}",
  "error.backHome": "返回首頁",
  "login.title": "登入 VNX.SI",
  "login.intro": "輸入電子郵件，我們會寄送登入連結給你。不需要密碼。",
  "login.emailLabel": "電子郵件",
  "login.submit": "寄送登入連結",
  "login.sent.title": "請查看信箱",
  "login.sent.body": "我們已將登入連結寄到 {email}。連結僅能使用一次，15 分鐘後失效。",
  "login.error.email": "電子郵件格式不正確。",
  "login.error.rateLimited": "嘗試次數過多，請一小時後再試。",
  "login.error.sendFailed": "無法寄出電子郵件，請幾分鐘後再試。",
  "auth.invalidLink.title": "此登入連結已失效",
  "auth.invalidLink.body": "連結僅能使用一次，並於 15 分鐘後失效。請重新取得。",
  "auth.invalidLink.cta": "取得新連結",
  "email.login.subject": "你的 VNX.SI 登入連結",
  "email.login.intro": "點擊下方連結登入 VNX.SI。連結僅能使用一次，15 分鐘後失效。",
  "email.login.ignore": "如果這不是你本人的操作，請忽略此郵件。",
};
```

- [ ] **Step 5: Tạo `apps/web/src/i18n/t.ts`**

```ts
import type { Locale } from "./locales.ts";
import { en, type MessageKey, type Messages } from "./messages/en.ts";
import { vi } from "./messages/vi.ts";
import { zhHans } from "./messages/zh-hans.ts";
import { zhHant } from "./messages/zh-hant.ts";

const CATALOG: Record<Locale, Messages> = { en, vi, "zh-Hans": zhHans, "zh-Hant": zhHant };

export type Params = Record<string, string | number>;

export function t(locale: Locale, key: MessageKey, params?: Params): string {
  const raw = CATALOG[locale][key] || en[key];
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translator(locale: Locale) {
  return (key: MessageKey, params?: Params) => t(locale, key, params);
}

export type Translate = ReturnType<typeof translator>;
```

- [ ] **Step 6: Middleware locale, helper route và cập nhật `env.ts`**

```ts
// apps/web/src/i18n/middleware.ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "./locales.ts";

export const localeMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("locale", localeFromPath(c.req.path).locale);
  await next();
};
```

```ts
// apps/web/src/http/localized.ts
import type { Handler, Hono, MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { LOCALES, localizedPath } from "../i18n/locales.ts";

type AnyHandler = Handler<AppEnv> | MiddlewareHandler<AppEnv>;

/** Registers the same handlers under all four locale prefixes. */
export function onLocalized(app: Hono<AppEnv>, method: "get" | "post", path: string, ...handlers: AnyHandler[]) {
  for (const locale of LOCALES) {
    app.on(method.toUpperCase(), localizedPath(locale, path), ...(handlers as [Handler<AppEnv>]));
  }
}
```

Trong `apps/web/src/env.ts`, thay khối `AppEnv` bằng:

```ts
import type { Locale } from "./i18n/locales.ts";

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    locale: Locale;
  };
};
```

(đặt dòng `import` ở đầu file.)

Trong `apps/web/src/app.ts` thêm import `import { localeMiddleware } from "./i18n/middleware.ts";` và thêm dòng `app.use("*", localeMiddleware);` ngay sau `app.use("*", requestId);`.

- [ ] **Step 7: Chạy test và typecheck**

Run: `npm test -- test/i18n && npm run typecheck -w apps/web`
Expected: PASS, 8 test; typecheck không lỗi.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/i18n apps/web/src/http/localized.ts apps/web/src/env.ts apps/web/src/app.ts apps/web/test/i18n
git commit -m "feat(web): i18n with four locales, URL prefixes and parity test"
```

---

### Task 7: VNX-0103 — Layout, CSS, trang lỗi, PlainText

**Files:**
- Create: `apps/web/src/views/render.ts`
- Create: `apps/web/src/views/Layout.tsx`
- Create: `apps/web/src/views/PlainText.tsx`
- Create: `apps/web/src/views/ErrorPage.tsx`
- Create: `apps/web/src/views/error-response.tsx`
- Create: `apps/web/public/assets/app.css`
- Modify: `apps/web/src/app.ts` (notFound/onError theo locale)
- Test: `apps/web/test/views/plain-text.test.tsx`, `apps/web/test/views/error-pages.test.ts`

**Interfaces:**
- Consumes: `translator`, `localizedPath`, `alternates`, `LOCALES`, `LOCALE_LABEL`, `parsePlainText`, `AppEnv`.
- Produces:
  - `page(c, node, status?) : Promise<Response>`.
  - `Layout` props `{ locale: Locale; title: string; origin: string; rest: string; description?: string; noindex?: boolean; signedIn?: boolean }`.
  - `PlainText` props `{ text: string }`.
  - `ErrorPage` props `{ locale; origin; rest; kind: "notFound" | "forbidden" | "server"; reference?: string }`.
  - `errorResponse(c, kind, status)`.

- [ ] **Step 1: Viết test fail**

```tsx
// apps/web/test/views/plain-text.test.tsx
import { describe, expect, it } from "vitest";
import { PlainText } from "../../src/views/PlainText.tsx";

describe("PlainText", () => {
  it("escapes HTML and renders lists", async () => {
    const html = String(await (<PlainText text={"<script>alert(1)</script>\n\n- a & b\n- c"} />));
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<li>a &amp; b</li>");
  });
});
```

```ts
// apps/web/test/views/error-pages.test.ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

describe("localized error pages", () => {
  it("renders a Vietnamese 404 under /vi", async () => {
    const res = await createApp().request("https://vnx.si/vi/khong-co", {}, testEnv);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="vi"');
    expect(html).toContain("Không tìm thấy trang");
    expect(html).toContain('hreflang="zh-Hant"');
    expect(html).toContain('href="https://vnx.si/zh-hant/khong-co"');
  });

  it("renders a localized 500 with the reference id", async () => {
    const app = createApp();
    app.get("/zh-hans/boom", () => {
      throw new Error("x");
    });
    const res = await app.request("https://vnx.si/zh-hans/boom", { headers: { "cf-ray": "ray-9" } }, testEnv);
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("出错了");
    expect(html).toContain("ray-9");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/views`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Tạo `render.ts`, `PlainText.tsx`, `Layout.tsx`**

```ts
// apps/web/src/views/render.ts
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../env.ts";

/** Renders a JSX page with a doctype. Accepts sync or async JSX nodes. */
export async function page(c: Context<AppEnv>, node: unknown, status: ContentfulStatusCode = 200): Promise<Response> {
  const html = String(await node);
  return c.html("<!DOCTYPE html>" + html, status);
}
```

```tsx
// apps/web/src/views/PlainText.tsx
import type { FC } from "hono/jsx";
import { parsePlainText } from "../domain/text.ts";

export const PlainText: FC<{ text: string }> = ({ text }) => (
  <div class="prose">
    {parsePlainText(text).map((block) =>
      block.kind === "p" ? (
        <p>{block.text}</p>
      ) : (
        <ul>
          {block.items.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
      ),
    )}
  </div>
);
```

```tsx
// apps/web/src/views/Layout.tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import { alternates, LOCALE_LABEL, LOCALES, localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";

export type LayoutProps = {
  locale: Locale;
  title: string;
  origin: string;
  rest: string;
  description?: string;
  noindex?: boolean;
  signedIn?: boolean;
};

export const Layout: FC<PropsWithChildren<LayoutProps>> = (props) => {
  const { locale, title, origin, rest, description, noindex, signedIn, children } = props;
  const tr = translator(locale);
  return (
    <html lang={locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        {noindex ? <meta name="robots" content="noindex" /> : null}
        <link rel="canonical" href={origin + localizedPath(locale, rest)} />
        {alternates(origin, rest).map((alt) => (
          <link rel="alternate" hreflang={alt.hreflang} href={alt.href} />
        ))}
        <link rel="stylesheet" href="/assets/app.css" />
      </head>
      <body>
        <header class="site-header">
          <div class="container bar">
            <a class="brand" href={localizedPath(locale, "/")}>
              VNX.SI
            </a>
            <nav class="lang" aria-label={tr("nav.language")}>
              {LOCALES.map((l) => (
                <a href={localizedPath(l, rest)} hreflang={l} lang={l} aria-current={l === locale ? "true" : undefined}>
                  {LOCALE_LABEL[l]}
                </a>
              ))}
            </nav>
            {signedIn ? (
              <form method="post" action="/logout">
                <button type="submit" class="link">
                  {tr("nav.signOut")}
                </button>
              </form>
            ) : (
              <a href={localizedPath(locale, "/login")}>{tr("nav.signIn")}</a>
            )}
          </div>
        </header>
        <main id="main" class="container">
          {children}
        </main>
        <footer class="site-footer">
          <div class="container">{tr("site.tagline")}</div>
        </footer>
      </body>
    </html>
  );
};
```

- [ ] **Step 4: Tạo `ErrorPage.tsx` và `error-response.tsx`**

```tsx
// apps/web/src/views/ErrorPage.tsx
import type { FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { Layout } from "./Layout.tsx";

export type ErrorKind = "notFound" | "forbidden" | "server";

export const ErrorPage: FC<{ locale: Locale; origin: string; rest: string; kind: ErrorKind; reference?: string }> = (props) => {
  const tr = translator(props.locale);
  const title = tr(`error.${props.kind}.title`);
  const body = props.kind === "server" ? tr("error.server.body", { id: props.reference ?? "-" }) : tr(`error.${props.kind}.body`);
  return (
    <Layout locale={props.locale} title={title} origin={props.origin} rest={props.rest} noindex>
      <section class="error">
        <h1>{title}</h1>
        <p>{body}</p>
        <p>
          <a href={localizedPath(props.locale, "/")}>{tr("error.backHome")}</a>
        </p>
      </section>
    </Layout>
  );
};
```

```tsx
// apps/web/src/views/error-response.tsx
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";
import { ErrorPage, type ErrorKind } from "./ErrorPage.tsx";
import { page } from "./render.ts";

export function errorResponse(c: Context<AppEnv>, kind: ErrorKind, status: ContentfulStatusCode) {
  const url = new URL(c.req.url);
  const { locale, rest } = localeFromPath(url.pathname);
  return page(c, <ErrorPage locale={locale} origin={url.origin} rest={rest} kind={kind} reference={c.get("requestId")} />, status);
}
```

`error.${props.kind}.title` phải là `MessageKey` hợp lệ. Nếu TypeScript không suy ra được kiểu template literal, khai báo `const KEYS = { notFound: ["error.notFound.title", "error.notFound.body"], forbidden: [...], server: [...] } as const` và dùng nó thay cho template string.

- [ ] **Step 5: Cập nhật handler lỗi trong `apps/web/src/app.ts`**

Thay khối `app.onError(...)` và `app.notFound(...)` bằng:

```ts
  app.onError((err, c) => {
    const id = c.get("requestId");
    console.error(JSON.stringify({ requestId: id, path: c.req.path, error: String(err) }));
    if (c.req.path.startsWith("/api/")) return c.json({ ok: false, error: "Internal error", requestId: id }, 500);
    return errorResponse(c, "server", 500);
  });

  app.notFound((c) => {
    // Non-English prefixes never map to static assets; render a localized 404.
    if (localeFromPath(c.req.path).locale !== "en") return errorResponse(c, "notFound", 404);
    return c.env.ASSETS.fetch(c.req.raw);
  });
```

Thêm import vào đầu file:

```ts
import { localeFromPath } from "./i18n/locales.ts";
import { errorResponse } from "./views/error-response.tsx";
```

Sửa test `renders a 500 with a reference id` trong `test/app.test.ts` nếu cần: test đó chỉ kiểm `toContain("ray-123")`, nên trang lỗi HTML mới vẫn qua.

- [ ] **Step 6: Tạo `apps/web/public/assets/app.css`**

```css
:root {
  color-scheme: light;
  --ground: #f4f5f7; --surface: #ffffff; --ink: #0d1526; --ink-2: #3f4a5c; --muted: #5b6475;
  --line: #dce0e6; --accent: #1d4ed8; --accent-ink: #ffffff; --good: #0b6b42;
  --radius: 12px; --font: "Be Vietnam Pro", "Noto Sans SC", "Noto Sans TC", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ground: #0b1220; --surface: #121a2b; --ink: #e8edf5; --ink-2: #c3ccdb; --muted: #9aa5b8;
    --line: #26314a; --accent: #6b93ff; --accent-ink: #0b1220; --good: #5fd3a0;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --ground: #0b1220; --surface: #121a2b; --ink: #e8edf5; --ink-2: #c3ccdb; --muted: #9aa5b8;
  --line: #26314a; --accent: #6b93ff; --accent-ink: #0b1220; --good: #5fd3a0;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font: 16px/1.55 var(--font); }
a { color: var(--accent); }
.container { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.site-header { background: var(--surface); border-bottom: 1px solid var(--line); }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; min-height: 60px; }
.brand { font-weight: 700; font-size: 20px; color: var(--ink); text-decoration: none; }
.lang { display: flex; gap: 4px; margin-left: auto; }
.lang a { padding: 10px 8px; color: var(--ink-2); text-decoration: none; border-radius: 8px; }
.lang a[aria-current="true"] { background: var(--ink); color: var(--surface); }
main { padding: 32px 16px 64px; }
.site-footer { border-top: 1px solid var(--line); background: var(--surface); color: var(--muted); padding: 24px 0; font-size: 14px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; max-width: 480px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field input { font: inherit; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 20px; border: 0; border-radius: 10px; background: var(--accent); color: var(--accent-ink); font: inherit; font-weight: 600; cursor: pointer; }
.link { background: none; border: 0; color: var(--accent); font: inherit; cursor: pointer; min-height: 44px; }
.error-msg { color: #b42318; }
.prose p { white-space: pre-line; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 7: Chạy test**

Run: `npm test && npm run typecheck -w apps/web`
Expected: PASS toàn bộ; typecheck không lỗi.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/views apps/web/src/app.ts apps/web/public/assets apps/web/test/views
git commit -m "feat(web): base layout, CSS tokens, localized error pages, PlainText"
```

---

### Task 8: VNX-0104 — Migration danh tính, users, audit, rate limit

**Files:**
- Create: `apps/web/migrations/0003_identity.sql`
- Create: `apps/web/src/db/users.ts`
- Create: `apps/web/src/db/audit.ts`
- Create: `apps/web/src/http/rate-limit.ts`
- Test: `apps/web/test/db/users.test.ts`, `apps/web/test/http/rate-limit.test.ts`

**Interfaces:**
- Consumes: `ulid` (Task 5).
- Produces:
  - `UserRow` có các cột: `id`, `email`, `display_name`, `locale`, `is_admin`, `status`, `last_login_at`, `created_at`, `updated_at`.
  - `findUserByEmail(db, email): Promise<UserRow | null>`.
  - `findUserById(db, id): Promise<UserRow | null>`.
  - `createUser(db, { email, locale, now }): Promise<UserRow>`.
  - `markLogin(db, id, { now, isAdmin }): Promise<void>`.
  - `writeAudit(db, { actorUserId, action, entity, entityId, data, now }): Promise<void>`.
  - `hitRateLimit(db, key, limit, windowSeconds, nowMs): Promise<{ allowed: boolean; count: number }>`.

- [ ] **Step 1: Viết test fail**

```ts
// apps/web/test/db/users.test.ts
import { describe, expect, it } from "vitest";
import { createUser, findUserByEmail, markLogin } from "../../src/db/users.ts";
import { writeAudit } from "../../src/db/audit.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-03T09:00:00.000Z";

describe("users", () => {
  it("creates and finds a user by email", async () => {
    const created = await createUser(testEnv.DB, { email: "lan@example.vn", locale: "vi", now: NOW });
    expect(created.id).toMatch(/^[0-9A-Z]{26}$/);
    const found = await findUserByEmail(testEnv.DB, "lan@example.vn");
    expect(found).toMatchObject({ email: "lan@example.vn", locale: "vi", is_admin: 0, status: "active" });
  });

  it("rejects duplicate emails", async () => {
    await createUser(testEnv.DB, { email: "dup@example.vn", locale: "en", now: NOW });
    await expect(createUser(testEnv.DB, { email: "dup@example.vn", locale: "en", now: NOW })).rejects.toThrow();
  });

  it("markLogin sets last_login_at and only ever raises is_admin", async () => {
    const u = await createUser(testEnv.DB, { email: "a@vnx.si", locale: "en", now: NOW });
    await markLogin(testEnv.DB, u.id, { now: NOW, isAdmin: true });
    await markLogin(testEnv.DB, u.id, { now: NOW, isAdmin: false });
    const after = await findUserByEmail(testEnv.DB, "a@vnx.si");
    expect(after).toMatchObject({ last_login_at: NOW, is_admin: 1 });
  });

  it("writes audit rows", async () => {
    await writeAudit(testEnv.DB, { actorUserId: null, action: "test.action", entity: "user", entityId: "x", data: { a: 1 }, now: NOW });
    const row = await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = 'x'").first<{ action: string; data: string }>();
    expect(row).toEqual({ action: "test.action", data: '{"a":1}' });
  });
});
```

```ts
// apps/web/test/http/rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { hitRateLimit } from "../../src/http/rate-limit.ts";
import { testEnv } from "../helpers.ts";

describe("hitRateLimit", () => {
  it("allows up to the limit inside a window, then blocks", async () => {
    const t0 = Date.parse("2026-10-03T09:00:10Z");
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await hitRateLimit(testEnv.DB, "k:1", 5, 3600, t0 + i));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results[5]?.count).toBe(6);
  });

  it("starts a fresh window after it ends", async () => {
    const t0 = Date.parse("2026-10-03T09:00:10Z");
    for (let i = 0; i < 5; i++) await hitRateLimit(testEnv.DB, "k:2", 5, 3600, t0);
    const next = await hitRateLimit(testEnv.DB, "k:2", 5, 3600, Date.parse("2026-10-03T10:00:01Z"));
    expect(next).toEqual({ allowed: true, count: 1 });
  });

  it("keeps keys independent", async () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await hitRateLimit(testEnv.DB, "k:a", 5, 3600, t0);
    expect((await hitRateLimit(testEnv.DB, "k:b", 5, 3600, t0)).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/db test/http`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Tạo `apps/web/migrations/0003_identity.sql`**

```sql
-- Wave 1 identity (spec §6.1). Additive only.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  locale        TEXT NOT NULL DEFAULT 'en',
  is_admin      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE login_tokens (
  token_hash       TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  purpose          TEXT NOT NULL CHECK (purpose IN ('login', 'inquiry_verify', 'request_verify')),
  locale           TEXT NOT NULL DEFAULT 'en',
  inquiry_id       TEXT,
  request_id       TEXT,
  invite_code_hash TEXT,
  expires_at       TEXT NOT NULL,
  used_at          TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_login_tokens_expires ON login_tokens (expires_at);

CREATE TABLE sessions (
  id_hash    TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action        TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     TEXT,
  data          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);
```

Cột `login_tokens.locale` có trong spec mục 6.1: dùng để gửi email và redirect đúng ngôn ngữ.

- [ ] **Step 4: Tạo `src/db/users.ts`, `src/db/audit.ts`, `src/http/rate-limit.ts`**

```ts
// apps/web/src/db/users.ts
import { ulid } from "../lib/ulid.ts";

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  locale: string;
  is_admin: number;
  status: "active" | "suspended";
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?1").bind(email).first<UserRow>();
}

export function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?1").bind(id).first<UserRow>();
}

export async function createUser(db: D1Database, input: { email: string; locale: string; now: string }): Promise<UserRow> {
  const id = ulid(Date.parse(input.now));
  await db
    .prepare("INSERT INTO users (id, email, locale, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)")
    .bind(id, input.email, input.locale, input.now)
    .run();
  const row = await findUserById(db, id);
  if (!row) throw new Error("user insert failed");
  return row;
}

export async function markLogin(db: D1Database, id: string, input: { now: string; isAdmin: boolean }): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET last_login_at = ?2, updated_at = ?2,
         is_admin = CASE WHEN ?3 = 1 THEN 1 ELSE is_admin END
       WHERE id = ?1`,
    )
    .bind(id, input.now, input.isAdmin ? 1 : 0)
    .run();
}
```

```ts
// apps/web/src/db/audit.ts
import { ulid } from "../lib/ulid.ts";

export async function writeAudit(
  db: D1Database,
  input: { actorUserId: string | null; action: string; entity: string; entityId: string | null; data?: Record<string, unknown>; now: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(ulid(Date.parse(input.now)), input.actorUserId, input.action, input.entity, input.entityId, JSON.stringify(input.data ?? {}), input.now)
    .run();
}
```

```ts
// apps/web/src/http/rate-limit.ts
/** Fixed-window counter in D1 (spec §8.2). Workers Rate Limiting only supports 10s/60s periods. */
export async function hitRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
  nowMs: number,
): Promise<{ allowed: boolean; count: number }> {
  const windowStart = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 1;
  return { allowed: count <= limit, count };
}
```

- [ ] **Step 5: Chạy test và áp migration local**

Run: `npm test && npm run typecheck -w apps/web`
Expected: PASS toàn bộ.

Run: `npm run db:migrate:local -w apps/web`
Expected: migration `0003_identity.sql` được áp vào D1 local, không lỗi.

- [ ] **Step 6: Commit**

```bash
git add apps/web/migrations/0003_identity.sql apps/web/src/db apps/web/src/http/rate-limit.ts apps/web/test/db apps/web/test/http
git commit -m "feat(web): identity tables, users/audit repositories and D1 rate limiter"
```

---

### Task 9: VNX-0105 — Mailer port và email đăng nhập

**Files:**
- Create: `apps/web/src/email/mailer.ts`
- Create: `apps/web/src/email/fake.ts`
- Create: `apps/web/src/email/console.ts`
- Create: `apps/web/src/email/resend.ts`
- Create: `apps/web/src/email/index.ts`
- Create: `apps/web/src/email/escape.ts`
- Create: `apps/web/src/email/templates/login.ts`
- Test: `apps/web/test/email/resend.test.ts`, `apps/web/test/email/login-template.test.ts`

**Interfaces:**
- Consumes: `translator`, `Locale`, `Bindings`.
- Produces:
  - `interface EmailMessage { to: string; subject: string; text: string; html: string }`.
  - `interface Mailer { send(message: EmailMessage): Promise<void> }`.
  - `class MailError extends Error`.
  - `outbox: EmailMessage[]`, `clearOutbox()`, `FakeMailer`.
  - `ResendMailer(apiKey, from, fetchFn?)`.
  - `ConsoleMailer`.
  - `getMailer(env: Bindings): Mailer`.
  - `escapeHtml(s)`.
  - `loginEmail(locale, link): { subject; text; html }`.

- [ ] **Step 1: Viết test fail**

```ts
// apps/web/test/email/resend.test.ts
import { describe, expect, it, vi } from "vitest";
import { MailError } from "../../src/email/mailer.ts";
import { ResendMailer } from "../../src/email/resend.ts";

const message = { to: "lan@example.vn", subject: "Hi", text: "t", html: "<p>h</p>" };

describe("ResendMailer", () => {
  it("posts the message to Resend with the API key", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    await new ResendMailer("re_test", "VNX.SI <noreply@vnx.si>", fetchFn).send(message);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "VNX.SI <noreply@vnx.si>",
      to: ["lan@example.vn"],
      subject: "Hi",
      text: "t",
      html: "<p>h</p>",
    });
  });

  it("throws MailError on a non-2xx response", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 422 }));
    await expect(new ResendMailer("k", "f", fetchFn).send(message)).rejects.toBeInstanceOf(MailError);
  });
});
```

```ts
// apps/web/test/email/login-template.test.ts
import { describe, expect, it } from "vitest";
import { loginEmail } from "../../src/email/templates/login.ts";

describe("loginEmail", () => {
  it("is localized and contains the link in text and html", () => {
    const link = "https://vnx.si/auth/verify?t=abc&next=%2Fhub";
    const mail = loginEmail("vi", link);
    expect(mail.subject).toBe("Link đăng nhập VNX.SI của bạn");
    expect(mail.text).toContain(link);
    expect(mail.html).toContain('href="https://vnx.si/auth/verify?t=abc&amp;next=%2Fhub"');
    expect(mail.html).toContain('lang="vi"');
  });

  it("escapes HTML in the link", () => {
    const mail = loginEmail("en", 'https://vnx.si/"><script>x</script>');
    expect(mail.html).not.toContain("<script>");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/email`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết code**

```ts
// apps/web/src/email/mailer.ts
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export class MailError extends Error {
  override name = "MailError";
}
```

```ts
// apps/web/src/email/fake.ts
import type { EmailMessage, Mailer } from "./mailer.ts";

/** In-memory outbox shared by the test isolate. Never used in production. */
export const outbox: EmailMessage[] = [];

export function clearOutbox() {
  outbox.length = 0;
}

export class FakeMailer implements Mailer {
  async send(message: EmailMessage) {
    outbox.push(message);
  }
}
```

```ts
// apps/web/src/email/console.ts
import type { EmailMessage, Mailer } from "./mailer.ts";

/** Local development: prints the email instead of sending it. */
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage) {
    console.log(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
  }
}
```

```ts
// apps/web/src/email/resend.ts
import { MailError, type EmailMessage, type Mailer } from "./mailer.ts";

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {}

  async send(message: EmailMessage) {
    const res = await this.fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) throw new MailError(`Resend responded ${res.status}`);
  }
}
```

```ts
// apps/web/src/email/index.ts
import type { Bindings } from "../env.ts";
import { ConsoleMailer } from "./console.ts";
import { FakeMailer } from "./fake.ts";
import type { Mailer } from "./mailer.ts";
import { ResendMailer } from "./resend.ts";

const DEFAULT_FROM = "VNX.SI <noreply@vnx.si>";

export function getMailer(env: Bindings): Mailer {
  if (env.MAIL_DRIVER === "fake") return new FakeMailer();
  if (env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM ?? DEFAULT_FROM);
  return new ConsoleMailer();
}
```

```ts
// apps/web/src/email/escape.ts
const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => MAP[ch] ?? ch);
}
```

```ts
// apps/web/src/email/templates/login.ts
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

export function loginEmail(locale: Locale, link: string): { subject: string; text: string; html: string } {
  const tr = translator(locale);
  const intro = tr("email.login.intro");
  const ignore = tr("email.login.ignore");
  const safeLink = escapeHtml(link);
  return {
    subject: tr("email.login.subject"),
    text: `${intro}\n\n${link}\n\n${ignore}`,
    html:
      `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">` +
      `<p>${escapeHtml(intro)}</p><p><a href="${safeLink}">${safeLink}</a></p>` +
      `<p style="color:#5B6475">${escapeHtml(ignore)}</p></body></html>`,
  };
}
```

- [ ] **Step 4: Chạy test**

Run: `npm test -- test/email && npm run typecheck -w apps/web`
Expected: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/email apps/web/test/email
git commit -m "feat(web): mailer port with Resend, fake and console drivers; login email"
```

---

### Task 10: VNX-0106 — Token, session, cookie, middleware, origin check

**Files:**
- Create: `apps/web/src/auth/crypto.ts`
- Create: `apps/web/src/auth/tokens.ts`
- Create: `apps/web/src/auth/sessions.ts`
- Create: `apps/web/src/auth/cookies.ts`
- Create: `apps/web/src/auth/middleware.ts`
- Create: `apps/web/src/http/origin.ts`
- Modify: `apps/web/src/env.ts` (thêm `user` vào `Variables`)
- Modify: `apps/web/src/app.ts` (gắn `originCheck` và `sessionMiddleware`)
- Test: `apps/web/test/auth/tokens.test.ts`, `apps/web/test/auth/sessions.test.ts`, `apps/web/test/http/origin.test.ts`

**Interfaces:**
- Consumes: `createUser`, `findUserByEmail` (Task 8), `errorResponse` (Task 7), `localizedPath`, `isLocale`.
- Produces:
  - `randomToken(bytes?: number): string`, `sha256Hex(input: string): Promise<string>`.
  - `LOGIN_TOKEN_TTL_MS`, `type TokenPurpose`.
  - `createLoginToken(db, { email, purpose, locale, inviteCodeHash?, inquiryId?, requestId? }, now: Date): Promise<string>`.
  - `consumeLoginToken(db, raw, now: Date)`, trả `{ ok: true; token: ConsumedToken } | { ok: false; reason: "invalid" | "expired" | "used" }`.
  - `ConsumedToken { email; purpose; locale: Locale; inquiryId; requestId; inviteCodeHash }`.
  - `SESSION_TTL_MS`, `interface SessionUser { id: string; email: string; locale: string; isAdmin: boolean }`.
  - `createSession(db, userId, now): Promise<string>`, `getSessionUser(db, raw, now): Promise<SessionUser | null>`, `deleteSession(db, raw): Promise<void>`.
  - `SESSION_COOKIE`, `readSessionCookie(c)`, `writeSessionCookie(c, value)`, `clearSessionCookie(c)`.
  - Middleware: `sessionMiddleware`, `requireUser`, `requireAdmin`, `originCheck`.

- [ ] **Step 1: Viết test fail**

```ts
// apps/web/test/auth/tokens.test.ts
import { describe, expect, it } from "vitest";
import { consumeLoginToken, createLoginToken, LOGIN_TOKEN_TTL_MS } from "../../src/auth/tokens.ts";
import { testEnv } from "../helpers.ts";

const now = new Date("2026-10-03T09:00:00Z");

describe("login tokens", () => {
  it("creates a 43-char base64url token and consumes it once", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "lan@example.vn", purpose: "login", locale: "vi" }, now);
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const first = await consumeLoginToken(testEnv.DB, raw, new Date(now.getTime() + 1000));
    expect(first).toEqual({
      ok: true,
      token: { email: "lan@example.vn", purpose: "login", locale: "vi", inquiryId: null, requestId: null, inviteCodeHash: null },
    });
    expect(await consumeLoginToken(testEnv.DB, raw, new Date(now.getTime() + 2000))).toEqual({ ok: false, reason: "used" });
  });

  it("concurrent consumption succeeds exactly once", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "x@vnx.si", purpose: "login", locale: "en" }, now);
    const later = new Date(now.getTime() + 1000);
    const results = await Promise.all([consumeLoginToken(testEnv.DB, raw, later), consumeLoginToken(testEnv.DB, raw, later)]);
    expect(results.filter((r) => r.ok).length).toBe(1);
  });

  it("rejects expired and unknown tokens", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "e@vnx.si", purpose: "login", locale: "en" }, now);
    expect(await consumeLoginToken(testEnv.DB, raw, new Date(now.getTime() + LOGIN_TOKEN_TTL_MS + 1))).toEqual({ ok: false, reason: "expired" });
    expect(await consumeLoginToken(testEnv.DB, "A".repeat(43), now)).toEqual({ ok: false, reason: "invalid" });
    expect(await consumeLoginToken(testEnv.DB, "short", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("stores only the hash", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "h@vnx.si", purpose: "login", locale: "en" }, now);
    const row = await testEnv.DB.prepare("SELECT token_hash FROM login_tokens WHERE email = 'h@vnx.si'").first<{ token_hash: string }>();
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.token_hash).not.toBe(raw);
  });
});
```

```ts
// apps/web/test/auth/sessions.test.ts
import { describe, expect, it } from "vitest";
import { createSession, deleteSession, getSessionUser, SESSION_TTL_MS } from "../../src/auth/sessions.ts";
import { createUser } from "../../src/db/users.ts";
import { testEnv } from "../helpers.ts";

const now = new Date("2026-10-03T09:00:00Z");

describe("sessions", () => {
  it("resolves the user until expiry, then null", async () => {
    const u = await createUser(testEnv.DB, { email: "s@vnx.si", locale: "en", now: now.toISOString() });
    const sid = await createSession(testEnv.DB, u.id, now);
    expect(await getSessionUser(testEnv.DB, sid, now)).toEqual({ id: u.id, email: "s@vnx.si", locale: "en", isAdmin: false });
    expect(await getSessionUser(testEnv.DB, sid, new Date(now.getTime() + SESSION_TTL_MS + 1))).toBeNull();
  });

  it("ignores sessions of suspended users and deleted sessions", async () => {
    const u = await createUser(testEnv.DB, { email: "sus@vnx.si", locale: "en", now: now.toISOString() });
    const sid = await createSession(testEnv.DB, u.id, now);
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(u.id).run();
    expect(await getSessionUser(testEnv.DB, sid, now)).toBeNull();

    const v = await createUser(testEnv.DB, { email: "del@vnx.si", locale: "en", now: now.toISOString() });
    const sid2 = await createSession(testEnv.DB, v.id, now);
    await deleteSession(testEnv.DB, sid2);
    expect(await getSessionUser(testEnv.DB, sid2, now)).toBeNull();
  });
});
```

```ts
// apps/web/test/http/origin.test.ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/env.ts";
import { originCheck } from "../../src/http/origin.ts";
import { testEnv } from "../helpers.ts";

const app = new Hono<AppEnv>();
app.use("*", originCheck);
app.all("/x", (c) => c.text("ok"));

describe("originCheck", () => {
  it("allows safe methods without Origin", async () => {
    expect((await app.request("https://vnx.si/x", {}, testEnv)).status).toBe(200);
  });

  it("requires a same-origin Origin on POST", async () => {
    const post = (origin?: string) =>
      app.request("https://vnx.si/x", { method: "POST", headers: origin ? { origin } : {} }, testEnv);
    expect((await post()).status).toBe(403);
    expect((await post("https://evil.example")).status).toBe(403);
    expect((await post("https://vnx.si")).status).toBe(200);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/auth test/http/origin.test.ts`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết `crypto.ts`, `tokens.ts`, `sessions.ts`**

```ts
// apps/web/src/auth/crypto.ts
export function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

```ts
// apps/web/src/auth/tokens.ts
import { isLocale, type Locale } from "../i18n/locales.ts";
import { randomToken, sha256Hex } from "./crypto.ts";

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
export type TokenPurpose = "login" | "inquiry_verify" | "request_verify";

export interface ConsumedToken {
  email: string;
  purpose: TokenPurpose;
  locale: Locale;
  inquiryId: string | null;
  requestId: string | null;
  inviteCodeHash: string | null;
}

export type ConsumeResult = { ok: true; token: ConsumedToken } | { ok: false; reason: "invalid" | "expired" | "used" };

export async function createLoginToken(
  db: D1Database,
  input: { email: string; purpose: TokenPurpose; locale: Locale; inviteCodeHash?: string | null; inquiryId?: string | null; requestId?: string | null },
  now: Date,
): Promise<string> {
  const raw = randomToken();
  await db
    .prepare(
      `INSERT INTO login_tokens (token_hash, email, purpose, locale, inquiry_id, request_id, invite_code_hash, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      await sha256Hex(raw),
      input.email,
      input.purpose,
      input.locale,
      input.inquiryId ?? null,
      input.requestId ?? null,
      input.inviteCodeHash ?? null,
      new Date(now.getTime() + LOGIN_TOKEN_TTL_MS).toISOString(),
      now.toISOString(),
    )
    .run();
  return raw;
}

type Row = { email: string; purpose: TokenPurpose; locale: string; inquiry_id: string | null; request_id: string | null; invite_code_hash: string | null };

export async function consumeLoginToken(db: D1Database, raw: string, now: Date): Promise<ConsumeResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return { ok: false, reason: "invalid" };
  const hash = await sha256Hex(raw);
  const iso = now.toISOString();
  // Single atomic statement: concurrent clicks cannot both succeed.
  const row = await db
    .prepare(
      `UPDATE login_tokens SET used_at = ?2
       WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
       RETURNING email, purpose, locale, inquiry_id, request_id, invite_code_hash`,
    )
    .bind(hash, iso)
    .first<Row>();
  if (row) {
    return {
      ok: true,
      token: {
        email: row.email,
        purpose: row.purpose,
        locale: isLocale(row.locale) ? row.locale : "en",
        inquiryId: row.inquiry_id,
        requestId: row.request_id,
        inviteCodeHash: row.invite_code_hash,
      },
    };
  }
  const existing = await db.prepare("SELECT used_at FROM login_tokens WHERE token_hash = ?1").bind(hash).first<{ used_at: string | null }>();
  if (!existing) return { ok: false, reason: "invalid" };
  return { ok: false, reason: existing.used_at ? "used" : "expired" };
}
```

```ts
// apps/web/src/auth/sessions.ts
import { randomToken, sha256Hex } from "./crypto.ts";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  locale: string;
  isAdmin: boolean;
}

export async function createSession(db: D1Database, userId: string, now: Date): Promise<string> {
  const raw = randomToken();
  await db
    .prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256Hex(raw), userId, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), now.toISOString())
    .run();
  return raw;
}

export async function getSessionUser(db: D1Database, raw: string, now: Date): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.locale, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ?1 AND s.expires_at > ?2 AND u.status = 'active'`,
    )
    .bind(await sha256Hex(raw), now.toISOString())
    .first<{ id: string; email: string; locale: string; is_admin: number }>();
  return row ? { id: row.id, email: row.email, locale: row.locale, isAdmin: row.is_admin === 1 } : null;
}

export async function deleteSession(db: D1Database, raw: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256Hex(raw)).run();
}
```

- [ ] **Step 4: Viết `cookies.ts`, `middleware.ts`, `origin.ts`; cập nhật `env.ts` và `app.ts`**

```ts
// apps/web/src/auth/cookies.ts
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env.ts";
import { SESSION_TTL_MS } from "./sessions.ts";

export const SESSION_COOKIE = "__Host-vnx_session";

export function readSessionCookie(c: Context<AppEnv>): string | null {
  return getCookie(c, SESSION_COOKIE) ?? null;
}

export function writeSessionCookie(c: Context<AppEnv>, value: string) {
  setCookie(c, SESSION_COOKIE, value, { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge: SESSION_TTL_MS / 1000 });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}
```

```ts
// apps/web/src/auth/middleware.ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { errorResponse } from "../views/error-response.tsx";
import { readSessionCookie } from "./cookies.ts";
import { getSessionUser } from "./sessions.ts";

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = readSessionCookie(c);
  c.set("user", raw ? await getSessionUser(c.env.DB, raw, new Date()) : null);
  await next();
};

function toLogin(c: Parameters<MiddlewareHandler<AppEnv>>[0]) {
  const target = `/login?next=${encodeURIComponent(c.req.path)}`;
  return c.redirect(localizedPath(c.get("locale"), target), 303);
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return toLogin(c);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return toLogin(c);
  if (!user.isAdmin) return errorResponse(c, "forbidden", 403);
  await next();
};
```

```ts
// apps/web/src/http/origin.ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** CSRF defence (spec §8.2): state-changing requests must carry a same-origin Origin header. */
export const originCheck: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin");
    if (!origin || origin !== new URL(c.req.url).origin) return c.text("Forbidden", 403);
  }
  await next();
};
```

Trong `apps/web/src/env.ts`: thêm `import type { SessionUser } from "./auth/sessions.ts";` và thêm `user: SessionUser | null;` vào `Variables`.

Trong `apps/web/src/app.ts` thêm import:

```ts
import { sessionMiddleware } from "./auth/middleware.ts";
import { originCheck } from "./http/origin.ts";
```

và thứ tự middleware trở thành:

```ts
  app.use("*", requestId);
  app.use("*", localeMiddleware);
  app.use("*", originCheck);
  app.use("*", sessionMiddleware);
```

- [ ] **Step 5: Chạy test**

Run: `npm test && npm run typecheck -w apps/web`
Expected: PASS toàn bộ, gồm test `/api/waitlist` trong `app.test.ts` (test đó đã gửi `origin: https://vnx.si`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth apps/web/src/http/origin.ts apps/web/src/env.ts apps/web/src/app.ts apps/web/test/auth apps/web/test/http/origin.test.ts
git commit -m "feat(web): magic-link tokens, sessions, cookies, auth and origin middleware"
```

---

### Task 11: VNX-0107 — Route đăng nhập, xác minh, đăng xuất

**Files:**
- Create: `apps/web/src/views/auth.tsx`
- Create: `apps/web/src/routes/auth.tsx`
- Create: `apps/web/src/auth/admin.ts`
- Create: `apps/web/src/http/next.ts`
- Modify: `apps/web/src/app.ts` (gọi `registerAuthRoutes(app)` trước các route `/api`)
- Test: `apps/web/test/auth/login-flow.test.ts`, `apps/web/test/http/next.test.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 6–10.
- Produces:
  - `registerAuthRoutes(app: Hono<AppEnv>)` tạo các route `GET|POST {prefix}/login`, `GET /auth/verify`, `POST /logout`.
  - `adminEmails(env): Set<string>`.
  - `safeNext(value: unknown): string | null`.
  - View `LoginPage`, `LoginSentPage`, `InvalidLinkPage`.

- [ ] **Step 1: Viết test fail**

```ts
// apps/web/test/http/next.test.ts
import { describe, expect, it } from "vitest";
import { safeNext } from "../../src/http/next.ts";

describe("safeNext", () => {
  it("accepts same-site absolute paths", () => {
    expect(safeNext("/hub")).toBe("/hub");
    expect(safeNext("/vi/me?tab=1")).toBe("/vi/me?tab=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", undefined, 42, "/%2F%2Fevil.com"]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });
});
```

```ts
// apps/web/test/auth/login-flow.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { formPost, testEnv } from "../helpers.ts";

function tokenFrom(text: string): string {
  const m = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(text);
  if (!m?.[1]) throw new Error("no token in email");
  return m[1];
}

function cookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /__Host-vnx_session=([^;]+)/.exec(set);
  if (!m?.[1]) throw new Error("no session cookie");
  return m[1];
}

describe("magic link login", () => {
  beforeEach(() => clearOutbox());

  it("renders the login form in each locale", async () => {
    const app = createApp();
    const vi = await app.request("https://vnx.si/vi/login", {}, testEnv);
    expect(vi.status).toBe(200);
    expect(await vi.text()).toContain("Đăng nhập VNX.SI");
    const zh = await app.request("https://vnx.si/zh-hant/login", {}, testEnv);
    expect(await zh.text()).toContain("登入 VNX.SI");
  });

  it("logs in end to end and normalizes the email", async () => {
    const app = createApp();
    const sent = await app.request(formPost("/vi/login", { email: "  Lan@Example.VN " }), undefined, testEnv);
    expect(sent.status).toBe(200);
    expect(await sent.text()).toContain("lan@example.vn");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe("lan@example.vn");
    expect(outbox[0]?.subject).toBe("Link đăng nhập VNX.SI của bạn");

    const verify = await app.request(`https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`, {}, testEnv);
    expect(verify.status).toBe(303);
    expect(verify.headers.get("location")).toBe("/vi/");
    const setCookie = verify.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/__Host-vnx_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const user = await testEnv.DB.prepare("SELECT locale, is_admin, last_login_at FROM users WHERE email = 'lan@example.vn'").first<{
      locale: string;
      is_admin: number;
      last_login_at: string | null;
    }>();
    expect(user).toMatchObject({ locale: "vi", is_admin: 0 });
    expect(user?.last_login_at).not.toBeNull();
  });

  it("refuses a reused link", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "reuse@vnx.si" }), undefined, testEnv);
    const url = `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`;
    expect((await app.request(url, {}, testEnv)).status).toBe(303);
    const again = await app.request(url, {}, testEnv);
    expect(again.status).toBe(400);
    expect(await again.text()).toContain("This sign-in link no longer works");
  });

  it("makes ADMIN_EMAILS users admins, case-insensitively", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "Owner@VNX.si" }), undefined, testEnv);
    await app.request(`https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`, {}, testEnv);
    const row = await testEnv.DB.prepare("SELECT is_admin FROM users WHERE email = 'owner@vnx.si'").first<{ is_admin: number }>();
    expect(row?.is_admin).toBe(1);
  });

  it("follows a safe next and ignores an unsafe one", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "n1@vnx.si", next: "/hub" }), undefined, testEnv);
    const ok = await app.request(`https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2Fhub`, {}, testEnv);
    expect(ok.headers.get("location")).toBe("/hub");
    clearOutbox();
    await app.request(formPost("/login", { email: "n2@vnx.si" }), undefined, testEnv);
    const bad = await app.request(`https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2F%2Fevil.com`, {}, testEnv);
    expect(bad.headers.get("location")).toBe("/");
  });

  it("rejects bad emails, missing Origin and too many attempts", async () => {
    const app = createApp();
    expect((await app.request(formPost("/login", { email: "nope" }), undefined, testEnv)).status).toBe(400);
    const noOrigin = new Request("https://vnx.si/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=a%40vnx.si",
    });
    expect((await app.request(noOrigin, undefined, testEnv)).status).toBe(403);

    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await app.request(formPost("/login", { email: "flood@vnx.si" }), undefined, testEnv)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("escapes HTML in a rejected email value", async () => {
    const res = await createApp().request(formPost("/login", { email: "<script>x</script>" }), undefined, testEnv);
    expect(await res.text()).not.toContain("<script>x</script>");
  });

  it("logs out and invalidates the session", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "out@vnx.si" }), undefined, testEnv);
    const verify = await app.request(`https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`, {}, testEnv);
    const sid = cookieFrom(verify);
    const out = await app.request(formPost("/logout", {}, { cookie: `__Host-vnx_session=${sid}` }), undefined, testEnv);
    expect(out.status).toBe(303);
    expect(out.headers.get("set-cookie") ?? "").toMatch(/__Host-vnx_session=;/);
    const left = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1")
      .bind(await sha256Hex(sid))
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npm test -- test/auth/login-flow.test.ts test/http/next.test.ts`
Expected: FAIL, không tìm thấy module / route trả 404.

- [ ] **Step 3: Tạo `src/http/next.ts` và `src/auth/admin.ts`**

```ts
// apps/web/src/http/next.ts
/** Returns a same-site path or null. Blocks protocol-relative, absolute and backslash tricks. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || value.startsWith("//")) return null;
  return value;
}
```

```ts
// apps/web/src/auth/admin.ts
import type { Bindings } from "../env.ts";

export function adminEmails(env: Pick<Bindings, "ADMIN_EMAILS">): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
```

- [ ] **Step 4: Tạo `src/views/auth.tsx`**

```tsx
// apps/web/src/views/auth.tsx
import type { FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { Layout } from "./Layout.tsx";

type Base = { locale: Locale; origin: string };

export const LoginPage: FC<Base & { email?: string; next?: string | null; error?: string }> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("login.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("login.title")}</h1>
        <p>{tr("login.intro")}</p>
        <form method="post" action={localizedPath(props.locale, "/login")}>
          <div class="field">
            <label for="email">{tr("login.emailLabel")}</label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              value={props.email ?? ""}
              aria-invalid={props.error ? "true" : undefined}
              aria-describedby={props.error ? "email-error" : undefined}
            />
            {props.error ? (
              <p id="email-error" class="error-msg" role="alert">
                {props.error}
              </p>
            ) : null}
          </div>
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <button class="btn" type="submit">
            {tr("login.submit")}
          </button>
        </form>
      </section>
    </Layout>
  );
};

export const LoginSentPage: FC<Base & { email: string }> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("login.sent.title")} origin={props.origin} rest="/login" noindex>
      <section class="card" role="status">
        <h1>{tr("login.sent.title")}</h1>
        <p>{tr("login.sent.body", { email: props.email })}</p>
      </section>
    </Layout>
  );
};

export const InvalidLinkPage: FC<Base> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("auth.invalidLink.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("auth.invalidLink.title")}</h1>
        <p>{tr("auth.invalidLink.body")}</p>
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("auth.invalidLink.cta")}
        </a>
      </section>
    </Layout>
  );
};
```

- [ ] **Step 5: Tạo `src/routes/auth.tsx`**

```tsx
// apps/web/src/routes/auth.tsx
import type { Context, Hono } from "hono";
import { z } from "zod";
import { adminEmails } from "../auth/admin.ts";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "../auth/cookies.ts";
import { sha256Hex } from "../auth/crypto.ts";
import { createSession, deleteSession } from "../auth/sessions.ts";
import { consumeLoginToken, createLoginToken } from "../auth/tokens.ts";
import { writeAudit } from "../db/audit.ts";
import { createUser, findUserByEmail, markLogin } from "../db/users.ts";
import { getMailer } from "../email/index.ts";
import { loginEmail } from "../email/templates/login.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { safeNext } from "../http/next.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { InvalidLinkPage, LoginPage, LoginSentPage } from "../views/auth.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const LoginForm = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });

const HOUR = 3600;

function origin(c: Context<AppEnv>) {
  return new URL(c.req.url).origin;
}

export function registerAuthRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/login", (c) =>
    page(c, <LoginPage locale={c.get("locale")} origin={origin(c)} next={safeNext(c.req.query("next"))} />),
  );

  onLocalized(app, "post", "/login", async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const form = await c.req.parseBody();
    const next = safeNext(form.next);
    const parsed = LoginForm.safeParse({ email: form.email });
    if (!parsed.success) {
      const typed = typeof form.email === "string" ? form.email : "";
      return page(c, <LoginPage locale={locale} origin={origin(c)} email={typed} next={next} error={tr("login.error.email")} />, 400);
    }
    const email = parsed.data.email;
    const now = new Date();
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const byEmail = await hitRateLimit(c.env.DB, `login:email:${await sha256Hex(email)}`, 5, HOUR, now.getTime());
    const byIp = await hitRateLimit(c.env.DB, `login:ip:${ip}`, 20, HOUR, now.getTime());
    if (!byEmail.allowed || !byIp.allowed) {
      return page(c, <LoginPage locale={locale} origin={origin(c)} email={email} next={next} error={tr("login.error.rateLimited")} />, 429);
    }

    const token = await createLoginToken(c.env.DB, { email, purpose: "login", locale }, now);
    const link = new URL("/auth/verify", c.env.APP_ORIGIN);
    link.searchParams.set("t", token);
    if (next) link.searchParams.set("next", next);
    try {
      await getMailer(c.env).send({ to: email, ...loginEmail(locale, link.toString()) });
    } catch (err) {
      console.error(JSON.stringify({ requestId: c.get("requestId"), event: "login.mail_failed", error: String(err) }));
      return page(c, <LoginPage locale={locale} origin={origin(c)} email={email} next={next} error={tr("login.error.sendFailed")} />, 502);
    }
    return page(c, <LoginSentPage locale={locale} origin={origin(c)} email={email} />);
  });

  app.get("/auth/verify", async (c) => {
    const now = new Date();
    const result = await consumeLoginToken(c.env.DB, c.req.query("t") ?? "", now);
    if (!result.ok) return page(c, <InvalidLinkPage locale="en" origin={origin(c)} />, 400);

    const { email, locale } = result.token;
    const iso = now.toISOString();
    const user = (await findUserByEmail(c.env.DB, email)) ?? (await createUser(c.env.DB, { email, locale, now: iso }));
    if (user.status !== "active") return errorResponse(c, "forbidden", 403);

    await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(email) });
    await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { purpose: result.token.purpose }, now: iso });
    writeSessionCookie(c, await createSession(c.env.DB, user.id, now));
    return c.redirect(safeNext(c.req.query("next")) ?? localizedPath(locale, "/"), 303);
  });

  app.post("/logout", async (c) => {
    const raw = readSessionCookie(c);
    if (raw) await deleteSession(c.env.DB, raw);
    clearSessionCookie(c);
    return c.redirect("/", 303);
  });
}
```

Inquiry và request (M5, M6) dùng lại `/auth/verify`, rẽ nhánh theo `result.token.purpose`. Ở task này chỉ có `login`.

- [ ] **Step 6: Gắn route trong `apps/web/src/app.ts`**

Thêm `import { registerAuthRoutes } from "./routes/auth.tsx";` và gọi `registerAuthRoutes(app);` ngay sau 4 dòng `app.use(...)`, trước `app.get("/api/health", ...)`.

- [ ] **Step 7: Chạy toàn bộ test và typecheck**

Run: `npm test && npm run typecheck -w apps/web`
Expected: PASS toàn bộ.

- [ ] **Step 8: Kiểm tay ở máy local**

Tạo `apps/web/.dev.vars` (đã gitignore):

```
APP_ORIGIN=http://localhost:8787
ADMIN_EMAILS=<email của Owner>
```

Run: `npm run db:migrate:local -w apps/web && npm run dev`
1. Mở `http://localhost:8787/vi/login`, nhập email.
2. Terminal in nội dung email (ConsoleMailer). Mở link trong email.
3. Trình duyệt về `/vi/` (landing cũ không có bản `/vi/` nên hiện trang 404 tiếng Việt; đúng với M1) và có cookie `__Host-vnx_session`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): magic-link login, verify and logout routes with admin bootstrap"
```

---

## Sau khi xong M0–M1

Reviewer:
- Cập nhật `.ai/context/CURRENT-STATUS.md`.
- Kiểm cổng ra M0 và M1 trong `docs/roadmap/WAVE1-ROADMAP.md`.
- Viết plan M2 dựa trên code thật.
