# ADR-008: Sponsored là ô tách riêng, không đổi thứ tự xếp hạng

- **Trạng thái:** Proposed (chờ Owner duyệt văn bản; quyết định nghiệp vụ Q2 ngày 2026-10-04)
- **Ngày:** 2026-10-04
- **Người quyết định:** Owner, Claude (Reviewer)
- **Bổ sung cho:** ADR-004. ADR-004 giữ nguyên hiệu lực với mọi danh sách xếp hạng; ADR này chỉ cho phép thêm một loại khối mới nằm ngoài các danh sách đó.
- **Áp dụng từ:** sau cổng ra Wave 1 (EPIC 23)

## Quyết định

Builder có thể trả tiền để product xuất hiện trong một **ô "Sponsored" riêng**. Ô này có nhãn rõ ràng và nằm ngoài mọi danh sách xếp hạng. Không có điểm cộng, trọng số hay vị trí nào trong danh sách organic được bán. Thứ tự organic phải giống hệt nhau dù sponsored đang bật hay tắt.

## Bối cảnh

Prompt monetization đề xuất `FinalDisplay = OrganicRanking + PromotionBoost`. Công thức đó vi phạm ADR-004. Owner chọn phương án ô tách riêng (Q2). Charter đã dự liệu: "Sponsored listing (nếu có sau này phải tách nhãn và cần ADR mới)".

## Luật

1. **Vị trí được phép:** một khối riêng trên homepage và một ô riêng trên trang duyệt category (`/products` khi lọc theo category, không có từ khóa). Số ô tối đa mỗi trang do Owner chốt khi lập plan EPIC 23.
2. **Vị trí cấm:** kết quả có từ khóa tìm kiếm, `/p/:slug` (không đặt product đối thủ lên trang của builder khác), `/b/:handle`, danh bạ `/builders`, Trending, Top builders, Top products, gợi ý builder cho request, mọi đầu vào và đầu ra AI, Hub, `/me`, form Inquiry/request.
3. **Nhãn:** chữ "Sponsored" ở 4 locale, đặt trên khối, kèm link giải thích. Không dùng màu hay kiểu thẻ giống hệt thẻ organic.
4. **Organic không đổi:** product được tài trợ vẫn nằm ở vị trí organic của nó trong danh sách, không bị ẩn, không bị đẩy lên. Product đã hiện trong ô sponsored vẫn có thể xuất hiện lần nữa ở danh sách organic.
5. **Điều kiện:** product `published` của builder `approved`, có ít nhất huy hiệu `listed`. Admin duyệt từng chiến dịch và từ chối được. Chiến dịch có ngày bắt đầu và kết thúc.
6. **Câu "Nobody can pay to be here"** vẫn đúng và chỉ được dùng cho các khối xếp hạng (Top builders, Trending, Top products). Không đặt câu này cạnh ô sponsored.
7. **"Featured" không phải paid placement.** Khối do platform chọn theo tiêu chí công bố (ví dụ mới được xác minh) không được dùng chữ "Featured" theo nghĩa trả tiền, và không được bán.
8. **Thu tiền:** trước khi có cổng thanh toán (EPIC 14) chỉ dùng hợp đồng thủ công; doanh thu ghi vào `revenue_entries` với `source_type = 'sponsored'`.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Boost điểm trong danh sách organic | Vi phạm ADR-004, phá niềm tin client, không thể nói thật "không ai trả tiền để lên top" |
| Trộn thẻ sponsored vào giữa kết quả (kiểu quảng cáo search) | Người dùng khó phân biệt, nhất là trên mobile; vẫn làm lệch thứ tự nhìn thấy |
| Không bao giờ có sponsored | Bỏ một nguồn doanh thu mà builder chấp nhận được; Owner chọn ô tách riêng |

## Hệ quả

- Tích cực: có nguồn doanh thu từ builder mà danh sách xếp hạng vẫn trung lập và kiểm được bằng test.
- Tiêu cực / chấp nhận: ô sponsored chiếm diện tích trên homepage/category; số ô ít nên doanh thu bị giới hạn.

## Được bảo đảm bởi

- Test (EPIC 23): cùng một dữ liệu, kết quả truy vấn xếp hạng giống hệt nhau khi bật/tắt cờ `sponsored_listings` và khi có/không có chiến dịch.
- Test kiến trúc (ADR-007 luật 2): truy vấn xếp hạng không tham chiếu bảng chiến dịch.
- Test giao diện: khối sponsored luôn có nhãn ở cả 4 locale; không render trên các route cấm.
