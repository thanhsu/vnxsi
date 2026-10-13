# VNX-2704a — Báo cáo Implementer

Task: Ops, khối "Public listing" (sửa, publish, reject, unpublish). Nhánh `feat/epic27-request-board`, code `ec28a7b` (trên `26aff0a`).

## Đã làm

- `routes/ops-request-board.tsx` (mới, vào `RANKING_FILES`): bốn `POST /ops/marketplace/requests/:id/publication/{publish,edit,reject,unpublish}`, mỗi route `requireOps("marketplace.act")`, không có kiểm vai trò riêng. Mỗi lần ghi là một `db.batch([câu CAS của db/request-board.ts, auditStatement(..., publicationAuditGuard)])`; audit `request_publication.<hành động>`, `entity "request_publication"`, `entityId = request_id`, `data = { requestId, from, to }`. Thứ tự: không tìm thấy request/publication → 404 kín; chuyển trạng thái không hợp lệ (máy trạng thái, request không `submitted|matching` với publish) → 409; parse (`parsePublicListing`, `parseReviewNote`) → 400; thua CAS → 409 (không audit). Thành công: `303 ?done=1`.
- `views/ops/PublicListingBlock.tsx` (mới): bản gốc của client, ô `public_title`/`public_description` (điền sẵn từ bản gốc khi chưa có `public_*`), trường có cấu trúc chỉ đọc, danh mục kiểm duyệt, trạng thái/ngày/`review_note`; nút theo trạng thái (pending_review: Publish + Reject; published: Save wording + Unpublish). Mẫu VNX-0807: một `FormErrorSummary` trước form, id `pl-public-title|pl-public-description|pl-review-note` (+ `-error`), `aria-invalid`/`aria-describedby`, không `role="alert"`, action không có fragment; 409 là mục `href: ""`.
- `OpsLayout`: prop `invalid?: boolean` (tiền tố `form.error.titlePrefix` bằng `t("en", ...)`); vắng/false thì `<title>` không đổi (test so từng byte cho chi tiết request, danh sách request và Overview).
- `ops-marketplace.tsx`: `requestDetail` nạp publication (chỉ khi `can(role, "marketplace.act")`), gộp History của `request_publication` vào History của request (một khối, một `id="ops-history-h"`), và `registerOpsMarketplaceRoutes` trả `{ requestDetail }` để route mới dùng lại; `app.ts` đăng ký route mới ngay sau.
- `en.ts`: khóa `ops.board.*` (chỉ EN).
- Test: `test/ops/marketplace-request-board.test.ts` (28 test), thêm 4 đường POST vào ca OAuth của `test/ops/guard.test.ts`, `routes/ops-request-board.tsx` vào `RANKING_FILES` của `test/architecture.test.ts`.
- E2E: seed thêm người dùng staff `e2e-admin@example.test` (`OPS`, `users.is_admin = 1`, phiên `SESSION_RAW_OPS`, fixture `opsPage`), `R 2008..2010` + publication `pending_review` `Q 2008..2010` (cũ hơn 30 ngày), ca Ops trong `request-board-forms.spec.ts` (khối, Publish 400 với mẫu lỗi, rồi Publish), cập nhật `e2e/README.md` (phạm vi, ngân sách POST, đăng nhập seed, số test 63).

## Kết quả lệnh

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck -w apps/web` | sạch |
| `npm test -w apps/web -- test/ops/marketplace-request-board.test.ts ...` | 28 / 28 |
| `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000` (toàn bộ) | 194 file, 2438 passed + 2 skipped |
| `npm run e2e -- tests/request-board-forms.spec.ts` | 4 / 4 |
| `npm run e2e` (toàn bộ) | lần 1: 62 passed, 1 failed (`a11y.spec.ts` `vi /vi/login`, lỗi ở fixture `csp` tự động, chạy riêng xanh); lần 2: 63 / 63 |
| `npm run e2e:typecheck`, `npm run test:scripts` | sạch, 52 / 52 |

## Điểm cần Reviewer xem

1. **Thứ tự kiểm tra 409 trước 400.** Chuyển trạng thái không hợp lệ được kiểm trước parse (như `rejectRequest` của admin), nên `edit` trên `pending_review` luôn là 409 dù nội dung sai.
2. **Reject bị chặn cho request `pending_verification`** (route trả 409, khối không hiện nút): domain `publicationTransition` cho phép, nhưng nghĩa vụ CURRENT-STATUS nói chỉ `submitted|matching` ở hàng chờ/khối. SQL của `rejectStatement` (2702a) không kiểm trạng thái request; chặn ở route. Với request `pending_verification` khối hiện trạng thái và một câu "chưa xác nhận email", không có nút nào.
3. **Nút theo trạng thái, không hiện đủ "bốn nút" cùng lúc**: pending_review thấy Publish + Reject, published thấy Save wording + Unpublish (nút vô hiệu hóa sẽ là giao diện kém). Ca e2e kiểm đúng như vậy; nếu Reviewer muốn bốn nút cố định, báo lại.
4. **R1-S1 (truy vấn hàng chờ thật).** Truy vấn hàng chờ duy nhất hiện có là `countPublicationReviewQueue` (đếm, chưa có danh sách/bộ lọc `public=pending`, thuộc 2704b). Test chứng minh theo id: khối của request `pending_verification` không có Publish/Reject, hai POST giả mạo là 409 và không ghi/audit, rồi `countPublicationReviewQueue` tăng đúng 1 khi request chuyển `submitted` (so độ lệch, theo mẫu 2702a). Phần danh sách, bộ lọc và thẻ Overview theo id còn lại cho 2704b.
5. **Không gửi email** (đúng phạm vi); không có `TODO`/hàm rỗng. Redirect thành công về `?done=1` không giữ bộ lọc danh sách (action không mang `qs(filter)` theo đúng chuỗi plan `…/publication/<hành động>`).
6. **E2E**: bước kiểm bản đã sửa trong context không đăng nhập đã chuyển sang 2705a theo delta (ghi trong chú thích spec). Không quét axe cho `/ops` (ghi ở README). Lần chạy `npm run e2e` đầu có một lỗi lẻ ở `a11y.spec.ts` (`vi /vi/login`, do fixture `csp`), chạy lại riêng và toàn bộ đều xanh; không liên quan code mới nhưng ghi lại.
7. Test 28 viết cùng lúc với code (không có lần chạy đỏ riêng); các nhánh quan trọng (race giả lập bằng proxy `batch`, audit vắng khi thua CAS) có assert riêng.
8. Không cần copy mới ngoài Ops; không đụng plan, review, `CURRENT-STATUS.md`.

## Vòng sửa 1 (review `5fba240`: APPROVE_AFTER_FIXES)

Test mới được thêm và chạy **trước** khi sửa code (L-3). Lần chạy đỏ (`npm test -w apps/web -- test/ops/marketplace-request-board.test.ts`): `Tests 6 failed | 30 passed (36)`:

| Fix | Dòng đỏ trước khi sửa |
|---|---|
| M-1 (a) | `AssertionError: expected '<!DOCTYPE html>…' to contain 'CURRENT-TITLE'` |
| M-1 (b) | `AssertionError: expected '<!DOCTYPE html>…' not to contain 'TYPED-NOTE'` |
| M-2 | `AssertionError: postal addresses: expected '<a class="ops-back" …' to contain 'postal addresses'` |
| L-1 | `AssertionError: expected '<a class="ops-back" …' not to contain 'never shown'` |
| L-2 | `AssertionError: expected { …(14) } to be null` (`rejectStatement` trên request `pending_verification`) |
| S-1 / L-4c | `AssertionError: expected [ '2026-03-01T00:00:59.000Z', …(59) ] to have a length of 50 but got 60` |

Các test ghim L-4a (409 trước 400) và L-4b (`data` chính xác của edit/reject/unpublish, không có email/tên client) đã xanh ngay (hành vi vốn đúng, chỉ thiếu ghim); L-4c nằm trong ca S-1.

Đã sửa:
- **M-1:** 409 render trạng thái hiện tại (giá trị và token mới từ DB), không mang `values`; `Confirm` không mở, ô lý do rỗng. 400 giữ nguyên.
- **M-2:** danh mục kiểm duyệt viết lại theo bốn gạch của §3.2 (`ops.board.check.remove|confidential|combination|terms`, EN, **Reviewer duyệt câu khi re-review**); hiện mỗi khi khối có hành động (cả khi chỉ có Reject), không hiện khi không có hành động.
- **L-1:** câu mở đầu: "The public sees only the wording you publish here, never the client's name or e-mail. It starts as the client's own wording: edit it before you publish."
- **L-2:** `rejectStatement` có `NOT EXISTS (… status = 'pending_verification')`; một hàm `opsBoardActions(publicationStatus, requestStatus)` trong `domain/request-board.ts` dùng chung cho route và view.
- **S-1:** History gộp cắt còn `HISTORY_LIMIT` (50); truy vấn History của publication chạy song song trong cùng `Promise.all`.

Kết quả: typecheck sạch; `test/ops`, `test/architecture.test.ts`, `test/db` xanh; toàn bộ 194 file, 2446 passed + 2 skipped; `npm run e2e` 63/63; `e2e:typecheck` sạch; `test:scripts` 52/52.
