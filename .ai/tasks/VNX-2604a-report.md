# VNX-2604a report

Implemented Task 5: `isStaffSession` in `domain/identity.ts`; `requireOps` (check before `resolveOpsRole`) and `requireAdmin` now accept only `magic_link`; `signIn` fixture takes `method`. `resolveOpsRole`, `auth/admin.ts`, `requireUser`, `requireBuilder` untouched.

Files: src/domain/identity.ts, src/auth/ops.ts, src/auth/middleware.ts, test/fixtures.ts, test/ops/guard.test.ts, test/auth/staff-session.test.ts (new).

## TDD evidence
Code was written before the first run, so RED was reproduced afterwards by restoring HEAD versions of ops.ts and middleware.ts:
`npm test -w apps/web -- test/ops/guard.test.ts test/auth/staff-session.test.ts` -> 6 failed | 19 passed (2 OAuth guard tests, 2 /admin tests, 2 source-assertion tests). Guards re-applied -> 25 passed.
Source-scan helper: files are CRLF on disk; helper normalises CRLF and positive assertions pass. Negative plant (`user.method` in resolveOpsRole and a `// method` line in auth/admin.ts) made "where the method check lives" fail; plants reverted (git diff shows no change to admin.ts).

## Results
Focused (guard, staff-session, sessions, admin/flags): 4 files, 34 passed. `npm run typecheck -w apps/web`: exit 0. Full suite left to the controller.

## Deviations
None; plan code copied verbatim (test blocks extracted from the plan by script; edits preserved each file's CRLF/LF style).

## Ghi nhận
None.

## Fix round R1
M1: requireUser and auth/admin.ts negative scans in test/auth/staff-session.test.ts now use /method|isStaffSession/i (resolveOpsRole scan already /method/i). Ran staff-session + ops/guard tests (CRLF files) and typecheck: green. Test-only.
