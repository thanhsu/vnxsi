# VNX-2706a Report: builder "I'm interested" (POST, withdraw, limits, Hub section)

Branch `feat/epic27-request-board`, worktree `D:\DOCS\SUPHAM\GIT\vnxsi-epic27`. Base 67f936b. Implementer: Claude (Sonnet). Only 2706a was done.

## Result

- Typecheck clean. 2706a files: `test/public/request-board-interest.test.ts`, `test/hub/interests.test.ts`, `test/db/request-board.test.ts`, `test/hub/invitations.test.ts`, `test/i18n/parity.test.ts` green (98 tests). Whole suite: 205 files / 2606 passed + 2 skipped.
- `npm run e2e`: 84 passed (3 of 4 full runs; one run had a single failure in `editor.spec.ts` "the product list shows the seeded drafts and products", the first test of a cold server, green on the next two runs: looks like a cold-start flake, not related to this task). `npm run e2e:typecheck` clean. `npm run test:scripts` 53 pass. No `workerd` left running.
- Red-first: the three new test files (plus the db test edits) were written before any source change; first run was 46 failed / 30 passed (route 404s, missing `publicId` input, missing keys).

## What changed

- `db/request-board.ts`: `createInterestStatement` now takes `publicId` and resolves the request in the INSERT's FROM (`request_publications p JOIN requests r`), so no request id reaches the route (S-2); every gate stays in the one INSERT (H1 cap counted on open + published requests only). `findViewerRelation` gained `products` (builder's own published products, in the same single query, so the page cost does not grow). `listBuilderInterests` gained `inviteId` and leaves `withdrawn` rows out (L4). New `diagnoseInterestRefusal` (message only, runs after a refusal).
- `domain/request-board.ts`: `hubInterestState(status, requestStatus)` (pending / invited / not_invited / null for withdrawn).
- `routes/request-board.tsx`: `POST /requests/:publicId/interest` and `.../interest/withdraw`; explicit `toBoardItem` mapping for the list and the detail page (S-1: `requestStatus` never reaches a view); `ctaFromRelation`.
- `views/requests/InterestBlock.tsx` (form, pending/invited/not invited/withdrawn states, withdraw form, invite link from `inviteId`, one `FormErrorSummary`), `RequestDetail.tsx` (`invalid`, `problems`), `views/hub/InvitationsPage.tsx` + `routes/hub-invitations.tsx` (section `#interests`, route maps rows explicitly and uses `closedAt` + `requestVisibility` for the title).
- i18n: 32 new keys x 4 locales (`board.interest.*`, `hub.interests.*`), see the copy table.
- E2E: new `e2e/tests/request-board-interest.spec.ts`; `a11y.spec.ts` (builder on `/requests/<Q1>` and `/hub/invitations`, plus `/requests/<Q1>` signed in at 360 px); `e2e/README.md` (POST budget rows, spec table).
- Existing tests touched: `test/db/request-board.test.ts` (`express` helper and one call site use `publicId`; the three `findViewerRelation` `toEqual` gained `products: []`; two new tests), `test/public/request-board-detail.test.ts` (the "approved builder gets no button yet" test now expects the form), `test/views/request-board-copy.test.tsx` (the "exactly the 31 approved board.* keys" check excludes the `board.interest.` namespace, which is awaiting approval; remove the exclusion once the Owner approves).

## Behaviour as built

Order in `POST interest`: gate (404) -> shape of `publicId` (404) -> listing (hidden 404; closed 409) -> signed out 303 `/login?next=<localized page>` -> relation: not approved builder / own request 409, already invited 409, already interested 409 (these do not touch the rate limit) -> `parseInterestForm` (400, values kept) -> `hitRateLimit("interest:builder:<userId>", 10, 86400)` (429) -> one `db.batch([createInterestStatement, auditStatement(request_interest.create, interestAuditGuard({interestId, writeId}))])` with a fresh ULID `id` and `writeId` per write. 0 rows -> 409 with the reason read afterwards (already / invited / product / cap / generic). Success 303 to the page (no fragment). Audit `data` is `{ publicId }` only (no note).

`POST withdraw`: gate, signed out 303, relation -> own interest or 404, `interestTransition(...,"withdraw","builder")` else 409, CAS + guarded audit in one batch; allowed whatever the request state; success 303 to the page, or to `/hub/invitations` when the page is no longer visible (it would 404).

No interest side effects: request status, `request_invites` and the outbox are asserted unchanged. OAuth sessions work (no `isStaffSession` check; one Vitest case).

## Deviations and decisions for the Reviewer

1. `createInterestStatement` input changed from `requestId` to `publicId` (S-2, as the obligation says), so the 2702a db tests were adjusted (helper + one call).
2. `findViewerRelation` now returns `products`. The status note said "no query beyond findViewerRelation": the select of the builder's products rides in that same query as a JSON subselect, so the count stays the same (tests: <= 8 for the 200, 400 and 409 pages).
3. Withdrawn interests are filtered in `listBuilderInterests` SQL (L4). A builder cannot send interest again for a request they withdrew from (the pair row remains; matches "duplicate pair -> 409"); the page says so (`board.interest.withdrawn`).
4. Both POST routes are behind the board gate (404 when off). Plan wording is explicit only for the interest POST; withdraw follows the same rule, which means that after an emergency switch-off a builder cannot withdraw through the page. If the Reviewer wants withdraw to ignore the gate, it is a one-line change.
5. The Hub section is not gated: with the gate off a pending row's title would link to a 404 page. Only reachable after an emergency switch-off.
6. The 429 counter is spent before the INSERT, so an interest refused in SQL (cap, race) still counts for the day. The 409 pre-checks (invited, already, not eligible) do not.
7. Extra messages beyond the plan's key list: `already`, `alreadyInvited`, `capReached`, `conflict`, `noteHint`, `productHint`, `intro`, `waiting`, `invited`, `notInvited`, `withdrawn`, `error.noteInvalid`. `board.interest.closed` is used for the 409 on a closed listing.
8. E2E: the 501-character case removes `maxlength` from the textarea first (Playwright `fill` honours it and the first run got a 303, which spent an interest; fixed).

## Copy needing Owner approval

`{n}` is a number (10 for the day limit, 30 for the waiting cap). ZH Simplified uses "公开需求板" in existing copy; Traditional "公開需求板"; the second person is 你.

| Key | EN | VI |
|---|---|---|
| board.interest.cta | Tell us you're interested | Báo với chúng tôi rằng bạn quan tâm |
| board.interest.intro | Only the VNX.SI team sees this. The client does not see it unless we invite you, and it does not create any agreement. Our team decides whom to invite, up to five builders. | Chỉ đội ngũ VNX.SI thấy thông tin này. Người đăng không thấy, trừ khi chúng tôi mời bạn, và việc này không tạo ra bất kỳ thỏa thuận nào. Đội ngũ của chúng tôi quyết định mời ai, tối đa năm builder. |
| board.interest.label.note | Note (optional) | Ghi chú (không bắt buộc) |
| board.interest.noteHint | Up to 500 characters. What you write must be true. | Tối đa 500 ký tự. Những gì bạn viết phải đúng sự thật. |
| board.interest.label.product | Product (optional) | Sản phẩm (không bắt buộc) |
| board.interest.productHint | One of your published products that fits this request. | Một sản phẩm đã đăng của bạn phù hợp với nhu cầu này. |
| board.interest.noProduct | No product | Không chọn sản phẩm |
| board.interest.submit | I'm interested | Tôi quan tâm |
| board.interest.sent | You told us you're interested | Bạn đã báo với chúng tôi rằng bạn quan tâm |
| board.interest.waiting | Interest sent — waiting for our team. Only the VNX.SI team sees it. | Đã gửi quan tâm — đang chờ đội ngũ của chúng tôi. Chỉ đội ngũ VNX.SI thấy thông tin này. |
| board.interest.withdraw | Withdraw my interest | Rút lại quan tâm |
| board.interest.invited | Invited. Our team invited you to this request. | Đã được mời. Đội ngũ của chúng tôi đã mời bạn tham gia nhu cầu này. |
| board.interest.invitedLink | Open your invitation | Mở lời mời của bạn |
| board.interest.notInvited | Not invited. Our team did not invite you to this request. | Không được mời. Đội ngũ của chúng tôi không mời bạn cho nhu cầu này. |
| board.interest.withdrawn | You withdrew your interest in this request. It cannot be sent again for the same request. | Bạn đã rút lại quan tâm tới nhu cầu này. Không thể gửi lại cho cùng một nhu cầu. |
| board.interest.notEligible | Only approved builders can tell us they are interested, and not in their own request. | Chỉ builder đã được duyệt mới có thể báo rằng mình quan tâm, và không thể làm vậy với nhu cầu của chính mình. |
| board.interest.rateLimited | You can tell us you're interested in up to {n} requests a day. Try again tomorrow. | Bạn có thể báo quan tâm tối đa {n} nhu cầu mỗi ngày. Hãy thử lại vào ngày mai. |
| board.interest.capReached | You already have {n} interests waiting for our team. Withdraw one to send another. | Bạn đang có {n} quan tâm chờ đội ngũ của chúng tôi. Hãy rút lại một cái để gửi thêm. |
| board.interest.closed | This request has just closed, so we could not record your interest. | Nhu cầu này vừa đóng, nên chúng tôi không ghi nhận được quan tâm của bạn. |
| board.interest.conflict | This request changed while you were sending. Reload the page and try again. | Nhu cầu này đã thay đổi trong lúc bạn gửi. Hãy tải lại trang và thử lại. |
| board.interest.already | You already told us you're interested in this request. | Bạn đã báo với chúng tôi rằng bạn quan tâm tới nhu cầu này. |
| board.interest.alreadyInvited | Our team already invited you to this request. Your invitation is in your Hub. | Đội ngũ của chúng tôi đã mời bạn tham gia nhu cầu này. Lời mời nằm trong Hub của bạn. |
| board.interest.error.noteTooLong | The note is too long. Use at most 500 characters. | Ghi chú quá dài. Dùng tối đa 500 ký tự. |
| board.interest.error.noteInvalid | The note contains characters we can't accept. | Ghi chú chứa ký tự chúng tôi không nhận. |
| board.interest.error.product | Choose one of your published products, or no product. | Hãy chọn một sản phẩm đã đăng của bạn, hoặc không chọn sản phẩm. |
| hub.interests.title | Requests you're interested in | Nhu cầu bạn quan tâm |
| hub.interests.empty | You haven't told us you're interested in any request yet. | Bạn chưa báo quan tâm tới nhu cầu nào. |
| hub.interests.pending | Interest sent — waiting for our team | Đã gửi quan tâm — đang chờ đội ngũ của chúng tôi |
| hub.interests.invited | Invited | Đã được mời |
| hub.interests.notInvited | Not invited | Không được mời |
| hub.interests.noLongerPublic | No longer public | Không còn công khai |
| hub.interests.clicked | Sent {date} | Đã gửi {date} |

ZH (Simplified / Traditional) strings are in `apps/web/src/i18n/messages/zh-hans.ts` and `zh-hant.ts` next to the EN/VI ones (same keys, 你; the Terms-style statements "only the VNX.SI team sees it", "the client does not see it unless we invite you", "no agreement" are carried in `intro`).

## For the Reviewer

- Check the SQL gates in `createInterestStatement` (publicId -> request in the FROM clause; the cap subquery counts only open + published).
- Race semantics: the audit row is guarded by this write's `writeId` (VNX-2702c); tests cover create and withdraw races at db level (2702c) and the HTTP paths here.
- Detail-page 4xx re-render keeps `Layout` SEO (canonical for open, `noindex` and no canonical for closed), no JSON-LD, <= 8 D1 queries (tests).
- Decisions 3-6 above.
- Files: `apps/web/src/routes/request-board.tsx`, `apps/web/src/db/request-board.ts`, `apps/web/src/views/requests/InterestBlock.tsx`, `apps/web/src/views/hub/InvitationsPage.tsx`, `apps/web/src/routes/hub-invitations.tsx`, `e2e/tests/request-board-interest.spec.ts`.

## Vòng sửa 1 (review `.ai/reviews/VNX-2706a-review.md`, e83f33e)

- **M-1 + L-1:** copy table of the review applied verbatim for EN and VI (all 32 keys, incl. the withdraw warning in `board.interest.waiting`). zh-Hans/zh-Hant re-translated from the final EN for the 12 changed keys (你; 已表示兴趣 / 已表示興趣 in `waiting` and `hub.interests.pending`). `request-board-copy.test.tsx`: exclusion removed; new `INTEREST_APPROVED` table pins all 32 keys byte for byte in EN and VI, and the key set under `board.interest.*` + `hub.interests.*` is exact. (This test was red against the old strings before the catalogues were changed.)
- **L-2:** `postWithdraw` `conflict()` renders `{kind:"closed"}` on a closed listing, else re-reads the relation. Test: withdraw of a `dismissed` interest on a closed listing gives 409, closed block, no withdraw button.
- **L-3:** `diagnoseInterestRefusal` now takes `publicId` and also returns `inviteId` and the pair's interest, so the post-refusal path is one read (no second `findViewerRelation`). Query-count test: 409 wrong product and 409 full cap are each <= 8 by the project counter.
- **S-1:** HTTP test: no `request_interest.create` audit row (counted by `actor_user_id`) after 409 in SQL, pre-check 409, closed 409 and duplicate; exactly one after the 303.
- **S-2:** the Hub route passes `link = requestBoard gate`; with the gate off titles are plain text, status still shown. Test both ways.
- New L-2, L-3, S-1, S-2 tests were written after their code in this round (not red-first); the copy pin was red-first.

Results: typecheck clean; 2706a files + detail + invitations + parity 129 green; full suite 205 files / 2610 passed + 2 skipped; `e2e:typecheck` clean; `test:scripts` 53 pass.
**`npm run e2e` was NOT re-run in this round:** drive D: hit 0 bytes free (SQLITE_FULL when the e2e server migrated). I deleted `e2e/.state`, `playwright-report`, `test-results`; a further 110 MB of ignored build output in `apps/web/.wrangler/tmp` needs removal by a person (the safety check refused my `rm`). The e2e assertions that touch changed copy are substrings that still match ("Interest sent — waiting for our team", "You told us you're interested", "You withdrew your interest in this request."). Please re-run `npm run e2e` once D: has space (last full run, before this round: 84 passed).
