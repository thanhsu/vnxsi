# VNX-2703a report: `/request` form, `country` and per-request opt-in

Implementer: Claude (Sonnet), branch `feat/epic27-request-board`, code commit `5aba9ca` (on top of f21eba8).

## What was done
- `domain/request.ts`: `RequestFormValues.country` (string, "" = none) and `.publish` (boolean, only the value `"1"`); `RequestField` + `"country"`; `RequestInput.country: string | null`. `parseRequestForm`: exact `COUNTRY_CODES` match or empty (`XX`, `vn`, `USA`, ` VN` give `choice`); old data unchanged.
- `routes/request-form.tsx`: `publish` counts only when `c.get("requestBoard")` (gate on); `consent_version = REQUEST_BOARD_GO_LIVE`. New `createRequestWithOptIn`: ONE `db.batch` of `createRequestStatements` + `optInStatement` (clientUserId required) + guarded `request.submit`/`request.create` audit (`AuditRequestGuard`) + guarded `request_publication.opt_in` audit (`AuditPublicationGuard`, data `{ consentVersion }` only). Signed in: batch replaces `createRequest` + `writeAudit`; signed out: batch before the e-mail, mail failure deletes the request (cascade removes the publication). L2: without the box (or gate off) the existing path is byte-for-byte the same statements (`createRequest`, `writeAudit` after). The signed-out `request.create` audit is written after the mail only on the no-opt-in path (with opt-in it is in the batch, before the mail, per the plan).
- 0-row obligation (2702a review): `returnedPublication(results[1])` null on the create path logs `{"event":"request.opt_in_not_inserted"}` and throws, giving a 500; never silent.
- `views/RequestFormPage.tsx`: `<select id="rq-country" name="country">` (empty first option "Not specified", `countryOptions(locale)`, not prefilled from IP), always shown; opt-in checkbox `#rq-publish` (`name="publish" value="1"`, unchecked by default, `checked` kept on re-render, `aria-describedby` the hint) only when `board`. Country error: summary item to `#rq-country`, `<p id="rq-country-error" class="error-msg">`, `aria-invalid`/`aria-describedby`; no `role="alert"`, action has no fragment.
- i18n x4: `request.form.country|countryHint|countryAny`, `request.error.country`, `request.board.optIn.label|hint`. EN and VI verbatim from addendum 12.4 / 12.6 (asserted by test). **zh-Hans and zh-Hant are AI translations (opt-in label/hint, country strings): need a native reader.** The countryHint, countryAny and error strings (all 4 locales) are mine, not in the addendum.
- E2E: `serve.mjs` `REQUEST_BOARD_GO_LIVE: "2026-01-01"`; `build-seed.mjs` one `feature_flags` row `request_board` enabled; `e2e/tests/request-board-forms.spec.ts` (3 tests: form contents; 400 with box + `VN` kept, EN and VI, shared error pattern, no `#`); `e2e/README.md` (var table, scope table, POST budget: 0 added).

## Verification (run in the worktree)
- `npm run typecheck -w apps/web`: 0 errors.
- Targeted (`test/domain/request.test.ts test/public/request-form.test.ts test/request-gate.test.ts test/i18n/parity.test.ts test/jobs/daily-requests.test.ts`): all pass (request-form.test.ts 27 tests, 15 new; domain 2 new).
- Full suite `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: 193 files, 2408 passed, 2 skipped, 0 failed.
- `npm run e2e`: 62 passed (1.5 m), no retries needed. `npm run e2e:typecheck`: clean. `npm run test:scripts`: 52/52.

## Deviations and notes for the Reviewer
1. Root `npm test -- --testTimeout=60000` does not forward the flag to the workspace; run through `-w apps/web`. Two root-level runs under load showed 3 to 13 different 5000 ms timeouts (different tests each run, all pass alone and in the `-w apps/web` full run). Not caused by this task, flagged as load flake.
2. e2e `fixtures.mjs` not touched (plan: data rows come at 2704a/2705a); only the flag row was needed.
3. Not covered by a test: "pending_verification request not in the Ops moderation queue" is asserted structurally (request not `submitted`, publication stays `pending_review`); the queue query itself arrives in 2704b.
4. Test "no retroactive": `/requests/<id>` is 404 today because the route does not exist yet (2705a); it becomes a real check then.
5. The country field is shown regardless of the gate (plan: country per the plan; saved even when `publish` is ignored, asserted).
6. L3: the orphan `request.create` + `request_publication.opt_in` audit rows after a signed-out mail failure are asserted to hold only ids, status and `consentVersion` (no e-mail, name, title, wording).
7. Plan/code conflict: none found. Nothing in plan, reviews or CURRENT-STATUS edited. Not pushed.

## Vòng sửa 1 (review `5a5cb49`, quyết định Owner 2026-10-11)
- **M-1 (a):** `country` chỉ render và chỉ được nhận khi cổng `requestBoard` bật. Cổng tắt: không có `<select>`, `country` gửi lên bị bỏ (kể cả giá trị sai `XX`, không lỗi, lưu NULL), `publish` bị bỏ. Cổng bật: như trước. Ba ca cổng tắt (cờ tắt + ngày tới; cờ bật + ngày rỗng; cờ bật + ngày tương lai, L-3) kiểm HTML không có `country`/`publish` và hai POST (`VN`, `XX`) → 303, `country` NULL, không publication, không audit opt-in.
- **H-1 + M-2:** nhãn và gợi ý country theo câu Owner duyệt (EN/VI nguyên văn, test so chuỗi chính xác); không còn biến thể cổng tắt. zh-Hans/zh-Hant dịch AI (nhãn, gợi ý) và dùng 你 thay 您 trong mọi chuỗi zh mới (cả mô tả opt-in, L-1; test khẳng định HTML zh không có 您). **Vẫn cần người bản xứ đọc lại.**
- **S-2:** `<select>` có `aria-describedby="rq-country-hint"` (khi lỗi: `"rq-country-hint rq-country-error"`).
- **S-1:** `results[statements.length]`.
- **L-2:** bỏ `GET /requests/<request.id>`; ca "no retroactive" khẳng định không có dòng, `findPublicationByRequestId` null, `requestVisibility` = `hidden`, và không có trong hàng chờ review theo id (truy vấn theo `request_id`); ca chưa đăng nhập khẳng định `hidden` và ngoài hàng chờ trước khi xác nhận, vào hàng chờ sau khi bấm link.
- **L-4:** đếm audit theo `actor_user_id` của user test (và khẳng định bằng 0 trước/sau).
- **E2E:** spec cập nhật nhãn/gợi ý mới; locator nhãn opt-in dùng `exact: true` (gợi ý country nay chứa cụm "request board"; lần chạy đầu đỏ vì strict mode, đã sửa).
- **Kết quả:** typecheck 0 lỗi; bộ 2703a 83 xanh; toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: 193 file, 2410 xanh, 2 skipped; `npm run e2e`: 62 xanh (1.6 phút, lần chạy cuối, không retry; lần đầu của vòng này đỏ 1 test do locator nói trên); `e2e:typecheck` sạch; `test:scripts` 52/52.
