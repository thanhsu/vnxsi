# CURRENT STATUS — VNX.SI

_Cập nhật lần cuối: 2026-10-03 bởi Reviewer (Claude)._

## Tóm tắt

- **Hướng sản phẩm:** marketplace cho sản phẩm được xây bằng AI và builder (pivot ngày 2026-10-03). Spec v0.1 cũ (agent runtime) đã Superseded.
- **Đợt hiện tại:** Wave 1 (Supply). Spec: `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`.
- **Milestone hiện tại:** M0 (nền tảng công cụ). Plan: `docs/superpowers/plans/2026-10-03-vnxsi-m0-m1-foundation.md`. Trạng thái: **chờ Owner duyệt plan**.
- **Production:** https://vnx.si vẫn chạy landing cũ + waitlist (Worker `vnxsi-web`, D1 `vnxsi`, migration 0001–0002). Không đụng tới cho đến M7.
- **Prototype giao diện:** https://claude.ai/artifact/SkuTz2YbCgoyX2aH5NgZSm (riêng tư).

## Task

| Task | Trạng thái | Commit | Ghi chú |
|---|---|---|---|
| VNX-0001 … VNX-0103 | Chưa bắt đầu | — | Xem plan M0–M1 |

## Quyết định phát sinh

- 2026-10-03: Giới hạn tần suất dùng bảng D1 `rate_limits` thay cho Workers Rate Limiting binding (binding chỉ hỗ trợ chu kỳ 10/60 giây). Spec mục 8.2 đã sửa.

## Nghĩa vụ để lại

- Trước M8: người bản xứ đọc lại bản dịch `zh-Hans`, `zh-Hant`.
- Trước Wave 3: nghiên cứu pháp nhân và cổng thanh toán (spec mục 12).
- Trước M3: Owner tạo bucket R2 `vnxsi-media`. Trước M1-auth chạy thật: Owner xác minh domain gửi mail trên Resend (DKIM/SPF trong DNS Cloudflare).

## Blocker

- Repo chưa có commit nào. Task VNX-0001 tạo commit nền (cần Owner đồng ý).

## Ghi nhận

- (trống)
