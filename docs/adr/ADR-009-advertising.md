# ADR-009: Quảng cáo chỉ ở trang nội dung, qua provider port; chưa code

- **Trạng thái:** Accepted (Owner duyệt văn bản 2026-10-04; chỉ là thiết kế, chưa code theo quyết định Q6)
- **Ngày:** 2026-10-04
- **Người quyết định:** Owner, Claude (Reviewer)
- **Điều kiện bắt đầu code:** có traffic thật trên trang nội dung (Owner đặt ngưỡng khi lên lịch EPIC 24) và ADR này chuyển `Accepted`.

## Quyết định

Khi làm, quảng cáo chỉ xuất hiện ở trang nội dung biên tập (guide, review, so sánh, alternatives, best list), qua một port `AdProvider`, và tải lười sau nội dung. Marketplace (product, tìm kiếm, builder, Hub, form) không có quảng cáo. Ưu tiên quảng cáo trực tiếp (creative do admin tải lên) trước mạng quảng cáo bên thứ ba.

## Bối cảnh

Prompt monetization xếp quảng cáo là một nguồn doanh thu, nhưng cần traffic mới có giá trị. Owner chọn chỉ analytics nội bộ (Q5), nên mọi script bên thứ ba (AdSense…) là một đánh đổi phải quyết riêng.

## Thiết kế

- **Registry vị trí trong code:** `article_inline`, `article_end`, `comparison_end`, `best_list_end`. Mỗi vị trí gắn với một loại trang. Không có vị trí nào cho `/`, `/products`, `/p/:slug`, `/b/:handle`, `/builders`, `/request`, Hub, `/me`, admin, trang đăng nhập.
- **Port:** `AdProvider { renderSlot(placement, locale): Html; scriptOrigins(): string[] }`. Bản `direct`: ảnh + link qua `/go/` (offer `kind = 'sponsored'`, ADR-007), render như ảnh tĩnh, không script. Bản mạng quảng cáo: thêm sau, theo ADR này.
- **Hiệu năng:** ô có kích thước cố định (không gây CLS), tải khi cuộn tới (`IntersectionObserver`), không chặn render.
- **Nhãn:** "Advertisement" ở 4 locale.
- **Cờ:** `ads` trong `feature_flags`, mặc định tắt.
- **Đếm:** impression/click vào `daily_metrics` (nội bộ, ADR-007 luật 10).

## Nếu dùng mạng quảng cáo bên thứ ba (AdSense, Ad Manager…)

Cần quyết riêng trước khi bật, vì kéo theo:
- banner đồng ý cookie cho người dùng EU/UK (CMP), cập nhật `/privacy`;
- nới CSP cho origin của mạng quảng cáo;
- xem lại quyết định Q5 (không tracker bên thứ ba).

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Code khung ngay, cờ tắt | Code không dùng tới chỉ thêm việc bảo trì; Owner chọn chỉ viết ADR (Q6) |
| Quảng cáo trên trang product và kết quả tìm kiếm | Hại UX marketplace và niềm tin; trang product là của builder |
| AdSense ngay từ đầu | Script bên thứ ba, cookie, cần CMP; trái Q5 |

## Hệ quả

- Tích cực: khi có traffic, thêm quảng cáo không chạm vào marketplace.
- Tiêu cực / chấp nhận: chưa có doanh thu quảng cáo trong Wave 1–2.

## Được bảo đảm bởi

(Khi code) test: route ngoài danh sách loại trang cho phép không render ô quảng cáo; ô có kích thước cố định; cờ tắt thì không render gì.
