# VNX-0705a — Handoff cho Implementer

- **Plan đã duyệt:** `.ai/plans/VNX-0705a-plan.md` (APPROVED bởi Owner 2026-10-04). Plan là nguồn chi tiết.
- **Nội dung đã duyệt:** `docs/legal/terms.md`, `docs/legal/privacy.md`, `docs/legal/media-kit.md` (mục `## EN` và `## VI`).
- **Báo cáo phải nộp:** `.ai/tasks/VNX-0705a-report.md`
- **Nhánh:** `feat/vnx-0705a-legal` (đã có, gốc từ `main` `5363766`). Không merge, không push.

## Mục tiêu

Ba trang `/terms`, `/privacy`, `/media-kit` ở 4 locale, link ở footer, có trong sitemap; và một cron hằng ngày xóa dữ liệu đăng nhập/rate limit đã hết hạn, để Privacy nói đúng.

## Phạm vi đã duyệt

Như mục "Phạm vi → Trong phạm vi" và "Thiết kế" của plan.

## Ngoài phạm vi (không làm)

`/for-builders`, `/disclosure`, nhắc builder / báo admin / xóa Inquiry (VNX-0505), logo, nạp font mới, dịch thân văn bản sang `zh-*`, deploy, bất kỳ sửa câu chữ nào so với `docs/legal/*.md`.

## Đọc trước

- `CLAUDE.md`; plan; 3 file `docs/legal/*.md`.
- Code: `src/routes/landing.tsx` + `src/views/LandingPage.tsx` (mẫu trang mới nhất), `src/views/Layout.tsx`, `src/routes/seo.ts`, `src/http/localized.ts`, `src/http/rate-limit.ts`, `src/auth/tokens.ts`, `src/auth/sessions.ts`, `src/index.ts`, `wrangler.jsonc`, `test/architecture.test.ts`, `test/seo/sitemap.test.ts`, `vitest.config.ts`.

## File dự kiến bị ảnh hưởng

- Mới: `src/legal/content.ts`, `src/routes/legal.tsx`, `src/views/LegalPage.tsx`, `src/jobs/daily.ts`, `test/legal/pages.test.ts`, `test/legal/content.test.ts`, `test/legal/footer.test.ts`, `test/jobs/daily.test.ts`.
- Sửa: `src/app.ts`, `src/index.ts`, `src/views/Layout.tsx`, `src/routes/seo.ts`, `src/http/rate-limit.ts`, `src/auth/tokens.ts`, `src/auth/sessions.ts`, `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`, `public/assets/app.css`, `wrangler.jsonc`, `test/seo/sitemap.test.ts`.

## Ảnh hưởng DB / API / UI

- DB: không migration. Chỉ `DELETE` dòng hết hạn ở 3 bảng, từ module sở hữu.
- API: 3 route GET mới ×4 locale; handler `scheduled`.
- UI: footer mọi trang thêm 3 link.

## Quy tắc nghiệp vụ

- Câu chữ EN/VI chép **nguyên văn** từ `docs/legal/*.md`. Thấy lỗi chính tả hay câu khó hiểu thì ghi vào báo cáo, không tự sửa.
- `{date}` → `LEGAL_UPDATED_AT = "2026-10-04"`.
- Inline: chỉ `` `x` `` → `<code>`, `**x**` → `<strong>`, và `contact@vnx.si` → `mailto:`. Không thêm cú pháp khác, không dùng `dangerouslySetInnerHTML`.
- `zh-Hans`/`zh-Hant`: câu `legal.englishOnly` theo locale + thân văn bản EN trong khối `lang="en"`. Chuỗi `legal.englishOnly` cho zh lấy đúng từ plan.
- Cron: `rate_limits` xóa khi `window_start < now − 2 ngày` (giây); `login_tokens`, `sessions` xóa khi `expires_at < now`. Mỗi bước bọc try/catch riêng, log JSON một dòng `{ job: "daily", step, deleted }` hoặc `{ job: "daily", step, error }`.

## Tiêu chí chấp nhận

AC1–AC11 ở plan:

- [ ] AC1, AC3, AC4, AC5: `npm test -- test/legal/pages.test.ts`
- [ ] AC2: `npm test -- test/legal/content.test.ts` (nếu Vitest trong workerd không đọc được `docs/legal/*.md` bằng `import.meta.glob(..., { query: "?raw" })`, ghi lý do trong báo cáo và dùng cách khác vẫn đọc từ chính các file đó, không chép bản sao)
- [ ] AC6: `npm test -- test/legal/footer.test.ts`
- [ ] AC7: `npm test -- test/seo/sitemap.test.ts`
- [ ] AC8, AC9: `npm test -- test/jobs/daily.test.ts` và `grep -n '"0 1 \* \* \*"' apps/web/wrangler.jsonc`
- [ ] AC10: `npm test` và `npm run typecheck -w apps/web`
- [ ] AC11: Reviewer kiểm tay

## Test bắt buộc

Viết test trước (TDD), commit test riêng trước code. Mỗi AC có ít nhất một test. Test cron dùng dữ liệu tạo trong test, thời gian `now` truyền vào, không phụ thuộc giờ máy.

## Lệnh kiểm tra

```bash
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài danh sách file trừ khi bắt buộc; nếu phải sửa, ghi lý do trong báo cáo.
- Không thêm dependency, không migration.
- Không sửa `docs/legal/*.md`.
- Commit theo Conventional Commits, mỗi commit kèm dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
