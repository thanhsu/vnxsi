# ADR-006: Prompt quản lý bằng Knowledge Package có phiên bản và eval gate

- **Trạng thái:** Proposed (quyết định khi brainstorm Wave 2)
- **Ngày:** 2026-10-03
- **Người quyết định:** Owner, Claude (Reviewer)

## Quyết định (đề xuất)

Mỗi năng lực AI có một thư mục `knowledge/<capability>/` gồm `system.md`, `output-schema.json`, `examples/` (≥3), `evaluation/` (≥10 ca có assertion), `changelog.md`, `version.yaml`. Đổi package phải bump version và qua eval trong CI trước khi merge.

## Bối cảnh

Prompt là "code" quyết định chất lượng gợi ý và tính trung lập (ADR-004). Không có phiên bản và eval thì không biết thay đổi làm tốt hơn hay tệ đi.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Prompt viết inline trong code | Không có phiên bản, không có eval, khó review |
| Lưu prompt trong DB để sửa nóng | Bỏ qua review và eval |

## Hệ quả

- Tích cực: review được, tái lập được, có số đo.
- Chấp nhận: thêm công viết ca eval.

## Được bảo đảm bởi

(Wave 2) `scripts/lint-knowledge.mjs` trong CI và job eval khi `knowledge/**` thay đổi.
