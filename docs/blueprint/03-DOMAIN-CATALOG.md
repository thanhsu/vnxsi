# Domain Catalog

Mỗi thực thể thuộc đúng một module (cột `Module` là bản ghi sở hữu chính thức). Chi tiết cột: spec mục 6.

## Danh tính

| Thực thể | Bảng | Module | Wave | Ghi chú |
|---|---|---|---|---|
| User (cũng là Client) | `users` | identity | 1 | Client không có bảng riêng |
| LoginToken | `login_tokens` | identity | 1 | purpose: login / inquiry_verify / request_verify |
| Session | `sessions` | identity | 1 | |
| RateLimitWindow | `rate_limits` | identity | 1 | |
| AuditEntry | `audit_log` | identity | 1 | mọi module ghi qua `writeAudit` |

## Supply

| Thực thể | Bảng | Module | Wave | Ghi chú |
|---|---|---|---|---|
| Builder | `builders` | builder | 1 | 1–1 với User |
| PortfolioItem | `portfolio_items` | builder | 1 | ≤ 12 |
| Invite | `invites` | builder | 1 | lưu hash |
| Product | `products` | catalog | 1 | state machine spec mục 7.2 |
| PricingTier | `pricing_tiers` | catalog | 1 | ≤ 5 |
| ProductMedia | `product_media` | catalog | 1 | ≤ 8, R2 |
| ProductVerification | `product_verifications` | catalog | 1 | listed / demo_verified / in_production |
| ProductSearchIndex | `products_fts` | catalog | 1 | FTS5 trigram |
| Category | (hằng trong code) | catalog | 1 | 9 giá trị, dịch 4 locale |

## Kết nối

| Thực thể | Bảng | Module | Wave | Ghi chú |
|---|---|---|---|---|
| Inquiry | `inquiries` | engagement | 1 | buy / customize / hire / build_similar / request |
| InquiryMessage | `inquiry_messages` | engagement | 1 | `notified_at` cho gửi lại |
| Request | `requests` | matching | 1 | không public |
| RequestInvite (+ đề xuất) | `request_invites` | matching | 1 | ≤ 5 đang hoạt động / request |

## Số liệu

| Thực thể | Bảng | Module | Wave |
|---|---|---|---|
| ProductDailyStat | `product_daily_stats` | insights | 1 |
| PublicStat | `public_stats` | insights | 1 |

## AI (Wave 2)

| Thực thể | Bảng | Module | Ghi chú |
|---|---|---|---|
| AiRun | `ai_runs` | ai | năng lực, package version, model, token, chi phí, kết quả kiểm |
| KnowledgePackage | (file `knowledge/<capability>/`) | ai | ADR-006 |
| DiscoverySession | `discovery_sessions` | ai | ý tưởng → yêu cầu có cấu trúc |

## Giao dịch (Wave 3)

| Thực thể | Bảng | Module | Ghi chú |
|---|---|---|---|
| Order | `orders` | commerce | mua product theo tier |
| Project | `projects` | commerce | nguồn: Inquiry hoặc Request |
| Proposal | `proposals` | commerce | đề xuất có ràng buộc giá |
| Milestone | `milestones` | commerce | funded → submitted → approved → released |
| Payment / Payout | `payments`, `payouts` | commerce | ledger |
| Review | `reviews` | commerce | chỉ sau order/project hoàn tất |
| MaintenancePlan | `maintenance_plans` | commerce | định kỳ hằng tháng |
