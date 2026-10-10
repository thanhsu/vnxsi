# VNX-2606b report: verified badge on /b/:handle

## Implemented
- `domain/identity.ts`: `GITHUB_LOGIN_RE` (moved from `auth/oauth/github.ts`, which now imports it; behaviour unchanged), `githubProfileUrl`, `PublicBadge`.
- `db/identities.ts`: `listPublicBadges(db, userId, providers)`: approved builder + active user + `show_on_profile = 1` + provider in list; LinkedIn label never selected; invalid GitHub login drops the badge; empty list returns `[]` without touching the DB.
- `routes/builder-profile.tsx`: `availableProviders(c)` filtered by `isBadgeProvider` (Owner E1), passed to `listPublicBadges`.
- `views/BuilderProfilePage.tsx`: `ul.verified-list` after the handle line; GitHub `@login` direct link (`rel="nofollow noopener noreferrer" target="_blank"`), LinkedIn label only; no inline style/script. CSS `.verified-list`/`.verified` in `app.css` (`--success` exists).
- 2 i18n keys (`bprofile.verifiedVia`, `bprofile.verified.heading`) verbatim in 4 locales after `bprofile.website`.
- Tests: new `test/public/builder-badges.test.ts` (incl. catalogue order via `searchProducts` and directory order), `test/hub/client-identity-privacy.test.ts`; `test/db/identities.test.ts` (+githubProfileUrl); `test/architecture.test.ts` (+routes/builder-profile.tsx in allowlist, new ADR-004/client block extended to `routes/hub-invitations.tsx` and `views/ProposalView.tsx`).

## TDD
- RED: `npx vitest run test/db/identities.test.ts test/public/builder-badges.test.ts test/hub/client-identity-privacy.test.ts test/architecture.test.ts --maxWorkers=1 --no-file-parallelism` -> 29 failed (githubProfileUrl missing, badge block absent, architecture call-shape test).
- GREEN: `npx vitest run test/db/identities.test.ts test/public test/hub test/catalog test/domain/identity.test.ts test/auth/oauth-github.test.ts test/i18n test/architecture.test.ts --maxWorkers=1 --no-file-parallelism` -> 28 files, 309 tests passed. `npm run typecheck -w apps/web` clean. Full suite: controller.
- Teeth check: temporarily appended `import { listPublicBadges } from "../db/identities.ts"` to `src/db/directory.ts`: 3 architecture tests went red; file restored (git shows it unchanged). Note: the plan's literal "import '../db/identities.ts'" (side-effect import, no `from`) is not matched by the regexes, so I used a named import.

## Decisions / notes
- No plan code needed changes. `grep ORDER BY src/db`: no ranking file beyond `RANKING_FILES` exists on this branch (home/Trending/TopBuilders arrive with the `main` rebase; see plan obligation: extend order test with `topBuilders` and keep the 7 `main` RANKING_FILES entries).
- Ghi nhan: the architecture "teeth" instruction in the plan names a side-effect import that the regexes do not catch; a side-effect-only import of db/identities.ts in ranking code would not be flagged (harmless: it exports no side effects). Not changed.
