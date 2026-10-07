# VNX-2508a — Handoff cho Implementer

- **Plan đã duyệt:** `.ai/plans/VNX-2508a-plan.md`. Plan là nguồn chi tiết; handoff này chỉ chốt phạm vi và cách kiểm.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2508a-report.md`
- **Worktree / nhánh:** `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`, nhánh `feat/vnx-2105-2508a` (đã `npm ci`). VNX-2105 có thể đã commit trước trên cùng nhánh. Không làm ở `D:\DOCS\SUPHAM\GIT\vnxsi`. Không push, không merge.

## Phạm vi

- `/ops/monetization/merchants` (danh sách + tạo), `/ops/monetization/merchants/:id` (chi tiết + History).
- Các POST sửa, đổi trạng thái, chương trình, offer, offer mặc định. Chỉ Owner (`monetization.view` / `monetization.act`).
- Mục menu Monetization › Merchants.
- Logic dùng chung với `/admin/merchants`. `/admin/merchants` không đổi.

## Ngoài phạm vi

- Chuyển hướng hay gỡ `/admin/*`.
- Feature flags trong Ops.
- Đổi nghiệp vụ partner, migration.

## Khuôn có sẵn

Làm theo đúng mẫu Ops Marketplace:

- Code: `src/routes/ops.tsx` (`opsShell`, `registeredPaths`, `actorOf`), `src/routes/ops-marketplace.tsx` (`historyOf`, cách render 400/404/409, `requireOps`), `src/views/ops/{OpsLayout,ProductsPages,parts}.tsx`, `src/ops/menu.ts`.
- Test: `test/ops/marketplace-products.test.ts` (mẫu test và ma trận vai trò), `test/ops/layout.test.ts`.
- Đọc `.ai/tasks/VNX-2504b-handoff.md` và `.ai/tasks/VNX-2504b-report.md` để biết cách đã tách hàm dùng chung khỏi route admin.

## Đọc trước

- `CLAUDE.md`, plan VNX-2508a.
- Spec Ops §2, §3, §7, ADR-010.
- Code: `src/routes/admin-merchants.tsx`, `src/views/admin/{MerchantsPage,MerchantDetailPage,OfferSection,partner-fields}.tsx`, `src/db/{merchants,programs,offers}.ts`, `src/domain/{merchant,offer}.ts`, `src/domain/ops.ts`, `src/auth/ops.ts`, `src/app.ts`.
- Test: `test/admin/merchants.test.ts`, `test/admin/merchant-offers.test.ts`, `test/architecture.test.ts` (`MONEY_ALLOWED` ghim chính xác: file mới import `db/merchants|programs|offers` thì phải thêm vào bảng ghim, và ghi lý do trong báo cáo).

## Quy tắc

- Mọi ghi đi qua hàm db/domain có sẵn. Không viết SQL mới cho merchant, chương trình, offer.
- Ops chỉ tiếng Anh. Khóa `ops.*` mới chỉ ở `en.ts`. Không tiền tố locale.
- 404 kín qua `requireOps` / `opsNotFound`. Header `no-store` + `X-Robots-Tag` do middleware có sẵn lo.
- HTML của `/admin/merchants*` phải giữ nguyên.
- CSP VNX-0803: không có `style=` hay script inline. POST ≤ 64 KB. Handler POST không redirect ra ngoài site.
- File dùng chung (`ops/menu.ts`, `OpsLayout.tsx`, `en.ts`, `app.css`, `app.ts`): chỉ thêm dòng, không sắp xếp lại. Nhánh `feat/ops-o1` cũng đang sửa các file này.
- Diff vượt ~600 dòng (không tính test, locale) thì dừng và báo trước khi làm tiếp.

## Tiêu chí chấp nhận

AC1–AC9 ở plan, mỗi tiêu chí có lệnh kiểm. Mỗi AC có ít nhất một test, viết trước code (TDD: commit test trước, rồi commit code).

## Môi trường máy

Máy dùng chung, RAM và đĩa sát giới hạn.

- `npm test` một lượt có thể hết bộ nhớ. Khi đó chạy theo thư mục (`npx vitest run test/<dir>/ --maxWorkers=2` trong `apps/web`) và ghi kết quả từng nhóm.
- Gặp timeout 5 s ngẫu nhiên: chạy riêng file đó và ghi cả hai kết quả.
- Không mở `wrangler dev`.

## Lệnh kiểm tra

```bash
cd D:/DOCS/SUPHAM/GIT/vnxsi-merchants
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài phạm vi. Nếu bắt buộc phải sửa, ghi lý do trong báo cáo.
- Không thêm dependency.
- Không commit `.dev.vars` hay bí mật.
- Commit theo Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ commit file của task này.
