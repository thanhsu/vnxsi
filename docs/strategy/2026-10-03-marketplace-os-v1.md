# VNX.SI Marketplace OS v1 — chiến lược gốc

- **Ngày chốt:** 2026-10-03
- **Vai trò:** baseline chiến lược cho toàn bộ dự án. Thiết kế chi tiết theo từng đợt nằm trong `docs/superpowers/specs/`.
- **Spec đầu tiên:** [Wave 1 (Supply)](../superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md)

Project độc lập, không gắn với iTrade hay VNX financial-data project.

---

## 1. Core thesis

AI makes building software easier. VNX.SI makes finding, buying, customizing and selling AI-built software easier.

Ba bên: **Client**, **Builder**, **Product**. Client discover product, rồi chọn **Buy**, **Customize** hoặc **Build**.

## 2. Bốn object cốt lõi

- **Client** (người có nhu cầu): browse products, create project, request customization, hire builder, buy product.
- **Builder** (người/tổ chức cung cấp năng lực build): profile, skills, AI capabilities, portfolio, products, projects, availability.
- **Product** (thứ đã được build): demo, description, features, pricing, tech, license, customization options, verification, builder.
- **Project** (thứ client muốn build): requirement, PRD, budget, estimate, milestones, builder, deliverables, status.

Bốn object này liên kết với nhau.

## 3. Client journey

Client không cần hiểu software development. Entry point: **"What do you want to build?"**

Ví dụ: "I need a booking system for my restaurant." AI Discovery hỏi vài câu business đơn giản, tóm tắt thành yêu cầu (users, core features), rồi đưa ra 3 phương án:

- **Use an existing product** (ví dụ từ $29/tháng) → View products
- **Customize existing product** (ước $300–700) → Find builders
- **Build from scratch** (ước $800–1,500) → Start project

Client không phải tự quyết "thuê developer hay dùng SaaS". Platform giúp họ tìm phương án.

## 4. Product journey

Builder tạo product không chỉ bằng upload source code. Platform yêu cầu: Product, Problem solved, Target users, Features, Demo, Pricing, Customization, License, Support. Sau đó platform tạo Product Page (tên, mô tả, rating, số user, live demo, giá, tính năng, khả năng customize, thông tin builder, mức xác minh).

## 5. Một Product có 4 transaction

- **Buy:** dùng đúng cái này.
- **Customize:** thích nhưng cần sửa.
- **Hire Builder:** muốn builder này làm cho mình.
- **Build Similar:** muốn product tương tự cho business của mình.

Một listing → 4 loại revenue opportunity.

## 6. Builder journey

Builder Hub: products, active projects, customization requests, revenue. Platform là distribution channel cho builder. Đây là value proposition quan trọng nhất để kéo supply.

## 7. Project journey

IDEA → AI DISCOVERY → PRD → ESTIMATE → POST PROJECT → BUILDER MATCHING → PROPOSAL → MILESTONE → BUILD → QA → DEPLOY → MAINTENANCE.

Client chỉ thấy: Requirements approved → Builder selected → Development → Testing → Deployment. Không cần hiểu Git, CI/CD, Docker, cloud.

## 8. AI Matching Engine

- Input: Project + Client + Budget + Deadline.
- Tín hiệu: product similarity, builder skills, past projects, tech stack, price, availability, success rate, AI capability.
- Output: danh sách giải pháp có % match (product có sẵn, các builder, build from scratch kèm ước giá).

Marketplace đề xuất thay vì bắt client tự search.

## 9. Product matching là killer feature

AI search toàn bộ inventory (products, templates, builders, similar projects), rồi đề xuất: "Bạn có thể mua product A với $39/tháng, hoặc customize product B khoảng $500." AI trở thành sales agent cho toàn marketplace.

## 10. Trust layer

Các trạng thái: AI Submitted → Demo Verified → Function Verified → Security Checked → Human Reviewed → Production Verified. Không phải product nào cũng đạt tất cả, nhưng phải minh bạch. "Production Verified ✓" dễ hiểu với client hơn 5 sao.

## 11. Ranking

Không để ai trả tiền nhiều nhất đứng đầu. Ranking dựa trên relevance, verified quality, usage, conversion, customer satisfaction, recency, builder reliability. Sponsored listing (nếu có) phải tách rõ. Mục tiêu là client tìm được thứ phù hợp nhất, không phải platform kiếm commission cao nhất. Làm sai chỗ này thì trust chết rất nhanh.

## 12. Marketplace flywheel

1. More builders → more products → more product choice → more clients → more transactions → more builder revenue → more builders.
2. More projects → more real-world requirements → builders learn what sells → more useful products → more products sold.
3. More transactions → more outcome data → better AI matching → better conversion → more transactions.

## 13. Cold-start — Wave 1

Mời 100 solo builder: "Build one useful product. Put it in front of real customers." Free listing. Platform hỗ trợ product page, demo, analytics, leads, customer requests, customization. Mục tiêu: 100 product trước khi launch consumer marketplace.

## 14. Wave 2 — Client acquisition

Không quảng cáo "Come use our marketplace". Dùng SEO/content: "How much does it cost to build a booking app?", "I have an app idea", "Can AI build my business software?", "Software for small restaurants". CTA: **Describe your idea → Get free product recommendations + estimate.**

## 15. Wave 3 — Transaction

Khi có 100+ products và 50+ active builders mới đẩy Buy / Customize / Build. Lúc đó marketplace không còn là phòng trống.

## 16. Commission model v1

| Giao dịch | Client trả | Builder | Platform |
|---|---|---|---|
| Product sale | $100 | $85 | $15 |
| Customization | $500 | $425 | $75 |
| New project | $1,000 | $850 | $150 |

Tỷ lệ thực tế phải test theo category và transaction type. Không thu listing fee giai đoạn đầu; mục tiêu là maximize supply.

## 17. Maintenance — recurring revenue

Sau khi build: hosting, maintenance, support theo tháng (ví dụ $20 + $50 + $30, platform $10). Builder có thu nhập định kỳ, platform có commission định kỳ, client có một nơi quản lý.

## 18. Request a Product

Client không tìm thấy thứ cần → đăng nhu cầu (budget, industry, số user, deadline). Platform báo builder phù hợp, gợi ý product tương tự, nhận proposal. Biến demand thành supply.

## 19. Product Opportunity

Builder đăng ý tưởng ("Vietnamese payroll SaaS, cần 10 beta customers"). Client đăng ký quan tâm. Platform gom demand để builder biết có bao nhiêu người cần trước khi build. Đây là market validation marketplace.

## 20. Tầm nhìn dài hạn: idea → market

IDEA → VALIDATE → FIND EXISTING PRODUCT → CUSTOMIZE → BUILD → LAUNCH → FIND CUSTOMERS → GROW. Không chỉ software marketplace mà là product creation + distribution marketplace.

## 21. Định vị

- Client: *Have an idea? Find a product, customize one, or build your own.*
- Builder: *Build once. Sell many times. Get hired to customize.*
- Marketplace: *The marketplace for AI-built products and the people who build them.*

Câu cho builder giải quyết insight gốc: AI làm coding rẻ hơn → developer cần cách mới để monetize năng lực.

## 22. MVP thực sự

Products, Builders, Projects, Client; giao dịch Buy / Customize / Build. AI ở MVP chỉ gồm: Product Discovery, Requirement Analysis, Product Matching, Builder Matching, Estimate. Chưa cần AI tự code.

## 23. Sau khi có liquidity

Mới thêm AI Architect, AI Developer, AI QA, AI Security, AI Deployment. Platform đi từ Marketplace thành AI Development Operating System.

## 24. Model-agnostic

Không phụ thuộc Claude, Codex, Gemini, Cursor, Lovable, Replit. Builder dùng gì cũng được; VNX.SI chỉ hỏi: *Can you deliver the product?* Model càng mạnh → builder càng productive → supply càng lớn → platform càng mạnh.

## Kiến trúc chiến lược

DISCOVERY (Products) + MARKET (Builders) + BUILD (AI/Dev) → TRANSACTIONS (Buy / Customize / Build) → DELIVERY → MAINTENANCE → MORE DATA → BETTER MATCHING.
