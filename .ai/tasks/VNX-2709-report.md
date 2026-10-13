# VNX-2709 report: EPIC 27 exit gate (Implementer)

Branch `feat/epic27-request-board`, base `2f2020c`. No legal text, approved copy or locale file was touched; no new user-facing copy.

## What was done

1. **Lifecycle test** `apps/web/test/public/request-board-gate.test.ts` (12 sequential steps, real routes, one file-wide DB, exact counts). Only the builder's proposal uses the existing M6 fixture (`proposeOn`).
   1. Signed-out client ticks the box on `/request` (country VN, Turnstile fake): `pending_verification` + `pending_review`, 404 public, one e-mail (the confirmation); magic link confirms; still hidden; one `opt_in` audit row.
   2. Ops: second client opts in (signed in); `/ops` card "Public requests to review" = 2; `?public=pending` rows; "Public listing" block with Publish form.
   3. Operator edits the wording and publishes: audit row, client e-mail equals `requestBoardPublishedEmail(edited: true)` (subject and text), link from the e-mail opens 200 signed out; second listing published unedited (no "edited" sentence); queue back to 0.
   4. List/detail/sitemap in 4 locales, canonical + hreflang, no `noindex` on detail, <= 8 queries; `/requests` is `noindex` with 2 open and indexable (canonical, in sitemap in 4 locales) at 5 open (fillers written to the DB); robots has no `/requests` line.
   5. `/privacy`, `/terms` (EN and VI) with real board text: absent at B-14d minus 1 ms, present at B-14d (fake `Date`), "Last updated: B", still present on the real clock.
   6. Approved builder interest with note and product: pending, audit `create`, no e-mail at all, client page shows nothing of it, Ops card = 2, `?interests=pending`, block shows note/product link, suggestions section byte-identical before/after (ADR-004) and `requestMatching` suggestions/scores equal `suggestBuilders`.
   7. Invite A: interest `invited` + `decidedBy`, audit `create, invite`, exactly the M6 invitation e-mail, Hub "Invited" + link, public CTA shows the invitation link. Dismiss B: audit `create, dismiss`, no e-mail, Hub and public page "Not invited", card back to 0, audit data has no note/name.
   8. Proposal (M6 fixture) + client select: `builder_selected` with `closed_at`; detail 200 "Closed", noindex, no canonical/`<link rel="alternate">`, no interest form, no outcome words; gone from list and sitemap; open count 5 -> 4: `/requests` goes `noindex`, leaves the sitemap; B's Hub still "Not invited".
   9. `closed_at + 30d - 1ms` 200; `+30d` 404; not in sitemap (fake `Date`).
   10. Withdraw path: 200 -> 404 at once for signed out, the client, a builder and Ops; list and sitemap cleared; audit `opt_in, publish, withdraw`; second withdraw 409 with no new audit row.
   11. Gate off (flag): `/requests`, detail (EN, VI), interest POST and withdraw all 404; sitemap has no `/requests`; `/` has no board link; `/request` has no box; Hub keeps status with the title and no link; publish refused 409 (no write, no e-mail, no audit, no Publish form); reject with reason still works (e-mail equals `requestBoardRejectedEmail`); unpublish with reason still works (e-mail equals `requestBoardUnpublishedEmail`); Dismiss still works (no e-mail, Hub "Not invited"); client withdraw works; flag on with empty date is still 404.
   12. Sweep: every public/builder-facing page fetched (> 30) contains no request id, client id, e-mail, name, original wording, admin note or interest note; no `request_publication.*` / `request_interest.*` audit row carries wording, reasons, notes or names.
   Mutation check: changing `<` to `<=` in `requestVisibility` fails step 9 only (reverted).
2. **Smoke** `scripts/smoke-checks.mjs` (+ `scripts/smoke.mjs` usage comment, `scripts/test/smoke-checks.test.mjs`):
   - Default (board off): `/`, `/vi/`, `/zh-hans/`, `/zh-hant/` and `/for-builders` (4 locales) have no `href` to `/requests`; `/requests` 404 + noindex in 4 locales; `/requests/zz-smoke-no-such-thing` 404 + noindex; sitemap has no `<loc>` under `/requests`.
   - `--board`: `/requests` 200 HTML, no `public`/`max-age`/`s-maxage` in Cache-Control, Referrer-Policy not `no-referrer`; unknown listing 404 + noindex; sitemap `<loc>` only `/requests` and `/requests/<26-char public id shape>`, each id exactly 4 times (one per locale), no `/me`, `/ops`, `/hub`, `/admin` paths, no `request_id` text. A public id has the same shape as a ULID, so smoke cannot distinguish a public id from a request id by shape; it proves the structure instead.
   - `isRateCovered` counts `/requests` and `/requests/*` in every locale, in both modes. Covered requests: default 11 (13 with `--slug`), `--board` 8 (10 with `--slug`); the runner still keeps <= 10 in any 10 s window (test over all four mode combinations). The old "<= 8" assertion became exact per-mode counts.
   - `parseArgs` returns `board`; unknown flags still rejected. Red-first: the new tests run against the previous `smoke-checks.mjs` fail (7 of 25).
3. **Folded suggestions**: 2705b S-1 (`seo.ts` uses `listings.length`; `countOpenPublicationsAll` import removed, one query fewer per sitemap); S-2 (robots test now turns the flag on for the "on" pass; the 8-query test measures before and at the threshold).
4. `e2e/README.md`: "request board" removed from "Chưa kiểm", pointer to the Vitest lifecycle test; no new POST, so the budget table is unchanged.

## Verification (all run in this worktree)

- `npm run typecheck -w apps/web`: clean.
- `npm test -w apps/web -- test/public/request-board-gate.test.ts`: 12 / 12.
- Full suite `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: 211 files, 2737 tests, all passed.
- `npm run test:scripts`: 58 / 58 (5 new smoke cases, 2 changed).
- `npm run e2e:typecheck`: clean. `npm run e2e` (workers 1): 85 passed (1.7 min). `e2e/.state`, `playwright-report`, `test-results` deleted; no workerd/wrangler left running. D: has about 136 MB free.
- Checklist greps: no `featured|boost|urgent|sponsored` or `dangerouslySetInnerHTML` in the new files; no `role="alert"`, `action="...#"`, `style=`, `<script` in the board views; `REQUEST_BOARD_GO_LIVE` still `""` in `wrangler.jsonc`; `architecture.test.ts` (RANKING_FILES) green. CI job `e2e` on the branch was not checked (no push).

## Deviations / notes

- The plan's lifecycle file path is kept (`test/public/request-board-gate.test.ts`); a different file `test/http/request-board-gate.test.ts` (the gate unit test) already exists with a similar name.
- The plan step 4 "builder sends a proposal" uses the M6 fixture `proposeOn` (as `me/select.test.ts` does), not the Hub propose route.
- Fillers for the 5-open threshold are written straight to the DB (`listed()`), as in the sitemap test.
- Edits through `sed -i` and a Python rewrite changed only line endings of `apps/web/src/domain/request-board.ts` in the working tree (no content diff, not staged).
- Step 5 uses B = `2026-01-01` (the helper go-live), with a faked `Date` at B-14d; the production B boundary is covered in `legal/request-board-versions.test.ts`.

## For the Reviewer

- Runbook `docs/runbooks/deploy.md` section 7 (smoke): default `npm run smoke` assumes the board is OFF (fails on a live board); after go-live and after every later deploy use `npm run smoke -- --board`. Covered-request budget is now 11 default / 8 `--board` (+2 with `--slug`); the runner paces to <= 10 per 10 s, so the section's "<= 8 covered" wording should change, and the Cloudflare `/requests*` rule must exist before the flag is turned on (VNX-2708).
- Runbook section 4 (B and the privacy `Last updated` value) and section 9 (emergency switch: the sitemap can list board URLs for up to 1 hour after the flag is turned off, `max-age=3600`; pages answer 404 at once; the legal text follows the date, not the flag).
- `--board` does not assert the footer link is present, only that `/requests` works; say if you want it.
- Not covered by design (Wave 1 scope): the builder's proposal over HTTP and `re_opt_in` after a self-withdrawal in the lifecycle (both have their own tests in 2703b and M6).
