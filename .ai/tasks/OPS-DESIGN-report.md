# OPS-DESIGN — Báo cáo Implementer

- **Task:** Ops console design/spec review
- **Spec:** `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md`
- **ADR:** `docs/adr/ADR-010-ops-console.md`
- **Plan nguồn:** task được Reviewer (root) giao với scope docs-only ngày 2026-10-05; chưa tạo plan triển khai O1.
- **Nhánh:** workspace dùng chung; không push, không merge.
- **Implementer:** Codex

## 1. Đã làm

- Tạo spec Ops đầy đủ từ sáu nhóm yêu cầu: sidebar không link chết, Overview queue/O2 boundary, Marketplace/People/Inbox, role matrix, `ops_members` và magic-link activation, audit log, security headers/404/Origin, chuyển legacy `/admin`, phối hợp EPIC 21 và tài liệu tiếp theo.
- Thêm design bar UI OPS đo được: shell sidebar khoảng 240px, VNX tokens và self-hosted fonts, data-first queues, accessible dense tables, URL filters khi backend hỗ trợ, list/detail/action/result/audit flow, trạng thái freshness/empty/error, WCAG contrast/focus, keyboard, responsive `375/768/1280/1440`, zoom 200%, reduced motion và confirmation/duplicate-submit cho hành động nguy hiểm.
- Ghi rõ UI OPS là quality bar, không phải chứng nhận ngành; tham khảo và áp dụng có chọn lọc nguyên tắc từ Grafana, PagerDuty và Carbon Data Table, không sao chép brand/marketing layout.
- Ghi các quyết định Owner đã xác nhận: chỉ `ADMIN_EMAILS` root Owner có hiệu lực Owner; UI chỉ cấp Operator/Content/Viewer; chỉ Owner quản lý team; Operator không suspend root Owner; monetization Owner-only; pending permission chỉ activate sau magic-link verification khớp email chuẩn hóa.
- Tạo ADR-010, chỉ thay phần authorization/route Ops của ADR-002 và ngoại lệ language/route Ops của ADR-003; magic link/session và public locale không đổi.

## 2. Quyết định và giới hạn

- Canonical Ops là English `/ops`, dùng `t()` và vẫn giữ parity key bốn locale theo chính sách hiện tại; locale-prefixed `/admin` chỉ là compatibility mapping.
- Guard Ops phải kiểm tra active user + capability ở mọi request và trả 404 kín cho unauthenticated, suspended, no-role và insufficient-role; denied responses cũng no-store/noindex.
- Audit UI chỉ dùng projection an toàn tối thiểu (`created_at`, actor ID, action, entity, entity ID), không render raw JSON/PII/secrets hoặc link detail trái quyền.
- Membership grant/change/remove và pending invite lifecycle có audit nguyên tử; audit hiện có của legacy mutation được giữ. O1 không retrofit atomic audit cho toàn bộ Marketplace cũ.
- Thời hạn pending invite và metric/freshness của O2 để plan/đợt tương ứng quyết định; không tự đặt deadline mới.

## 3. Kiểm tra

### Required commands

```text
$ npm run typecheck -w apps/web
> typecheck
> wrangler types --strict-vars=false && tsc --noEmit
(exit 0; Wrangler generated types and tsc reported no errors.)

$ npm test
Test Files  122 passed (122)
     Tests  1182 passed (1182)
  Duration  132.77s (transform 32.19s, setup 830.21s, import 26.94s, tests 164.46s, environment 9ms)
(exit 0)
```

### Documentation checks

- `git diff --check`: exit 0, không có whitespace error trong phần diff hiện có.
- Relative reference check: các file local được link trong spec/ADR tồn tại (`UI audit`, ADR-002, ADR-003, ADR-010 và spec).
- Conflict marker check trên ba file task: không có conflict marker hoặc placeholder chưa xử lý.

## 4. Câu hỏi/việc để lại

- Projection tối thiểu đã là default cho O1. Nếu muốn thêm label/email hoặc payload audit khác, cần approval riêng trước khi mở rộng.
- Cần chốt mapping cuối cùng và query allowlist cho các route admin bổ sung khi module tương ứng chuyển; O1 plan sẽ biến thành test.
- Pending invite expiry duration thuộc O1 plan, chưa được đặt trong spec.
- O2 tự định nghĩa metric, data window, source và freshness contract; không thuộc O1.

## 5. Ghi nhận

- Không sửa code sản phẩm, test, locale hoặc `CURRENT-STATUS.md`.
- Workspace có thư mục untracked `.claude/` ngoài scope; không stage hoặc chỉnh sửa.
- Không có test mới vì task chỉ tạo tài liệu; đã chạy full suite theo yêu cầu để bắt lỗi tương tác với workspace dùng chung.
- Commit Conventional Commits sẽ chứa đúng ba file task này; không push/merge.
