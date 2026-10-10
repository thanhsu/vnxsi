# ADR-013: Chỉ liên kết provider mới từ session magic link

- **Trạng thái:** Accepted (Owner duyệt 2026-10-10)
- **Ngày:** 2026-10-10
- **Người quyết định:** Owner; Claude (Reviewer) soạn
- **Bổ sung:** ADR-012 §4 (liên kết và hủy liên kết). Mọi phần khác của ADR-012 giữ nguyên.

## Quyết định

Bắt đầu liên kết một provider mới (`POST /me/identities/:provider/link`) và hoàn tất liên kết ở callback chỉ được phép khi session hiện tại có `method = magic_link`. Session `oauth_*` vẫn đăng nhập, xem `/me` và hủy liên kết được như trước. Callback nhánh `link` kiểm lại session còn sống và vẫn là session đã bắt đầu liên kết **sau** khi đổi code với provider, ngay trước khi ghi liên kết.

## Bối cảnh

Review VNX-2605c (2026-10-10) tìm ra hai đường mà ADR-012 chưa chặn:

1. **Nhảy sang provider thứ hai.** Kẻ gian đã liên kết GitHub của họ vào tài khoản nạn nhân và đăng nhập bằng GitHub có thể, từ session `oauth_github` đó, liên kết thêm LinkedIn của họ rồi đăng nhập bằng LinkedIn. Hủy liên kết GitHub (VNX-2605c) kết thúc mọi session `oauth_github` nhưng không chạm session `oauth_linkedin`. Nạn nhân phải hủy từng provider mà kẻ gian đã thêm.
2. **Khoảng hở thời gian ở nhánh link.** Callback kiểm session trước khi gọi provider để đổi code, rồi ghi liên kết mà không kiểm lại. Nếu session của kẻ gian bị kết thúc trong lúc đó, liên kết vẫn được ghi.

## Động lực

- Muốn thêm một cách đăng nhập mới phải chứng minh quyền với hộp thư của tài khoản, giống quy tắc `/ops` (ADR-012 §6) và ADR-010.
- Giữ được lời hứa của VNX-2605c: hủy liên kết một provider đủ để đẩy kẻ gian ra, không để họ kịp mở đường khác.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Giữ nguyên, dựa vào email báo liên kết | Nạn nhân phải tự phát hiện và hủy từng provider; kẻ gian có thể lặp lại |
| "Đăng xuất các phiên khác" | Hữu ích nhưng là việc lớn hơn; Owner đã đưa vào backlog sau VNX-2608. Không chặn được việc mở thêm provider |
| Chỉ chặn liên kết khi đã có identity khác | Phức tạp hơn và vẫn để một session `oauth_*` mở được đường đầu tiên |

## Hệ quả

- Tích cực: một tài khoản chỉ có thêm cách đăng nhập khi người đó vừa đăng nhập bằng link qua email.
- Chấp nhận: người đang đăng nhập bằng Google/GitHub/LinkedIn muốn liên kết thêm provider phải đăng nhập lại bằng email trước. Trang `/me` giải thích điều này thay cho nút "Liên kết" (câu chữ chờ Owner duyệt trong task VNX-2605d).
- Không đổi: hủy liên kết luôn được phép với mọi session (ADR-012 §4); đăng nhập bằng provider đã liên kết không đổi.

## Được bảo đảm bởi

Task VNX-2605d phải thêm test cho:

- `POST …/link` từ session `oauth_*` bị từ chối, không ghi cookie intent; từ session `magic_link` vẫn 303 như trước;
- callback nhánh `link` với flow bắt đầu từ session `magic_link` nhưng session nay là `oauth_*` hoặc đã bị xóa: không ghi liên kết;
- session bị xóa giữa lúc đổi code và lúc ghi liên kết: không ghi liên kết, không audit, không email. (Ghi chú 2026-10-10: test dùng spy chỉ trong test bọc `FakeOAuthProvider.exchange` thay cho trigger như VNX-2605c, vì giữa lúc đổi code và lệnh INSERT không có câu lệnh D1 nào chạy để trigger bám vào; kèm một test gọi thẳng `linkIdentity` để chứng minh điều kiện nằm trong câu SQL.)
- hủy liên kết từ session `oauth_*` vẫn được phép.
