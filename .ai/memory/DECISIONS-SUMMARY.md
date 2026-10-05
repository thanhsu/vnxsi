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
| 2026-10-04 | Monetization là module riêng; ranking không đọc tiền; mọi link ra ngoài qua `/go/`; conversion chỉ khi partner xác nhận; chỉ analytics nội bộ | ADR-007 (Accepted), phụ lục monetization |
| 2026-10-04 | Listing bên thứ ba ở `/tools/:merchant`, không vào `/products` | Audit monetization Q1 |
| 2026-10-04 | Sponsored là ô tách riêng có nhãn, không đổi thứ tự, sau Wave 1 | ADR-008 (Accepted) |
| 2026-10-04 | Quảng cáo chỉ thiết kế, chưa code | ADR-009 (Accepted) |
| 2026-10-04 | `/go/p/:slug/{demo,site}` + `outbound_clicks` làm ở M7, thay `/p/:slug/demo` | Phụ lục monetization mục 2 |
| 2026-10-04 | Owner cá nhân nhận hoa hồng partner; lead dùng lại M6 không phí; nội dung markdown giới hạn chỉ admin viết; ngưỡng index 5/5/3/2 | Audit monetization Q4, Q7–Q9 |
| 2026-10-05 | Ops console `/ops` (tiếng Anh), 4 vai trò trong DB, `ADMIN_EMAILS` = Owner gốc, 404 kín, audit luôn ghi khi chặn thao tác lên Owner gốc | ADR-010, spec Ops console |
