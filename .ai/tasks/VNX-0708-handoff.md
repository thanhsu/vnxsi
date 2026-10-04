# VNX-0708 — Handoff cho Implementer

- **Plan đã duyệt:** `.ai/plans/VNX-0708-plan.md` (APPROVED bởi Owner 2026-10-04). Plan là nguồn chi tiết; handoff này không lặp lại nội dung, chỉ chốt phạm vi và cách kiểm.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-0708-report.md`
- **Nhánh:** tạo `feat/vnx-0708-landing` từ `main` (đã có M4, `d297c72`). Không merge, không push.

## Mục tiêu

Thay landing tĩnh trước pivot bằng trang `/` render server ở 4 locale, nói định vị marketplace, có nút builder đăng ký thật và form waitlist cho client.

## Phạm vi đã duyệt

- `GET /` và `POST /waitlist` cho 4 locale (plan, mục "Route").
- Form waitlist client ghi vào bảng `waitlist` có sẵn, gộp persona `client` (plan, mục "Dữ liệu").
- Gỡ `/api/waitlist` JSON, `public/index.html`, `src/waitlist.ts`, `src/routes/waitlist.ts` và test chỉ phục vụ chúng.
- SEO của `/`, sitemap liệt kê `/` theo 4 locale.
- Chuỗi `landing.*` ở 4 file locale; CSS trong `public/assets/app.css`.

## Ngoài phạm vi (không làm)

- Homepage có số liệu, `/for-builders`, `/terms`, `/privacy`.
- Turnstile, email cho người trong waitlist, trang hủy đăng ký, ảnh Open Graph.
- Migration (không cần); xóa `apps/web/drafts/` hay bảng `waitlist`.
- Deploy production; sửa `wrangler.jsonc`.
- Mọi thứ thuộc monetization (`/go/`, `/tools/`).

## Đọc trước

- Plan `.ai/plans/VNX-0708-plan.md` (toàn bộ).
- Spec Wave 1 mục 1, 5.8, 5.9, 8.2, 8.6, 8.8; ADR-003, ADR-004.
- Code: `src/app.ts` (`notFound` → `ASSETS`), `src/http/localized.ts`, `src/http/rate-limit.ts`, `src/http/origin.ts`, `src/routes/auth.tsx` (cách dùng `next`, render lại form có lỗi), `src/routes/seo.ts`, `src/views/Layout.tsx`, `src/views/json-ld.ts`, `src/routes/waitlist.ts` + `src/waitlist.ts` (để chuyển `INSERT … ON CONFLICT` và regex email), `test/architecture.test.ts` (bảng `WRITERS`), `test/app.test.ts`.

## File dự kiến bị ảnh hưởng

- Mới: `apps/web/src/domain/waitlist-input.ts`, `apps/web/src/db/waitlist.ts`, `apps/web/src/routes/landing.tsx`, `apps/web/src/views/LandingPage.tsx`, `apps/web/test/landing/page.test.ts`, `apps/web/test/landing/waitlist.test.ts`.
- Sửa: `apps/web/src/app.ts`, `apps/web/src/routes/seo.ts`, `apps/web/public/assets/app.css`, `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`, `apps/web/test/architecture.test.ts`, `apps/web/test/app.test.ts`, `apps/web/test/seo/sitemap.test.ts`; `apps/web/src/views/Layout.tsx` chỉ khi cần prop tùy chọn cho `<main>`.
- Xóa: `apps/web/public/index.html`, `apps/web/src/waitlist.ts`, `apps/web/src/routes/waitlist.ts`, `apps/web/test/waitlist.test.ts`.

## Ảnh hưởng DB / API / UI

- DB: không migration. Chỉ ghi `waitlist` qua `src/db/waitlist.ts`.
- API: bỏ `/api/waitlist`. Thêm `POST /waitlist` (form, 303/400/429/403).
- UI: trang `/` mới ở 4 locale; header và footer giữ nguyên.

## Quy tắc nghiệp vụ

- Nội dung trang lấy **đúng** bảng "Nội dung" của plan (EN, VI). `zh-Hans`, `zh-Hant` dịch từ EN. Không thêm câu, con số, thẻ product mẫu, testimonial, logo. Cần câu mới thì dừng và hỏi Reviewer.
- Thân trang không link tới `/products`, `/builders`.
- Nút builder: chưa đăng nhập → `localizedPath(locale, "/login")?next=<encodeURIComponent(localizedPath(locale, "/hub/apply"))>`; đã đăng nhập → `localizedPath(locale, "/hub")`.
- Email trùng: thêm `client` vào `personas` nếu chưa có, giữ vai cũ; phản hồi giống hệt lần đầu (không lộ email đã tồn tại).
- Honeypot có giá trị → 303 thành công, không ghi.
- Rate limit: khóa `waitlist:ip:<cf-connecting-ip>`, 10 lần / 3600 giây. IP thiếu → dùng `"unknown"` như các route khác.
- `referrer`: chỉ host, và chỉ khi khác host của site. `utm_*`: ≤ 200 ký tự.
- `lang` lưu mã locale (`en`, `vi`, `zh-Hans`, `zh-Hant`).

## Tiêu chí chấp nhận

AC1–AC16 ở plan. Mỗi tiêu chí kiểm bằng:

- [ ] AC1–AC4, AC11: `npm test -- test/landing/page.test.ts`
- [ ] AC5–AC10: `npm test -- test/landing/waitlist.test.ts`
- [ ] AC12: `npm test -- test/app.test.ts` và `git ls-files apps/web/public/index.html apps/web/src/waitlist.ts apps/web/src/routes/waitlist.ts` (rỗng)
- [ ] AC13: `npm test -- test/seo/sitemap.test.ts`
- [ ] AC14: `npm test -- test/architecture.test.ts test/i18n/parity.test.ts`
- [ ] AC15: `npm test` và `npm run typecheck -w apps/web`
- [ ] AC16: Reviewer kiểm tay bằng `npm run dev` (Implementer chỉ cần ghi trong báo cáo là đã tự xem ở 360 px và 1280 px, sáng và tối)

## Test bắt buộc

- Mỗi AC ở trên có ít nhất một test, viết trước code (TDD).
- `page.test.ts`: chạy cho cả 4 locale, gồm `/vi` và `/vi/`.
- `waitlist.test.ts`: mỗi ca kiểm cả status lẫn trạng thái bảng `waitlist` sau request.
- Không để test phụ thuộc thứ tự chạy hay bộ đếm rate limit của file khác (dùng IP riêng trong header `cf-connecting-ip`).

## Lệnh kiểm tra

```bash
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài danh sách file trừ khi bắt buộc; nếu phải sửa, ghi lý do trong báo cáo.
- Không thêm dependency.
- Không dùng `dangerouslySetInnerHTML` ngoài `jsonLdScript` có sẵn.
- Không commit `.dev.vars` hay bí mật.
- Commit theo Conventional Commits, mỗi commit kèm dòng `Co-Authored-By` theo cấu hình phiên.
