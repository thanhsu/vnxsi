# Handoff — VNX.SI Whitepaper và Marketing

- **Task ID:** `DOCS-WHITEPAPER-MARKETING`
- **Ủy quyền:** Người dùng yêu cầu viết whitepaper cho dự án và một tài liệu marketing giới thiệu dự án. Phạm vi đã được Reviewer phê duyệt: chỉ tài liệu, không thay đổi hành vi sản phẩm.
- **Owner thực hiện:** Implementer; Reviewer kiểm tra diff, tính nhất quán và cập nhật trạng thái nếu cần.
- **Ngày:** 2026-10-05

## Phạm vi đã duyệt

1. Tạo `docs/WHITEPAPER.md` bằng tiếng Anh chuyên nghiệp, có thể dùng làm tài liệu định hướng sản phẩm, kỹ thuật và chiến lược ở mức vừa đủ. Nội dung phải phân biệt rõ trạng thái đã hợp nhất, đã triển khai và kế hoạch; dùng luận đề thay cho số liệu thị trường không có nguồn; mô tả đúng workflow hiện có, mô hình Buy / Customize / Build, huy hiệu, xếp hạng, kiến trúc, riêng tư/bảo mật, nền tảng kiếm tiền và lộ trình.
2. Tạo `docs/MARKETING.md` bằng tiếng Anh chuyên nghiệp, hướng tới khách hàng, builder và đối tác, giới thiệu định vị, lợi ích, hành trình dùng thử, điểm tạo niềm tin, các phiên bản pitch ngắn và CTA. Không bịa người dùng, doanh thu, đối tác, testimonial hay cam kết kết quả; tính năng tương lai phải được ghi rõ là kế hoạch. Marketing giữ bản ngắn, hướng ngoại và không đưa ghi chú vận hành nội bộ vào nội dung chính.
3. Kiểm tra các liên kết tương đối và tuyên bố chéo giữa hai tài liệu. Không sửa `CURRENT-STATUS.md`.
4. Chạy `npm run typecheck -w apps/web` và `npm test`; ghi nguyên văn kết quả và các lỗi có sẵn (nếu có) trong report.
5. Chỉ commit các file thuộc phạm vi task bằng Conventional Commit; không push/merge.

## Nguồn phải đọc và đối chiếu

- `.ai/context/CURRENT-STATUS.md`
- `docs/blueprint/01-PRODUCT-CHARTER.md`
- `docs/blueprint/02-MODULE-MAP.md`
- `docs/blueprint/02-NFR.md`
- `docs/blueprint/03-DOMAIN-CATALOG.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/AI-ARCHITECTURE.md`
- `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`
- `docs/adr/ADR-004-neutral-ranking.md`
- `docs/adr/ADR-007-monetization.md`
- `docs/adr/ADR-008-sponsored-placement.md`
- `docs/strategy/2026-10-03-marketplace-os-v1.md`
- `docs/strategy/2026-10-04-monetization-audit.md`
- `docs/roadmap/WAVE1-ROADMAP.md`
- `docs/legal/privacy.md`, `docs/legal/terms.md`, `docs/legal/disclosure.md`, `docs/legal/media-kit.md`
- Các route/domain hiện có trong `apps/web/src/` để kiểm chứng workflow và giới hạn thực tế.

## Ràng buộc nội dung

- Tính đến trạng thái Reviewer ghi ngày 2026-10-05: production đang chạy bản `main` mới nhất đã triển khai với migrations `0001`–`0009`; lát cắt EPIC 21 đã merge nhưng chưa deploy. Không đưa chi tiết nội bộ không cần thiết vào marketing.
- ElevenLabs chưa bật nên không nêu tên trong marketing như đối tác đang hoạt động.
- Liên hệ đã xác minh dùng `contact@vnx.si`; CTA chính là `https://vnx.si`.
- Không tự cập nhật trạng thái hay nội dung pháp lý ngoài phạm vi tài liệu được giao.
