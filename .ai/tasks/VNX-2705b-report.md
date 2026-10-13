# VNX-2705b report: SEO and entry links for the public request board

Implementer: Claude (Opus 5.5 trailer). Branch `feat/epic27-request-board`, based on 5cc29b0.

## What changed
- `/requests` indexable only when `isBoardIndexable(total)` (>= 5 open) and no filter is set. Unfiltered, `total` is the same query as `countOpenPublicationsAll`, so no extra D1 read (still <= 8). Otherwise noindex, no canonical, no hreflang. `BoardPage` takes an `indexable` prop (route decides).
- Open detail: meta description = new `publicMetaDescription` (<= 160 code points including the ellipsis, one line, grapheme-safe; `publicExcerpt` unchanged at 200 for cards). Canonical, 4 hreflang + x-default, `og:type=website` come from `Layout`. Closed stays noindex with neither. No JSON-LD.
- Sitemap (`routes/seo.ts`): full gate from `c.get("requestBoard")` (flag AND date, L7); open listings x4 locales via `listSitemapRequests` (already in `db/request-board.ts`), `lastmod = updated_at`; `/requests` entry when `isBoardIndexable(countOpenPublicationsAll)`. Gate off: no query, no entry. seo.ts imports only db/ and domain/ pure functions.
- `robots.txt` unchanged (new test asserts no `requests` line).
- Footer (Marketplace group) and `/for-builders` link to `/requests` only with the gate on, through a hono/jsx context set by `page()` from `c.get("requestBoard")` (`views/request-board-nav.tsx`; default false; views import no db). No header link.
- CSS: `.lp-builders-link` (light link on the dark builders band; axe contrast).

## Tests (red first)
Red run before implementation: 8 failures (sitemap x3, `/requests` index, meta description 201 > 160, `publicMetaDescription` missing, footer, for-builders). New: `test/seo/request-board.test.ts`, `test/seo/request-board-sitemap.test.ts`; extended `robots`, `footer`, `for-builders`; `request-board-list` no longer asserts noindex-until-2705b (moved to the seo test); `request-board-copy` passes `indexable`.
E2E (`request-board-public.spec.ts`, +4 tests, GET only): `/requests` not noindex with canonical + 5 hreflang, filtered view noindex, footer link yes and header nav no; `/for-builders` link; Q1 canonical/hreflang/og:type/description <= 160/no JSON-LD, Q2001 neither; sitemap has Q1 x4 + x-default + `/requests`, no Q2001-2004/Q2011, no request ids/titles/identity; robots has no `/requests`. Nothing asserted about Q2008-2010.

## Results
- `npm run typecheck -w apps/web`: clean. Full suite: 203 files / 2578 passed + 2 skipped. Seo/public/legal/design re-run after the CSS tweak: 24 files / 306.
- `npm run e2e`: 80 passed (first run 78 + 2 fixes: strict-mode locator on the footer language links, and axe contrast on the new link; both fixed). `e2e:typecheck` clean. `test:scripts` green.
- `npm run smoke`: skipped (needs a running server; not cheap). No wrangler/workerd process left.

## Deviations (for the Reviewer)
1. **No new i18n keys.** Plan listed `board.nav.footer`/`board.nav.forBuilders`; both links reuse the approved `board.title` ("Public request board" / "Bảng nhu cầu công khai" / zh). Parity unaffected.
2. A filtered `/requests` view is always noindex even with >= 5 open (plan silent; avoids thin duplicate pages). Plan text "from 5 index normally" holds for the unfiltered list. Pagination pages (page > 1, unfiltered) stay indexable with self-canonical.
3. `publicMetaDescription` counts the ellipsis inside the 160. `publicExcerpt` is refactored onto a shared `cutOneLine` with identical behaviour.
4. Context-based `boardOpen()` instead of a prop through `Layout` (as the plan said: "ngữ cảnh hono/jsx"); `for-builders.tsx` needed no change.
5. The `/for-builders` link sits in `<main>` after the apply CTA; the existing "nothing else in main" test still holds with the gate off.

## Copy needing Owner approval
None new. Reused: `board.title` (footer + /for-builders link text; also the existing /requests page title), `board.intro` (existing /requests meta description). Meta description of an open listing is the client's public description itself (no template words).
