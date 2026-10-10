# VNX-2606a report: show_on_profile switch at /hub/profile

## Implemented
- `domain/identity.ts`: `BADGE_PROVIDERS`, `BadgeProvider`, `isBadgeProvider`; `IDENTITY_AUDIT.show/hide`.
- `db/identities.ts`: `setShowOnProfile` (read first, no write when unchanged, UPDATE + audit `{provider}` in one batch, filtered by user_id).
- `routes/hub.tsx`: async `profilePage` (badges filtered by `isBadgeProvider` and `availableProviders`, Owner E1; `?badge=` notice from `BADGE_NOTICES`); `POST /hub/identities/:provider/badge` (requireBuilder, no canEditProfile, no flag check; google/unknown 404; bad `show` 409; 303 to `?badge=<notice>#badges`).
- `views/hub/ProfilePage.tsx`: `#badges` section, `BADGE_NOTICES`. No CSS, no inline style/script.
- 12 i18n keys (Task 10 table, verbatim) in en, vi, zh-hans, zh-hant, after `profile.saved`, no comments.
- Tests: new `test/hub/badge-toggle.test.ts` (18), `test/db/identities.test.ts` (+2), `test/domain/identity.test.ts` (audit pin + badge providers), `test/architecture.test.ts` (allowlist + routes/hub.tsx).

## TDD
- RED: `npx vitest run test/domain/identity.test.ts test/db/identities.test.ts test/hub/badge-toggle.test.ts --maxWorkers=1 --no-file-parallelism` -> 3 files failed, 18 failed | 21 passed (missing exports, 404 route, no #badges).
- GREEN: `npx vitest run test/domain/identity.test.ts test/db/identities.test.ts test/hub test/i18n test/architecture.test.ts test/me test/http --maxWorkers=1 --no-file-parallelism` -> 31 files, 259 tests; after the two test fixes below, badge-toggle 18/18.
- `npm run typecheck -w apps/web`: clean. Full suite: not run (controller runs it).

## Plan fixes (test-only, within intent)
1. Test "a provider whose flag is off...": `expect(off).not.toContain("GitHub")` is wrong because the section intro says "linked GitHub or LinkedIn account". Replaced by `not.toMatch(/(Show|Hide) GitHub/)` and `not.toContain("@octo-flag")` (the `/hub/identities/github/` assertion kept).
2. "a body that is not exactly show=1...": array of mixed objects failed typecheck against `Record<string,string>`; added `as Record<string, string>[]`.

## Decisions / notes
- No node_modules problems. Line endings preserved per file.
- Ghi nhan: none.
