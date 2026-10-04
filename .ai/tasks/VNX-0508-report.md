# VNX-0508 — Báo cáo Implementer

## Đã làm
Sửa `apps/web/src/legal/content.ts` (`privacyEn`, `privacyVi`): thêm nguyên văn từ `docs/legal/privacy.md` — mục 2 (Inquiries, Bot check), mục 3 (một gạch đầu dòng), mục 4 (câu thêm và cụm Turnstile), mục 6 (một gạch đầu dòng), cho cả EN và VI. Không sửa file nào khác.

## RED
`npm test -w apps/web -- test/legal/content.test.ts` → 2 failed | 6 passed (privacy EN và VI thiếu dòng "Inquiries" / "Yêu cầu (Inquiry)").

## GREEN
- `npm test -w apps/web -- test/legal` → 3 files, 21 tests passed.
- `npm run typecheck -w apps/web` → exit 0.
- `npm test` → 79 files, 534 tests passed.

## Câu hỏi còn mở
Không.

## Ghi nhận
Không.
