# VNX.SI — AI Architecture v1.0

- **Ngày:** 2026-10-03
- **Trạng thái:** thiết kế cho Wave 2. **Wave 1 không có code AI** (YAGNI); Wave 1 chỉ thu dữ liệu mà Wave 2 cần.
- **ADR:** ADR-005 (provider port và chọn model), ADR-006 (Knowledge Package và eval) — cả hai đang Proposed.
- **Tham khảo:** kiến trúc 10 lớp của vsnstock (`blueprint/04-ai/AI-ARCHITECTURE.md`), điều chỉnh cho marketplace.

## 1. Năng lực AI dự kiến

| Năng lực | Đầu vào | Đầu ra | Wave | Thay thế cho |
|---|---|---|---|---|
| **Discovery** | Mô tả ý tưởng bằng ngôn ngữ tự nhiên (4 locale) | Yêu cầu có cấu trúc: người dùng, tính năng cốt lõi, category, ràng buộc | 2 | Form Post a request |
| **Solution options** | Yêu cầu có cấu trúc | 3 phương án Buy / Customize / Build, kèm product và builder cụ thể | 2 | — |
| **Builder matching** | Request | Danh sách builder xếp hạng kèm lý do | 2 | Gợi ý theo luật ở spec mục 8.10 |
| **Estimate** | Yêu cầu + dữ liệu giá thật của chợ | Khoảng giá và thời gian | 2 | — |
| **Listing assistant** | Bản nháp product của builder | Gợi ý viết rõ hơn, thiếu trường gì, bản dịch | 2 | — |
| **Moderation** | Inquiry, request, nội dung product | Spam / PII / vi phạm, kèm lý do | 2 | Admin đánh dấu thủ công |

## 2. Pipeline 10 lớp

Mọi năng lực đi qua cùng một pipeline. Mỗi lớp là một module riêng trong `apps/web/src/ai/`.

1. **Intent và ngữ cảnh:** xác định năng lực, locale, người gọi.
2. **Cổng sử dụng:** đăng nhập (nếu cần), rate limit, hạn mức ngày theo người dùng, ngân sách chi phí tháng toàn hệ thống. Vượt thì trả lỗi có kiểu, không gọi model.
3. **Công cụ xác định (deterministic tools):** truy vấn SQL hoặc FTS, không phải model. Ví dụ: `SearchProducts`, `SearchBuilders`, `GetCategoryPriceStats`, `GetBuilderTrackRecord`, `GetRequestHistory`.
4. **Ghép ngữ cảnh:** chỉ đưa dữ liệu cần thiết. **Không bao giờ** đưa email, tên đầy đủ hay liên hệ của client vào prompt.
5. **Chọn Knowledge Package:** prompt có phiên bản (mục 4).
6. **Gọi model qua provider port:** chọn model theo lớp năng lực (ADR-005), cache prompt cho phần tiền tố cố định.
7. **Kiểm schema đầu ra:** zod hoặc JSON Schema. Sai thì thử lại một lần, rồi trả lỗi có kiểu.
8. **Kiểm grounding:** mọi `productId` / `builderId` trong đầu ra phải nằm trong kết quả của lớp 3; mọi con số giá phải lấy từ `GetCategoryPriceStats`, model không tự tính.
9. **Kiểm an toàn và ngôn ngữ:** đúng locale; không hứa hẹn thay builder; không chứa PII; không ưu tiên dựa trên thứ gì khác ngoài tiêu chí công bố.
10. **Ghi sử dụng và audit:** bảng `ai_runs` (năng lực, phiên bản package, model, token vào/ra, cache hit, chi phí ước tính, độ trễ, kết quả kiểm, người gọi).

## 3. Envelope đầu ra chuẩn

```json
{
  "capability": "builder_matching",
  "packageVersion": "1.2.0",
  "model": "claude-haiku-4-5-20251001",
  "locale": "vi",
  "result": {},
  "candidates": [{ "type": "builder", "id": "01J...", "reasons": ["..."] }],
  "confidence": "low | medium | high",
  "warnings": [],
  "generatedAt": "2026-10-03T09:00:00Z",
  "dataAsOf": "2026-10-03T08:05:00Z"
}
```

Giao diện chỉ đọc envelope đã qua lớp 7–9; không bao giờ hiển thị đầu ra thô của model.

## 4. Knowledge Package

```
knowledge/<capability>/
  system.md            vai trò, luật cứng, định dạng
  output-schema.json   schema của result
  examples/            ≥ 3 ca mẫu (input → output đúng)
  evaluation/          ≥ 10 ca có assertion (schema, grounding, locale, nội dung)
  changelog.md
  version.yaml         semver + model mặc định
```

Script `scripts/lint-knowledge.mjs` kiểm đủ file, schema hợp lệ, số ca tối thiểu. Đổi package → bump version → chạy eval → ghi changelog.

## 5. Xếp hạng và tính trung lập

- Model chỉ được **xếp lại và giải thích** trong tập ứng viên do lớp 3 trả về. Không tự thêm ứng viên.
- Không có tín hiệu trả tiền nào trong đầu vào của model (ADR-004).
- Thứ tự cuối và lý do được lưu trong `ai_runs` để tái lập và kiểm toán.

## 6. Người trong vòng lặp

1. **Shadow mode** (đầu Wave 2): AI matching chạy song song gợi ý theo luật trong `/admin`; admin vẫn tự chọn. Đo tỷ lệ admin chọn đúng người AI gợi ý.
2. **Assisted:** AI gợi ý được chọn sẵn, admin xác nhận.
3. **Auto-invite:** chỉ bật khi eval đạt ngưỡng (mục 7) trong 4 tuần liên tiếp.

## 7. Eval

| Năng lực | Bộ dữ liệu | Chỉ số | Ngưỡng ra production |
|---|---|---|---|
| Builder matching | `request_invites` của Wave 1: admin đã mời ai, ai gửi đề xuất, ai được chọn | precision@5 so với builder được chọn; recall builder đã gửi đề xuất | precision@5 ≥ rule-based + 10 điểm |
| Discovery | ≥ 30 ý tưởng thật (ẩn danh) × 4 locale | schema hợp lệ 100%; đúng locale 100%; Owner chấm ≥ 4/5 | cả ba |
| Estimate | request đã có đề xuất kèm giá | khoảng giá chứa giá đề xuất được chọn | ≥ 70% |
| Moderation | inquiry/request đã bị `removed` và mẫu sạch | precision spam | ≥ 95% |

Eval chạy trong CI khi `knowledge/**` thay đổi (job riêng, dùng API key của môi trường CI, có ngân sách).

## 8. Chọn model và chi phí (ADR-005)

| Lớp năng lực | Model mặc định | Lý do |
|---|---|---|
| Phân loại, moderation, trích xuất | `claude-haiku-4-5-20251001` | rẻ, nhanh |
| Discovery hội thoại, solution options, matching có giải thích | `claude-sonnet-5-5` | chất lượng lập luận |
| Dịch nội dung product, xử lý hàng loạt | Batch API + Haiku | rẻ, không cần realtime |

- Provider là port (`ai/provider.ts`): đổi nhà cung cấp chỉ là đổi cấu hình.
- Ngân sách: trần chi phí tháng toàn hệ thống (`AI_MONTHLY_BUDGET_USD`) và hạn mức theo người dùng; vượt trần thì năng lực tự tắt, giao diện quay về luồng không AI.

## 9. Việc Wave 1 làm để sẵn sàng cho Wave 2

- Lưu đầy đủ văn bản request, category, ngôn ngữ, kết quả lời mời (đã có trong spec).
- Lưu trường product có cấu trúc (category, features, pricing tiers, delivery model).
- `audit_log` cho mọi chuyển trạng thái.
- Trang privacy nói rõ dữ liệu request có thể được dùng để cải thiện gợi ý, không chia sẻ thông tin liên hệ.
- **Không** thêm SDK AI, bảng `ai_runs` hay code AI trong Wave 1.
