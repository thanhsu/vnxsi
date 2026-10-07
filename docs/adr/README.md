# Architecture Decision Records

Template: `ADR-000-template.md`. Đổi trạng thái hoặc nội dung một ADR `Accepted` cần ADR mới thay thế.

| ADR | Quyết định | Trạng thái | Được bảo đảm bởi |
|---|---|---|---|
| [ADR-001](ADR-001-stack.md) | Hono JSX SSR trên một Cloudflare Worker, D1, R2, Resend | Accepted | `wrangler.jsonc`; test kiến trúc `test/architecture.test.ts` |
| [ADR-002](ADR-002-auth-magic-link.md) | Magic link + session cookie; client = user; admin qua `ADMIN_EMAILS` | Accepted | `test/auth/*.test.ts` |
| [ADR-003](ADR-003-i18n.md) | 4 locale theo tiền tố URL; EN là chuẩn; parity key bắt buộc | Accepted | `test/i18n/parity.test.ts` |
| [ADR-004](ADR-004-neutral-ranking.md) | Xếp hạng không bán; số liệu công khai chỉ từ dữ liệu thật, có ngưỡng | Accepted | `test/catalog/*.test.ts`, `test/stats/*.test.ts` (M4, M7) |
| [ADR-005](ADR-005-ai-provider-port.md) | AI qua provider port, chọn model theo lớp năng lực, ngân sách chi phí | Proposed (Wave 2) | — |
| [ADR-006](ADR-006-knowledge-packages.md) | Prompt quản lý bằng Knowledge Package có phiên bản và eval gate | Proposed (Wave 2) | — |
| [ADR-007](ADR-007-monetization.md) | Monetization là module riêng; ranking không đọc tiền; mọi link ra ngoài qua `/go/`; conversion chỉ khi partner xác nhận | Accepted (2026-10-04) | `test/architecture.test.ts`, `test/monetization/*.test.ts` (M7, EPIC 21) |
| [ADR-008](ADR-008-sponsored-placement.md) | Sponsored là ô tách riêng có nhãn, không đổi thứ tự xếp hạng (bổ sung ADR-004) | Accepted (2026-10-04) | test thứ tự organic bất biến (EPIC 23) |
| [ADR-009](ADR-009-advertising.md) | Quảng cáo chỉ ở trang nội dung, qua `AdProvider`, tải lười; chưa code | Accepted (2026-10-04, chỉ thiết kế) | — |
| [ADR-010](ADR-010-ops-console.md) | Ops console `/ops` (tiếng Anh), 4 vai trò trong DB với `ADMIN_EMAILS` là Owner gốc, 404 kín, audit; thay một phần ADR-002 và ADR-003 | Accepted (Owner 2026-10-05) | test O1 (role matrix, 404 kín, audit, parity `ops.*`) |
| [ADR-012](ADR-012-oauth-linked-identities.md) | Liên kết Google/GitHub/LinkedIn từ trang tài khoản: đăng nhập phụ cho tài khoản đã có, huy hiệu xác minh builder tự bật; không tạo tài khoản, không tự liên kết theo email, Ops chỉ nhận session magic link; thay một phần ADR-002, bổ sung ADR-010 | Accepted (2026-10-07) | test EPIC 26 (state/PKCE, không auto-link, 404 kín Ops, không lộ identity client) |
