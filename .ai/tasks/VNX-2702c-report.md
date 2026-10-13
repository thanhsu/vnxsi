# VNX-2702c report: audit guards match a per-write id

Branch `feat/epic27-request-board`, base `7111236`. Implementer: Claude (Opus 5.5 trailer). Not pushed, not merged, no remote migration.

## What changed
- `apps/web/migrations/0018_request_board.sql` (amended in place, unmerged): `write_id TEXT NOT NULL` on `request_publications` and `request_interests`. NOT NULL without default, like `merchants`/`offers`/`partner_programs` (0011): both tables are new and the migration inserts nothing, so every row comes from a statement that sets it; a missing write_id is a bug that should fail loudly, not a silent NULL that no guard can match.
- `db/request-board.ts`: every INSERT/UPDATE of these rows sets `write_id`: optIn, reOptIn, publish, editPublic, reject, unpublish, withdraw, createInterest, withdrawInterest, dismissInterest, markInterestsInvited. `writeId` is a required input (compile-time: a statement cannot be built without one). `createInterestStatement` now takes the interest `id` from the caller too (the guard needs it). `PublicationGuard`/`InterestGuard` are `{ requestId|interestId, writeId }`; new `interestAuditGuard`.
- `db/audit.ts`: `AuditPublicationGuard`/`AuditInterestGuard` match `request_id|id = ? AND write_id = ?` (same shape as `AuditFlagGuard`/`AuditPartnerGuard`). No `changes()`.
- Callers pass one fresh `ulid()` per write to both statement and guard: `routes/request-form.tsx` (2703a create), `routes/me-requests.tsx` (opt-in, re-opt-in, withdraw), `routes/ops-request-board.tsx` (publish, edit, reject, unpublish). `updated_at` tokens and CAS conditions unchanged. Route-less interest statements get `writeId` from their future callers (2706a/b); `markInterestsInvitedStatements` takes one `writeId` per batch (the guard there, when added, is per interest id + write_id).
- `e2e/seed/build-seed.mjs`: seeded publications carry a `write_id`.
- Architecture test (sole writer) unchanged and green. No money columns.

## Tests (red first)
New `describe("db/request-board: audit guards match a per-write id (VNX-2702c)")` in `test/db/request-board.test.ts`: winner batch then loser batch at the same `now`, same target status, loser with a different actor; asserts the loser's write returns 0 rows, exactly one audit row for the winner, none for the loser. Cases: opt-in, re-opt-in, withdraw, publish, edit (published to published), reject, unpublish, interest create, interest withdraw, interest dismiss, plus "a write leaves its own write_id". `request-board-migration.test.ts`: column lists + NOT NULL check. Existing tests updated only to pass `writeId`.

Red: the guards were first rewritten, so red was shown by temporarily making the guard behave like the old one (`updated_at = now`, write_id ignored), then restoring:
```
× opt-in  × re-opt-in  × withdraw  × publish  × edit  × reject  × unpublish
× interest create  × interest withdraw  × interest dismiss
AssertionError: no audit row for an action that did not happen: expected 1 to be +0 // Object.is equality
Tests  10 failed | 1 passed | 36 skipped (47)
```
Green with the real guard: `Tests 11 passed | 36 skipped`.

## Verification (HEAD of this task)
- `npm run typecheck -w apps/web`: 0 errors.
- request-board db/migration/me/ops/public tests: 12 files, 239 tests green (before adding the 11 new + 1 migration test; all included in the full run).
- Full suite: **196 files / 2491 passed + 2 skipped** (first run had 4 flaky failures in `admin/merchants`, `http/turnstile`, `views/plain-text` under load; those three files pass alone, full rerun fully green).
- `npm run e2e`: 65 passed (workers=1). `npm run e2e:typecheck`: clean. `npm run test:scripts`: 52 pass, 0 fail.
- A `workerd` process was still listed after the runs; I did not start a standalone wrangler, so it is likely another session's.

## Notes for the Reviewer
- Route-level test (a) of 2703b keeps `now + 1s`; the same-ms proof lives at the db level, where both writes are forced to the identical `now`.
- Obligation closed: VNX-2702c in CURRENT-STATUS. VNX-2706a/b interest routes must generate `id` and `writeId` per write and use `interestAuditGuard`.
