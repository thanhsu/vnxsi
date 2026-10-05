# VNX-0803-fix — Khắc phục review bảo mật (F2, F4, F6, F8, F9) · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Trạng thái:** APPROVED theo ủy quyền Owner 2026-10-05 ("i do F1 later, you start fix from F2"; cách làm từ M6: Reviewer duyệt plan thay Owner)
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → VNX-0803 Review bảo mật toàn nhánh (phần khắc phục)
- **Spec:** Wave 1 §8.2 (CSRF, cookie), §8.5 (ảnh ≤ 2 MB), §8.6 (JSX escape, không inline); NFR `docs/blueprint/02-NFR.md` §Bảo mật
- **Review nguồn:** `.ai/reviews/VNX-0803-security-review.md` (F2 headers, F4 body limit, F6 driver console, F8 no-store khi đăng nhập, F9 `.gitignore`)
- **ADR:** ADR-001 (Hono trên một Worker), ADR-002 (không đổi)
- **Phụ thuộc:** không. Nhánh `fix/vnx-0803-security` tách từ `main` `b60d8ed` (độc lập với EPIC 21; các file đụng tới chỉ khác `main` ở 2 dòng import trong `app.ts`).
- **Implementer / Reviewer:** subagent (context mới) / Claude

**Goal:** Đóng 5 phát hiện bảo mật có thể sửa bằng code mà không đổi kiến trúc: header bảo mật toàn app, giới hạn kích thước body, chốt driver mail giả/console, `no-store` cho trang HTML của người đã đăng nhập, ignore worktree của agent.

**Architecture:** Hai middleware mới trong `apps/web/src/http/` (`security-headers.ts`, `body-limit.ts`) đăng ký ở `app.ts`; `security-headers` đặt header *sau* `next()` và chỉ khi route chưa đặt, nên route vẫn ghi đè được (`/join`, `/auth/verify` giữ `no-referrer`). CSP kiểu allow-list (không nonce) vì trang không có script/style inline; một `style=` duy nhất ở `LegalPage.tsx` đổi thành `data-color` + CSS. `body-limit` dùng `hono/body-limit` sẵn có (kiểm Content-Length, thiếu thì đếm khi stream). Driver mail `fake`/`console` chỉ có hiệu lực khi không có `RESEND_API_KEY`.

**Tech Stack:** Hono 4 (`hono/body-limit`), Vitest trong workerd (`@cloudflare/vitest-pool-workers`), TypeScript.

**Spec:** `.ai/reviews/VNX-0803-security-review.md` (mục Phát hiện F2, F4, F6, F8, F9) + `.ai/tasks/VNX-0803-fix-handoff.md`.

## Global Constraints

- Không thêm dependency. `hono/body-limit` là module con của `hono` đã có.
- Không đổi hành vi nghiệp vụ nào: mọi test hiện có phải xanh (1019/1019 tại `main`), trừ một test cập nhật markup swatch (Task 1).
- Mọi comment code bằng tiếng Anh, theo kiểu file lân cận (một dòng "Review VNX-0803 Fn: lý do").
- Commit theo Conventional Commits, mỗi task một commit, kèm dòng cuối `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Không `git push`, không merge.
- `form-action 'self'` (CSP) có hiệu lực cả với redirect sau POST trên Chrome: từ nay handler POST không được redirect ra ngoài site (hiện không có handler nào làm vậy; `/go/` của M7 là GET).

## Review Focus

1. Trang có Turnstile khi chưa đăng nhập (`/contact`, `/request`, `/p/:slug/inquiry/:type`): CSP phải cho `https://challenges.cloudflare.com` ở `script-src` và `frame-src` (tài liệu Cloudflare: chỉ cần hai directive này, không cần `'unsafe-inline'`) — Task 1 test "CSP allows nothing inline" chạy qua `/contact`, `/request`.
2. Response không do Hono tạo (`ASSETS.fetch`, `new Response` ở `/media/*`): header vẫn phải được thêm và không được ném "immutable headers" — Task 1 dùng `c.header()` (Hono clone response đã finalize) và test trên route trả `new Response`.
3. Upload ảnh 3 MB (test hiện có `test/hub/media.test.ts`) phải vẫn nhận trang 400 "larger than 2 MB" thân thiện, không phải 413 — Task 2 đặt trần upload 8 MB, trên đó mới 413.
4. Người đã đăng nhập tải `/assets/app.css`, font: không được `no-store` (chỉ HTML) — Task 4 test.
5. `MAIL_DRIVER=fake` kèm `RESEND_API_KEY` (cấu hình nhầm ở production): mail không được "biến mất" và Turnstile giả không được chấp nhận `test-pass` — Task 3 test cả `getMailer` lẫn `turnstileSiteKey`/`verifyTurnstile`.

---

### Task 1: Header bảo mật toàn app (F2)

**Files:**
- Create: `apps/web/src/http/security-headers.ts`
- Modify: `apps/web/src/app.ts:44-48` (đăng ký middleware)
- Modify: `apps/web/src/routes/auth.tsx:118-120,127-129` (`Referrer-Policy: no-referrer` ở GET và POST `/auth/verify`)
- Modify: `apps/web/src/views/LegalPage.tsx:37-45` (swatch không dùng `style=`)
- Modify: `apps/web/public/assets/app.css:288` (màu swatch theo `data-color`)
- Modify: `apps/web/test/legal/pages.test.ts:163-169` (markup swatch mới)
- Test: `apps/web/test/http/security-headers.test.ts`

**Interfaces:**
- Produces: `export const CONTENT_SECURITY_POLICY: string`, `export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]>`, `export const securityHeaders: MiddlewareHandler<AppEnv>` từ `src/http/security-headers.ts`.

- [ ] **Step 1: Viết test thất bại cho middleware và cho app**

Tạo `apps/web/test/http/security-headers.test.ts`:

```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { AppEnv } from "../../src/env.ts";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "../../src/http/security-headers.ts";
import { getReq, testEnv } from "../helpers.ts";

describe("securityHeaders middleware (VNX-0803 F2)", () => {
  const app = new Hono<AppEnv>();
  app.use("*", securityHeaders);
  app.get("/raw", () => new Response("raw"));
  app.get("/own", (c) => {
    c.header("Referrer-Policy", "no-referrer");
    return c.text("own");
  });

  it("adds every header, also to a response built outside Hono", async () => {
    const res = await app.request("https://vnx.si/raw", {}, testEnv);
    expect(res.headers.get("content-security-policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("keeps a header the route set itself", async () => {
    const res = await app.request("https://vnx.si/own", {}, testEnv);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("names exactly the sources the pages use", () => {
    expect(CONTENT_SECURITY_POLICY.split("; ")).toEqual([
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]);
  });
});

describe("security headers on the real app (VNX-0803 F2)", () => {
  it("covers pages, assets, 404s, API and errors", async () => {
    const app = createApp();
    for (const path of ["/", "/login", "/vi/products", "/assets/app.css", "/zh-hant/nope", "/api/nope", "/robots.txt", "/media/nope"]) {
      const res = await app.request(getReq(path), undefined, testEnv);
      expect(res.headers.get("content-security-policy"), path).toBe(CONTENT_SECURITY_POLICY);
      expect(res.headers.get("x-frame-options"), path).toBe("DENY");
      expect(res.headers.get("x-content-type-options"), path).toBe("nosniff");
      expect(res.headers.get("referrer-policy"), path).not.toBeNull();
    }
  });

  it("sends no referrer from the magic-link and invite pages, the default elsewhere", async () => {
    const app = createApp();
    const get = (path: string) => app.request(getReq(path), undefined, testEnv);
    expect((await get("/auth/verify?t=nope")).headers.get("referrer-policy")).toBe("no-referrer");
    expect((await get(`/join/${"a".repeat(22)}`)).headers.get("referrer-policy")).toBe("no-referrer");
    expect((await get("/login")).headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("CSP needs nothing inline: no page carries a style attribute, an event handler or an executable inline script", async () => {
    const app = createApp();
    for (const path of ["/", "/login", "/products", "/builders", "/request", "/contact", "/terms", "/privacy", "/media-kit", "/vi", "/zh-hans/contact", "/auth/verify?t=nope"]) {
      const html = await (await app.request(getReq(path), undefined, testEnv)).text();
      expect(html, path).not.toMatch(/\sstyle="/);
      expect(html, path).not.toMatch(/\son[a-z]+="/);
      for (const m of html.matchAll(/<script\b[^>]*>/g)) {
        expect(m[0], `${path}: ${m[0]}`).toMatch(/^<script (src="\/assets\/[^"]+"|src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"|type="application\/ld\+json")/);
      }
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd apps/web && npx vitest run test/http/security-headers.test.ts`
Expected: FAIL — "Cannot find module '../../src/http/security-headers.ts'".

- [ ] **Step 3: Viết middleware**

Tạo `apps/web/src/http/security-headers.ts`:

```ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

/**
 * Review VNX-0803 F2. Allow-list CSP: the pages carry no inline script (JSON-LD is a data block, never executed) and no
 * inline style; Turnstile needs only its script and frame origin
 * (https://developers.cloudflare.com/turnstile/reference/content-security-policy/). `form-action 'self'` also covers the
 * redirect after a POST in Chrome, so a POST handler must never redirect off-site.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", CONTENT_SECURITY_POLICY],
  // Legacy twin of frame-ancestors for browsers without CSP level 2.
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  // One year, this host only (no includeSubDomains until every subdomain is known to serve HTTPS).
  ["Strict-Transport-Security", "max-age=31536000"],
];

/**
 * Adds each header unless the route already set it, so /join and /auth/verify keep their stricter Referrer-Policy.
 * Runs after the handler: c.header() on a finalized response makes Hono clone it, which also covers responses built
 * outside Hono (ASSETS.fetch, /media/*), whose headers are immutable.
 */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  for (const [name, value] of SECURITY_HEADERS) {
    if (!c.res.headers.has(name)) c.header(name, value);
  }
};
```

Sửa `apps/web/src/app.ts`: thêm `import { securityHeaders } from "./http/security-headers.ts";` cạnh các import `./http/*`, và trong `createApp()` đặt ngay sau `app.use("*", requestId);`:

```ts
  app.use("*", requestId);
  app.use("*", securityHeaders);
  app.use("*", localeMiddleware);
```

Sửa `apps/web/src/routes/auth.tsx`: trong `app.get("/auth/verify", …)` và `app.post("/auth/verify", …)`, ngay sau dòng `c.header("Cache-Control", "no-store");` hiện có, thêm:

```ts
    // The token is in the URL (GET) and in the form (POST): never leak the page's address (VNX-0803 F2).
    c.header("Referrer-Policy", "no-referrer");
```

- [ ] **Step 4: Bỏ `style=` ở swatch**

Sửa `apps/web/src/views/LegalPage.tsx`: thay khối `if (tok.kind === "code") { … }` (dòng 36–45) bằng:

```ts
      if (tok.kind === "code") {
        // Media kit brand colours: a swatch beside the code. Only the three brand colours have a CSS rule
        // (.swatch[data-color=…] in app.css); no inline style, so the CSP needs no 'unsafe-inline' (VNX-0803 F2).
        if (BRAND_COLORS.has(tok.text.toUpperCase())) {
          return (
            <>
              <span class="swatch" data-color={tok.text.toUpperCase()} aria-hidden="true"></span>
              <code>{tok.text}</code>
            </>
          );
        }
        return <code>{tok.text}</code>;
      }
```

và thay dòng `const HEX = /^#[0-9A-Fa-f]{6}$/;` (dòng 13) bằng:

```ts
/** The media kit's three brand colours (docs/legal/media-kit.md); each has a .swatch[data-color] rule in app.css. */
const BRAND_COLORS: ReadonlySet<string> = new Set(["#0D1526", "#1D4ED8", "#F4F5F7"]);
```

(`HEX` không còn được dùng ở đâu khác trong file; nếu `parseInline` dùng, giữ nguyên `HEX` và chỉ thêm `BRAND_COLORS`.)

Sửa `apps/web/public/assets/app.css` dòng 288, thêm ngay sau dòng `.swatch { … }`:

```css
.swatch[data-color="#0D1526"] { background-color: #0D1526; }
.swatch[data-color="#1D4ED8"] { background-color: #1D4ED8; }
.swatch[data-color="#F4F5F7"] { background-color: #F4F5F7; }
```

Sửa `apps/web/test/legal/pages.test.ts` dòng 166:

```ts
      expect(main, hex).toMatch(new RegExp(`<span class="swatch" data-color="${hex}" aria-hidden="true"></span><code>${hex}</code>`));
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `cd apps/web && npx vitest run test/http/security-headers.test.ts test/legal/pages.test.ts test/http/no-store.test.ts test/app.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/http/security-headers.ts apps/web/src/app.ts apps/web/src/routes/auth.tsx apps/web/src/views/LegalPage.tsx apps/web/public/assets/app.css apps/web/test/http/security-headers.test.ts apps/web/test/legal/pages.test.ts
git commit -m "fix(web): security response headers, CSP without inline styles (VNX-0803 F2)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Giới hạn kích thước body (F4)

**Files:**
- Create: `apps/web/src/http/body-limit.ts`
- Modify: `apps/web/src/app.ts` (đăng ký sau `originCheck`)
- Test: `apps/web/test/http/body-limit.test.ts`

**Interfaces:**
- Consumes: `MAX_MEDIA_BYTES` từ `src/domain/product.ts:21` (2 MB), `localeFromPath(path).rest` từ `src/i18n/locales.ts` (như `http/no-store.ts`).
- Produces: `export const MAX_FORM_BYTES = 65536`, `export const MAX_UPLOAD_BYTES = 4 * MAX_MEDIA_BYTES` (8 MB), `export function maxBodyBytes(path: string): number`, `export const requestBodyLimit: MiddlewareHandler<AppEnv>`.

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/web/test/http/body-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { MAX_FORM_BYTES, MAX_UPLOAD_BYTES, maxBodyBytes } from "../../src/http/body-limit.ts";
import { testEnv } from "../helpers.ts";

const ID = "01HZZZZZZZZZZZZZZZZZZZZZZZ";
const post = (path: string, body: BodyInit, headers: Record<string, string> = {}, extra: RequestInit = {}) =>
  createApp().request(
    new Request(`https://vnx.si${path}`, {
      method: "POST",
      headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded", ...headers },
      body,
      ...extra,
    }),
    undefined,
    testEnv,
  );

describe("request body limit (VNX-0803 F4)", () => {
  it("picks the upload ceiling only for the image upload path, in every locale", () => {
    expect(maxBodyBytes("/contact")).toBe(MAX_FORM_BYTES);
    expect(maxBodyBytes(`/hub/products/${ID}/media`)).toBe(MAX_UPLOAD_BYTES);
    expect(maxBodyBytes(`/vi/hub/products/${ID}/media`)).toBe(MAX_UPLOAD_BYTES);
    expect(maxBodyBytes(`/hub/products/${ID}/media/${ID}/delete`)).toBe(MAX_FORM_BYTES);
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });

  it("answers 413 to a form POST above 64 KB, by Content-Length and when streamed without one", async () => {
    const big = `message=${"a".repeat(MAX_FORM_BYTES + 1)}`;
    const declared = await post("/contact", big);
    expect(declared.status).toBe(413);
    expect(await declared.text()).toBe("Payload Too Large");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const streamed = await post("/contact", stream, {}, { duplex: "half" } as RequestInit);
    expect(streamed.status).toBe(413);
  });

  it("lets a normal form through and leaves GET alone", async () => {
    expect((await post("/contact", "message=hi")).status).not.toBe(413);
    const get = await createApp().request(new Request("https://vnx.si/contact", { headers: { "content-length": String(MAX_FORM_BYTES * 10) } }), undefined, testEnv);
    expect(get.status).toBe(200);
  });

  it("allows an upload body up to the upload ceiling and refuses above it", async () => {
    const path = `/hub/products/${ID}/media`;
    const multipart = { "content-type": "multipart/form-data; boundary=x" };
    // Signed out: the route redirects to /login; what matters is that the limit did not fire.
    const under = await post(path, new Uint8Array(MAX_FORM_BYTES * 2), multipart);
    expect(under.status).not.toBe(413);
    const over = await post(path, new Uint8Array(8), { ...multipart, "content-length": String(MAX_UPLOAD_BYTES + 1) });
    expect(over.status).toBe(413);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd apps/web && npx vitest run test/http/body-limit.test.ts`
Expected: FAIL — "Cannot find module '../../src/http/body-limit.ts'".

- [ ] **Step 3: Viết middleware**

Tạo `apps/web/src/http/body-limit.ts`:

```ts
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_MEDIA_BYTES } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

/** Forms are small (the longest field is 4000 characters); 64 KB leaves room for multipart framing. */
export const MAX_FORM_BYTES = 64 * 1024;
/**
 * The image upload: routes/hub-media.tsx answers anything over 2 MB + 64 KB with its own friendly 400 page, so this
 * ceiling only stops bodies that are far too large (8 MB) from being buffered at all.
 */
export const MAX_UPLOAD_BYTES = 4 * MAX_MEDIA_BYTES;
const UPLOAD_PATH = /^\/hub\/products\/[^/]+\/media$/;

export function maxBodyBytes(path: string): number {
  return UPLOAD_PATH.test(localeFromPath(path).rest) ? MAX_UPLOAD_BYTES : MAX_FORM_BYTES;
}

/**
 * Review VNX-0803 F4: refuses an oversized body (by Content-Length, or while reading when it is missing) before any
 * route buffers it with parseBody(). GET and HEAD have no body and pass through.
 */
export const requestBodyLimit: MiddlewareHandler<AppEnv> = (c, next) =>
  bodyLimit({ maxSize: maxBodyBytes(c.req.path), onError: (cc) => cc.text("Payload Too Large", 413) })(c, next);
```

Nếu `tsc` báo kiểu không khớp giữa `Context<AppEnv>` và tham số của middleware do `bodyLimit` trả về, dùng:

```ts
export const requestBodyLimit: MiddlewareHandler<AppEnv> = (c, next) =>
  bodyLimit({ maxSize: maxBodyBytes(c.req.path), onError: (cc) => cc.text("Payload Too Large", 413) })(c as never, next);
```

Sửa `apps/web/src/app.ts`: thêm `import { requestBodyLimit } from "./http/body-limit.ts";` và đăng ký ngay sau `originCheck`:

```ts
  app.use("*", originCheck);
  app.use("*", requestBodyLimit);
  app.use("*", sessionMiddleware);
```

- [ ] **Step 4: Chạy test, xác nhận xanh (kể cả test upload hiện có)**

Run: `cd apps/web && npx vitest run test/http/body-limit.test.ts test/hub/media.test.ts test/contact test/public`
Expected: PASS toàn bộ; test "refuses an oversized upload from its Content-Length" vẫn nhận 400 "larger than 2 MB" (3 MB < 8 MB).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/http/body-limit.ts apps/web/src/app.ts apps/web/test/http/body-limit.test.ts
git commit -m "fix(web): cap request bodies before routes buffer them (VNX-0803 F4)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Driver mail giả / console chỉ khi không có khóa thật (F6)

**Files:**
- Modify: `apps/web/src/email/index.ts:10-16`
- Modify: `apps/web/src/http/turnstile.ts:8-12`
- Test: `apps/web/test/email/get-mailer.test.ts`, `apps/web/test/http/turnstile.test.ts`

**Interfaces:**
- Produces: `export function isFakeMail(env: Pick<Bindings, "MAIL_DRIVER" | "RESEND_API_KEY">): boolean` từ `src/email/index.ts`; `turnstile.ts` dùng nó thay cho phép so sánh `MAIL_DRIVER === "fake"`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe("getMailer", …)` trong `apps/web/test/email/get-mailer.test.ts`:

```ts
  it("ignores the console and fake drivers once a real key exists (VNX-0803 F6)", () => {
    for (const driver of ["console", "fake"]) {
      const env = { ...testEnv, MAIL_DRIVER: driver, RESEND_API_KEY: "re_live_key" } as Bindings;
      expect(getMailer(env), driver).toBeInstanceOf(ResendMailer);
    }
  });
```

Thêm vào `describe("Turnstile …")` trong `apps/web/test/http/turnstile.test.ts`, sau test "honours the fake driver only alongside the fake mailer":

```ts
  it("drops the fake driver when a real mail key is set, even with MAIL_DRIVER=fake (VNX-0803 F6)", async () => {
    const misconfigured = { ...testEnv, RESEND_API_KEY: "re_live_key", TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    expect(misconfigured.MAIL_DRIVER).toBe("fake");
    expect(turnstileSiteKey(misconfigured)).toBeNull();
    expect(await verifyTurnstile(misconfigured, FAKE_TURNSTILE_PASS, null)).toBe("unavailable");
  });
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd apps/web && npx vitest run test/email/get-mailer.test.ts test/http/turnstile.test.ts`
Expected: FAIL ở hai test mới (nhận `ConsoleMailer`/`FakeMailer`; Turnstile trả "pass" / "fake-site-key").

- [ ] **Step 3: Sửa code**

`apps/web/src/email/index.ts` thành:

```ts
import type { Bindings } from "../env.ts";
import { ConsoleMailer } from "./console.ts";
import { FakeMailer } from "./fake.ts";
import type { Mailer } from "./mailer.ts";
import { ResendMailer } from "./resend.ts";
import { UnconfiguredMailer } from "./unconfigured.ts";

const DEFAULT_FROM = "VNX.SI <noreply@vnx.si>";

const realKey = (env: Pick<Bindings, "RESEND_API_KEY">) => env.RESEND_API_KEY?.trim() || null;

/**
 * Review VNX-0803 F6: the fake and console drivers (tests, local dev) only count while no real key exists. A production
 * environment always has RESEND_API_KEY, so a stray MAIL_DRIVER can neither swallow mail nor print magic links to the logs.
 * The fake Turnstile driver is tied to this too (http/turnstile.ts).
 */
export function isFakeMail(env: Pick<Bindings, "MAIL_DRIVER" | "RESEND_API_KEY">): boolean {
  return env.MAIL_DRIVER === "fake" && realKey(env) === null;
}

export function getMailer(env: Bindings): Mailer {
  const apiKey = realKey(env);
  if (apiKey) return new ResendMailer(apiKey, env.MAIL_FROM ?? DEFAULT_FROM);
  if (env.MAIL_DRIVER === "fake") return new FakeMailer();
  if (env.MAIL_DRIVER === "console") return new ConsoleMailer();
  return new UnconfiguredMailer();
}
```

`apps/web/src/http/turnstile.ts`: thêm `import { isFakeMail } from "../email/index.ts";`, đổi `TurnstileEnv` và `isFake` thành:

```ts
type TurnstileEnv = Pick<Bindings, "TURNSTILE_DRIVER" | "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET" | "MAIL_DRIVER" | "RESEND_API_KEY">;

// The fake driver counts only next to the fake mailer, which itself only counts without a real mail key (VNX-0803 F6):
// production never runs that mailer, while the test env shares APP_ORIGIN with production, so the origin cannot be the signal.
const isFake = (env: TurnstileEnv) => env.TURNSTILE_DRIVER === "fake" && isFakeMail(env);
```

Kiểm tra `test/architecture.test.ts` (quét import giữa các lớp): `http/` import `email/index.ts` phải được phép; nếu test kiến trúc chặn, chuyển `isFakeMail` sang file mới `apps/web/src/email/driver.ts` (chỉ import `Bindings`) và cho cả `email/index.ts` lẫn `http/turnstile.ts` import từ đó; ghi lý do trong báo cáo.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `cd apps/web && npx vitest run test/email test/http/turnstile.test.ts test/architecture.test.ts test/public test/contact`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/email/index.ts apps/web/src/http/turnstile.ts apps/web/test/email/get-mailer.test.ts apps/web/test/http/turnstile.test.ts
git commit -m "fix(web): fake and console mail drivers only without a real key (VNX-0803 F6)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Nếu thêm `email/driver.ts`, `git add` cả file đó.)

---

### Task 4: `no-store` cho mọi trang HTML của người đã đăng nhập (F8)

**Files:**
- Modify: `apps/web/src/http/no-store.ts`
- Test: `apps/web/test/http/no-store.test.ts`

**Interfaces:**
- Consumes: `c.get("user")` do `sessionMiddleware` đặt (null khi chưa đăng nhập), đăng ký trước `noStorePrivate` trong `app.ts`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe` trong `apps/web/test/http/no-store.test.ts`:

```ts
  it("marks every HTML page for a signed-in person, but not their assets (VNX-0803 F8)", async () => {
    const user = await signIn("ns-u@vnx.si");
    const app = createApp();
    for (const path of ["/contact", "/request", "/vi", "/products", "/login"]) {
      expect((await app.request(getReq(path, user.cookie), undefined, testEnv)).headers.get("cache-control"), path).toBe("no-store");
    }
    expect((await app.request(getReq("/assets/app.css", user.cookie), undefined, testEnv)).headers.get("cache-control")).not.toBe("no-store");
    expect((await app.request(getReq("/robots.txt", user.cookie), undefined, testEnv)).headers.get("cache-control")).toBe("public, max-age=3600");
    expect((await app.request(getReq("/contact"), undefined, testEnv)).headers.get("cache-control")).toBeNull();
  });
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd apps/web && npx vitest run test/http/no-store.test.ts`
Expected: FAIL — `/contact` với cookie trả `null` thay vì `no-store`.

- [ ] **Step 3: Sửa middleware**

`apps/web/src/http/no-store.ts` thành:

```ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

const PRIVATE = /^\/(hub|me|admin)(\/|$)/;
const isHtml = (res: Response) => (res.headers.get("content-type") ?? "").startsWith("text/html");

/**
 * Pages with personal data must never be stored by browsers or shared caches: the private areas, and (VNX-0803 F8) any
 * HTML page shown to a signed-in person, since public forms prefill their name or e-mail. Assets and feeds keep their caching.
 */
export const noStorePrivate: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (PRIVATE.test(localeFromPath(c.req.path).rest) || (c.get("user") !== null && isHtml(c.res))) c.header("Cache-Control", "no-store");
};
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `cd apps/web && npx vitest run test/http/no-store.test.ts test/seo test/design`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/http/no-store.ts apps/web/test/http/no-store.test.ts
git commit -m "fix(web): no-store on every HTML page of a signed-in user (VNX-0803 F8)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Ignore worktree của agent (F9), kiểm tra toàn bộ, báo cáo

**Files:**
- Modify: `.gitignore`
- Create: `.ai/tasks/VNX-0803-fix-report.md`

- [ ] **Step 1: Xác nhận chưa ignore**

Run (từ gốc repo): `git check-ignore -q .claude/worktrees/x/README.md; echo $?`
Expected: `1` (chưa ignore).

- [ ] **Step 2: Thêm vào `.gitignore`**

Thêm hai dòng cuối file `.gitignore`:

```
# Worktrees the coding agent creates (a full copy of the repo; never commit them).
.claude/worktrees/
```

- [ ] **Step 3: Xác nhận đã ignore**

Run: `git check-ignore -q .claude/worktrees/x/README.md; echo $?`
Expected: `0`.

- [ ] **Step 4: Chạy toàn bộ kiểm tra**

Run (từ gốc repo): `npm run typecheck -w apps/web && npm test`
Expected: typecheck sạch; `Test Files N passed (N)`, `Tests M passed (M)` với M ≥ 1019 + số test mới (ít nhất 1030), 0 failed.

- [ ] **Step 5: Viết báo cáo**

Tạo `.ai/tasks/VNX-0803-fix-report.md` gồm: SHA từng commit; kết quả hai lệnh ở Step 4 (dán số test); mỗi AC của handoff kèm lệnh đã chạy và kết quả; file sửa ngoài danh sách (nếu có) kèm lý do; điều chưa làm.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .ai/tasks/VNX-0803-fix-report.md
git commit -m "chore: ignore agent worktrees; VNX-0803-fix report (VNX-0803 F9)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Mọi response (trang, asset, 404, `/api`, `/media`) mang CSP đúng chuỗi, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `/auth/verify` và `/join/:code` giữ `no-referrer` | `npx vitest run test/http/security-headers.test.ts` |
| AC2 | Không trang nào còn `style=`, `on*=` hay script inline (trừ JSON-LD); swatch media kit vẫn hiện 3 màu | test "CSP needs nothing inline" + `test/legal/pages.test.ts` |
| AC3 | POST > 64 KB → 413 (có và không có Content-Length); upload ≤ 8 MB tới route ảnh; upload 3 MB vẫn nhận 400 thân thiện; GET không bị ảnh hưởng | `npx vitest run test/http/body-limit.test.ts test/hub/media.test.ts` |
| AC4 | `MAIL_DRIVER=console` hoặc `fake` cùng `RESEND_API_KEY` → `ResendMailer`; Turnstile giả không hoạt động khi có khóa thật | `npx vitest run test/email/get-mailer.test.ts test/http/turnstile.test.ts` |
| AC5 | Người đã đăng nhập: mọi trang HTML `no-store`, asset và `robots.txt` giữ cache | `npx vitest run test/http/no-store.test.ts` |
| AC6 | `.claude/worktrees/` bị ignore | `git check-ignore -q .claude/worktrees/x/README.md` → exit 0 |
| AC7 | Toàn bộ xanh | `npm run typecheck -w apps/web && npm test` → 0 failed |

## Câu hỏi mở

- OQ-1 (Owner, sau deploy): kiểm Turnstile thật trên `/contact` khi chưa đăng nhập với CSP đang bật; nếu widget không hiện, bước lùi là thêm `'unsafe-inline'` vào `style-src` (một dòng ở `security-headers.ts`) rồi báo Reviewer.
- OQ-2 (Owner): HSTS `includeSubDomains`/`preload` chỉ bật khi mọi subdomain `vnx.si` chắc chắn chạy HTTPS; plan này chưa bật.
