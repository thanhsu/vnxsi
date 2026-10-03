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
