# EPIC 26: merge origin/main (e78c1c5) into feat/epic26-linked-accounts

## Commit 1: merge (0701acb)
Conflicted files and resolution:
- `apps/web/src/auth/middleware.ts`: `requireAdmin` = `if (!isAdminUser(user, c.env) || !isStaffSession(user.method)) return errorResponse(c, "forbidden", 403);` (comment kept). `requireUser`, `requireBuilder` unchanged. The method check stays out of `isAdminUser`.
- `apps/web/src/env.ts`: union (OAUTH_DRIVER, 6 client id/secret fields, PRIVACY_NOTICE_GO_LIVE, ANALYTICS_SALT).
- `apps/web/vitest.config.ts`: union (OAUTH_DRIVER "fake", six credentials pinned "", PRIVACY_NOTICE_GO_LIVE "").
- `apps/web/wrangler.jsonc`: union of both comment blocks; no OAuth vars/secrets there, comments only.
- `apps/web/test/architecture.test.ts`: both sides kept (main's single render choke point block plus all EPIC 26 blocks); main's 7 RANKING_FILES entries present.
- Auto-merged without conflict: app.css (`--success` in all 3 theme blocks, lines 36/69/85; `.verified` present), 4 locale files, app.ts, CURRENT-STATUS.md, WAVE1-ROADMAP.md, 07-MASTER-BACKLOG.md (lines of our side that disappeared in the diff vs c2dfdbd are main's own removals/rewrites; EPIC 26 mentions retained, and the "O2 starts at 0017" line in CURRENT-STATUS already carries our 2026-10-07 note).
- Merge mistake fixed: `test/auth/staff.test.ts` (new on main) built `SessionUser` without `method` and failed typecheck; added `method: "magic_link"`.

Migration check: main has 0014, 0015, 0016 only (nothing at 0017 or above); EPIC 26 keeps 0017_user_identities.sql.
npm install: package.json/package-lock.json changed on main (adds @playwright/test); ran `npm install` (not ci) from the root.
Results: typecheck clean; `npm test -- --maxWorkers=2`: Test Files 186 passed (186), Tests 2253 passed (2253).

## Commit 2: obligations
- (a) Reworded: `auth/admin.ts` docstring, `domain/visitor.ts` comment, `test/auth/staff.test.ts` titles. All say the /admin guard ALSO requires a magic-link session. The word "method" does not occur in `auth/admin.ts`.
- (b) New test in `test/auth/staff.test.ts`: owner with `method: "oauth_github"` is staff; an Ops Viewer with oauth_google/oauth_github/oauth_linkedin sessions is staff.
- (c) New test in `test/public/builder-badges.test.ts`: three builders with 3/2/1 verified products; `topBuilders(await loadBuilderTallies(db, now)).verified` order identical before badges, after opting in the two lower ones, and after the top one too; length >= 3 precondition; the Top builders output contains no badge text. Architecture identity assertions (`RANKING_FILES` loops) run over the merged list; grep of main's 7 files for identity words found nothing (the architecture test passes).
- e2e: `@playwright/test` and Chromium were already present (D: free 10.4 GB); no seed change needed (sessions.method defaults to magic_link).

Results:
- typecheck (apps/web): clean; `npm run e2e:typecheck`: clean
- `npm test -- --maxWorkers=2`: Test Files 186 passed (186), Tests 2255 passed (2255)
- `npm run test:scripts`: tests 52, pass 52, fail 0
- `npm run e2e`: 49 passed (1.1m)

## Ghi nhan
- Line endings: git warned LF to CRLF on touched files (autocrlf); no content effect.

## Fix round R1 (review của merge)

- LOW-1: docstring of `isStaff` in `apps/web/src/auth/staff.ts` now says it is the admin e-mail and flag check (`isAdminUser`) and that the /admin guard also requires a magic-link session. Comment only.
- SUGGESTION-1: `test/public/builder-badges.test.ts` Top builders order test asserts each `optIn` returns "changed".
- SUGGESTION-3: `test/ops/guard.test.ts` new case: root Owner with an oauth_* session on `/ops/monetization/merchants` gets the same sealed 404 as an anonymous visitor.
- Tests: builder-badges, ops/guard, auth/staff plus typecheck (see commit message run).

## Merge 2 (7d68df8, VNX-0807)
- `git fetch` showed origin/main at `5eae764`, one docs-only commit past 7d68df8 (`5eae764` touches only `.ai/context/CURRENT-STATUS.md`). That is what was merged (commit d4fe582); its subject names 7d68df8 as briefed, but the content includes 5eae764.
- Conflicts: none (git auto-merged locale files, app.css, Layout/HubLayout (`invalid` and `signedIn` both present), architecture tests, docs).
- Migrations: no new migration on main; `git diff --stat origin/main...HEAD -- apps/web/migrations` shows only 0017_user_identities.sql (22 insertions).
- `npm run typecheck -w apps/web`: no errors; `npm run e2e:typecheck`: clean.
- `npm test -- --maxWorkers=2`: Test Files 187 passed (187), Tests 2262 passed (2262).
- `npm run test:scripts`: 52 pass, 0 fail.
- `npm run e2e`: 59 passed (1.6m).
- EPIC 26 views were not changed; error summary not adopted there (VNX-0807 T6).
