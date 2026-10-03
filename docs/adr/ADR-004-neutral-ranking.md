# ADR-004: Xếp hạng không bán; số liệu công khai chỉ từ dữ liệu thật

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-03
- **Người quyết định:** Owner, Claude (Reviewer)

## Quyết định

Không có tham số, cột hay đường code nào cho phép trả tiền để thay đổi thứ tự trong catalogue, danh bạ builder, Trending, Top builders, Top products hay gợi ý matching. Mọi con số công khai được tính từ dữ liệu thật theo định nghĩa ở spec mục 8.11 và chỉ hiển thị khi vượt ngưỡng.

## Bối cảnh

Chiến lược (mục 11): nếu người trả tiền đứng đầu thì niềm tin của client mất rất nhanh. Homepage có Trending, leaderboard và chart nên rủi ro "làm đẹp số" cao.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Sponsored trộn vào kết quả | Phá niềm tin; nếu có sau này phải là khu vực tách riêng, có nhãn, và cần ADR mới |
| Hiện số ngay từ đầu dù nhỏ | Số nhỏ làm chợ trông trống; số bịa thì vi phạm nguyên tắc trung thực |

## Hệ quả

- Tích cực: có thể nói thật "Nobody can pay to be here".
- Chấp nhận: homepage giai đoạn đầu ẩn nhiều khối cho tới khi đủ dữ liệu.

## Được bảo đảm bởi

Test xếp hạng ở `test/catalog/*.test.ts` (M4) và test ngưỡng ở `test/stats/*.test.ts` (M7). Review từ chối mọi thay đổi thêm trọng số không có trong spec.
