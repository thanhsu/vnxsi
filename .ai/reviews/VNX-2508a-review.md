# VNX-2508a — Review

- **Phạm vi review:** `b69c6b3..b013223`: `cc0c089` (test), `4d89c98` (refactor), `39e1f96` (feat), `b013223` (báo cáo). Diff không tính test và locale là +343 / −137.
- **Đối chiếu:** plan `.ai/plans/VNX-2508a-plan.md`, handoff, báo cáo `.ai/tasks/VNX-2508a-report.md`, spec Ops §2, §3, §5, §7, ADR-010, ADR-004, ADR-007, `test/architecture.test.ts`.
- **Người review:** Claude (phiên chính) và một subagent review độc lập. Subagent đọc từ git object và thử merge nhánh `feat/ops-o1` bằng `git merge-tree`.
- **Kết quả Implementer báo:** typecheck 0 lỗi; cả bộ 136 file / 1442 test xanh. Reviewer chạy lại sau lượt sửa.

## Verdict

**APPROVE WITH CHANGES.** Không có BLOCKER hay HIGH. Có một MEDIUM về bộ chặn đọc bảng tiền, phải sửa trước khi merge.

## Đã kiểm, đúng

- **Phân quyền:**
  - Có 10 cặp method–route: 2 GET dùng `monetization.view`, 8 POST dùng `monetization.act`. Chỉ Owner có hai capability này.
  - Khi bị từ chối, route trả `opsNotFound`, giống hệt catch-all `/ops/*`.
  - `requireOps` chạy trước mọi lần đọc body hay ghi.
  - Id lạ, hoặc chương trình/offer thuộc merchant khác, đều nhận 404 kín.
- **Thứ tự middleware:** `opsHeaders` → Origin → giới hạn body → session đều đứng trước route. Route mới đăng ký trước catch-all `/ops`. Có test cho 403 và 413.
- **`/admin` giữ nguyên hành vi:**
  - Thứ tự kiểm tra trong từng action khớp handler cũ: `expectedStatus`, rồi parse, rồi chuyển trạng thái, rồi `confirmArchive`.
  - Slug vẫn lấy từ DB, không đọc từ request.
  - Cổng `hostsChanged` / `offersBrokenByHosts` vẫn còn.
  - Mã lỗi giữ như cũ: 404 và 409 qua `errorResponse`, 400 trả chữ "Bad request", 303 có locale.
  - Implementer so hash HTML `/admin` trước và sau refactor, và các hash khớp.
- **Ops:**
  - Sau khi lưu, trả 303 về `/ops/monetization/merchants/:id?done=1`: id lấy từ DB, không locale, không chuyển hướng ra ngoài site.
  - Trang 400 và 409 render trong `OpsLayout`. Lỗi 409 đọc lại trạng thái hiện tại.
  - Actor trong audit là user đang đăng nhập.
  - History dùng projection an toàn và có trạng thái lỗi riêng.
- **View và CSS:** view không import `db`, không có tên partner, không có `style=` hay script inline. Hai trang mới nằm trong CSP scan. CSS `.ops-legacy*` có phạm vi riêng và chỉ thêm vào cuối.
- **Test:** test so luồng `/admin` với `/ops` dùng `toEqual` trên dữ liệu bảng và audit. Ma trận vai trò phủ 4 danh tính không phải Owner cộng người chưa đăng nhập, trên cả 10 cặp method–route, kèm ảnh chụp số dòng các bảng.

## Phát hiện

| # | Mức | Vị trí (`b013223`) | Vấn đề | Sửa |
|---|---|---|---|---|
| M1 | MEDIUM | `test/architecture.test.ts:112,120`; `src/routes/admin-merchants.tsx:87-103` | `admin-merchants.tsx` giờ export các hàm đọc và ghi bảng tiền (`loadMerchants`, `merchantOfRequest`, `loadMerchantDetail` và 8 action). Bộ chặn chỉ bắt import trực tiếp `db/<money>.ts`, nên một file xếp hạng có thể import `routes/admin-merchants.tsx` để đọc bảng tiền mà test vẫn xanh. `ops-monetization.tsx` đọc bảng tiền gián tiếp nhưng không nằm trong `MONEY_ALLOWED` (trái AC7). Hiện chưa có vi phạm, nhưng bộ chặn của một luật cứng (ADR-004/007) đã yếu đi. | Thêm `src/routes/ops-monetization.tsx` vào `MONEY_ALLOWED` và danh sách ghim, có ghi lý do. Thêm assertion: không file nào trong `RANKING_FILES` import một module thuộc `MONEY_ALLOWED`, và không file nào ngoài `MONEY_ALLOWED` import `routes/admin-merchants.tsx`. |
| L1 | LOW | `test/ops/layout.test.ts` (`OPS_MENU[4]`); `src/ops/menu.ts:24` | Assertion dựa vào vị trí trong mảng sẽ sai khi `feat/ops-o1` (2504c) chèn Inquiries/Invites vào `OPS_MENU`. Thử merge đã cho xung đột ở `test/ops/layout.test.ts` và `test/http/security-headers.test.ts`. | Tìm mục menu theo `path`, không theo vị trí. Xung đột ở dòng union `OpsIcon` và hai file test: ghi vào `CURRENT-STATUS.md` cho người merge sau. |
| L2 | LOW | `test/ops/monetization-merchants.test.ts` | Trang 400 `badRequest` của Ops (thiếu tick xác nhận archive, `expectedStatus` lạ) và lỗi `confirmArchive` khi archive offer mặc định chỉ được kiểm mã trạng thái. Nếu Ops quay về trả chữ "Bad request" thì test vẫn xanh. | Kiểm thêm trang render trong `OpsLayout`, câu thông báo `ops.merchants.badRequest`, và dấu hiệu lỗi `confirmArchive`. |
| L3 | LOW | cùng file, ma trận vai trò | Với POST, test chỉ so status và body với 404 kín, không so header. | So cả header cho POST, giống cách test đang làm với GET. |
| L4 | LOW | `cc0c089` | Commit test đỏ không qua typecheck (biến `merchants` chưa khai báo), nên test đỏ vì `ReferenceError` chứ không vì đúng lý do. `39e1f96` đã sửa. | Chấp nhận và ghi lại, không viết lại lịch sử. |
| S1 | SUGGESTION | History | Khối History chỉ hiện audit `entity = 'merchant'`. Sửa chương trình hay offer không hiện ở đây. | Đúng plan. Ghi vào "Ghi nhận" để làm sau. |
| S2 | SUGGESTION | AC9 | Chưa xem giao diện ở 1280 px và 390 px. | Reviewer làm sau lượt sửa. |

## Khắc phục được duyệt

Duyệt **M1, L1 (phần test tìm theo `path`), L2, L3**, theo ủy quyền điều phối của Owner.

- L4: chấp nhận như hiện trạng.
- S1: ghi nhận.
- S2: Reviewer tự làm.
- Implementer chỉ sửa các mục đã duyệt, viết test trước, rồi bổ sung mục "Lượt sửa" vào `.ai/tasks/VNX-2508a-report.md`.

## Re-review

- **Lượt sửa:** `8bbf315` (chỉ test), `47d870f` (báo cáo). Không đổi code production.
- **M1: đã sửa.**
  - `routes/ops-monetization.tsx` đã vào `MONEY_ALLOWED` và danh sách ghim, có ghi lý do.
  - Assertion mới (a): không file nào trong `RANKING_FILES` import một module thuộc `MONEY_ALLOWED`. Riêng `db/audit.ts` được miễn, vì nó là bộ ghi audit dùng chung và `admin-requests.tsx` (một file xếp hạng) dùng nó hợp lệ; nó không đọc giá trị tiền. Reviewer chấp nhận ngoại lệ này.
  - Assertion mới (b): ngoài `MONEY_ALLOWED` và `app.ts`, không file nào import `routes/admin-merchants.tsx`.
  - Implementer đã chứng minh hai assertion bắt được vi phạm bằng 4 lần thêm import tạm (không commit).
  - Giới hạn còn lại: import chỉ để lấy side effect, không có `from`, sẽ không bị bắt. Đây là giới hạn chung của kiểu kiểm hiện có. Đã ghi nhận.
- **L1, L2, L3: đã sửa.**
  - L1: tìm mục menu theo `path`.
  - L2: kiểm cả 4 trang 400 render trong `OpsLayout`, kèm câu thông báo hoặc dấu hiệu lỗi.
  - L3: ma trận POST so cả header.
- **Lệnh Reviewer chạy lại ở `47d870f`:**
  - `npm run typecheck -w apps/web`: sạch.
  - `npm test`: **136 file / 1447 test xanh**.
- **AC9 (Reviewer xem):** `wrangler dev` cổng 8796, D1 local, phiên Owner local, chụp bằng Chrome headless qua CDP:
  - `/ops/monetization/merchants` 1280 px sáng: menu Monetization › Merchants đang chọn; breadcrumb Ops / Monetization / Merchants; bảng và form tạo.
  - `/ops/monetization/merchants/:id` 1280 px sáng và tối, 390 px sáng: đủ form merchant, nút chuyển trạng thái, chương trình, offer, History.
  - Không cuộn ngang. Ở 390 px mọi thứ về một cột.
  - Giao diện là form của admin đặt trong khung Ops (`.ops-legacy`), đọc được và dùng được. Làm lại cho đúng mockup Ops là việc của VNX-2509, đã ghi nhận.

## Verdict cuối

**APPROVE.**
