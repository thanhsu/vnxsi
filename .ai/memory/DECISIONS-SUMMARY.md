# Decisions Summary

Mỗi dòng một quyết định; chi tiết trong ADR hoặc spec.

| Ngày | Quyết định | Nguồn |
|---|---|---|
| 2026-10-03 | Pivot vnx.si sang marketplace cho sản phẩm xây bằng AI và builder; bỏ hướng agent runtime | `docs/strategy/2026-10-03-marketplace-os-v1.md` |
| 2026-10-03 | Chia Wave 1 (Supply) → Wave 2 (Demand + AI) → Wave 3 (Transaction) | Spec mục 2 |
| 2026-10-03 | Stack: Hono JSX SSR trên Cloudflare Workers, D1, R2, Resend | ADR-001 |
| 2026-10-03 | Đăng nhập magic link, session cookie, client = user | ADR-002 |
| 2026-10-03 | 4 locale `en`/`vi`/`zh-Hans`/`zh-Hant` theo tiền tố URL; không làm tiếng Hindi | ADR-003 |
| 2026-10-03 | Xếp hạng không bán; số liệu công khai chỉ từ dữ liệu thật, có ngưỡng | ADR-004 |
| 2026-10-03 | AI qua provider port, Knowledge Package, envelope JSON, eval gate (áp dụng từ Wave 2) | ADR-005, ADR-006 (Proposed) |
| 2026-10-03 | Kết nối client–builder: Inquiry + danh bạ builder + Post a request do admin ghép | Spec mục 4, 5.7 |
| 2026-10-03 | Rate limit bằng D1 thay cho Workers Rate Limiting binding | Spec mục 8.2 |
