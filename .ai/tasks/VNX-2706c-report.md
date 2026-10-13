# VNX-2706c report

Fix for M-1 and S-1 of the VNX-2709 review.

- `apps/web/src/routes/hub-invitations.tsx`: `interests` is passed to the view only when the board gate is on or the builder has at least one interest row. S-2 of 2706a is kept (gate off with rows: plain-text titles, statuses shown). No copy changes.
- `apps/web/test/hub/interests.test.ts`: two new tests. Gate off with no rows (flag off, and date empty; EN and VI): no `id="interests"`, no title, no "public request board" or "bảng nhu cầu công khai". Gate on with no rows: approved empty state. The first test was red before the fix (confirmed).
- `apps/web/test/public/request-board-gate.test.ts` (S-1): Hub fetches now go through `pub()` (via `hubPage()`), so the step-12 sweep covers them. The Hub invitations list legitimately shows the builder's own M6 invitation row with the request's typed title, so the sweep exempts only that one string (`main.title`) on those pages; every other private string still fails.

Verification: both files 18/18 pass; typecheck 0 errors; full suite 211 files, 2739 tests pass. `npm run e2e` not run (D: has about 90 MB free); the change is view-level and covered by Vitest.
