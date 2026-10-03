# Module Map (bounded contexts)

Các module là ranh giới nghiệp vụ trong cùng một Worker (ADR-001). Module sở hữu bảng của nó; module khác chỉ đọc/ghi qua hàm của module sở hữu (`src/db/<module>.ts`) hoặc qua domain event ghi vào `audit_log`.

```
                    ┌──────────────┐
                    │   identity   │  users, sessions, login_tokens, rate_limits
                    └──────┬───────┘
          ┌────────────────┼──────────────────┐
          ▼                ▼                  ▼
   ┌────────────┐   ┌────────────┐     ┌────────────┐
   │  builder   │◄──│  catalog   │     │   admin    │ (chỉ điều phối, không sở hữu bảng)
   └─────┬──────┘   └─────┬──────┘     └────────────┘
         │                │
         ▼                ▼
   ┌────────────┐   ┌────────────┐     ┌────────────┐
   │ engagement │◄──│  matching  │     │  insights  │ product_daily_stats, public_stats
   └─────┬──────┘   └────────────┘     └────────────┘
         ▼
   ┌────────────┐                      ┌────────────┐   ┌────────────┐
   │notification│                      │  ai (W2)   │   │commerce(W3)│
   └────────────┘                      └────────────┘   └────────────┘
```

| Module | Trách nhiệm | Sở hữu bảng | Phụ thuộc | Wave | Epic |
|---|---|---|---|---|---|
| `identity` | Đăng nhập, session, quyền, rate limit, audit | `users`, `login_tokens`, `sessions`, `rate_limits`, `audit_log` | — | 1 | E1 |
| `builder` | Đăng ký builder, hồ sơ, portfolio, invite, duyệt | `builders`, `portfolio_items`, `invites` | identity | 1 | E2 |
| `catalog` | Product, giá, ảnh, xác minh, tìm kiếm | `products`, `pricing_tiers`, `product_media`, `product_verifications`, `products_fts` | builder | 1 | E3, E4 |
| `engagement` | Inquiry và trao đổi | `inquiries`, `inquiry_messages` | identity, builder, catalog | 1 | E5 |
| `matching` | Request, lời mời, đề xuất, gợi ý builder | `requests`, `request_invites` | identity, builder, catalog, engagement | 1 | E6 |
| `insights` | Thống kê lượt xem, số liệu công khai, trending | `product_daily_stats`, `public_stats` | catalog, engagement, matching (chỉ đọc) | 1 | E7 |
| `notification` | Gửi email, template theo locale, gửi lại | — (cột `notified_at` thuộc bảng của module gốc) | identity | 1 | E1, E5 |
| `admin` | Giao diện điều phối duyệt, khóa, huy hiệu, ghép | — | mọi module (qua hàm công khai) | 1 | E2–E7 |
| `ai` | Pipeline AI, provider port, Knowledge Package, `ai_runs` | `ai_runs` | catalog, builder, matching (chỉ đọc qua tool) | 2 | E9–E12 |
| `commerce` | Order, project, milestone, payment, payout, review | `orders`, `projects`, `proposals`, `milestones`, `payments`, `payouts`, `reviews` | engagement, matching, catalog | 3 | E14–E18 |

## Luật

1. Không module nào ghi vào bảng của module khác.
2. `ai` không truy vấn D1 trực tiếp từ prompt; chỉ qua tool xác định (AI-ARCHITECTURE lớp 3).
3. `insights` chỉ đọc; sai số liệu không được làm hỏng dữ liệu nghiệp vụ.
4. `admin` không có logic riêng ngoài gọi chuyển trạng thái của module sở hữu.

Luật 1 được kiểm bằng test kiến trúc mở rộng ở EPIC 2 (VNX-0201): mỗi `src/db/<module>.ts` chỉ chứa câu SQL nhắm tới bảng của module đó.
