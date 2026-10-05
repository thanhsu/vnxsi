# ADR-010: Ops console, role và ngoại lệ ngôn ngữ

- **Trạng thái:** Accepted cho phạm vi và quyết định authorization; yêu cầu visual UI là acceptance criteria của spec, cần mockup review trước khi code.
- **Ngày:** 2026-10-05
- **Người quyết định:** Owner (các quyết định quyền ngày 2026-10-05), Reviewer (Codex)
- **Spec:** [VNX.SI Ops Console — Design Spec](../superpowers/specs/2026-10-05-vnxsi-ops-console-design.md)

## Bối cảnh

Khu vực `/admin/...` hiện dùng khái niệm admin chung và có nhiều màn hình đã tăng theo Marketplace, Feedback và EPIC 21. Ops cần một không gian canonical `/ops` để xử lý queue, có role rõ ràng, audit log chỉ đọc và khả năng ẩn module chưa làm. Link email cũ phải tiếp tục hoạt động an toàn trong lúc chuyển đổi.

## Quyết định

### 1. Canonical route và ngôn ngữ

- Console canonical là `/ops` và các route con tiếng Anh; không tạo `/vi/ops`, `/zh-hans/ops` hoặc `/zh-hant/ops`.
- Các route admin cũ và locale-prefixed admin được mapping về English `/ops` theo allowlist. GET legacy có thể redirect an toàn; POST legacy phải internal-delegate hoặc dùng 307/308 mapping tĩnh đã test, không 301/302 mù.
- Ops dùng `t()` với locale `en`. Theo quy tắc parity hiện tại, key mới vẫn có trong cả bốn locale file cho tới khi Owner đổi chính sách i18n. Đây là ngoại lệ route/language của Ops; public pages vẫn theo ADR-003.

### 2. Nguồn quyền

Quyền hiệu lực được resolve ở server trong từng request từ user active, `ADMIN_EMAILS` và `ops_members`:

| Role | Quyền |
|---|---|
| Owner | Owner gốc từ `ADMIN_EMAILS`; quản lý Team & roles; cấp Operator, Content, Viewer; quyền cao nhất trong các module đang có |
| Operator | Xem Overview/Audit log; thao tác Marketplace, Users, Feedback |
| Content | Xem Overview/Audit log; Overview chỉ có aggregate counts/freshness an toàn; thao tác Content & marketing; không có quyền Marketplace, Users hoặc Feedback |
| Viewer | Chỉ xem Overview, Audit log và các danh sách được cấp |

Chỉ Owner gốc được quản lý membership. UI không cấp role Owner. Monetization tạm thời Owner-only. Operator không được suspend root Owner.

`ops_members.role` có thể biểu diễn `owner`, `operator`, `content` hoặc `viewer`, nhưng `owner` chỉ có hiệu lực khi email đồng thời nằm trong `ADMIN_EMAILS`; UI không cấp role Owner. `ADMIN_EMAILS` là Owner gốc và không thể bị demote hoặc xóa khỏi Ops bằng UI hay POST giả mạo. Kiểm tra `users.status = active` vẫn áp dụng cho Owner gốc: user bị suspend mất Ops ngay, kể cả root Owner; mở khóa khôi phục quyền theo cấu hình root hoặc membership hiện tại.

### 3. Membership và xác minh email

`ops_members` lưu user, role, ai cấp và thời điểm cấp/cập nhật. Owner nhập email để tạo permission intent. Intent chưa cấp quyền cho tới khi người đó đăng nhập bằng magic link và token xác minh khớp email đã chuẩn hóa.

Ý định chờ được lưu ở bảng riêng (khuyến nghị `ops_member_invites`) với role, email chuẩn hóa, Owner tạo, thời điểm lifecycle và user đã nhận. Thời hạn intent là quyết định của plan O1, không suy ra từ deadline Marketplace. Transaction xác minh tạo/cập nhật `ops_members`, đánh dấu intent đã nhận và ghi audit. Không lưu raw token, session cookie hoặc secret. Job dọn user chưa xác nhận không được âm thầm xóa membership đã xác minh.

### 4. Authorization và response kín

- Mọi `/ops` page, action, POST và legacy mapping đều kiểm tra active user + capability ở server.
- Unauthenticated, suspended, no-role và insufficient-role đều trả 404 giống nhau; không redirect login và không tiết lộ Ops tồn tại.
- Mọi response, kể cả denied/404, có `Cache-Control: no-store` và noindex (`X-Robots-Tag` cùng meta trên HTML). `robots.txt` chặn `/ops` và `/ops/`.
- Mutation giữ Origin check hiện tại. Không dùng menu, hidden field hay session role làm authorization.

### 5. Audit

Grant/change/remove membership và pending invite lifecycle phải ghi audit nguyên tử cùng mutation. Audit hiện có của user suspension và các hành động quản trị khác được giữ và hiển thị qua projection an toàn; O1 không retrofit atomic audit cho toàn bộ mutation legacy. Root-protection denial không làm thay đổi dữ liệu nên record bảo mật là tùy chọn. Audit log là read-only và mọi role trong bảng được xem.

Projection tối thiểu của UI chỉ gồm thời điểm, actor ID, action, entity và entity ID. Không hiển thị raw JSON arbitrary, nội dung riêng tư, token, cookie, API key hoặc secret; không link tới detail mà role hiện tại không có quyền. Chính sách field visibility mở rộng và retention phải chốt trước O1.

## Phạm vi thay thế các ADR trước

- **ADR-002:** chỉ thay phần xác định quyền admin và route/response của Ops. Magic link, token purpose, session cookie và luồng đăng nhập vẫn giữ nguyên ADR-002.
- **ADR-003:** chỉ thêm ngoại lệ canonical English/no-locale-prefix cho `/ops` và yêu cầu dùng `t()`/parity key. Public URL locale, fallback EN và bốn locale vẫn giữ nguyên ADR-003.

ADR-004 và các ADR monetization không bị thay đổi. Quy tắc Monetization Owner-only ở giai đoạn đầu là capability boundary của Ops, không thay đổi mô hình monetization.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Dùng nguyên `requireAdmin` và `/admin` | Không biểu đạt role matrix; guard hiện tại có redirect/403 không phù hợp yêu cầu 404 kín của Ops. |
| Cấp quyền từ menu hoặc session cũ | Có thể bị bỏ qua bằng URL/POST; authorization phải kiểm tra mỗi request. |
| Cấp quyền ngay khi Owner nhập email | Chưa chứng minh người nhận sở hữu email; permission intent phải chờ magic-link verification. |
| Duy trì bốn UI locale cho Ops | Tăng số route và surface cần bảo vệ; Ops được chốt là canonical English, còn parity key vẫn bảo đảm theo ADR-003. |
| Redirect mọi POST legacy bằng 301/302 | Có thể đổi method/mất body hoặc bỏ qua Origin/capability; chỉ delegate hoặc 307/308 mapping tĩnh. |

## Hệ quả

- Có thêm resolver role và bảng membership/pending intent; đổi quyền phải có audit transaction.
- UI sidebar phải feature-aware và role-aware. Module chưa làm không xuất hiện, nên không có dead link.
- Root Owner vẫn phụ thuộc `active` để tránh quyền của user bị khóa tiếp tục chạy; `ADMIN_EMAILS` chỉ bảo vệ vai trò khỏi demote/remove.
- `/ops` English-only đơn giản hóa route và email, nhưng các key phải giữ parity bốn locale cho tới quyết định mới.
- Audit projection an toàn làm giảm dữ liệu hiển thị trực tiếp; field visibility không được tự mở rộng khi thêm module.

## Được bảo đảm bởi

Plan O1 phải thêm test cho:

- role matrix và 404 kín cho unauth/no-role/suspended/insufficient role;
- root Owner không thể demote/remove; Operator không suspend root Owner;
- pending email chỉ activate sau magic-link verification khớp email chuẩn hóa;
- audit atomic với membership mutation và projection không lộ secret/private payload;
- no-store/noindex cho thành công và denied, Origin check, legacy GET allowlist và POST mapping an toàn;
- menu không render route chưa sẵn sàng và canonical English redirect.
