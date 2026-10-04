# ADR-007: Monetization là một module riêng, không chạm vào xếp hạng

- **Trạng thái:** Proposed (chờ Owner duyệt văn bản; quyết định nghiệp vụ đã có ngày 2026-10-04, Q1–Q9)
- **Ngày:** 2026-10-04
- **Người quyết định:** Owner, Claude (Reviewer)
- **Liên quan:** ADR-004 (xếp hạng không bán), ADR-008 (ô sponsored), ADR-009 (quảng cáo), audit `docs/strategy/2026-10-04-monetization-audit.md`, phụ lục spec `docs/superpowers/specs/2026-10-04-vnxsi-monetization-addendum.md`

## Quyết định

Mọi hoạt động kiếm tiền từ traffic (affiliate, partner referral, sponsored, quảng cáo, phí lead) nằm trong module `monetization`. Module này đọc được catalog, nhưng catalog, xếp hạng, matching và AI không bao giờ đọc ngược dữ liệu tiền. Mọi link ra ngoài đi qua `/go/`. Mọi điều khoản partner là dữ liệu do admin nhập từ hợp đồng thật, và một conversion chỉ được ghi nhận khi partner đã xác nhận.

## Bối cảnh

Owner muốn VNX.SI có Monetization Engine ngay từ kiến trúc ban đầu, để sau này tích hợp Cloudflare và nhiều partner/affiliate khác. Mỗi partner có commission và luật khác nhau, nên không được hard-code. Marketplace vẫn là lõi. Charter đặt "Trung thực trước tăng trưởng" và ADR-004 cấm trả tiền để đổi thứ tự.

## Động lực

- Thêm partner mới chỉ là thêm dữ liệu, không sửa code.
- Không thể có chuyện vô tình để hoa hồng ảnh hưởng thứ tự hiển thị.
- Không báo cáo doanh thu chưa có thật.
- Đo được outbound click cho builder ngay từ Wave 1, bằng cùng đường đo mà affiliate dùng sau này.

## Luật

1. **Ranh giới module.** Module `monetization` sở hữu `outbound_clicks`, `feature_flags`, `merchants`, `partner_programs`, `offers`, `conversions`, `revenue_entries`. Module `content` sở hữu `articles`, `article_links`. Không module nào khác ghi vào các bảng này.
2. **Ranking không đọc tiền.** Code xếp hạng và gợi ý (tìm kiếm catalogue, danh bạ builder, Trending, Top, gợi ý builder cho request, mọi đầu vào của model AI) không import `src/db/{offers,programs,merchants,conversions,revenue}.ts` và không có SQL tham chiếu các bảng đó.
3. **Product không biết offer.** `products` không có cột nào về tiền hay khuyến mãi. Offer trỏ tới product, không có chiều ngược lại.
4. **Không có tên partner trong code.** Không có nhánh code theo merchant cụ thể. Khác biệt giữa các partner nằm ở dữ liệu (`partner_programs`, `offers.tracking_template`) hoặc ở adapter theo **giao thức** (`generic_template`, `manual`), không theo tên công ty.
5. **Không có điều khoản mặc định.** `commission_rate_bps`, `commission_flat_minor`, `cookie_days`, `currency` của chương trình đều cho phép `NULL`. Không có giá trị mặc định nào trong code hay migration. Chương trình chỉ chuyển sang `active` khi có `terms_url` và `terms_verified_at`.
6. **Click không phải doanh thu.** Conversion chỉ đến từ admin (nhập tay hoặc CSV báo cáo của partner) hoặc từ postback đã kiểm chữ ký. Báo cáo doanh thu chỉ cộng conversion `approved` hoặc `paid` và các dòng `revenue_entries`. Không ước tính, không ngoại suy.
7. **Mọi link ra ngoài đi qua `/go/`.** Đích được tra theo id trong DB, không bao giờ lấy từ query string. Host đích phải khớp danh sách đã đăng ký, được kiểm cả lúc ghi lẫn lúc redirect.
8. **Công khai quan hệ.** Trang có offer kiếm tiền thì hiện câu disclosure cạnh offer và link tới `/disclosure`. Disclosure luôn hiện ở mọi quốc gia. Link kiếm tiền dùng `rel="sponsored noopener"`.
9. **Cờ tính năng.** Mỗi nguồn doanh thu có một cờ trong `feature_flags`, mặc định tắt khi không có dòng. Admin bật/tắt, mỗi lần đổi ghi `audit_log`.
10. **Analytics nội bộ.** Không có script analytics hay tracker của bên thứ ba (quyết định Q5). Đếm trong D1 theo tổng ngày. Event đi qua một hàm trung tâm để sau này nối ra ngoài được mà không sửa nơi phát event.
11. **Dữ liệu cá nhân.** Click không lưu IP hay email. Mã nhận diện người xem là HMAC của cookie ẩn danh với khóa xoay theo ngày (secret `ANALYTICS_SALT`). Builder chỉ thấy số liệu product của mình, không bao giờ thấy doanh thu hay hoa hồng của platform.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Thêm cột `affiliate_url`, `commission` vào `products` | Trộn monetization vào catalog; một product chỉ có một offer; dễ rò vào xếp hạng |
| Mỗi partner một module/adapter riêng theo tên (CloudflareProvider…) | Phần lớn partner dùng cùng giao thức tracking URL + sub-id; adapter theo tên công ty nhân bản code. Adapter chỉ thêm khi một **mạng** có giao thức riêng |
| Ghi conversion khi click | Báo cáo doanh thu không có thật; vi phạm Charter |
| Dùng Google Analytics cho event | Cần banner cookie, script bên thứ ba; Owner chọn chỉ nội bộ (Q5) |
| Workers Analytics Engine | Binding mới ngoài ADR-001; xem lại khi D1 không chịu nổi lượng ghi |

## Hệ quả

- Tích cực: thêm Cloudflare hay bất kỳ partner nào là thêm dữ liệu; số outbound click của builder có từ M7; luật ADR-004 được test giữ, không chỉ dựa vào review.
- Tiêu cực / chấp nhận: link demo/website của product đổi từ link trực tiếp sang `/go/…` (thêm một lần redirect); phải bảo trì bảng sở hữu trong test kiến trúc; báo cáo theo từng loại tiền tệ, không quy đổi.
- Rủi ro đã biết: Owner nhận hoa hồng với tư cách cá nhân (Q4). Owner tự kiểm điều khoản từng partner trước khi bật chương trình đó trên production. Khi có pháp nhân (VNX-1401) thì chuyển hợp đồng.

## Được bảo đảm bởi

- `test/architecture.test.ts`: bản đồ sở hữu bảng có thêm `monetization` và `content`; luật "file xếp hạng/gợi ý không import `db/` của monetization và không có SQL tới bảng tiền".
- `test/monetization/go.test.ts`: các ca open redirect (URL trong query, `//`, `\`, CR/LF, host lạ, `http:`, IP literal, userinfo), offer `paused`/hết hạn, cờ tắt.
- `test/monetization/conversions.test.ts`: không có conversion nếu không qua admin/postback; `UNIQUE(program_id, external_ref)` chặn bản trùng; báo cáo chỉ cộng trạng thái đã xác nhận.
- Review từ chối mọi migration thêm giá trị mặc định cho điều khoản partner.
