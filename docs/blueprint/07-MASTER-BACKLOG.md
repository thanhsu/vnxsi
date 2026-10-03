# Master Backlog

- **ID:** `VNX-EENN`: EE = số epic, NN = số thứ tự. Epic 0–8 trùng với milestone M0–M8 của Wave 1.
- **Thứ tự và cổng ra Wave 1:** [../roadmap/WAVE1-ROADMAP.md](../roadmap/WAVE1-ROADMAP.md).
- **Kích thước:**
  - Task Wave 1 ≤ 1 ngày.
  - Task Wave 2–4 ở đây là bản phác; sẽ được tách nhỏ và gán kích thước khi brainstorm wave đó.
- **Tag:**
  - `FOUNDATION`: task sau phụ thuộc vào nó.
  - `QUICK-WIN`: nhỏ, thấy giá trị ngay.
  - `HIGH-RISK`: đụng production, dữ liệu hoặc bảo mật.
  - `AGENT`: agent làm.
  - `HUMAN`: Owner làm.
  - `RESEARCH`: cần tìm hiểu trước khi quyết.
- **Trạng thái:**
  - ✅ xong
  - 🔄 đang làm
  - ⏳ chưa bắt đầu
  - 💤 chưa lên lịch

---

# Wave 1 — Supply

## EPIC 0 — Nền tảng công cụ và AI dev OS

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0001 | Commit nền cho repo | HUMAN | ✅ |
| VNX-0002 | TypeScript, Hono, Vitest + workers pool; chuyển test waitlist | AGENT, FOUNDATION | ✅ |
| VNX-0003 | Khung app Hono + test kiến trúc | AGENT, FOUNDATION | ✅ |
| VNX-0004 | CI test + security CI | AGENT | ✅ |
| VNX-0005 | Blueprint, ADR, quy trình `.ai/` | Reviewer | ✅ |

## EPIC 1 — Nền tảng sản phẩm: i18n, giao diện, danh tính

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0101 | ULID, render văn bản thuần | AGENT, FOUNDATION | ✅ |
| VNX-0102 | i18n 4 locale, route theo locale, hreflang, parity | AGENT, FOUNDATION | ✅ |
| VNX-0103 | Layout, CSS token, trang lỗi, PlainText | AGENT, FOUNDATION | ✅ |
| VNX-0104 | Migration danh tính, users, audit, rate limit D1 | AGENT, FOUNDATION | ✅ |
| VNX-0105 | Mailer port (Resend/Fake/Console), email đăng nhập | AGENT | ✅ |
| VNX-0106 | Token, session, cookie, middleware, origin check | AGENT, HIGH-RISK | ✅ |
| VNX-0107 | Route login / verify / logout, admin bootstrap | AGENT, HIGH-RISK | ✅ |

## EPIC 2 — Builder

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0201 | Migration builders, portfolio, invites; state machine builder; test sở hữu bảng theo module | AGENT, FOUNDATION | ✅ |
| VNX-0202 | `/join/:code`, invite đi kèm magic link, `/hub/apply` (0202a, 0202b) | AGENT | ✅ |
| VNX-0203 | Khung Builder Hub, sửa hồ sơ, portfolio (0203a, 0203b) | AGENT | ✅ |
| VNX-0204 | Trang `/b/:handle` | AGENT | ✅ |
| VNX-0205 | Admin: hàng chờ builder, invite, khóa/mở khóa (0205a–c) | AGENT, HIGH-RISK | ✅ |

## EPIC 3 — Product

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0301 | Migration product, tier, media, verification; state machine product | AGENT, FOUNDATION | ⏳ |
| VNX-0302 | Upload R2, `/media/*` | AGENT, HIGH-RISK | ⏳ |
| VNX-0303 | Editor bước 1–5 | AGENT | ⏳ |
| VNX-0304 | Editor bước 6–9, điều kiện submit | AGENT | ⏳ |
| VNX-0305 | Admin duyệt product, huy hiệu, mục mới sửa, tự thu hồi Demo verified | AGENT | ⏳ |
| VNX-0306 | Trang `/p/:slug`, JSON-LD, Open Graph | AGENT | ⏳ |
| VNX-0307 | Tạo bucket R2 `vnxsi-media` | HUMAN | ⏳ |

## EPIC 4 — Catalogue và danh bạ

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0401 | FTS5 trigram, truy vấn xếp hạng, fallback `LIKE` | AGENT, FOUNDATION | ⏳ |
| VNX-0402 | `/products` có bộ lọc và phân trang | AGENT | ⏳ |
| VNX-0403 | `/builders` danh bạ | AGENT | ⏳ |
| VNX-0404 | Sitemap, robots, canonical, hreflang | AGENT, QUICK-WIN | ⏳ |

## EPIC 5 — Inquiry

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0501 | Migration inquiries, messages; state machine | AGENT, FOUNDATION | ⏳ |
| VNX-0502 | Form Inquiry, xác nhận email, Turnstile, honeypot, rate limit | AGENT, HIGH-RISK | ⏳ |
| VNX-0503 | Hộp thư Hub; `/me` | AGENT | ⏳ |
| VNX-0504 | Email thông báo theo locale, gửi lại qua `notified_at` | AGENT | ⏳ |
| VNX-0505 | Cron hằng ngày: nhắc, báo admin, dọn dẹp | AGENT | ⏳ |
| VNX-0506 | Trang trung gian `/auth/verify` với nút POST xác nhận | AGENT, HIGH-RISK | ⏳ |

## EPIC 6 — Post a request

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0601 | Migration requests, request_invites; 2 state machine | AGENT, FOUNDATION | ⏳ |
| VNX-0602 | Form `/request`, xác nhận email | AGENT | ⏳ |
| VNX-0603 | Admin: hàng chờ request, gợi ý builder theo luật, mời ≤ 5 | AGENT | ⏳ |
| VNX-0604 | Hub: Invitations, gửi đề xuất / từ chối | AGENT | ⏳ |
| VNX-0605 | `/me`: chọn đề xuất → Inquiry `request` | AGENT | ⏳ |
| VNX-0606 | Cron lời mời và request | AGENT | ⏳ |

## EPIC 7 — Số liệu và homepage

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0701 | `product_daily_stats`, `/p/:slug/demo` | AGENT | ⏳ |
| VNX-0702 | Cron hằng giờ `public_stats`, trending | AGENT | ⏳ |
| VNX-0703 | Homepage SSR có ngưỡng | AGENT | ⏳ |
| VNX-0704 | Animation, chart, tooltip, bảng dữ liệu, reduced-motion | AGENT | ⏳ |
| VNX-0705 | `/for-builders`, `/terms`, `/privacy` | AGENT | ⏳ |
| VNX-0706 | Cutover landing, gỡ `/api/waitlist` | AGENT, HIGH-RISK | ⏳ |

## EPIC 8 — Ra mắt Wave 1

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0801 | Hoàn thiện bản dịch; người bản xứ đọc `zh-*` | HUMAN | ⏳ |
| VNX-0802 | Playwright + axe | AGENT | ⏳ |
| VNX-0803 | Review bảo mật toàn nhánh | AGENT (review) | ⏳ |
| VNX-0804 | Production: Resend domain, secrets, R2, migration remote | HUMAN, HIGH-RISK | ⏳ |
| VNX-0805 | Runbook deploy/rollback, script smoke | AGENT | ⏳ |
| VNX-0806 | Mời 20 builder sáng lập đầu tiên | HUMAN | ⏳ |
| VNX-0807 | Mời đủ ~100 builder theo đợt, đo cổng ra Wave 1 | HUMAN | ⏳ |

---

# Wave 2 — Demand + AI

Điều kiện bắt đầu: cổng ra Wave 1 đạt. Trước khi làm: brainstorm Wave 2 → ADR-005, ADR-006 chuyển `Accepted`.

## EPIC 9 — Nền tảng AI

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-0901 | Provider port `AiProvider`, bản Anthropic, bản giả cho test; test kiến trúc chỉ `ai/providers/*` được import SDK | AGENT, FOUNDATION | 💤 |
| VNX-0902 | Pipeline 10 lớp: khung, envelope chuẩn, kiểm schema, kiểm grounding | AGENT, FOUNDATION | 💤 |
| VNX-0903 | Bảng `ai_runs`, ghi token, chi phí, độ trễ | AGENT | 💤 |
| VNX-0904 | Cổng sử dụng: hạn mức người dùng, ngân sách tháng, tự tắt khi vượt | AGENT, HIGH-RISK | 💤 |
| VNX-0905 | Cấu trúc Knowledge Package + `scripts/lint-knowledge.mjs` | AGENT | 💤 |
| VNX-0906 | Eval harness, job CI khi `knowledge/**` đổi | AGENT | 💤 |
| VNX-0907 | Tool xác định: `SearchProducts`, `SearchBuilders`, `GetCategoryPriceStats`, `GetBuilderTrackRecord` | AGENT | 💤 |
| VNX-0908 | Cập nhật privacy: dùng dữ liệu request để cải thiện gợi ý | HUMAN | 💤 |

## EPIC 10 — AI Discovery và 3 phương án

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1001 | Knowledge Package `discovery` (4 locale, ≥ 30 ca eval) | AGENT | 💤 |
| VNX-1002 | Trang "Describe your idea": hội thoại ngắn → yêu cầu có cấu trúc | AGENT | 💤 |
| VNX-1003 | Knowledge Package `solution_options` + 3 phương án Buy / Customize / Build | AGENT | 💤 |
| VNX-1004 | Ước giá từ `GetCategoryPriceStats` (không để model tự tính) | AGENT | 💤 |
| VNX-1005 | Chuyển kết quả discovery thành request (dùng lại luồng EPIC 6) | AGENT | 💤 |
| VNX-1006 | Fallback không AI khi vượt ngân sách hoặc lỗi | AGENT | 💤 |

## EPIC 11 — AI matching và estimate

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1101 | Bộ eval matching từ `request_invites` Wave 1 | AGENT | 💤 |
| VNX-1102 | Knowledge Package `builder_matching` | AGENT | 💤 |
| VNX-1103 | Shadow mode trong hàng chờ admin + đo tỷ lệ trùng | AGENT | 💤 |
| VNX-1104 | Assisted mode (AI chọn sẵn, admin xác nhận) | AGENT | 💤 |
| VNX-1105 | Auto-invite sau khi đạt ngưỡng eval 4 tuần liên tiếp | AGENT, HIGH-RISK | 💤 |
| VNX-1106 | Estimate có khoảng giá + đo độ chính xác so với đề xuất được chọn | AGENT | 💤 |

## EPIC 12 — Công cụ AI cho builder và kiểm duyệt

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1201 | Listing assistant trong editor: gợi ý viết rõ, trường còn thiếu | AGENT | 💤 |
| VNX-1202 | Dịch nội dung product sang 3 ngôn ngữ còn lại (Batch API), builder duyệt | AGENT | 💤 |
| VNX-1203 | Moderation Inquiry/request: spam, PII, vi phạm → hàng chờ admin | AGENT | 💤 |
| VNX-1204 | Tự kiểm demo URL định kỳ (HTTP, HTTPS) → cảnh báo, không tự gắn huy hiệu | AGENT | 💤 |

## EPIC 13 — Tăng trưởng client

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1301 | Trang landing theo category và theo ngành (SEO, 4 locale) | AGENT | 💤 |
| VNX-1302 | Bài hướng dẫn giá ("How much does it cost to build a booking app?") lấy số từ `public_stats` | AGENT | 💤 |
| VNX-1303 | Đo phễu: xem → Inquiry/request → chọn builder (không dùng tracker bên thứ ba) | AGENT | 💤 |
| VNX-1304 | Trang công khai cho builder chia sẻ product (link có UTM) | AGENT, QUICK-WIN | 💤 |

---

# Wave 3 — Transaction

Điều kiện bắt đầu: có lead thật đều đặn. Trước khi làm: nghiên cứu pháp lý và thanh toán (EPIC 14) → brainstorm Wave 3.

## EPIC 14 — Pháp nhân và thanh toán

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1401 | Nghiên cứu pháp nhân (VN / nước ngoài), giấy phép trung gian thanh toán | HUMAN, RESEARCH | 💤 |
| VNX-1402 | Chọn cổng thanh toán (Stripe Connect qua pháp nhân nước ngoài / Paddle / Lemon Squeezy / VNPay–MoMo) → ADR | HUMAN, RESEARCH | 💤 |
| VNX-1403 | Điều khoản marketplace, license Customize, quyền sở hữu, chính sách hoàn tiền | HUMAN | 💤 |
| VNX-1404 | Ledger thanh toán (`payments`, `payouts`) + đối soát | AGENT, HIGH-RISK | 💤 |
| VNX-1405 | Tích hợp cổng thanh toán, webhook idempotent | AGENT, HIGH-RISK | 💤 |

## EPIC 15 — Project, proposal, milestone

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1501 | Nâng Inquiry/request thành Project (`source_inquiry_id`) | AGENT | 💤 |
| VNX-1502 | Proposal có ràng buộc giá, timeline | AGENT | 💤 |
| VNX-1503 | Milestone: funded → submitted → approved → released; tranh chấp | AGENT, HIGH-RISK | 💤 |
| VNX-1504 | Trang tiến độ rút gọn cho client | AGENT | 💤 |

## EPIC 16 — Mua product

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1601 | Checkout theo tier; order | AGENT | 💤 |
| VNX-1602 | Giao `source`: link tải có hạn + license | AGENT, HIGH-RISK | 💤 |
| VNX-1603 | `saas`: chuyển sang builder kèm mã theo dõi; `service`: tạo Project | AGENT | 💤 |
| VNX-1604 | Doanh thu trong Builder Hub | AGENT | 💤 |

## EPIC 17 — Review và uy tín

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1701 | Review chỉ sau order/project hoàn tất | AGENT | 💤 |
| VNX-1702 | Chỉ số uy tín builder đưa vào xếp hạng (cần ADR mới bổ sung ADR-004) | AGENT | 💤 |

## EPIC 18 — Bảo trì định kỳ

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1801 | Gói bảo trì hằng tháng (hosting, maintenance, support) | AGENT | 💤 |
| VNX-1802 | Thu tiền định kỳ và chia phí platform | AGENT, HIGH-RISK | 💤 |

---

# Wave 4 — Idea → Market

## EPIC 19 — Gom nhu cầu

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-1901 | Request a Product công khai (ẩn danh, theo category) | AGENT | 💤 |
| VNX-1902 | Product Opportunity: builder đăng ý tưởng, client đăng ký quan tâm | AGENT | 💤 |
| VNX-1903 | Thông báo builder khi một nhu cầu đủ ngưỡng | AGENT | 💤 |

## EPIC 20 — AI hỗ trợ build

| Task | Nội dung | Tag | Trạng thái |
|---|---|---|---|
| VNX-2001 | AI Architect: PRD → đề xuất kiến trúc cho builder | AGENT, RESEARCH | 💤 |
| VNX-2002 | AI QA / Security check cho product nộp lên (bổ sung huy hiệu mới, cần ADR) | AGENT, RESEARCH | 💤 |
| VNX-2003 | Tích hợp agent runtime (hướng spec v0.1 cũ) như công cụ cho builder | RESEARCH | 💤 |
