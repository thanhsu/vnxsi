# VNX-0705a — Báo cáo Implementer

- **Nhánh:** `feat/vnx-0705a-legal` (gốc `fed147b`). Không push, không merge, không deploy.
- **Implementer:** subagent Claude, làm trong worktree riêng.
- **Plan / handoff:** `.ai/plans/VNX-0705a-plan.md`, `.ai/tasks/VNX-0705a-handoff.md`.

## Commit

| SHA | Nội dung |
|---|---|
| `ab11c0e` | `test: legal pages, footer links, sitemap and daily clean-up job (VNX-0705a)`: test viết trước, đã chạy và đỏ (thiếu module `src/legal/content.ts`, `src/jobs/daily.ts`; footer chưa có link; sitemap chưa có 3 trang) |
| `2430868` | `feat(web): Terms, Privacy and Media kit pages with footer links and sitemap entries` |
| `79eca5f` | `feat(web): daily cron deletes old rate-limit windows, expired login tokens and sessions` |
| (commit này) | `docs: VNX-0705a implementer report` |

## File

**Mới:** `apps/web/src/legal/content.ts`, `apps/web/src/routes/legal.tsx`, `apps/web/src/views/LegalPage.tsx`, `apps/web/src/jobs/daily.ts`, `apps/web/test/legal/pages.test.ts`, `apps/web/test/legal/content.test.ts`, `apps/web/test/legal/footer.test.ts`, `apps/web/test/jobs/daily.test.ts`.

**Sửa:** `apps/web/src/app.ts`, `apps/web/src/index.ts`, `apps/web/src/views/Layout.tsx`, `apps/web/src/routes/seo.ts`, `apps/web/src/http/rate-limit.ts`, `apps/web/src/auth/tokens.ts`, `apps/web/src/auth/sessions.ts`, `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`, `apps/web/public/assets/app.css`, `apps/web/wrangler.jsonc`, `apps/web/test/seo/sitemap.test.ts`.

**Ngoài danh sách:** không có (ngoài báo cáo này). Không thêm dependency, không migration, không sửa `docs/legal/*.md`, không dùng `dangerouslySetInnerHTML`.

## Cách làm chính

- `src/legal/content.ts`: dữ liệu thuần (không import gì). Kiểu đúng như plan (`Inline`, `Block`, `Section`, `LegalDoc`) cộng `LegalPage = { rest, dated, en, vi }` và `LEGAL: Record<"terms" | "privacy" | "mediaKit", LegalPage>`. Phần thân sinh **bằng script** từ mục `## EN` / `## VI` của 3 file nguồn (script chỉ chạy một lần ở thư mục tạm, không commit), nên chuỗi giữ nguyên ký tự, kể cả `**`, `` ` ``. Dòng `Last updated: {date}` không nằm trong dữ liệu: view hiện nó qua key `legal.updated` với `LEGAL_UPDATED_AT = "2026-10-04"` (chỉ Terms, Privacy).
- `views/LegalPage.tsx`: `parseInline` (export, có unit test) tách đúng 3 dấu: `` `x` `` → `<code>`, `**x**` → `<strong>`, đúng chuỗi `contact@vnx.si` → `<a href="mailto:contact@vnx.si">`. Mọi thứ khác là text, JSX tự escape. Mã màu dạng `#RRGGBB` trong `<code>` có thêm ô màu `<span class="swatch" style="background-color:#…" aria-hidden="true">` (chỉ Media Kit có mã màu).
- zh-Hans / zh-Hant: `<p class="notice">` với `legal.englishOnly` ở trên cùng, rồi `<div lang="en">` chứa h1 + thân EN. Dòng "Last updated" trên trang zh là câu của locale (`最后更新：…` / `最後更新：…`) và có `lang` của locale đó bên trong khối EN.
- Footer (`Layout.tsx`): tagline trong `<p class="tagline">`, dưới đó `<nav class="footer-nav" aria-label={footer.nav}>` với 3 link theo locale. Key `footer.terms`, `footer.privacy` đã có sẵn từ trước, chỉ thêm `footer.mediaKit`, `footer.nav`.
- Cron: 3 hàm xóa nằm trong module sở hữu bảng (`deleteOldRateLimitWindows` trong `http/rate-limit.ts`, `deleteExpiredLoginTokens` trong `auth/tokens.ts`, `deleteExpiredSessions` trong `auth/sessions.ts`), trả về `meta.changes`. `jobs/daily.ts` chạy 3 bước theo thứ tự, mỗi bước try/catch riêng, log một dòng JSON `{ job: "daily", step, deleted }` (`console.log`) hoặc `{ job: "daily", step, error }` (`console.error`). `index.ts` export `scheduled` → `ctx.waitUntil(runDaily(env, new Date(controller.scheduledTime)))`. Bảng `WRITERS` của test kiến trúc không đổi và vẫn xanh.

## Tiêu chí chấp nhận

| # | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 | Đạt | `test/legal/pages.test.ts` "AC1: every page answers 200…" (3 trang × 4 locale, gọi từ host preview: 200, `<html lang>`, đúng 1 `h1`, `<title>`, canonical `https://vnx.si…`, hreflang 4 + `x-default`, meta description, không `robots`) và "AC1: EN and VI show their own title…" (dòng ngày có ở Terms/Privacy, không có ở Media Kit) |
| AC2 | Đạt | `test/legal/content.test.ts`: đọc `docs/legal/*.md` bằng `import.meta.glob("../../../../docs/legal/*.md", { query: "?raw" })`, chạy được trong workerd (không cần cách khác). Với mỗi trang × EN/VI: mọi tiêu đề, `h2`, đoạn và mục danh sách của file nguồn (bỏ `**`, `` ` ``, thay `{date}`) có mặt trong text của `<main>` **theo đúng thứ tự**. Thêm 1 test: không còn "Ghi chú cho Owner", `{date}`, `**`, `` ` `` |
| AC3 | Đạt | `pages.test.ts` "AC3: zh-Hans and zh-Hant say…" (câu đúng locale, đứng trước thân EN, thân EN trong `<div lang="en">`, không có chữ VI, câu zh kia không lọt sang), "AC3: EN and VI pages carry no English-only notice", "AC3: the zh englishOnly sentences are the approved ones" (so đúng chuỗi trong plan) |
| AC4 | Đạt | `pages.test.ts` "AC4: renders `code`, **bold** and contact@vnx.si…" (4 locale của Privacy), "AC4: content brings no tags of its own" (chỉ các thẻ article/div/p/h1/h2/ul/li/code/strong/a/span, href duy nhất là `mailto:contact@vnx.si`, dữ liệu không có `<`/`>`), unit `parseInline`, và "InlineText escapes everything…" (HTML thô trong text bị escape) |
| AC5 | Đạt | `pages.test.ts` "AC5: the Media kit shows no number except the colour codes, and no partner name" (4 locale; bỏ `#RRGGBB` rồi không còn chữ số; không có PartnerStack, Lovable, Bolt, Replit, Cursor, Vercel, Supabase, Hostinger, Windsurf, v0). Thêm test 3 swatch đúng 3 màu |
| AC6 | Đạt | `test/legal/footer.test.ts`: `/`, `/products`, `/p/:slug` × 4 locale có `<nav class="footer-nav" aria-label=…>` và 3 link đúng prefix + nhãn locale; thêm: 404 localized `/vi/...` cũng có link |
| AC7 | Đạt | `test/seo/sitemap.test.ts` test mới: `/terms`, `/privacy`, `/media-kit` × 4 locale, mỗi `<url>` có đủ 5 `xhtml:link`, mỗi `loc` xuất hiện đúng một lần |
| AC8 | Đạt | `test/jobs/daily.test.ts`: xóa cửa sổ 3 ngày tuổi, giữ cửa sổ 2 ngày − 1 giờ và cửa sổ mới; xóa token hết hạn (sau đó trả `invalid`), token còn hạn vẫn dùng được; xóa session hết hạn, giữ session còn hạn; số `deleted` khớp số dòng thỏa điều kiện đếm trước; chạy lần hai xóa 0; log đúng 3 dòng JSON; một bước lỗi (DB giả ném lỗi với `rate_limits`) thì hai bước sau vẫn chạy và lỗi được log qua `console.error`. `now` luôn truyền vào (`2026-10-04T01:00:00Z`) |
| AC9 | Đạt | `daily.test.ts` "the Worker exports scheduled…" (import default `src/index.ts`, gọi `scheduled` với controller/ctx giả, `waitUntil` nhận đúng 1 promise, job xóa dữ liệu cũ); `grep` bên dưới |
| AC10 | Đạt | `npm test`: 432/432; `npm run typecheck -w apps/web`: exit 0; test kiến trúc và parity i18n nằm trong 432 |
| AC11 | Implementer xem sơ bộ; Reviewer kiểm tay | Xem mục dưới |

### Kết quả lệnh

```
$ npm run typecheck -w apps/web     # exit 0, không có "error TS"
...
📣 Remember to rerun 'wrangler types' after you change your wrangler.jsonc file.

$ npm test
 Test Files  66 passed (66)
      Tests  432 passed (432)
   Duration  51.30s

$ grep -n '"0 1 \* \* \*"' apps/web/wrangler.jsonc
35:  "triggers": { "crons": ["0 1 * * *"] }
```

Số test: **trước 405** (62 file) → **sau 432** (66 file), +27: `content.test.ts` 8, `pages.test.ts` 11, `footer.test.ts` 2, `sitemap.test.ts` +1, `daily.test.ts` 5.

### AC11: đã xem và chưa xem gì

Chạy `npx wrangler dev --port 8799` trong worktree, chụp bằng Chrome headless (`--screenshot`), sau đó tắt server.
- **360 px:** Chrome headless không thu cửa sổ xuống 360 px (layout vẫn rộng hơn và chữ bị cắt ở ảnh chụp thẳng), nên chụp trang trong một `<iframe>` rộng 360 px. Đã xem: `/privacy` (tối), `/media-kit` (sáng và tối). Chữ xuống dòng đúng, không cuộn ngang trong khung, `code` dài (`__Host-vnx_session`) không tràn, 3 ô màu hiện cạnh mã màu (ô `#0D1526` ở chế độ tối và ô `#F4F5F7` ở chế độ sáng có viền để còn thấy), footer xuống dòng gọn.
- **1280 px:** `/privacy` (tối), `/zh-hans/terms` (tối: khung thông báo zh trên cùng, rồi h1 EN, "最后更新：2026-10-04"), `/vi/terms` (sáng). Cột chữ ~70ch, khoảng cách heading ổn.
- **Chưa xem:** zh-Hant, `/media-kit` ở 1280 px, trình duyệt thật/thiết bị thật, kiểm tương phản bằng công cụ, kiểm bằng screen reader. Header ở 360 px tự xuống 2 dòng (đã như vậy trước task này, không đổi).

## Sai khác so với plan / handoff (có lý do)

1. **`legal.englishOnly` cho `vi`:** plan ghi "vi: không dùng", nhưng test parity bắt mọi key có ở cả 4 locale và không rỗng. Đã thêm "Trang này hiện chỉ có bản tiếng Anh." kèm comment "Not shown"; trang VI không hiện câu này (có test).
2. **Key meta:** đặt tên `legal.terms.title` / `.description`, `legal.privacy.*`, `legal.mediaKit.*`; `<title>` = `${title} · VNX.SI` theo mẫu các trang khác (Catalog, Directory). Tên tiêu đề zh tôi tự dịch: 服务条款 / 服務條款, 隐私政策 / 隱私權政策, 媒体资料 / 媒體資料; nhãn `footer.nav`: "About this site" / "Thông tin về trang" / 关于本站 / 關於本站. Owner hoặc VNX-0801 có thể đổi.
3. **Swatch dùng thuộc tính `style` nội dòng** (`background-color:#…`), giá trị chỉ được dùng khi khớp `^#[0-9A-Fa-f]{6}$`. Hiện không có CSP nên không ảnh hưởng; nếu sau này bật CSP chặn inline style thì cần đổi sang class.
4. **Footer:** tagline chuyển từ text trần trong `<div>` sang `<p class="tagline">` để tách khỏi `nav`.
5. **`runDaily(env, now)`** nhận `Pick<Bindings, "DB">` và trả về mảng kết quả từng bước (để test); thêm hằng export `RATE_LIMIT_KEEP_SECONDS`.
6. Khối nội dung zh dùng `<div lang="en">` (plan nói "khối nội dung có `lang="en"`", không quy định thẻ).

## Ghi nhận về `docs/legal/*.md` (không sửa)

- Phần đầu cả 3 file ghi Implementer chuyển nội dung vào `src/content/legal/terms.ts` (… `privacy.ts`, `media-kit.ts`), còn plan và handoff ghi một file `src/legal/content.ts`. Tôi làm theo plan/handoff; Reviewer có thể muốn sửa câu trong phần đầu cho khớp.
- Terms VI mục 3: "để để lại email" (hai chữ "để" liền nhau) đúng ngữ pháp nhưng đọc vấp; có thể viết "để lại email … thì bạn phải từ 16 tuổi".
- Privacy VI mục 9 viết "từ 16 tuổi … từ 18 tuổi" trong khi Terms VI viết "từ 16 tuổi trở lên"; nghĩa như nhau, cách viết khác nhau.
- Privacy mục 10 "we update the date above": trên trang zh, dòng ngày ở trên là câu tiếng Trung (theo plan), không ảnh hưởng nghĩa.
- Bản EN dùng chính tả Anh-Anh (`licence`, `anonymise`, `Colours`), thống nhất trong cả 3 file; chỉ ghi lại để biết.

## Câu hỏi mở

- Không có câu hỏi chặn. Cần Owner/Reviewer xác nhận các tên zh tự dịch ở sai khác 2.
- **Xung đột chắc chắn với nhánh `feat/m5-inquiry`.** Plan nói "nhánh `feat/m5-inquiry` chưa có `scheduled`", nhưng nhánh đó hiện đã có commit `3a698e4` "feat(web): daily cron for reminders, admin alerts, retries and clean-up" (tạo trong lúc task này chạy, 2026-10-04 17:29) sửa đúng các file: `src/auth/sessions.ts`, `src/auth/tokens.ts`, `src/http/rate-limit.ts`, `src/index.ts`, `src/jobs/daily.ts`, `test/jobs/daily.test.ts`, `wrangler.jsonc`. Khác biệt cần Owner/Reviewer chọn khi gộp:
  - tên hàm: M5 dùng `deleteExpiredTokens`, nhánh này dùng `deleteExpiredLoginTokens` (`deleteExpiredSessions`, `deleteOldRateLimitWindows` trùng tên và trùng SQL);
  - mốc giữ `rate_limits`: M5 **1 ngày** (`LONGEST_WINDOW_SECONDS`), nhánh này **2 ngày** theo plan đã duyệt;
  - `runDaily`: M5 trả `DailySummary` (số đếm theo tên) và log `{ event: "jobs.daily.step_failed", … }`; nhánh này trả mảng `{ job: "daily", step, deleted | error }` theo handoff;
  - `scheduled`: M5 kiểm `controller.cron === "0 1 * * *"`, nhánh này gọi thẳng `runDaily`.
  Tôi không sửa gì theo nhánh M5 (ngoài phạm vi). Ai merge sau phải gộp tay và chạy lại cả hai bộ test `test/jobs/daily.test.ts`.
