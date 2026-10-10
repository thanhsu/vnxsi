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
| Request | `requests` | matching | 1 | riêng tư mặc định; công khai chỉ khi client opt-in (xem `request_publications`) |
| RequestInvite (+ đề xuất) | `request_invites` | matching | 1 | ≤ 5 đang hoạt động / request |
| RequestPublication (EPIC 27) | `request_publications` | matching | 1 | tối đa 1 dòng / request; opt-in, kiểm duyệt, bản công khai tách khỏi bản gốc |
| RequestInterest (EPIC 27) | `request_interests` | matching | 1 | builder bày tỏ quan tâm; Ops xem và mời |

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

## Monetization (ADR-007, phụ lục monetization)

| Thực thể | Bảng | Module | Wave | Ghi chú |
|---|---|---|---|---|
| OutboundClick | `outbound_clicks` | monetization | 1 (M7) | mỗi lượt qua `/go/`; `id` là `click_id`; không lưu IP |
| FeatureFlag | `feature_flags` | monetization | sau Wave 1 (E21) | không có dòng = tắt |
| Merchant | `merchants` | monetization | E21 | trang `/tools/:slug`; `allowed_hosts` |
| PartnerProgram | `partner_programs` | monetization | E21 | affiliate / referral / revenue_share / direct; điều khoản nullable, không mặc định |
| Offer | `offers` | monetization | E21 | nhiều offer / subject (product, merchant, article) |
| Conversion | `conversions` | monetization | E21 | chỉ từ admin/CSV/postback đã kiểm; `UNIQUE(program_id, external_ref)` |
| RevenueEntry | `revenue_entries` | monetization | E21 | ledger append-only, theo từng loại tiền |
| SponsoredCampaign | (thiết kế ở plan E23) | monetization | E23 | ô tách riêng (ADR-008) |

## Nội dung (phụ lục monetization mục 4)

| Thực thể | Bảng | Module | Wave | Ghi chú |
|---|---|---|---|---|
| Article | `articles` | content | 2 (E22) | guide / review / comparison / alternatives / best_list / category_guide; một locale mỗi bài |
| ArticleLink | `article_links` | content | 2 (E22) | đồ thị liên kết nội bộ |
| Lead | dùng `requests`, `request_invites` | matching | 1 (M6) | không bảng mới (Q7) |
