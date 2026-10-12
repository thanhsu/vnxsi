# VNX-2705a report: public /requests and /requests/:publicId

## Done
- `routes/request-board.tsx` (GET `/requests`, `/requests/:publicId`, 4 locales via `onLocalized`), views in `views/requests/` (BoardPage, RequestCard, RequestDetail, InterestBlock), registered in `app.ts` after the request form routes.
- Only `findPublicListing` / `listOpenPublications` / `countOpenPublications` / `findViewerRelation` (read only for a signed-in viewer, open listing); `requestVisibility` decides; hidden = same 404 as missing; gate off = 404; id of the wrong shape = 404 without a query (`isPublicIdShape`).
- CTA per addendum 4.2 (signed out with `next`, not a builder, pending/rejected/suspended, own request link built by the route, closed = sentence + Post a request); approved builder shows nothing (slot for 2706a).
- Order only `published_at DESC, public_id DESC`; 24 per page; page past the end 404; filters category/budget/language as a GET form; empty state with Post a request and Browse products.
- S-3: `publicId()` in `lib/ulid.ts` (26 Crockford chars from random bytes, no time part) used by `optInStatement` for every path; same alphabet and length, so validation is unchanged. Migration 0018 not touched.
- RANKING_FILES gained the route and 4 views. Seed: Q1-Q8 published, R2001-2004 and R2011 hidden/closed rows (older than 30 days; R12 still has no publication). E2E: `request-board-public.spec.ts`, signed-out check in the Ops case, axe for `/requests`, open and closed detail, `/vi/requests`, 360 px detail; README updated. No new POST.

## Verification
- Red first: with the route registration commented out, 27 of the 35 new list/detail tests failed; the S-3 tests failed before `publicId()` existed (3 failures).
- `npm run typecheck -w apps/web`: 0 errors. Full suite (`--maxWorkers=2 --testTimeout=60000`): 200 files, 2556 passed, 2 skipped, no errors (one earlier run hit workerd heap OOM at startup from machine memory pressure; the rerun was clean).
- `npm run e2e`: 76 passed. `e2e:typecheck` clean. `test:scripts`: 53 pass (homepage MIN thresholds untouched).
- Query count on both routes is within the 8 limit (asserted with `countD1Queries`, signed in and out).

## Deviations and notes for the Reviewer
1. `/requests` is always `noindex` for now (fail closed); the 5-open threshold, canonical, hreflang, sitemap are 2705b. An open detail uses the Layout default canonical/hreflang; a closed one is noindex (no canonical).
2. `Pagination` uses `PAGE_SIZE` (24) of the catalogue, equal to `BOARD_PAGE_SIZE` (24); the route offset uses `BOARD_PAGE_SIZE`.
3. The detail view receives the `PublicListing` object (it has no request id or client id; a test pins its exact keys).
4. `test/fixtures.ts` `makeRequest` gained an optional `clientName`.
5. Filter keys follow the plan (`board.filter.*`); `filter.clear` is reused for "Clear filters". Extra keys beyond the plan list: `board.detail.back`, `board.cta.label`.
6. Seeded `public_id`s are `id("Q", n)` (fixed, not random) by plan; production ids are random.

## Copy needing Owner approval (new keys)
| Key | EN | VI |
|---|---|---|
| board.title | Public request board | Bảng nhu cầu công khai |
| board.intro | Requests from clients who chose to show them here. Our team reviews each one first, and the client's identity is never shown. | Các nhu cầu mà khách hàng đã chọn hiển thị tại đây. Đội ngũ của chúng tôi duyệt từng nhu cầu trước, và danh tính khách hàng không bao giờ được hiển thị. |
| board.empty.title | No open requests right now | Hiện chưa có nhu cầu nào đang mở |
| board.empty.body | Nothing is listed at the moment. You can post your own request, or browse products in the meantime. | Hiện chưa có gì được đăng. Bạn có thể đăng nhu cầu của mình, hoặc xem các sản phẩm trong lúc chờ. |
| board.cta.post / products | Post a request / Browse products | Đăng nhu cầu / Xem sản phẩm |
| board.filter.category / budget / language / any / apply | Category / Budget / Language / Any / Apply | Danh mục / Ngân sách / Ngôn ngữ / Tất cả / Áp dụng |
| board.card.posted / deadline | Posted / Deadline | Ngày đăng / Hạn chót |
| board.deadline.none | No deadline | Không có hạn chót |
| board.status.open / closed | Open / Closed | Đang mở / Đã đóng |
| board.detail.country / languages / budget / category / deadline / posted | Country / Languages / Budget / Category / Deadline / Posted | Quốc gia / Ngôn ngữ / Ngân sách / Danh mục / Hạn chót / Ngày đăng |
| board.detail.identityNote | The client's identity is not shown. The VNX.SI team invites up to five builders. | Danh tính khách hàng không được hiển thị. Đội ngũ VNX.SI mời tối đa năm builder. |
| board.detail.closedNote | This request is no longer open. It stays visible here for a limited time. | Nhu cầu này không còn mở. Nó vẫn hiển thị tại đây trong một thời gian giới hạn. |
| board.detail.back | All requests | Tất cả nhu cầu |
| board.cta.label | Next steps | Bước tiếp theo |
| board.cta.signedOut | I'm a builder — I'm interested | Tôi là builder — tôi quan tâm |
| board.cta.notBuilder | Only approved builders can say they are interested in a request. (+ link "For builders") | Chỉ builder đã được duyệt mới có thể bày tỏ quan tâm đến một nhu cầu. |
| board.cta.pendingBuilder | Available once your builder profile is approved | Có sau khi hồ sơ builder của bạn được duyệt |
| board.cta.ownRequest | This is your request. Manage it in your account | Đây là nhu cầu của bạn. Quản lý trong tài khoản |
| board.cta.closed | This request is closed | Nhu cầu này đã đóng |

zh-hans and zh-hant (AI, 你; 公开需求板 / 公開需求板) are in `apps/web/src/i18n/messages/zh-hans.ts` and `zh-hant.ts` under the same keys.
