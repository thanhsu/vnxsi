# ADR-005: AI qua provider port, chọn model theo lớp năng lực

- **Trạng thái:** Proposed (quyết định khi brainstorm Wave 2)
- **Ngày:** 2026-10-03
- **Người quyết định:** Owner, Claude (Reviewer)

## Quyết định (đề xuất)

Mọi lời gọi model đi qua interface `AiProvider` trong `src/ai/provider.ts`. Lớp năng lực quyết định model: Haiku 4.5 cho phân loại/moderation/trích xuất, Sonnet 5.5 cho discovery và matching có giải thích, Batch API cho dịch hàng loạt. Có trần chi phí tháng và hạn mức theo người dùng; vượt thì tắt năng lực AI và quay về luồng không AI.

## Bối cảnh

Chiến lược mục 24: platform không phụ thuộc model nào. Wave 2 thêm AI Discovery, matching, estimate.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Gọi thẳng SDK một nhà cung cấp trong route | Khóa nhà cung cấp; khó test; khó đo chi phí |
| Một model cho mọi việc | Lãng phí chi phí cho tác vụ đơn giản |

## Hệ quả

- Tích cực: test bằng provider giả; đổi nhà cung cấp là đổi cấu hình; chi phí đo được theo năng lực.
- Chấp nhận: thêm một lớp trừu tượng.

## Được bảo đảm bởi

(Wave 2) test kiến trúc: chỉ `src/ai/providers/*` được import SDK của nhà cung cấp.
