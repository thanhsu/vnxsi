# VNX-2706b Report: Ops "Interested builders", Dismiss, invite flips the interest, "Interests waiting" card

Branch `feat/epic27-request-board`, worktree `D:\DOCS\SUPHAM\GIT\vnxsi-epic27`. Base 1fe5219. Code commit f6ec763. Implementer: Claude (Sonnet). Only 2706b.

## Result

- Typecheck clean. Full suite: 206 files, 2639 passed, 2 skipped. `npm run e2e`: 85 passed. `e2e:typecheck` clean. `test:scripts`: 53 pass.
- Red first: the new tests were written before any source change (first run: 26 failed across `interested-builders`, `overview`, `admin/requests`, `db/request-board`; missing `opsInterestActions`, `interestQueue`, `findPendingInterestIds`, Dismiss route 404, no block, no card). Unchanged files stay green: `admin/requests`, `ops/marketplace-requests`, `ops/marketplace-request-board`, `me/select`, `i18n/parity`.
- e2e: `e2e/.state`, `playwright-report`, `test-results` deleted after the run; no wrangler/workerd left. D: ~619 MB free.

## What changed

- `domain/request-board.ts`: `opsInterestActions({ status, builderPublic, invitable })` is the one rule (Invite needs a pending interest and an invitable request; Dismiss needs pending only; non-public builder has none). Route and view share it.
- `db/request-board.ts`: `interestQueue` (count + oldest, L9 condition) with `countInterestQueue` as wrapper; `findPendingInterestIds`; `listInterestsForRequest` also returns `productSlug` (only while the product is published).
- `routes/admin-requests.tsx` `inviteToRequest` (shared by `/admin` and `/ops`): reads pending interest ids first, then batch = invites + request move (`batch.read` positions unchanged), `markInterestsInvitedStatements` (one `writeId` per batch, flips only if this batch's invitation was inserted), one `request_interest.invite` audit per interest read as pending, guarded by `interestAuditGuard({ interestId, writeId })` (the guard keys on the interest identity + batch write_id, not status/updated_at), then the existing `request.invite` audit. Audit data `{ requestId, inviteId }` only. `requestMatching` now scores all candidates once (same §8.10 function, formula unchanged) and returns `scores`; the suggestion list is still its 10 best.
- `routes/ops-request-board.tsx`: `POST /ops/marketplace/requests/:id/interests/:interestId/dismiss` (`requireOps("marketplace.act")`, not gated by the board gate): CAS `pending -> dismissed` + audit `request_interest.dismiss` (`{ requestId }`) in one batch, fresh `writeId`; 409 re-renders the current state via `OpsLayout invalid` + `FormErrorSummary` (no typed values); no e-mail; redirect keeps the list filter.
- `views/ops/InterestedBuilders.tsx` (new block, inside `RequestDetailPage`), `RequestsPages.tsx`, `routes/ops-marketplace.tsx`: block only for `marketplace.act`, only builders still public (`publicBuilderOnly`), note via `PlainText` (escaped), product link `/p/:slug`, score or an em dash, Invite posts to the existing `POST :id/invite` with `builder=<id>`, Dismiss to its own action; no `#` in actions.
- Overview: card `interests` ("Interests waiting"), after "Public requests to review"; own `error` state; Content count only; link (to the Requests list) only with `marketplace.view`.
- `i18n/messages/en.ts`: `ops.interests.*`, `ops.queue.interests` (EN only, factual).
- E2E: seed 3 pending interests of `OTHER` on R3-R5 (no POST, no interest budget); new `request-board-interests-ops.spec.ts` (Ops sees the block, Dismiss -> Dismissed); README row + budget row (Dismiss: 1 per attempt, no rate limit).

## Tests (new)

`test/ops/interested-builders.test.ts` (block content/escaping/hidden builders/Viewer/Content, score unchanged, dash, actions rule, Dismiss by Owner/Operator, sealed 404 incl. OAuth, second/stale/invited 409 with VNX-0807 summary, filter kept and gate off still works, audit no-op when write_id differs, Invite flip with 2 audit rows, no flip for no/dismissed/withdrawn interest, cap race loses -> no flip no audit, locked-builder race, 6th builder refused, OAuth 404/403, interest dismissed mid-batch not flipped); `admin/requests.test.ts` (the `/admin` path), `ops/overview.test.ts` (card: difference, error, Content, link, empty; QUEUES and the links test updated), `db/request-board.test.ts` (two new helpers).

## Deviations and notes for the Reviewer

1. New test file `test/ops/interested-builders.test.ts` instead of appending to `marketplace-request-board.test.ts` (already 939 lines).
2. `markInterestsInvitedStatements` itself is unchanged: its existing `EXISTS` on this batch's invite ids is the flip guard; the "guard" for the audit lives in the route (`interestAuditGuard` with the batch `writeId`). Say if you wanted a different shape.
3. The card links to the Requests list (no `?interests=` filter exists; plan makes the filter optional). Suggestion: a filter backed by `interestQueue`'s rule if Ops needs to find the requests.
4. The Ops History on the request page does not include `request_interest.*` rows (only `request` and `request_publication`).
5. `overview.test.ts` first test now seeds a second submitted request, so its "Requests to match" expectation became "2".
6. Ops console not axe-scanned (existing README policy), so the new spec has no `scanA11y`.
7. Invite in e2e not covered (moves a request to `matching`, would disturb other specs); Vitest covers it for both routes.
