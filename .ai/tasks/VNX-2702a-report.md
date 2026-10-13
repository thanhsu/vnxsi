# VNX-2702a report: migration 0018, db/request-board.ts, audit guards, ownership tests, query counter

Implementer: Claude (Opus 5.5 label per commit trailer). Branch `feat/epic27-request-board`. Code commit `d6ab34d`.

## What was done
- Step 1: `git ls-tree origin/main apps/web/migrations/` shows `0001`-`0017`; no other local branch holds `0018`. Migration is `apps/web/migrations/0018_request_board.sql` (verbatim the plan's schema, comments only added).
- `db/request-board.ts`: sole writer of `request_publications` and `request_interests`. Write statements: `optInStatement`, `reOptInStatement` (M4), `publishStatement`, `editPublicStatement`, `rejectStatement`, `unpublishStatement`, `withdrawStatement`, `createInterestStatement` (all gates in one `INSERT ... SELECT ... WHERE`; H1 cap counts only pending interests on open requests with a published publication), `withdrawInterestStatement`, `dismissInterestStatement`, `markInterestsInvitedStatements`, plus `returnedPublication`/`returnedInterest`. Reads: `findPublicationByRequestId`, `findPublicationByPublicId`, `findPublicListing`, `listOpenPublications`, `countOpenPublications`, `countOpenPublicationsAll`, `listSitemapRequests`, `findViewerRelation` (H2, one query), `listInterestsForRequest`, `listBuilderInterests`, `findInterestFor`, `findInterestById`, `countPublicationReviewQueue`, `countInterestQueue`, `listPublicationsForOps`. L9: the builder condition `b.status = 'approved' AND u.status = 'active'` is one named constant used in `createInterestStatement`, `findViewerRelation`, `listInterestsForRequest`, `countInterestQueue`.
- `db/audit.ts`: `AuditPublicationGuard { publicationRequestId, status, updatedAt }`, `AuditInterestGuard { interestId, status, updatedAt }` and their two `auditStatement` branches.
- `db/requests.ts`: `country` in `Row`/`toRequest`/`NewRequest` (optional, default null); `createRequestStatements` returns `{ id, statements }`; `createRequest` is a thin wrapper. `domain/request.ts`: `ClientRequest.country`.
- `test/architecture.test.ts`: `WRITERS` entries for both tables; `db/request-board.ts` added to `RANKING_FILES`, plus a test that it reads no money table and carries no money/priority words.
- `test/helpers.ts`: `countD1Queries(base = testEnv)` returns `{ env, queries }` (proxy of `DB` only; `first/all/run/raw` = 1, `batch(n)` = n; calls `resetFlagCache()` first).
- `wrangler.jsonc`: two comment lines for 0018 (migrate first, deploy after); the `0017` line and the step-1 list are untouched.

## Tests added
`test/db/request-board-migration.test.ts` (9: schema, additive, no retro rows, every CHECK/UNIQUE, cascade via `deletePendingRequestStatement` and via `deleteExpiredPendingRequests`: cascade WORKS in the test D1, no fallback needed), `test/db/request-board.test.ts` (34), `test/db/count-d1-queries.test.ts` (4), `test/db/requests.test.ts` (+1 country), `test/architecture.test.ts` (+1).

## Commands and results
- `npm run typecheck -w apps/web`: 0 errors.
- Plan verification set: `npm test -w apps/web -- --maxWorkers=2 test/db/request-board-migration.test.ts test/db/request-board.test.ts test/db/requests.test.ts test/architecture.test.ts test/jobs/daily-requests.test.ts` plus `count-d1-queries.test.ts`: 6 files, 116 tests passed.
- Full `npm test -w apps/web -- --maxWorkers=2`: 191 files, 2332 tests passed. (An earlier full run had 2 timeouts at 5000 ms in `test/me/requests.test.ts` while another session loaded the machine; that file passes alone and the second full run was clean.)

## Deviations / judgment calls (for the Reviewer)
1. `ViewerRelation` has a fourth field `approvedBuilder: boolean` beyond the plan's `{ ownRequestId, inviteId, interest }`. It applies L9 in the same single query so the CTA needs no extra query (8-query budget). Additive; drop it if the Reviewer prefers a separate builder lookup.
2. `optInStatement`, `reOptInStatement`, `withdrawStatement` take an optional `clientUserId` that, when given, is enforced in the SQL (`r.client_user_id = ?`). The plan gave no such parameter; it makes ownership a SQL gate rather than a route-only check. `optInStatement` also takes an optional `publicId` (default: fresh ULID).
3. `optInStatement` has `NOT EXISTS (publication for request)` so a second opt-in yields 0 rows instead of a PK error that would abort a whole batch.
4. `rejectStatement`/`unpublishStatement` require a non-blank note in the SQL (`length(trim(?)) > 0`), not only the 1000 cap by CHECK.
5. `PublicListing` names the public text `publicTitle`/`publicDescription` so the object has no `title`/`description` key (plan test: no original title/description in the object). `findPublicationByPublicId` returns the same type for any publication status; `findPublicListing` only `published`.
6. L1 (code-point lengths) belongs to `domain/request-board.ts` (VNX-2702b); nothing in 2702a. The SQL CHECKs use `length()`, which counts code points.
7. Repo files are CRLF in the working copy (autocrlf); all touched files were kept pure CRLF (git normalizes on commit).
8. `npm ci` was needed (no `node_modules` in the worktree); `wrangler types` regenerates `worker-configuration.d.ts`, which is untracked/ignored (no diff).

## Open items for later tasks
- `RANKING_FILES` entries for `domain/request-board.ts` (2702b), `routes/request-board.tsx`, `routes/ops-request-board.tsx`, `views/requests/*` still to add when those files exist (comment left in the test).
- The flag-cache count helper is verified against `affiliate`/`partner_referral`; `request_board` does not exist until 2702b.
- Nothing pushed, merged, deployed or run against a remote D1.

## Vòng sửa 1 (review `.ai/reviews/VNX-2702a-review.md`, APPROVE_AFTER_FIXES)
- **M-1:** `ViewerRelation.approvedBuilder` thay bằng `builder: "none" | "approved" | "not_approved"` trong cùng một truy vấn (`CASE` với `NOT EXISTS builders` / hằng L9 / còn lại). Test: người lạ `none`; `pending`, `rejected`, `suspended`, và builder `approved` có user `suspended` -> `not_approved`; builder hợp lệ -> `approved`.
- **M-2:** `BuilderInterestItem.closedAt` thêm; `publicTitle` chỉ khi publication `published` và request khác `removed`, ngược lại null (`CASE` trong SQL). Test: request đóng có `closedAt`, client gỡ -> null, request `removed` -> null.
- **L-1:** bỏ `findPublicationByPublicId` (không có nơi dùng); test dùng `findPublicListing` và các ca dương/âm tương ứng.
- **L-2:** `clientUserId` bắt buộc ở `optInStatement`, `reOptInStatement`, `withdrawStatement`; bỏ nhánh `IS NULL OR` trong SQL; test cập nhật (helper `ownerOf`), ca chủ lạ vẫn trả 0 dòng.
- **L-4:** `countD1Queries` reset cache cờ ở lần đầu `env.DB` được đọc (không phải lúc tạo bộ đếm và không phải ở truy vấn đầu, vì cache hit không có truy vấn nào); test: cache được mồi qua `testEnv` sau khi tạo bộ đếm vẫn đếm đúng 1 lượt đọc cờ.
- **L-5:** ca "smaller cap" viết lại với request mới: 1 pending sẵn, `cap: 1` -> null, `cap: 2` -> tạo được.
- Không làm (theo chỉ đạo): S-1 (cùng 2702b), S-2 (cùng 2706a).
- Kết quả: typecheck 0 lỗi; bộ 2702a 6 file / 119 test xanh; toàn bộ xem commit message/phản hồi.
