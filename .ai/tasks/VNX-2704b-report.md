# VNX-2704b report: Ops "Public" column, `public=pending` filter, Overview card, 3 client e-mails

Branch `feat/epic27-request-board`, based on 9f16ffa. Implementer: Claude Opus 5.5 (subagent). Only 2704b was done.

## What was built

- **List (Requests):** new "Public" column (`—`, Review, Published, Rejected, Withdrawn, Unpublished) for every role that can see the list; read through the existing `listPublicationsForOps` (one extra query by id list). `?public=pending` (allowlist: only `pending`; any other value is dropped) lists the review queue and **replaces** the default `status` (L6): open and confirmed requests (`submitted|matching`) with a `pending_review` listing, oldest first, with the search kept. No new tab; a one-line note with a link back to the Submitted tab shows while the filter is on. `requestFilter` (now exported) returns `{public:"pending", q}` and drops `status` with it, so links, forms and redirects carry the filter.
- **One queue definition:** `db/request-board.ts` `REVIEW_QUEUE` (`pending_review` and request `submitted|matching`) feeds `publicationReviewQueue` (count + oldest), `countPublicationReviewQueue`, and `listReviewQueueRequestIds` (list filter). `db/requests.ts` gained `listAdminRequestsByIds` (ordered by the id list), so the filter does not duplicate the ADMIN_SELECT SQL.
- **Overview card "Public requests to review"** (`publicRequests`, after "Requests to match"): count and oldest waiting (later of opt-in and the request's submission); own `state:"error"` when its query fails; Content sees count and label only; link to `/ops/marketplace/requests?public=pending` only when the role has `marketplace.view` and the route is registered (new optional `query` in `QUEUE_TARGETS`).
- **S-2 (from 2704a):** the "Public listing" forms get `qs(filter)` in `action` (`query` prop of `PublicListingBlock`, no fragment); the redirect after publish/edit/reject/unpublish and the 400/409 re-render keep the filter (`ops-request-board.tsx` imports `requestFilter`).
- **E-mails:** `email/templates/request-board.ts` (3 templates x 4 locales) and `notify/request-board.ts` (`notifyPublicationPublished|Rejected|Unpublished`, never throw, one JSON log line `request_board.notify_failed` with kind and request id, no address). Sent **after** the batch commits and the CAS is confirmed; not for `edit`, a 400/409, the client's own withdrawal, or an interest. Each notify re-reads the listing and sends only if it is still in the state the mail is about (client withdrew in between: nothing), and nothing for a `removed` request. Locale = client's locale. A failure leaves the moderation as is and the redirect carries `done=mail_failed`.
- **"Edited":** `wordingEdited(original, published)` in `domain/request-board.ts` (trim title; description compared after `cleanText`, the parser's own normalisation), computed in the route from the parsed input against the original and passed to `notifyPublicationPublished`.
- **L-2 guard** was already in SQL (`rejectStatement`); untouched. **write_id pattern** untouched: no new write was added (the 2704a route still makes one ULID for the statement and its guard).

## Red-first evidence (one line per behaviour, before the code)

- templates/notify: `Error: Cannot find module '../../src/email/templates/request-board.ts'` / `.../notify/request-board.ts`
- column: `AssertionError: expected '<div class="ops-ph"><h1>Requests</h1>…' to match /<th scope="col">Public<\/th>/`
- filter + L6: `AssertionError: expected false to be true` (matching request absent from `?public=pending`)
- filter kept in links: `AssertionError: expected '<tr><td><a class="ops-strong" href="/…' to contain 'public=pending'`
- R1-S1 by id on list: `AssertionError: expected '<tr><td><a class="ops-strong" href="/…' to contain 'Review'`
- S-2 form actions: `AssertionError: /ops/marketplace/requests/<id>/publication/publish: expected null to be 'pending'`
- S-2 redirect with mail_failed: `AssertionError: expected { done: '1' } to deeply equal { public: 'pending', …(1) }`
- e-mails from the route: `AssertionError: expected [] to have a length of 1 but got +0`
- `wordingEdited`: `TypeError: wordingEdited is not a function`
- Overview card: `AssertionError: publicRequests: expected -1 to be greater than -1` (no card), plus the link-list test `expected [ '/ops/marketplace/builders', …(2) ] to deeply equal [ …(3) ]`

## Tests added or changed

- `test/email/request-board-templates.test.ts` (4 locales, terminology per locale, "edited" only when edited, no promise of a way back, HTML escape of `<script>` in reason and title).
- `test/notify/request-board.test.ts` (locale and links, "edited" flag, reasons, skips: wrong state / no reason / removed / unknown id, mailer failure: logs once without address and returns `failed`).
- `test/ops/marketplace-request-board.test.ts` (+10): column values; `public=pending` set membership by id incl. `matching` (L6) and exclusion of published/closed/`pending_verification`/no listing; search kept, `public=hacked` dropped, no extra tab; **R1-S1 by id with the real list and filter** (absent while `pending_verification`, present after confirmation); S-2 actions + 400 re-render + redirect params; route e-mails (publish edited/not edited, reject, unpublish, none for edit/400/409); mail failure keeps the moderation, one log line, `mail_failed` notice with the filter kept.
- `test/ops/overview.test.ts` (+3 and updates): count by difference, unconfirmed and closed not counted, enters after confirmation; error state is not 0; Content sees count only, Viewer/Operator/Owner see the link; the age and link-list tests updated.
- `test/ops/layout.test.ts`: the `/ops` page now also links `?public=pending` (one expectation).

## Verification (all run from the worktree)

- `npm run typecheck -w apps/web`: clean.
- Task tests (`test/ops/marketplace-request-board.test.ts test/ops/overview.test.ts test/email/request-board-templates.test.ts test/notify/request-board.test.ts test/i18n/parity.test.ts`): pass.
- `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: 198 files, 2513 passed, 2 skipped (the two 2707b `it.skipIf` tests that were already skipped).
- `npm run e2e`: 65 passed. `npm run e2e:typecheck`: clean. `npm run test:scripts`: 52 pass. No wrangler/workerd tree left running. No e2e spec added (the plan lists none for 2704b); the 2704a Ops e2e still passes with the new redirect.

## Deviations and notes

1. **`request_id` in the e-mail:** the plan says the mails must not contain `request_id`, but the required link to `/me/requests/:id` is the client's own request id by design. The public link uses only `public_id` (tested); the id appears only in the client's own `/me` link.
2. **`admin.mailFailed` text** ("...the email to the builder couldn't be sent") is reused for the `mail_failed` notice, as the existing admin request reject (which e-mails the client) already does. It names the wrong recipient here; a neutral Ops key would be a separate change (not done: out of scope, recorded for CURRENT-STATUS "Ghi nhan").
3. Added `listAdminRequestsByIds` to `db/requests.ts` (plan said avoid touching it "if avoidable"; this is a new function, no existing SQL changed).
4. Extra Ops keys (EN only, `ops.*`): `ops.queue.publicRequests`, `ops.requests.col.public`, `ops.requests.public.{pending_review,published,rejected,withdrawn,unpublished}`, `ops.requests.publicFilter`, `ops.requests.publicFilterClear`. Ops is English only (ADR-010), so no Owner copy approval needed.
5. The "oldest waiting" age on the card is the later of the opt-in and the request's submission (the time it entered the queue), not the raw opt-in time.

## Copy needing Owner approval (client-facing e-mail; plan says Reviewer approves, Owner informed)

Keys (4 locales, all in `src/i18n/messages/*.ts`); zh uses 你 and 公开需求板 / 公開需求板.

| Key | EN | VI |
|---|---|---|
| `email.boardPublished.subject` | Your request is now on the public request board: {title} | Nhu cầu của bạn đã được hiện trên bảng nhu cầu công khai: {title} |
| `email.boardPublished.intro` | Our team approved “{title}” for the public request board. Anyone can now see it, without your name or email. | Đội ngũ của chúng tôi đã duyệt nhu cầu “{title}” để hiện trên bảng nhu cầu công khai. Ai cũng xem được, nhưng không hiện tên hay email của bạn. |
| `email.boardPublished.edited` (only if wording changed) | Before publishing, our team edited the wording, for example to remove details that could identify you. | Trước khi đăng, đội ngũ của chúng tôi đã chỉnh sửa câu chữ, ví dụ để bỏ những chi tiết có thể nhận ra bạn. |
| `email.boardPublished.view` | See the public page: | Xem trang công khai: |
| `email.boardPublished.manage` | You can look at it, or remove it from the board, at any time from your account: | Bạn có thể xem, hoặc gỡ nhu cầu khỏi bảng, bất cứ lúc nào trong tài khoản: |
| `email.boardRejected.subject` | Your request will not be shown on the public request board: {title} | Nhu cầu của bạn sẽ không hiện trên bảng nhu cầu công khai: {title} |
| `email.boardRejected.intro` | Our team decided not to show “{title}” on the public request board. | Đội ngũ của chúng tôi quyết định không hiện nhu cầu “{title}” trên bảng nhu cầu công khai. |
| `email.boardUnpublished.subject` | Your request was removed from the public request board: {title} | Nhu cầu của bạn đã được gỡ khỏi bảng nhu cầu công khai: {title} |
| `email.boardUnpublished.intro` | Our team removed “{title}” from the public request board. | Đội ngũ của chúng tôi đã gỡ nhu cầu “{title}” khỏi bảng nhu cầu công khai. |
| `email.board.reason` | Reason: | Lý do: |
| `email.board.finalNote` | Your request itself is not affected. It cannot be shown on the board again. | Bản thân nhu cầu của bạn không bị ảnh hưởng. Không thể hiện lại nhu cầu này trên bảng. |
| `email.board.cta` | See your request: | Xem nhu cầu của bạn: |

The Ops reason follows `email.board.reason`; the last line is a link to `/{locale}/me/requests/:id`; the published mail also links `/{locale}/requests/:publicId`. The wording matches the approved `/me` copy (`me.board.rejectedReason`, `me.board.unpublishedReason`, `me.board.finalNote`). zh-Hans/zh-Hant are AI translations; read them in the files.

## For the Reviewer

- Check the redirect with `mail_failed` when the batch committed but the mail failed (route test pins it), and that notify never double-sends: it is called once, after `returnedPublication(results[0])`.
- A client who withdraws between commit and notify gets no mail (state re-check); a published listing whose request is later `removed` gets none.
- The filter-driven list uses two queries (ids, then rows by id), capped at 200 like the other tabs.
- `wordingEdited` treats a title/description that differs only by trailing whitespace or CRLF as unchanged.

## Vòng sửa 1 (review `.ai/reviews/VNX-2704b-review.md`, eeae120)

- **M-1:** `opsBoardActions(status, requestStatus, boardOn)`; Publish needs the gate (flag and `REQUEST_BOARD_GO_LIVE`). The route passes `c.get("requestBoard")`, and the block gets `boardOn`: gate off shows no Publish button and the EN line `ops.board.gateOff`; a forged POST publish is 409 with no write, no audit, no mail. Reject, edit, unpublish are not gated. The Ops test file now runs with the gate on (flag in `beforeAll`, date in `env`); the M-1 tests turn it off per test. Red first: `expected '<a class="ops-back" …' not to contain 'action="/ops/marketplace/requests/<id>/publication/publish"'`; `expected [ 'publish', 'reject' ] to deeply equal [ 'reject' ]`.
- **L-1:** the 12 `email.board*` keys are the Owner-approved EN and VI copy, byte for byte (test `Owner-approved copy, byte for byte`, 12 keys x EN and VI). zh-Hans and zh-Hant re-translated by AI from that EN (你, 公开需求板 / 公開需求板): please read them (VNX-0801). Red first: `vi email.boardPublished.subject: expected 'Nhu cầu của bạn đã được hiện trên bản…' to be 'Nhu cầu của bạn đã hiện trên bảng nhu…'`.
- **L-2:** `Notice` takes an optional `mailFailed` key (default `admin.mailFailed`); the request list and detail pass `admin.requests.mailFailed`. Test checks "some emails couldn't be sent" and no "to the builder". Red first: `expected '<a class="ops-back" …' to contain 'some emails couldn&#39;t be sent'`.
- **L-3:** the filter orders by `max(p.opted_in_at, COALESCE(r.submitted_at, p.opted_in_at))`; footer uses `ops.list.shown`; new EN-only `ops.requests.publicEmpty` (empty queue rendered directly through `RequestsListPage`). Red first: `expected [ '01M4QD…', …(1) ] to deeply equal [ …(1) ]` (order), `expected … to match /\d+ shown/`.
- **Verification:** typecheck clean; full suite 198 files, 2518 passed, 2 skipped; `npm run e2e` 65 passed; `e2e:typecheck` clean; `test:scripts` 52 pass; no wrangler/workerd left.
