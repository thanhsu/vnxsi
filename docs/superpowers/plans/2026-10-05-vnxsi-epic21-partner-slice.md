# VNX.SI EPIC 21 — Lát mỏng partner đầu tiên (ElevenLabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** Approved. Owner đã duyệt nguyên văn các khối câu chữ A, B, C và trả lời các câu hỏi ngày 2026-10-05; Opus (Reviewer) đã duyệt header và Task 1 theo ủy quyền của Owner; Task 2–6 được viết chi tiết ngay trước khi làm.
- **Roadmap / Backlog:** `docs/blueprint/07-MASTER-BACKLOG.md` → EPIC 21, VNX-2101, 2102 (tách 2102a / 2102b), 2103, 2104 (tách 2104a / 2104b). Phụ lục `docs/superpowers/specs/2026-10-04-vnxsi-monetization-addendum.md` mục 3.8 (lát mỏng). VNX-2105–2109 ngoài phạm vi.
- **Nhánh:** `feat/epic21-partner-slice` (tách từ `main`, sau khi `feat/m6-request` đã merge vào `main`; làm sau VNX-0708 theo thứ tự Owner)

**Goal:** Chạy được luồng thật cho partner đầu tiên: admin bật cờ `affiliate`, nhập ElevenLabs (merchant, chương trình, offer mặc định) qua giao diện; khách vào `/tools/elevenlabs` (4 locale) thấy mô tả, nút offer và câu disclosure; bấm nút tới `/go/elevenlabs`, hệ thống ghi một dòng `outbound_clicks` rồi chuyển sang link tracking PartnerStack; khi cờ tắt hoặc chương trình chưa `active` thì chuyển tới `destination_url` không tracking (nếu host hợp lệ), không thì 404. `/disclosure` công khai quan hệ partner. Không conversion, không ledger, không doanh thu (xem dashboard PartnerStack).

**Architecture:**
- Module `monetization` (ADR-007 luật 1): `domain/` thuần (cờ, validate URL, template, luật chương trình), `db/{flags,merchants,programs,offers,clicks}.ts` (mỗi bảng đúng một module ghi), `routes/` ghép (`admin-flags`, `admin-merchants`, `go`, `tools`), `views/` trình bày. Không import ngược: catalog, xếp hạng, gợi ý không đọc `db/` của monetization (test kiến trúc ở Task 1).
- Cờ tính năng: bảng `feature_flags`, đọc qua `isFlagEnabled` có cache trong isolate 60 giây (đọc lỗi thì tắt), `setFlag` ghi `audit_log` cùng `db.batch`. `/admin/flags` luôn đọc thẳng D1.
- Kiểm URL nằm hoàn toàn trong code thuần `domain/offer-url.ts` (không I/O), được gọi cả lúc admin lưu lẫn lúc redirect (ADR-007 luật 7). Đích của redirect chỉ lấy từ DB theo id/slug, không bao giờ từ query.
- `/go/:merchantSlug` và `/go/o/:offerId` dùng chung một hàm `resolveOfferRedirect` (domain, thuần): nhận offer + chương trình + merchant + cờ + thời điểm, trả `tracked | fallback | not_found`. Route chỉ ghép.
- Ghi click bằng `executionCtx.waitUntil` để không chậm redirect; lỗi ghi click chỉ ghi log. `click_id` = ULID của dòng `outbound_clicks`, sinh trước khi redirect.

**Tech Stack:** như M0–M6. Không thêm dependency. Migration mới (`main` đã có `0009_feedback.sql` của form liên hệ, PR #4, đã áp dụng trên production; epic này bắt đầu từ `0010`): `0010_feature_flags` (Task 1), `0011_partners` (Task 2), `0012_outbound_clicks` (Task 4). Chỉ thêm. Không chạy migration remote, không deploy. Nếu lúc bắt đầu `main` đã có số cao hơn, đánh số lại theo thứ tự này.

**Spec:** phụ lục monetization mục 1, 2.1–2.2 (route, header, bảng `outbound_clicks`; mục 3.8 cho phép tạo ở EPIC 21 vì VNX-0707 chưa làm), 2.5 (`ANALYTICS_SALT`: lát mỏng không dùng, `visitor_hash` luôn null), 3.1–3.4, 3.8, 8, 9. Spec Wave 1: 5.1 (4 locale, hreflang), 8.6 (văn bản thuần), 8.8 (SEO, sitemap, robots). **ADR:** ADR-007 (mục "Được bảo đảm bởi" là test bắt buộc), ADR-004, ADR-008 (không có ô sponsored trong lát mỏng), ADR-003 (i18n).

## Quyết định của Owner (2026-10-04, bổ sung 2026-10-05; ràng buộc)

- Partner đầu tiên ElevenLabs qua PartnerStack; dữ liệu ở `docs/partners/registry.md`, admin nhập qua giao diện, **không seed bằng migration**.
- ElevenLabs ở `/tools/elevenlabs` (không phải `/p/`); nút → `/go/elevenlabs` (offer mặc định); `/go/:merchantSlug` cùng tồn tại với `/go/o/:offerId`; slug merchant không được là `p` hoặc `o`.
- Chương trình chỉ `active` khi Owner đã điền `terms_url` và `terms_verified_at`; trước đó `/go/` chuyển về link không tracking. Conversion / doanh thu xem tạm trên dashboard PartnerStack.
- Owner nhận hoa hồng cá nhân (Q4) và tự kiểm điều khoản chương trình trước khi bật trên production.
- **(2026-10-05) Không index lúc ra mắt:** `/tools/elevenlabs` giữ `noindex` và ngoài sitemap cho tới khi Owner bật cờ `content_indexing` **và** đặt `indexable = 1`.
- **(2026-10-05) Nhãn `try_it`:** thêm nhãn `try_it` ("Try {name}") vào enum nhãn offer; offer mặc định của ElevenLabs dùng nhãn này. Có đủ 4 locale (Task 5).
- **(2026-10-05) Fallback về `website_url` của merchant** (phụ lục 3.8): khi offer không tracking được (cờ tắt, chương trình chưa `active`, offer ngoài thời hạn / `paused`, merchant `paused`), `/go/` chuyển tới `merchants.website_url`. URL đó vẫn phải qua mọi luật URL và `allowed_hosts` của merchant, không thì 404.
- **(2026-10-05) Fallback vẫn ghi `outbound_clicks`:** dòng được ghi, nhưng không có `click_id` nào gửi cho partner (không template).
- **(2026-10-05) Giữ `outbound_clicks` 13 tháng;** cron xóa dòng cũ hơn. Chốt mục 9 của phụ lục.

### Lệch phụ lục (Owner duyệt 2026-10-05)

- **Phụ lục 3.2 (enum `offers.label`):** thêm giá trị `try_it`. Enum mới: `learn_more`, `get_started`, `start_trial`, `visit_site`, `try_it`.
- **Phụ lục 3.3 (fallback):** phụ lục viết "chuyển tới `destination_url` không có tracking"; Owner chọn theo mục 3.8: chuyển tới `merchants.website_url`. `offers.destination_url` là link không tracking của chính offer (đích của offer không có chương trình; hiển thị và kiểm host ở admin), không phải đích fallback.
- **Phụ lục 2.2 / 3.3:** fallback có ghi dòng `outbound_clicks` (phụ lục chỉ nói rõ cho redirect có tracking).

## Quyết định thiết kế của Reviewer (Opus đã duyệt có chỉnh, 2026-10-05)

Các mục này là lựa chọn kỹ thuật của Planner ở chỗ phụ lục im lặng hoặc mơ hồ, đã qua review của Opus (APPROVE_WITH_CHANGES) và được sửa theo kết quả đó. Mục 18–20 là phán quyết của Controller.

1. **Thư mục:** theo ADR-007 luật 2 (`src/db/{offers,programs,merchants,conversions,revenue}.ts`): thêm `db/flags.ts`, `db/merchants.ts`, `db/programs.ts`, `db/offers.ts`, `db/clicks.ts` (ghi `outbound_clicks`). Domain: `domain/flags.ts`, `domain/merchant.ts`, `domain/offer-url.ts`, `domain/offer.ts`, `domain/outbound.ts`.
2. **`feature_flags.key` không có CHECK trong SQL** (spec 3.1: "enum trong code"); thêm cờ mới không cần migration. `domain/flags.ts` là nguồn duy nhất; dòng có key lạ bị bỏ qua khi đọc. `enabled` có `DEFAULT 0` (không phải điều khoản partner, không vi phạm ADR-007 luật 5).
3. **Cache cờ:** biến module-level theo isolate, TTL 60 000 ms, đọc cả bảng một lần cho mọi key. Đọc D1 lỗi thì trả `false` (fail closed, không cache, ghi log). Ghi cờ xóa cache của isolate đó; isolate khác thấy sau tối đa 60 s (chấp nhận, ghi chú trên `/admin/flags`). Test gọi `resetFlagCache()` và truyền `now`.
4. **Admin đổi cờ trùng giá trị hiện tại** thì không ghi gì, không audit.
5. **Chương trình `active` được ép ở CSDL** bằng `CHECK (status != 'active' OR (terms_url IS NOT NULL AND terms_verified_at IS NOT NULL AND type != 'direct'))` (Task 2), ngoài kiểm ở domain. Không có DEFAULT cho `commission_*`, `cookie_days`, `currency` (test grep migration). Chương trình `type = direct` không `active` được trong lát mỏng (xem mục 19).
6. **Validate URL (`domain/offer-url.ts`, thuần, một hàm `validateFinalUrl(raw, allowedHosts)` dùng cho `destination_url`, `website_url`, kết quả điền template và mọi lần redirect).** Chặt hơn phụ lục, đóng các mánh đã biết. Thứ tự kiểm:
   1. Chuỗi thô chỉ gồm ký tự ASCII in được `[\x21-\x7E]` (không khoảng trắng, không điều khiển, không ký tự không-ASCII như chữ rộng hay `。`), không chứa `\`, dài ≤ 2048, bắt đầu đúng `https://` chữ thường (`https:evil.com`, `https:///evil.com`, `HTTPS://…`, `//evil.com` đều bị từ chối).
   2. Phần authority (từ sau `https://` tới `/`, `?` hoặc `#` đầu tiên) không rỗng, không chứa `@`, `%`, `{`, `}` (chặn userinfo và `%2e` trong host).
   3. `new URL(raw)`: `protocol === "https:"`; `username` và `password` rỗng; `port === ""` (WHATWG bỏ `:443`, nên `:443` được chấp nhận, `:8443` bị từ chối); `hostname` không bắt đầu bằng `[` (IPv6, kể cả `[::ffff:127.0.0.1]`); `hostname` không kết thúc bằng `.`, có ít nhất một dấu chấm, không phải `localhost` hay `*.localhost`; **nhãn cuối của `hostname` phải chứa ít nhất một chữ cái** (bắt mọi dạng IPv4: thập phân, hex, bát phân như `0177.0.0.1`, `0x7f.1`, `2130706433`).
   4. Khớp host: `host === h || host.endsWith("." + h)` với `h` ∈ `allowed_hosts` của **merchant của chương trình** (và `program.merchant_id` phải bằng merchant mà offer thuộc về; với offer không chương trình, merchant của `subject_id`). Không khớp theo hậu tố chuỗi trần (`evilelevenlabs.io` không khớp `elevenlabs.io`).
   5. Giá trị trả về là `new URL(raw).href` đã kiểm lại; **`Location` luôn bằng giá trị này**, không bao giờ là chuỗi thô.
   - `allowed_hosts` khi lưu: chữ thường, nhãn LDH ASCII, ≥ 2 nhãn, nhãn cuối chứa chữ cái (không IP), không scheme/path/port/wildcard, ≤ 20 mục, không trùng.
7. **Template:** mọi `{` hoặc `}` không thuộc ba placeholder hợp lệ là lỗi. Phần trước `{` đầu tiên phải khớp `^https://[^/?#@{}\\]+[/?#]` (placeholder chỉ nằm sau host, trong đường dẫn / query / fragment; template không có `{` thì kiểm như URL thường, cho phép `https://host` không có `/`). Lúc lưu: điền giá trị mẫu (`click_id` = ULID mẫu, `locale` = `en`, `src` = `tools`) rồi chạy `validateFinalUrl`; lúc redirect: điền giá trị thật rồi chạy lại. Giá trị điền qua `encodeURIComponent`. Offer chưa biết tham số sub-id (ElevenLabs hiện tại) dùng template không placeholder (link affiliate nguyên văn).
8. **Bậc xử lý offer (`resolveOfferRedirect`):** offer không tồn tại hoặc `archived`, merchant `archived` → `not_found` (phán quyết Controller: link chết thì để chết, chặt hơn phụ lục). Thiếu điều kiện nào khác của phụ lục 3.3 (offer `paused` / ngoài `starts_at`–`ends_at`; chương trình không `active`; merchant `paused`; cờ tắt) → `fallback` tới `merchants.website_url` nếu qua `validateFinalUrl` với `allowed_hosts` của merchant (Owner 2026-10-05), không thì `not_found`. Riêng `GET /go/:merchantSlug`: merchant không `active` → 404 theo phụ lục.
9. **Cờ theo loại chương trình:** `affiliate` ↔ `type = affiliate`; `partner_referral` ↔ `referral` | `revenue_share`. Offer không chương trình (`program_id` null) không cần cờ (không kiếm tiền, vẫn ghi click). `type = direct` không có cờ nên không `active` được (mục 19).
10. **Click và UTM:** cả redirect `tracked` lẫn `fallback` ghi một dòng `outbound_clicks` (Owner 2026-10-05); redirect `fallback` không có template, nên không có `click_id` nào gửi cho partner, và `404` / `405` / `HEAD` không ghi. UTM (`utm_source=vnx.si&utm_medium=referral`, trừ khi URL đã có tham số `utm_*`) chỉ gắn cho offer không có chương trình (link chính thức) và cho `fallback` tới `website_url`; link đi qua chương trình dùng đúng template của đối tác, không thêm tham số (phụ lục 3.3 chỉ nói "header và ghi click như 2.1–2.2"). Hàm thuần `appendUtm(url)`, test ở tầng domain vì lát mỏng không có offer không chương trình.
11. **Disclosure hiện khi trang render ít nhất một offer có `program_id`** (đúng phụ lục 3.4), bất kể cờ hay trạng thái chương trình (hiện thừa còn hơn thiếu); `rel="sponsored noopener"` cho chính các offer đó, `rel="noopener"` cho offer không chương trình; mọi nút `target="_blank"`.
12. **Bot:** `domain/outbound.ts#isBotRequest(userAgent, cf)` = UA rỗng, hoặc khớp `/bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i`, hoặc `cf.botManagement.verifiedBot === true`. Chỉ để đánh dấu `is_bot` (không chặn redirect). M7 (VNX-0707) có thể thay bằng luật chung của spec 8.11.
13. **Locale của click:** đọc từ `Referer` cùng host qua `localeFromPath`; không có hoặc khác host thì `en`. Không dùng cookie. `src` ngoài enum → `unknown`.
14. **Phương thức:** `GET` redirect và ghi click; `HEAD` redirect nhưng không ghi click; method khác trên `/go/*` → 405 kèm `Allow: GET, HEAD`.
15. **Mô tả merchant** là văn bản thuần tiếng Anh, một cột, render bằng `PlainText` cho cả 4 locale; trên trang không phải `en` bọc trong phần tử `lang="en"` (Controller). Chrome của trang đi qua `t()`. Tên merchant không dịch.
16. **Retention `outbound_clicks`:** 13 tháng (Owner 2026-10-05, chốt mục 9 của phụ lục). Cron hằng ngày xóa dòng cũ hơn `OUTBOUND_CLICK_RETENTION_DAYS = 395`, làm ở Task 4 (395 ngày ≈ 13 tháng, giá trị cố định để test được).
17. **`/disclosure`** thêm vào bộ `LEGAL` (nguồn `docs/legal/disclosure.md`, test so từng dòng như Terms/Privacy), kèm một khối động "danh sách merchant có chương trình `active`" nằm dưới phần tĩnh. zh-Hans / zh-Hant theo mẫu hiện có (hiện bản EN kèm câu "chỉ có bản tiếng Anh"); riêng **câu disclosure ngắn** trên `/tools` có đủ 4 locale.
18. **Offer có chương trình phải có `tracking_template`** (domain + admin; DB: `CHECK (program_id IS NULL OR tracking_template IS NOT NULL)`). `destination_url` là link không tracking của chính offer và không được bằng URL đã chuẩn hóa của template (nếu bằng, admin báo lỗi). Form admin ghi nhãn `destination_url` là "Untracked link". Xem trước hiện URL tracking và URL fallback (`website_url`) cạnh nhau. Với ElevenLabs: `destination_url = https://elevenlabs.io`, `tracking_template = https://try.elevenlabs.io/7fnly5cv33k3`, `label = try_it`, đặt làm offer mặc định.
19. **Chương trình `type = direct` không `active` được** (Controller): ADR-007 luật 9 cần một cờ cho mỗi nguồn doanh thu và `direct` không có cờ. Ép ở domain (`parseProgramForm` trả lỗi) và ở CSDL (CHECK mục 5); có test.
20. **Offer hoặc merchant `archived` → 404** (Controller), đã gộp vào mục 8.

## Cần Owner duyệt câu chữ

Reviewer chép các văn bản này vào `docs/legal/disclosure.md` và `docs/legal/privacy.md` **sau khi Owner duyệt**, trước khi Task tương ứng bắt đầu (Privacy trước Task 4, `/disclosure` trước Task 6). Không có sự thật nào về ElevenLabs hay mức hoa hồng trong các câu này.

### A. Câu disclosure (hiện trên khối offer ở `/tools/:slug`, 4 locale)

- **en** (cố định theo phụ lục 3.4): "VNX.SI may earn a commission when you sign up or buy through some links on this page. This never changes how products are ranked."
- **vi:** "VNX.SI có thể nhận hoa hồng khi bạn đăng ký hoặc mua qua một số liên kết trên trang này. Điều này không bao giờ thay đổi cách xếp hạng sản phẩm."
- **zh-Hans:** "当您通过本页的部分链接注册或购买时，VNX.SI 可能获得佣金。这绝不会影响产品的排名方式。"
- **zh-Hant:** "當您透過本頁的部分連結註冊或購買時，VNX.SI 可能獲得佣金。這絕不會影響產品的排名方式。"
- Link đi kèm: "Learn more" / "Tìm hiểu thêm" / "了解更多" / "瞭解更多" → `/disclosure`.

### B. Trang `/disclosure` (docs/legal/disclosure.md)

Cấu trúc file giống `terms.md` (`## EN`, `## VI`, `{date}`); `zh-*` hiện bản EN kèm câu "bản tiếng Anh có hiệu lực" đã có (cùng cơ chế `legal.englishOnly`).

EN:

> ### Disclosure
>
> Last updated: {date}
>
> **1. Partner links**
> Some links on VNX.SI lead to products or services of other companies through a partner or affiliate program. If you sign up or buy through one of these links, VNX.SI may earn a commission from that company. Pages with such links say so next to the link, and the links are marked `rel="sponsored"` for search engines. When you follow a link we record the click; our Privacy Policy says what the record contains.
>
> **2. Rankings are not for sale**
> A commission never changes how products or builders are ranked: not in search, not in the directory, not in Trending or the Top lists, and not in which builders we suggest for a request. Nobody can pay for a higher position, and the code that ranks results does not read partner or commission data.
>
> **3. Companies with an active partner program**
> The companies below have an active partner program with VNX.SI.
>
> **4. Questions**
> Email contact@vnx.si.

VI:

> ### Công khai quan hệ đối tác
>
> Cập nhật lần cuối: {date}
>
> **1. Link partner**
> Một số link trên VNX.SI dẫn tới sản phẩm hoặc dịch vụ của công ty khác thông qua chương trình partner hoặc affiliate. Nếu bạn đăng ký hoặc mua qua một link như vậy, VNX.SI có thể nhận hoa hồng từ công ty đó. Trang có link như vậy sẽ ghi rõ cạnh link, và các link được đánh dấu `rel="sponsored"` cho công cụ tìm kiếm. Khi bạn bấm một link, chúng tôi ghi lại lượt bấm; Chính sách quyền riêng tư nói rõ bản ghi gồm những gì.
>
> **2. Thứ hạng không bán**
> Hoa hồng không bao giờ thay đổi cách xếp hạng sản phẩm hay builder: không trong tìm kiếm, không trong danh bạ, không trong Trending hay các danh sách Top, và không trong việc chúng tôi gợi ý builder nào cho một nhu cầu. Không ai trả tiền để lên vị trí cao hơn, và đoạn mã xếp hạng kết quả không đọc dữ liệu partner hay hoa hồng.
>
> **3. Công ty có chương trình partner đang hoạt động**
> Các công ty dưới đây có chương trình partner đang hoạt động với VNX.SI.
>
> **4. Câu hỏi**
> Gửi email tới contact@vnx.si.

Dưới mục 3, trang hiện danh sách động (tên merchant → `/tools/:slug`); khi không có chương trình `active` thì hiện đúng một dòng "None at the moment." / "Hiện chưa có." (khóa `disclosure.noPartners`, không nằm trong file nguồn). Đây là chỗ duy nhất nói về việc không có partner.

### C. Bổ sung Privacy

Reviewer thêm dòng đầu file "Bổ sung EPIC 21 (outbound, partner): APPROVED bởi Owner <ngày>" và một dòng "Đối chiếu code EPIC 21". Task 4 chép nguyên văn vào `src/legal/content.ts` (test `legal/content` so từng dòng) và tăng `LEGAL_UPDATED_AT` (hằng dùng chung cho Terms và Privacy, nên ngày "Last updated" của cả hai đổi theo). Văn bản đúng cho cả redirect có tracking lẫn redirect không tracking (cả hai đều ghi bản ghi) và cho thời hạn giữ 13 tháng.

EN, mục 2 (thêm ngay sau gạch đầu dòng **Waitlist**):

> - **Outbound clicks:** when you follow a button or link that goes to another company's website through our `/go/` address, we record the time, which link it was, which kind of page it was on, the language of the page you were on, your country (detected by our hosting provider), the website you came from (domain only) and whether the visit looks like an automated bot. We record the click even when the link carries no tracking code. We do not store your IP address, your email address or your account with that record, and for now we do not link it to any visitor identifier.

EN, mục 3 (thêm ngay sau dòng "To match requests with builders: …"):

> - To count how often links to other companies are followed and, for partner links, to let the partner tell which of our links a visit came from (the link may carry a random click code; on VNX.SI it is not linked to your name, email address or account).

EN, mục 4 (thêm ngay sau dòng "Builders do not see clients' email addresses…"):

> - When you follow a link to a partner you leave VNX.SI. The partner can see that you came from VNX.SI, and the click code if the link carries one. It handles your data under its own privacy policy, and it may set its own cookies or tracking when you arrive on its site.

EN, mục 6 (thêm ngay sau dòng "Rate-limit counters (including IP addresses): …"):

> - Outbound click records: deleted after 13 months.

VI, các vị trí tương ứng:

> - **Lượt bấm link ra ngoài:** khi bạn bấm một nút hoặc link dẫn tới website của công ty khác qua địa chỉ `/go/` của chúng tôi, chúng tôi ghi lại thời điểm, đó là link nào, nằm trên loại trang nào, ngôn ngữ của trang bạn đang xem, quốc gia của bạn (do nhà cung cấp hosting nhận diện), trang web bạn đến từ đó (chỉ tên miền) và việc lượt truy cập có giống bot tự động không. Chúng tôi ghi lượt bấm cả khi link không mang mã theo dõi nào. Chúng tôi không lưu địa chỉ IP, email hay tài khoản của bạn cùng bản ghi đó, và hiện chưa gắn nó với bất kỳ mã nhận diện người xem nào.

> - Đếm số lần các link tới công ty khác được bấm và, với link partner, để partner biết một lượt truy cập đến từ link nào của chúng tôi (link có thể mang một mã bấm ngẫu nhiên; trên VNX.SI mã đó không gắn với tên, email hay tài khoản của bạn).

> - Khi bạn bấm link tới một partner, bạn rời VNX.SI. Partner thấy được bạn đến từ VNX.SI, và mã bấm nếu link có mang. Họ xử lý dữ liệu của bạn theo chính sách quyền riêng tư của họ, và có thể đặt cookie hoặc theo dõi riêng khi bạn vào trang của họ.

> - Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng.

Câu "Chúng tôi không dùng analytics, quảng cáo hay cookie theo dõi của bên thứ ba" giữ nguyên (nói về VNX.SI). Mục 5 (Cookie) không đổi: lát mỏng không có cookie mới. Khi M7 thêm `visitor_hash`, M7 cập nhật câu "hiện chưa gắn…".

## Câu hỏi mở cho Owner

Không còn câu hỏi nghiệp vụ mở. Bốn câu của bản nháp đã được Owner trả lời ngày 2026-10-05 (không index lúc ra mắt; nhãn `try_it`; một mô tả tiếng Anh dùng cho 4 locale; giữ click 13 tháng), ghi ở "Quyết định của Owner" và "Lệch phụ lục".

Việc của Owner trước khi bật trên production, không chặn code: điền `terms_url` và `terms_verified_at` của chương trình (admin nhập), viết đoạn mô tả tiếng Anh của ElevenLabs, đọc tài liệu PartnerStack để biết tham số sub-id cho `{click_id}` (chưa biết, nên offer đầu tiên dùng link nguyên văn `https://try.elevenlabs.io/7fnly5cv33k3` không placeholder), bật cờ `affiliate`.

## Global Constraints

- Mọi ràng buộc của plan M0–M6 vẫn áp dụng (không thêm dependency, ranh giới module, Origin check cho POST, test sở hữu bảng, `RETURNING` thay `meta.changes` cho bảng có trigger, chuỗi giao diện qua `t()` đủ 4 locale, test nặng timeout 30 s, `Cache-Control: no-store` cho `/admin*`).
- **Cờ hợp lệ (đúng 7 key, đúng thứ tự):** `affiliate`, `partner_referral`, `sponsored_listings`, `ads`, `lead_generation`, `ai_content`, `content_indexing`. Không có dòng = tắt. Cache 60 000 ms.
- **Placeholder của template (đúng 3):** `{click_id}`, `{locale}`, `{src}`. Giá trị qua `encodeURIComponent`. Placeholder lạ, ngoặc `{`/`}` lẻ, hoặc placeholder trong scheme/host → lỗi khi lưu.
- **URL cuối (sau khi điền template, hoặc `destination_url`, hoặc `website_url`):** chuỗi thô là ASCII in được `[\x21-\x7E]`, không `\`, ≤ 2048 ký tự, bắt đầu đúng `https://`; authority không rỗng, không `@`, `%`; sau `new URL`: `https:`, không userinfo, không cổng khác 443 (`:443` được, `:8443` không), hostname không bắt đầu `[`, không dấu chấm cuối, có dấu chấm, không `localhost` / `*.localhost`, nhãn cuối có chữ cái (loại mọi dạng IPv4); host ∈ `allowed_hosts` của merchant (khớp chính xác hoặc subdomain; `program.merchant_id` = merchant của offer); `Location` = `new URL(final).href`. Kiểm lúc admin lưu (giá trị mẫu) và lúc redirect (giá trị thật). `allowed_hosts` cũng theo luật nhãn cuối có chữ cái.
- **Slug merchant:** `SLUG_RE` của `domain/slug.ts` (3–60 ký tự), và không được là `p` hoặc `o` (`RESERVED_MERCHANT_SLUGS`, kiểm tường minh dù `SLUG_RE` đã loại chúng).
- **Nhãn offer (enum, 5 giá trị):** `learn_more`, `get_started`, `start_trial`, `visit_site`, `try_it`. Chương trình `direct` không `active` được; offer có `program_id` phải có `tracking_template`.
- **Header của mọi phản hồi `/go/` thành công (302, cả `tracked` lẫn `fallback`):** `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin`, `Location` = URL cuối. Không có tiền tố locale. Chỉ GET/HEAD. 404 dùng trang lỗi locale mặc định.
- **Query duy nhất `/go/` đọc:** `src` ∈ `product_page` | `builder_page` | `catalog` | `home` | `article` | `tools`, khác thì `unknown`. Không có tham số nào chứa URL.
- **Cờ tắt / chương trình chưa `active` / offer `paused` hoặc ngoài thời hạn / merchant `paused`:** không tracking (không template, không `click_id` cho partner); redirect tới `merchants.website_url` nếu qua kiểm URL, không thì 404; **vẫn ghi một dòng `outbound_clicks`**. Offer hoặc merchant `archived`, offer không tồn tại → 404, không ghi.
- **`outbound_clicks`:** không lưu IP, email, user id; `visitor_hash` luôn null ở lát mỏng; CHECK `product_id IS NOT NULL OR offer_id IS NOT NULL`; ghi qua `waitUntil`, lỗi chỉ ghi log; giữ 395 ngày (13 tháng), cron hằng ngày xóa dòng cũ hơn.
- **Hiển thị `/tools/:slug`:** 404 khi merchant không `active`; `<meta name="robots" content="noindex">` khi `indexable = 0` hoặc cờ `content_indexing` tắt (mặc định lúc ra mắt, Owner 2026-10-05; và khi đó không canonical); không có nút Buy / Customize / Hire; mô tả bọc `lang="en"` trên trang không phải `en`; offer hiện = `status = active`, trong thời hạn, `subject_type = merchant`. Link offer `rel="sponsored noopener"` khi `program_id` khác null, `rel="noopener"` khi null; `target="_blank"`.
- **Disclosure:** có ít nhất một offer hiển thị với `program_id` khác null → câu disclosure (đủ 4 locale) ngay trên khối offer + link `/disclosure`; không có → không hiện cả hai.
- **Sitemap:** `/tools/:slug` (4 locale, hreflang) chỉ khi merchant `active` **và** `indexable = 1` **và** cờ `content_indexing` bật; `/disclosure` luôn có. `robots.txt` đã có `Disallow: /go/`.
- **Audit:** `flag.set`, `merchant.create|update|status`, `program.create|update|status`, `offer.create|update|status`; mỗi thao tác ghi cùng `db.batch` với thay đổi.
- Test admin dùng `owner@vnx.si`. Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`.

## Review Focus

1. **Open redirect:** `/go/` không bao giờ đọc URL từ query/path; `//evil.com`, `https://evil.com` trong `src` hoặc slug, `\`, CR/LF, `%0d%0a` không đổi `Location`. Test ở Task 2 (domain), Task 4 (route).
2. **Mánh URL kiểu SSRF:** userinfo (`https://elevenlabs.io@evil.com`), host giống (`evilelevenlabs.io`, `elevenlabs.io.evil.com`), IPv4 mọi dạng (`127.0.0.1`, `2130706433`, `0x7f.1`, bát phân `0177.0.0.1`), IPv6 (`[::1]`, `[::ffff:127.0.0.1]`), `%2e` trong host, chữ rộng / `。`, `https:evil.com`, `https:///evil.com`, scheme viết hoa, `localhost`, `:443` (được) và `:8443` (không), `http:`, `javascript:`, `data:`, ký tự điều khiển; cả ở `destination_url`, `website_url` lẫn kết quả điền template. Test ở Task 2 và Task 4.
3. **Hành vi khi cờ tắt:** cờ tắt, chương trình `draft` / `paused`, offer hết hạn → không template, không `click_id` cho partner, redirect `website_url` và **có** dòng `outbound_clicks`; `website_url` không hợp lệ → 404; offer / merchant `archived` → 404, không ghi. Cache 60 s: kiểm cả hai phía bằng `now` tiêm vào. Test ở Task 1 và Task 4.
4. **Disclosure có / không:** có offer có chương trình → câu + link + `rel="sponsored"`; chỉ offer không chương trình, hoặc không offer → không câu, không `sponsored`. Test ở Task 5.
5. **Xếp hạng không đọc tiền:** test kiến trúc cấm file xếp hạng / gợi ý import `db/{offers,programs,merchants,conversions,revenue,clicks}.ts` hoặc có SQL tới `merchants`, `partner_programs`, `offers`, `conversions`, `revenue_entries`, `outbound_clicks`; thêm test danh sách cho phép (chỉ các file được liệt kê mới được import module db tiền hoặc có SQL bảng tiền; danh sách tăng theo từng task) và test `src/**` không có `elevenlabs` / `partnerstack`. Có từ Task 1.
6. **Điều khoản mặc định:** không DEFAULT cho `commission_*`, `cookie_days`, `currency`; chương trình không `active` được nếu thiếu `terms_url` / `terms_verified_at` hoặc nếu `type = direct` (CHECK ở CSDL + domain). Offer có chương trình phải có template. Test ở Task 2.
7. **Quyền riêng tư:** `outbound_clicks` không có cột IP / email / user; click của bot vẫn ghi với `is_bot = 1`. Test ở Task 4.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | VNX-2101 | Migration `0010_feature_flags`, `domain/flags.ts`, `db/flags.ts` (cache 60 s, audit), `/admin/flags`, test kiến trúc (sở hữu bảng + "xếp hạng không đọc tiền") | — |
| 2 | VNX-2102a | Migration `0011_partners` (merchants, partner_programs, offers), `domain/{merchant,offer-url,offer}.ts` (kiểm URL, template, luật chương trình, `resolveOfferRedirect`), `db/{merchants,programs,offers}.ts`, nối vào test kiến trúc | 1 |
| 3 | VNX-2102b | Admin: `/admin/merchants`, `/admin/merchants/:id` (CRUD merchant, chương trình, offer; kiểm host; xem trước URL cuối; offer mặc định) | 1, 2 |
| 4 | VNX-2103 | Migration `0012_outbound_clicks`, `db/clicks.ts`, `/go/:merchantSlug`, `/go/o/:offerId`, bot / locale / `src`, `waitUntil`, cron xóa click cũ, Privacy (mục C) | 1, 2 |
| 5 | VNX-2104a | `/tools/:slug` (4 locale), khối offer, disclosure, noindex / sitemap, link footer | 1, 2, 4 |
| 6 | VNX-2104b | `/disclosure` (`LEGAL.disclosure` + danh sách merchant `active`), sitemap, test `legal/content` | 5 |

Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: VNX-2101 — Cờ tính năng và `/admin/flags`

**Files:**
- Create: `apps/web/migrations/0010_feature_flags.sql`
- Create: `apps/web/src/domain/flags.ts`, `apps/web/src/db/flags.ts`
- Create: `apps/web/src/routes/admin-flags.tsx`, `apps/web/src/views/admin/FlagsPage.tsx`
- Modify: `apps/web/src/db/audit.ts` (guard `flagKey`: `AuditFlagGuard = { flagKey: string; enabled: 0 | 1; updatedAt: string; updatedBy: string }`; nhánh `"flagKey" in onlyIf` chèn audit chỉ khi `EXISTS (SELECT 1 FROM feature_flags WHERE key = ?8 AND enabled = ?9 AND updated_at = ?10 AND updated_by = ?11)`; thêm vào union của `auditStatement`)
- Modify: `apps/web/src/app.ts` (đăng ký route), `apps/web/src/views/admin/AdminLayout.tsx` (mục `flags`)
- Modify: 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (chuỗi mới, nối vào cuối trước `}`)
- Modify: `apps/web/test/architecture.test.ts` (`WRITERS.feature_flags`; luật "xếp hạng không đọc tiền")
- Modify: `apps/web/wrangler.jsonc` (ghi chú thứ tự deploy có `0010_feature_flags`)
- Test: `apps/web/test/domain/flags.test.ts`, `apps/web/test/db/flags.test.ts`, `apps/web/test/admin/flags.test.ts`

**Lưu ý:** `main` đã thiết kế lại Layout / header / footer / `app.css`; `AdminLayout.tsx` và `FlagsPage.tsx` dưới đây phải theo bản `main` mới (tên class, cấu trúc nav có thể khác), và `test/design/layout.test.ts`, `test/design/assets.test.ts` phải vẫn xanh.

**Interfaces:**
- Consumes: `auditStatement` (`db/audit.ts`), `requireAdmin` (`auth/middleware.ts`), `onLocalized` (`http/localized.ts`), `AdminLayout`, `page`, `errorResponse`, `requestOrigin`, `translator`, fixtures `signIn`, `makeBuilder`; helpers `formPost`, `getReq`, `testEnv`.
- Produces:
  - `domain/flags.ts`: `FLAG_KEYS` (tuple 7 key), `type FlagKey`, `type FlagState = Record<FlagKey, boolean>`, `isFlagKey(value: unknown): value is FlagKey`, `FLAG_CACHE_TTL_MS = 60_000`.
  - `db/flags.ts`: `readFlags(db): Promise<FlagState>` (luôn đọc D1), `isFlagEnabled(db, key, now = Date.now()): Promise<boolean>` (cache, fail closed), `setFlag(db, { key, enabled, actorUserId, now }): Promise<{ changed: boolean }>`, `resetFlagCache(): void`.
  - `routes/admin-flags.tsx`: `registerAdminFlagRoutes(app)`: `GET /admin/flags`, `POST /admin/flags/:key`.
  - `views/admin/AdminLayout.tsx`: `AdminSection` có thêm `"flags"`.

**Quyết định kỹ thuật:** xem "Quyết định thiết kế của Reviewer" mục 2, 3, 4. Thêm: `POST /admin/flags/:key` nhận `enabled` = `"1"` | `"0"`, giá trị khác 400, key lạ 404; sau khi ghi redirect `303` về `/admin/flags?done=1` (cùng cách `decide` của admin builder). Kiểu `update` của cờ không cần compare-and-set: trạng thái đích là idempotent.

- [ ] **Step 1: Migration**

`apps/web/migrations/0010_feature_flags.sql`:

```sql
-- EPIC 21 feature flags (addendum §3.1). Additive only.
-- `key` has no CHECK on purpose: the list of valid keys is an enum in code (domain/flags.ts), so a new flag needs no migration.
-- A missing row means the flag is off.
CREATE TABLE feature_flags (
  key        TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
```

Thêm vào `apps/web/wrangler.jsonc`, ngay sau dòng ghi chú migration mới nhất của `main` (`0009_feedback`), và thêm `0010_feature_flags` vào dòng `1. npm run db:migrate:remote …`:

```jsonc
  // 0010_feature_flags (EPIC 21) ships with its code the same way: migrate first, then deploy.
```

- [ ] **Step 2: Test domain (fail)**

`apps/web/test/domain/flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLAG_CACHE_TTL_MS, FLAG_KEYS, isFlagKey } from "../../src/domain/flags.ts";

describe("feature flag keys (addendum §3.1)", () => {
  it("are exactly the seven keys of the addendum, in order", () => {
    expect([...FLAG_KEYS]).toEqual(["affiliate", "partner_referral", "sponsored_listings", "ads", "lead_generation", "ai_content", "content_indexing"]);
  });

  it("recognises only those keys", () => {
    for (const key of FLAG_KEYS) expect(isFlagKey(key)).toBe(true);
    for (const bad of ["Affiliate", "affiliate ", "", "unknown", "__proto__", "constructor", 1, null, undefined]) expect(isFlagKey(bad), String(bad)).toBe(false);
  });

  it("caches for 60 seconds", () => {
    expect(FLAG_CACHE_TTL_MS).toBe(60_000);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/flags.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 3: Domain**

`apps/web/src/domain/flags.ts`:

```ts
/** Feature flags (monetization addendum §3.1). Pure: no Hono, no D1. */

/** Every valid flag. A flag with no row in `feature_flags` is off. */
export const FLAG_KEYS = ["affiliate", "partner_referral", "sponsored_listings", "ads", "lead_generation", "ai_content", "content_indexing"] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];
export type FlagState = Record<FlagKey, boolean>;

/** How long one isolate may serve a flag value it has read (addendum §3.1). */
export const FLAG_CACHE_TTL_MS = 60_000;

export function isFlagKey(value: unknown): value is FlagKey {
  return typeof value === "string" && (FLAG_KEYS as readonly string[]).includes(value);
}
```

Chạy lại test domain → PASS.

- [ ] **Step 4: Test db (fail)**

`apps/web/test/db/flags.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { isFlagEnabled, readFlags, resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const rawSet = (key: string, enabled: 0 | 1) =>
  testEnv.DB.prepare("INSERT INTO feature_flags (key, enabled, updated_by, updated_at) VALUES (?1, ?2, NULL, ?3) ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled").bind(key, enabled, NOW).run();
const auditCount = async (key: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'flag.set' AND entity_id = ?1").bind(key).first<{ n: number }>())?.n ?? 0;

describe("feature flags (addendum §3.1)", () => {
  beforeEach(async () => {
    await testEnv.DB.prepare("DELETE FROM feature_flags").run();
    resetFlagCache();
  });

  it("are all off when there is no row", async () => {
    const flags = await readFlags(testEnv.DB);
    expect(Object.keys(flags)).toEqual([...FLAG_KEYS]);
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
    expect(await isFlagEnabled(testEnv.DB, "affiliate")).toBe(false);
  });

  it("ignores rows with an unknown key", async () => {
    await rawSet("made_up", 1);
    expect(Object.keys(await readFlags(testEnv.DB))).toEqual([...FLAG_KEYS]);
  });

  it("turns on and off with one audit row per real change and none for a no-op", async () => {
    const admin = await ensureUser("flags-admin@vnx.si");
    // Each call has its own timestamp: ULIDs are not monotonic inside one millisecond, so order is never asserted from ids.
    const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: false, actorUserId: admin.id, now: at(1) })).toEqual({ changed: false });
    expect(await auditCount("affiliate")).toBe(0);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);

    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: admin.id, now: at(2) })).toEqual({ changed: true });
    expect((await readFlags(testEnv.DB)).affiliate).toBe(true);
    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: admin.id, now: at(3) })).toEqual({ changed: false });
    expect(await setFlag(testEnv.DB, { key: "affiliate", enabled: false, actorUserId: admin.id, now: at(4) })).toEqual({ changed: true });
    expect(await auditCount("affiliate")).toBe(2);

    const { results } = await testEnv.DB.prepare("SELECT actor_user_id, entity, data FROM audit_log WHERE action = 'flag.set' AND entity_id = 'affiliate'").all<{ actor_user_id: string; entity: string; data: string }>();
    expect(results.map((r) => r.actor_user_id)).toEqual([admin.id, admin.id]);
    expect(results.every((r) => r.entity === "feature_flag")).toBe(true);
    expect(results.map((r) => (JSON.parse(r.data) as { enabled: boolean }).enabled).sort()).toEqual([false, true]);
  });

  it("is atomic: two concurrent identical sets change once and audit once", async () => {
    const admin = await ensureUser("flags-admin3@vnx.si");
    const results = await Promise.all([
      setFlag(testEnv.DB, { key: "ads", enabled: true, actorUserId: admin.id, now: NOW }),
      setFlag(testEnv.DB, { key: "ads", enabled: true, actorUserId: admin.id, now: NOW }),
    ]);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(await auditCount("ads")).toBe(1);
  });

  it("serves a cached value for 60 s and re-reads at 60 s", async () => {
    const t0 = 1_000_000;
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0)).toBe(false);
    await rawSet("affiliate", 1);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 59_999)).toBe(false);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 60_000)).toBe(true);
    await rawSet("affiliate", 0);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 60_001)).toBe(true);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", t0 + 120_000)).toBe(false);
  });

  it("drops the cache of this isolate when a flag is set", async () => {
    const admin = await ensureUser("flags-admin2@vnx.si");
    const t0 = 2_000_000;
    expect(await isFlagEnabled(testEnv.DB, "partner_referral", t0)).toBe(false);
    await setFlag(testEnv.DB, { key: "partner_referral", enabled: true, actorUserId: admin.id, now: NOW });
    expect(await isFlagEnabled(testEnv.DB, "partner_referral", t0 + 1)).toBe(true);
  });

  it("fails closed when D1 cannot be read, and does not cache the failure", async () => {
    const broken = { prepare: () => { throw new Error("d1 down"); } } as unknown as D1Database;
    expect(await isFlagEnabled(broken, "affiliate", 3_000_000)).toBe(false);
    await rawSet("affiliate", 1);
    expect(await isFlagEnabled(testEnv.DB, "affiliate", 3_000_001)).toBe(true);
  });
});
```

Chạy: `npm test -w apps/web -- test/db/flags.test.ts` → FAIL (thiếu `db/flags.ts`).

- [ ] **Step 5: Db**

`apps/web/src/db/flags.ts` (module duy nhất ghi `feature_flags`):

```ts
import { FLAG_CACHE_TTL_MS, FLAG_KEYS, isFlagKey, type FlagKey, type FlagState } from "../domain/flags.ts";
import { auditStatement } from "./audit.ts";

type Snapshot = { at: number; flags: FlagState };
// One snapshot per isolate (addendum §3.1: cache 60 s). Another isolate sees a change within one TTL.
let snapshot: Snapshot | null = null;

export function resetFlagCache(): void {
  snapshot = null;
}

/** Reads every flag straight from D1 (no cache). Keys with no row are off; rows with an unknown key are ignored. */
export async function readFlags(db: D1Database): Promise<FlagState> {
  const { results } = await db.prepare("SELECT key, enabled FROM feature_flags").all<{ key: string; enabled: number }>();
  const flags = Object.fromEntries(FLAG_KEYS.map((key) => [key, false])) as FlagState;
  for (const row of results) if (isFlagKey(row.key) && row.enabled === 1) flags[row.key] = true;
  return flags;
}

/**
 * The flag as most callers need it: cached for FLAG_CACHE_TTL_MS. When D1 cannot be read the flag is off (fail closed)
 * and nothing is cached, so the next call tries again.
 */
export async function isFlagEnabled(db: D1Database, key: FlagKey, now: number = Date.now()): Promise<boolean> {
  if (!snapshot || now < snapshot.at || now - snapshot.at >= FLAG_CACHE_TTL_MS) {
    try {
      snapshot = { at: now, flags: await readFlags(db) };
    } catch (err) {
      console.error(JSON.stringify({ event: "flags.read_failed", error: String(err) }));
      return false;
    }
  }
  return snapshot.flags[key];
}

/**
 * Turns a flag on or off and audits it in the same batch. Atomic: the upsert only changes a row whose value differs (a flag
 * with no row is off, so turning it off inserts nothing), and the audit row is written only when that upsert changed the row.
 * Setting the value a flag already has writes nothing.
 */
export async function setFlag(
  db: D1Database,
  input: { key: FlagKey; enabled: boolean; actorUserId: string; now: string },
): Promise<{ changed: boolean }> {
  const value = input.enabled ? 1 : 0;
  const [upsert] = await db.batch<{ key: string }>([
    db
      .prepare(
        `INSERT INTO feature_flags (key, enabled, updated_by, updated_at)
         SELECT ?1, ?2, ?3, ?4 WHERE ?2 = 1 OR EXISTS (SELECT 1 FROM feature_flags WHERE key = ?1)
         ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at
         WHERE feature_flags.enabled != excluded.enabled
         RETURNING key`,
      )
      .bind(input.key, value, input.actorUserId, input.now),
    auditStatement(
      db,
      { actorUserId: input.actorUserId, action: "flag.set", entity: "feature_flag", entityId: input.key, data: { enabled: input.enabled }, now: input.now },
      { flagKey: input.key, enabled: value, updatedAt: input.now, updatedBy: input.actorUserId },
    ),
  ]);
  snapshot = null;
  return { changed: (upsert?.results.length ?? 0) > 0 };
}
```

Chạy: `npm test -w apps/web -- test/db/flags.test.ts` → PASS.

- [ ] **Step 6: Test admin (fail)**

`apps/web/test/admin/flags.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { readFlags, resetFlagCache } from "../../src/db/flags.ts";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const send = (req: Request) => app().request(req, undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });

describe("/admin/flags (addendum §3.6)", () => {
  beforeEach(async () => {
    await testEnv.DB.prepare("DELETE FROM feature_flags").run();
    resetFlagCache();
  });

  it("is for admins only", async () => {
    const { cookie } = await signIn("flags-user@vnx.si");
    expect((await send(getReq("/admin/flags", cookie))).status).toBe(403);
    expect((await send(formPost("/admin/flags/affiliate", { enabled: "1" }, { cookie }))).status).toBe(403);
    await makeBuilder("flags-builder@vnx.si", "flags-builder", "approved");
    const b = await signIn("flags-builder@vnx.si");
    expect((await send(getReq("/admin/flags", b.cookie))).status).toBe(403);
    expect((await send(getReq("/admin/flags"))).status).toBe(303);
  });

  it("lists the seven flags, all off, with no-store", async () => {
    const { cookie } = await admin();
    const res = await send(getReq("/admin/flags", cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    for (const key of FLAG_KEYS) expect(html, key).toContain(`/admin/flags/${key}`);
    expect(html).toContain('<meta name="robots" content="noindex"');
  });

  it("turns a flag on and off, audits each change, and rejects cross-site and bad input", async () => {
    const { cookie, user } = await admin();
    const on = await send(formPost("/admin/flags/affiliate", { enabled: "1" }, { cookie }));
    expect(on.status).toBe(303);
    expect(on.headers.get("location")).toBe("/admin/flags?done=1");
    expect((await readFlags(testEnv.DB)).affiliate).toBe(true);

    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'flag.set' AND entity_id = 'affiliate'").first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ enabled: true });

    expect((await send(formPost("/admin/flags/affiliate", { enabled: "0" }, { cookie }))).status).toBe(303);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);

    expect((await send(formPost("/admin/flags/affiliate", { enabled: "yes" }, { cookie }))).status).toBe(400);
    expect((await send(formPost("/admin/flags/nope", { enabled: "1" }, { cookie }))).status).toBe(404);
    expect((await send(formPost("/admin/flags/affiliate", { enabled: "1" }, { cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);
  });

  it("shows the flag state it read from D1, not the cache", async () => {
    const { cookie } = await admin();
    await send(formPost("/admin/flags/content_indexing", { enabled: "1" }, { cookie }));
    const html = await (await send(getReq("/admin/flags", cookie))).text();
    expect(html).toMatch(/content_indexing[\s\S]*?data-state="on"/);
  });

  it("works in every locale prefix", async () => {
    const { cookie } = await admin();
    for (const prefix of ["/vi", "/zh-hans", "/zh-hant"]) expect((await send(getReq(`${prefix}/admin/flags`, cookie))).status, prefix).toBe(200);
  });
});
```

Chạy: `npm test -w apps/web -- test/admin/flags.test.ts` → FAIL (404 / thiếu module).

- [ ] **Step 7: Route, view, nav, đăng ký**

`apps/web/src/routes/admin-flags.tsx`:

```tsx
import type { Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { readFlags, setFlag } from "../db/flags.ts";
import { isFlagKey } from "../domain/flags.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { FlagsPage } from "../views/admin/FlagsPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerAdminFlagRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/flags", requireAdmin, async (c) =>
    page(c, <FlagsPage locale={c.get("locale")} origin={requestOrigin(c)} flags={await readFlags(c.env.DB)} done={c.req.query("done") === "1"} />),
  );

  onLocalized(app, "post", "/admin/flags/:key", requireAdmin, async (c) => {
    const key = c.req.param("key") ?? "";
    if (!isFlagKey(key)) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const enabled = body.enabled === "1" ? true : body.enabled === "0" ? false : null;
    if (enabled === null) return c.text("Bad request", 400);
    await setFlag(c.env.DB, { key, enabled, actorUserId: c.get("user")!.id, now: new Date().toISOString() });
    return c.redirect(localizedPath(c.get("locale"), "/admin/flags?done=1"), 303);
  });
}
```

`apps/web/src/views/admin/FlagsPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { FLAG_KEYS, type FlagKey, type FlagState } from "../../domain/flags.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";

const DESC: Record<FlagKey, MessageKey> = {
  affiliate: "flags.desc.affiliate",
  partner_referral: "flags.desc.partner_referral",
  sponsored_listings: "flags.desc.sponsored_listings",
  ads: "flags.desc.ads",
  lead_generation: "flags.desc.lead_generation",
  ai_content: "flags.desc.ai_content",
  content_indexing: "flags.desc.content_indexing",
};

export const FlagsPage: FC<{ locale: Locale; origin: string; flags: FlagState; done: boolean }> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("flags.title")} rest="/admin/flags" active="flags">
      <h1>{tr("flags.title")}</h1>
      <p>{tr("flags.intro")}</p>
      <p class="muted">{tr("flags.cacheNote")}</p>
      {p.done ? (
        <p class="notice good" role="status">
          {tr("flags.done")}
        </p>
      ) : null}
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>{tr("flags.col.flag")}</th>
              <th>{tr("flags.col.state")}</th>
              <th>{tr("flags.col.what")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {FLAG_KEYS.map((key) => {
              const on = p.flags[key];
              return (
                <tr>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>{on ? tr("flags.on") : tr("flags.off")}</td>
                  <td>{tr(DESC[key])}</td>
                  <td>
                    <form method="post" action={localizedPath(p.locale, `/admin/flags/${key}`)}>
                      <input type="hidden" name="enabled" value={on ? "0" : "1"} />
                      <button class="btn" type="submit" data-state={on ? "on" : "off"}>
                        {on ? tr("flags.turnOff") : tr("flags.turnOn")}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};
```

`AdminLayout.tsx`: `AdminSection` thêm `"flags"`; `NAV` thêm `{ key: "flags", path: "/admin/flags", label: "admin.nav.flags" }` sau `users`. `app.ts`: import `registerAdminFlagRoutes` từ `./routes/admin-flags.tsx` và gọi `registerAdminFlagRoutes(app);` sau `registerUserAdminRoutes(app);`.

i18n (nối vào cuối mỗi file, trước `}` / `} as const`; mọi khóa có đủ 4 locale, test `i18n/parity`):

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `admin.nav.flags` | Flags | Cờ | 开关 | 開關 |
| `flags.title` | Feature flags | Cờ tính năng | 功能开关 | 功能開關 |
| `flags.intro` | Each revenue source and the content index has a switch. A flag with no setting is off. | Mỗi nguồn doanh thu và việc index nội dung có một công tắc. Cờ chưa đặt là tắt. | 每个收入来源和内容收录都有一个开关。未设置的开关为关闭。 | 每個收入來源和內容收錄都有一個開關。未設定的開關為關閉。 |
| `flags.cacheNote` | A change reaches every server within 60 seconds. | Thay đổi có hiệu lực trên mọi máy chủ trong vòng 60 giây. | 更改会在 60 秒内对所有服务器生效。 | 變更會在 60 秒內對所有伺服器生效。 |
| `flags.done` | Saved. | Đã lưu. | 已保存。 | 已儲存。 |
| `flags.col.flag` | Flag | Cờ | 开关 | 開關 |
| `flags.col.state` | State | Trạng thái | 状态 | 狀態 |
| `flags.col.what` | What it controls | Điều khiển gì | 控制内容 | 控制內容 |
| `flags.on` | On | Bật | 开 | 開 |
| `flags.off` | Off | Tắt | 关 | 關 |
| `flags.turnOn` | Turn on | Bật | 开启 | 開啟 |
| `flags.turnOff` | Turn off | Tắt | 关闭 | 關閉 |
| `flags.desc.affiliate` | Tracking on /go/ links of affiliate programs. | Theo dõi trên link /go/ của chương trình affiliate. | 联盟营销计划的 /go/ 链接跟踪。 | 聯盟行銷計畫的 /go/ 連結追蹤。 |
| `flags.desc.partner_referral` | Tracking on /go/ links of referral and revenue-share programs. | Theo dõi trên link /go/ của chương trình giới thiệu và chia sẻ doanh thu. | 推荐和收入分成计划的 /go/ 链接跟踪。 | 推薦和收入分成計畫的 /go/ 連結追蹤。 |
| `flags.desc.sponsored_listings` | Sponsored placements (not built yet). | Ô tài trợ (chưa làm). | 赞助位（尚未开发）。 | 贊助位（尚未開發）。 |
| `flags.desc.ads` | Advertising (not built yet). | Quảng cáo (chưa làm). | 广告（尚未开发）。 | 廣告（尚未開發）。 |
| `flags.desc.lead_generation` | Paid leads (not built yet). | Lead trả phí (chưa làm). | 付费线索（尚未开发）。 | 付費線索（尚未開發）。 |
| `flags.desc.ai_content` | AI-drafted articles (not built yet). | Bài do AI viết nháp (chưa làm). | AI 起草的文章（尚未开发）。 | AI 起草的文章（尚未開發）。 |
| `flags.desc.content_indexing` | Lets search engines index tool pages and articles marked indexable. | Cho công cụ tìm kiếm index trang công cụ và bài viết được đánh dấu indexable. | 允许搜索引擎收录标记为可收录的工具页和文章。 | 允許搜尋引擎收錄標記為可收錄的工具頁和文章。 |

Chạy: `npm test -w apps/web -- test/admin/flags.test.ts test/i18n/parity.test.ts` → PASS.

- [ ] **Step 8: Test kiến trúc (fail rồi pass)**

Trong `apps/web/test/architecture.test.ts`: thêm vào `WRITERS` dòng `feature_flags: "../src/db/flags.ts",`. Thêm cuối file:

```ts
// ADR-007 rule 2: ranking and suggestion code never reads money. Tables and modules of the monetization module.
const MONEY_TABLES = ["merchants", "partner_programs", "offers", "conversions", "revenue_entries", "outbound_clicks"];
const MONEY_DB = ["merchants", "programs", "offers", "conversions", "revenue", "clicks"];
// Every file that ranks, searches or suggests. Add a file here when it starts to order results.
const RANKING_FILES = [
  "../src/domain/catalog.ts",
  "../src/domain/directory.ts",
  "../src/domain/request.ts",
  "../src/db/catalog.ts",
  "../src/db/directory.ts",
  "../src/db/requests.ts",
  "../src/routes/catalog.tsx",
  "../src/routes/directory.tsx",
  "../src/views/CatalogPage.tsx",
  "../src/views/DirectoryPage.tsx",
  "../src/routes/admin-requests.tsx",
  "../src/views/admin/RequestDetailPage.tsx",
];

// Allowlist: only these files may import a monetization db module or run SQL on a money table. Starts empty; each task adds
// the files it creates (Task 2: db/{merchants,programs,offers}.ts; Task 3: routes/admin-merchants.tsx; Task 4: db/clicks.ts,
// routes/go.ts, jobs/daily.ts; Task 5: routes/tools.tsx, routes/seo.ts; Task 6: routes/legal.tsx).
const MONEY_ALLOWED = new Set<string>([]);

describe("ranking never reads money (ADR-007 rule 2, ADR-004)", () => {
  it("lists only files that exist", () => {
    for (const file of RANKING_FILES) expect(sources[file], file).toBeDefined();
  });

  it("ranking files import no monetization db module", () => {
    for (const file of RANKING_FILES) {
      for (const name of MONEY_DB) {
        expect(sources[file], `${file} imports db/${name}`).not.toMatch(new RegExp(`from\\s+["'][^"']*/db/${name}\\.ts["']`));
      }
    }
  });

  it("ranking files have no SQL on a money table", () => {
    for (const file of RANKING_FILES) {
      for (const table of MONEY_TABLES) {
        expect(sources[file], `${file} reads ${table}`).not.toMatch(new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`));
      }
    }
  });

  it("only allowlisted files import a money db module or touch a money table", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (MONEY_ALLOWED.has(file)) continue;
      for (const name of MONEY_DB) expect(src, `${file} imports db/${name}`).not.toMatch(new RegExp(`from\\s+["'][^"']*/db/${name}\\.ts["']`));
      for (const table of MONEY_TABLES) expect(src, `${file} touches ${table}`).not.toMatch(new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`));
    }
  });

  it("has no partner name in src (ADR-007 rule 4)", () => {
    for (const [file, src] of Object.entries(sources)) expect(src, file).not.toMatch(/elevenlabs|partnerstack/i);
  });
});
```

Ghi chú: `MONEY_DB` không có `flags` có chủ ý (cờ `sponsored_listings` sẽ được catalog đọc ở EPIC 23 theo ADR-008, nên không đưa vào danh sách cấm).

Chạy: `npm test -w apps/web -- test/architecture.test.ts` → PASS (kể cả bài "writes each table only from its owning module" với `feature_flags` trong `db/flags.ts`). Kiểm các bài test thật sự bắt lỗi: tạm thêm `const x = "SELECT 1 FROM offers";` vào `src/db/catalog.ts`, chạy lại phải FAIL (cả bài danh sách xếp hạng lẫn bài danh sách cho phép); tạm thêm chuỗi `// elevenlabs` vào một file `src/` cũng phải FAIL; rồi **hoàn tác ngay** (không commit).

- [ ] **Step 9: Kiểm toàn bộ và commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/migrations/0010_feature_flags.sql apps/web/src/domain/flags.ts apps/web/src/db/flags.ts apps/web/src/db/audit.ts apps/web/src/routes/admin-flags.tsx apps/web/src/views/admin/FlagsPage.tsx apps/web/src/views/admin/AdminLayout.tsx apps/web/src/app.ts apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/architecture.test.ts apps/web/test/domain/flags.test.ts apps/web/test/db/flags.test.ts apps/web/test/admin/flags.test.ts apps/web/wrangler.jsonc
git commit -m "feat(web): feature flags with 60 s cache and /admin/flags; ranking-never-reads-money architecture test (VNX-2101)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận:**
- `npm test -w apps/web -- test/domain/flags.test.ts test/db/flags.test.ts test/admin/flags.test.ts test/architecture.test.ts test/i18n/parity.test.ts` xanh.
- `npm run typecheck -w apps/web` và `npm test` xanh.
- `grep -c "CHECK (key" apps/web/migrations/0010_feature_flags.sql` in 0 (không enum key trong SQL).
- Diff ≲ 600 dòng không tính 4 file locale (ước tính: migration 10, domain 20, db 55, route 30, view 60, nav/app 6, test ~230).

---

### Task 2: VNX-2102a — Migration, domain và db của merchant / chương trình / offer

**Phạm vi:** Migration `apps/web/migrations/0011_partners.sql` tạo `merchants`, `partner_programs`, `offers` đúng cột phụ lục 3.2 (không DEFAULT cho `commission_model`, `commission_rate_bps`, `commission_flat_minor`, `currency`, `cookie_days`; `CHECK (status != 'active' OR (terms_url IS NOT NULL AND terms_verified_at IS NOT NULL AND type != 'direct'))` trên `partner_programs`; `CHECK (program_id IS NULL OR tracking_template IS NOT NULL)` trên `offers`; `merchants.website_url` bắt buộc; `merchants.slug` unique; `merchants.default_offer_id` không FK để tránh vòng, kiểm ở db; `offers.subject_type` CHECK `product|merchant|article` nhưng lát mỏng chỉ tạo `merchant`; chỉ mục `offers(subject_type, subject_id, status)`, `partner_programs(merchant_id)`). Domain thuần: `domain/merchant.ts` (`RESERVED_MERCHANT_SLUGS`, `parseMerchantForm`, `parseAllowedHosts`, enum trạng thái), `domain/offer-url.ts` (`validateFinalUrl`, `hostAllowed`, `parseTemplate`, `fillTemplate`, `PLACEHOLDERS`, `previewUrl`), `domain/offer.ts` (`parseProgramForm` + luật `active` cần `terms_url`/`terms_verified_at`, `parseOfferForm`, `LABELS`, `OFFER_KINDS`, `flagForProgram`, `appendUtm`, `resolveOfferRedirect` trả `tracked | fallback | not_found` theo Quyết định thiết kế 6–10, 18–19; `fallback` mang `website_url` của merchant; `LABELS` gồm `try_it`). Db: `db/merchants.ts`, `db/programs.ts`, `db/offers.ts` (mỗi file duy nhất ghi bảng của nó; ghi cùng audit trong `db.batch`; `setDefaultOffer` chỉ nhận offer `subject_type = merchant` của đúng merchant; truy vấn đọc cho route `/go` và `/tools`: `findMerchantBySlug`, `findOfferWithContext(offerId)`, `findDefaultOfferContext(merchantId)`, `listActiveMerchantOffers(merchantId, now)`, `listActiveProgramMerchants`). Mở rộng test kiến trúc: ba bảng vào `WRITERS`; test "domain không import db" tự bao phủ.

**Files (dự kiến):** Create `migrations/0011_partners.sql`, `src/domain/{merchant,offer-url,offer}.ts`, `src/db/{merchants,programs,offers}.ts`; Modify `test/architecture.test.ts`, `wrangler.jsonc`, `test/fixtures.ts` (`makeMerchant`, `makeProgram`, `makeOffer`). Test: `test/domain/{merchant,offer-url,offer}.test.ts`, `test/db/{merchants,programs,offers}.test.ts`, `test/migrations/partners.test.ts` (grep không DEFAULT; CHECK `active`).

**Tiêu chí chấp nhận:**
- Mọi ca Review Focus 1, 2 ở tầng domain có test (`validateFinalUrl`): userinfo, `evilelevenlabs.io`, `elevenlabs.io.evil.com`, `http:`, `javascript:`, `data:`, `//evil.com`, `https:evil.com`, `https:///evil.com`, `HTTPS://…` (scheme viết hoa, bị từ chối), `\\`, CR/LF / tab / khoảng trắng thô, `%0d%0a`, `%2e` trong host, chữ rộng và `。`, IPv4 thập phân / hex (`0x7f.1`) / bát phân (`0177.0.0.1`) / thập phân gộp, `[::1]`, `[::ffff:127.0.0.1]`, `localhost`, `a.localhost`, `:443` **được chấp nhận**, `:8443` bị từ chối, dấu chấm cuối, host một nhãn, > 2048; template (placeholder lạ, `{` lẻ, placeholder trong host kể cả `https://a.{src}.io/`, giá trị được mã hóa); `allowed_hosts` (định dạng, nhãn cuối có chữ cái, ≤ 20, trùng); `program.merchant_id` khác merchant của offer → từ chối; slug `p`, `o` và `SLUG_RE`; `appendUtm` (gắn khi chưa có `utm_*`, không gắn khi đã có bất kỳ `utm_*`).
- `resolveOfferRedirect` có test bảng cho từng tổ hợp: cờ bật/tắt theo `type`, chương trình `draft|active|paused|ended`, offer `active|paused|archived` và ngoài `starts_at`/`ends_at`, merchant `active|paused|archived`, offer không chương trình, `destination_url` hợp lệ / không hợp lệ.
- Offer có `program_id` mà không có `tracking_template` bị từ chối (domain và CHECK DB); `destination_url` bằng URL đã chuẩn hóa của template bị từ chối; chương trình `type = direct` chuyển `active` bị từ chối ở domain và CSDL (test cả hai); offer `try_it` hợp lệ.
- Review Focus 6: INSERT chương trình `active` thiếu `terms_url` hoặc `terms_verified_at` bị CSDL từ chối; `grep -inE "DEFAULT" apps/web/migrations/0011_partners.sql` không có dòng nào thuộc các cột điều khoản.
- Ghi bảng chỉ từ module sở hữu (`npm test -w apps/web -- test/architecture.test.ts`).
- Không có route, không có view. Diff ≲ 600 dòng (domain ~250, db ~200, migration ~50, fixtures ~40). Nếu domain + db vượt, tách `offer-url.ts` + `resolveOfferRedirect` thành 2102a1 và phần còn lại 2102a2.
- `npm run typecheck -w apps/web` và `npm test` xanh. Commit `feat(web): partner schema, URL validation and offer resolution (VNX-2102a)`.

**Việc để Planner chi tiết hóa ngay trước khi làm:** chữ ký hàm thật theo `db/requests.ts` (kiểu `Guard`, batch + audit), cách `makeBuilder`-style fixtures, danh sách `ErrorKind`.

---

### Task 3: VNX-2102b — Admin merchant, chương trình, offer

**Phạm vi:** `routes/admin-merchants.tsx` và các view `views/admin/{MerchantsPage,MerchantDetailPage}.tsx`: danh sách merchant; tạo merchant (tên, slug, website_url https, `allowed_hosts`, mô tả văn bản thuần ≤ giới hạn spec 8.6, `indexable`, trạng thái); trang chi tiết có ba khu: merchant (sửa, đổi `status`), chương trình (tạo / sửa các trường điều khoản, không mặc định, nhập `terms_url`, `terms_verified_at`; nút chuyển `active` hiển thị lỗi rõ khi thiếu), offer (tạo / sửa `kind`, `label`, `destination_url`, `tracking_template`, `starts_at`, `ends_at`, `status`; nút "đặt làm offer mặc định"). **Xem trước URL cuối** cho từng offer: gọi `previewUrl` với `click_id` mẫu (`01HZZZZZZZZZZZZZZZZZZZZZZZ`), `locale = en`, `src = tools` và hiện cả kết quả `resolveOfferRedirect` ở trạng thái hiện tại (tracked / fallback / not_found, kèm lý do dạng khóa i18n). Kiểm host và template lúc lưu qua domain Task 2, lỗi hiện cạnh trường. Mọi ghi dùng db Task 2 và audit `merchant.*`, `program.*`, `offer.*`. Mục nav `merchants` trong `AdminLayout`. Không có trang public.

**Files (dự kiến):** Create `src/routes/admin-merchants.tsx`, `src/views/admin/{MerchantsPage,MerchantDetailPage}.tsx`; Modify `src/app.ts`, `src/views/admin/AdminLayout.tsx`, 4 file locale; Test `test/admin/merchants.test.ts`.

**Tiêu chí chấp nhận:**
- Chỉ admin (403 người thường và builder; 303 chưa đăng nhập); POST sai Origin → 403; mọi trang `Cache-Control: no-store` và `noindex`.
- Tạo merchant với slug `p`, `o`, slug sai định dạng, trùng slug → lỗi trường, không ghi dòng; `allowed_hosts` sai định dạng → lỗi.
- Lưu offer có host ngoài `allowed_hosts`, template có placeholder lạ, `destination_url` `http:` → lỗi, không ghi dòng (Review Focus 2 ở tầng admin).
- Chương trình sang `active` khi thiếu `terms_url` hoặc `terms_verified_at` → lỗi hiển thị, trạng thái không đổi (Review Focus 6).
- Đặt offer mặc định của merchant khác → 404, không ghi gì.
- Mỗi thao tác ghi đúng một dòng `audit_log` (`merchant.create`, `program.status`, `offer.update`, …).
- Xem trước hiện URL tracking và URL fallback (`website_url`) cạnh nhau, đúng khi cờ bật và khi cờ tắt; nhãn của `destination_url` trên form là "Untracked link" (4 locale).
- Offer có chương trình lưu không có template → lỗi trường; `destination_url` trùng template chuẩn hóa → lỗi; chương trình `direct` sang `active` → lỗi hiển thị.
- Nhập thử dữ liệu ElevenLabs: `destination_url = https://elevenlabs.io`, template `https://try.elevenlabs.io/7fnly5cv33k3`, `allowed_hosts = try.elevenlabs.io, elevenlabs.io`, `label = try_it`, đặt làm mặc định → lưu được.
- `npm run typecheck -w apps/web`, `npm test` xanh. Diff ≲ 600 dòng không tính locale; nếu vượt, tách 3a (merchant + chương trình) / 3b (offer + xem trước). Commit `feat(web): admin merchants, programs and offers with final-URL preview (VNX-2102b)`.

---

### Task 4: VNX-2103 — `/go/` và `outbound_clicks`

**Lưu ý:** Privacy (`docs/legal/privacy.md`, `src/legal/content.ts`) phải theo bản `main` mới, đã có các dòng của form liên hệ.

**Phạm vi:** Migration `0012_outbound_clicks.sql` đúng phụ lục 2.2 (`id`, `product_id`, `offer_id`, `link_kind` CHECK `demo|site|offer`, `src`, `locale`, `visitor_hash`, `country`, `referrer_host`, `is_bot`, `created_at`; CHECK `product_id IS NOT NULL OR offer_id IS NOT NULL`; ba chỉ mục của phụ lục; không cột IP / email / user). `db/clicks.ts` (duy nhất ghi `outbound_clicks`; `recordClick`; `purgeOldClicks(db, now)` theo `OUTBOUND_CLICK_RETENTION_DAYS`). `domain/outbound.ts` (`parseSrc`, `isBotRequest`, `referrerHost`, `localeFromReferer`, `OUTBOUND_CLICK_RETENTION_DAYS`). `routes/go.ts`: `GET|HEAD /go/o/:offerId`, `GET|HEAD /go/:merchantSlug` (slug `p` / `o` / lạ / merchant không `active` / không offer mặc định → 404; xếp đúng thứ tự khai báo để `/go/o/:offerId` thắng `/go/:merchantSlug`), `app.all("/go/*")` → 405 cho method khác. Dùng `resolveOfferRedirect` (Task 2) với `isFlagEnabled` (Task 1), điền template bằng `click_id = ulid()`, ghi click qua `defer(c, promise)` (thử `c.executionCtx.waitUntil`, nếu không có thì `await`, lỗi chỉ log). Header theo Global Constraints. Cron: `jobs/daily.ts` gọi `purgeOldClicks`. Privacy: chép mục C vào `src/legal/content.ts` (Reviewer đã cập nhật `docs/legal/privacy.md` trước task này). `robots.txt` đã có `Disallow: /go/` (chỉ thêm test hồi quy).

**Files (dự kiến):** Create `migrations/0012_outbound_clicks.sql`, `src/domain/outbound.ts`, `src/db/clicks.ts`, `src/routes/go.ts`; Modify `src/app.ts`, `src/jobs/daily.ts`, `src/legal/content.ts`, `wrangler.jsonc`, `test/architecture.test.ts` (`outbound_clicks` vào `WRITERS`); Test `test/domain/outbound.test.ts`, `test/monetization/go.test.ts`, `test/jobs/clicks-purge.test.ts`, mở rộng `test/legal/content.test.ts` và `test/seo/robots.test.ts`.

**Tiêu chí chấp nhận (`test/monetization/go.test.ts` bao phủ đúng danh sách ADR-007 "Được bảo đảm bởi" và Review Focus 1, 2, 3, 7):**
- Open redirect: `/go/https://evil.com`, `/go/%2F%2Fevil.com`, `?src=https://evil.com`, `?url=…`, `?next=…`, `\`, CR/LF trong slug và query → `Location` chưa bao giờ chứa host ngoài `allowed_hosts`; query lạ bị bỏ qua.
- Dữ liệu hỏng trong DB (`destination_url` có userinfo / `http:` / IP / host lạ, template điền ra host lạ) → 404 hoặc `fallback` hợp lệ, không bao giờ redirect tới URL không qua kiểm.
- Offer `paused`, hết hạn, chương trình `draft` / `paused` / `direct`, merchant `paused`, cờ tắt → redirect `fallback` tới `merchants.website_url` hợp lệ, không UTM của template, **có** một dòng `outbound_clicks` (không có `click_id` trong `Location`); `website_url` không hợp lệ → 404, không ghi. Offer / merchant `archived` hoặc không tồn tại → 404, không ghi. Cờ bật → `Location` = `new URL(template đã điền).href`, dòng click có `id` = `click_id` trong URL (khi template có `{click_id}`).
- `/go/o/:offerId`: id không đúng dạng ULID (`^[0-9A-HJKMNP-TV-Z]{26}$`) → 404 trước khi đọc D1 (test bằng DB giả ném lỗi khi bị gọi).
- UTM dương tính ở tầng domain (`appendUtm`, vì lát mỏng không có offer không chương trình): offer không chương trình được gắn `utm_source=vnx.si&utm_medium=referral`, không gắn khi URL đã có `utm_*`; `fallback` tới `website_url` được gắn UTM theo cùng luật.
- Cache 60 s: đổi cờ trực tiếp trong D1 không đổi hành vi trong 60 s (dùng `resetFlagCache` / tiêm `now` ở tầng hàm; ở tầng route kiểm bằng `setFlag` xóa cache).
- Header `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin` trên mọi 302, kể cả `fallback`; 404 và 405 đúng; `HEAD` redirect không ghi click; POST `/go/…` có Origin hợp lệ → 405 và `Allow: GET, HEAD`.
- Click: một dòng mỗi GET `tracked` hoặc `fallback` (không có dòng cho 404, 405, HEAD); `src` ngoài enum → `unknown`; `locale` từ `Referer` cùng host (vi → `vi`), khác host hoặc không có → `en`; `referrer_host` chỉ host (không path, không query); `country` từ `request.cf.country` nếu có; `visitor_hash` null; bot (UA rỗng, `Googlebot`, `curl`) → `is_bot = 1` và vẫn redirect, vẫn ghi dòng; test schema: bảng không có cột `ip`, `email`, `user_id`.
- Ghi bằng `waitUntil`: test truyền `ExecutionContext` giả, kiểm response trả về trước khi promise ghi chạy xong, và click vẫn ghi sau khi `await` các promise đã đăng ký; lỗi ghi không đổi response.
- Cron xóa: dòng cũ hơn ngưỡng bị xóa, dòng mới giữ; chạy hai lần không đổi kết quả.
- Privacy: `test/legal/content.test.ts` xanh với `docs/legal/privacy.md` đã cập nhật (mục C); `LEGAL_UPDATED_AT` được tăng (hằng dùng chung với Terms, nên ngày của cả Terms và Privacy đổi; `{date}` trong `terms.md` và `privacy.md` vẫn khớp vì cùng hằng); `robots.txt` vẫn có `Disallow: /go/`.
- Trang site thường (`/`, `/products`, `/p/…`) **không** có `Referrer-Policy: origin` (hồi quy: chỉ `/go/` đặt header này).
- Danh sách cho phép của test kiến trúc thêm `db/clicks.ts`, `routes/go.ts`, `jobs/daily.ts`; `outbound_clicks` vào `WRITERS`.
- `test/monetization/conversions.test.ts` của ADR-007 hoãn tới VNX-2105+ (lát mỏng không có conversion); Reviewer ghi vào `CURRENT-STATUS.md`.
- Cron xóa dùng `OUTBOUND_CLICK_RETENTION_DAYS = 395`.
- `npm run typecheck -w apps/web`, `npm test` xanh. Task này HIGH-RISK: Reviewer chạy lại toàn bộ test `go` và đọc từng dòng `routes/go.ts` khi review. Diff ≲ 600 dòng không tính locale; nếu vượt, tách 4a (migration + db + domain + cron) / 4b (route + test). Commit `feat(web): /go/ redirects, outbound click log and retention (VNX-2103)`.

---

### Task 5: VNX-2104a — `/tools/:slug`, khối offer, disclosure, sitemap

**Lưu ý:** Layout, header, footer và `app.css` đã đổi trên `main` (thiết kế lại); mọi chỗ chạm footer / layout phải theo `main` mới và giữ xanh `test/design/layout.test.ts` (link header / footer) và `test/design/assets.test.ts` (không request bên thứ ba ngoài Turnstile).

**Phạm vi:** `routes/tools.tsx` (`onLocalized` GET `/tools/:slug`), `views/ToolPage.tsx`, `views/Disclosure.tsx` (khối câu disclosure + link `/disclosure`, dùng chung cho các trang khác sau này), hàm thuần `showsDisclosure(offers)` trong `domain/offer.ts`. Trang: tên merchant, mô tả `PlainText`, danh sách offer `active` trong thời hạn (nút theo `label` qua `t()`, đích `/go/:merchantSlug` cho offer mặc định và `/go/o/:offerId?src=tools` cho offer khác; offer mặc định cũng thêm `?src=tools`), khối disclosure khi có offer có chương trình, JSON-LD không bắt buộc ở lát mỏng. 404 khi merchant không tồn tại hoặc không `active`. `noindex` theo Global Constraints. Sitemap: `routes/seo.ts` thêm `/tools/:slug` khi `active` + `indexable = 1` + cờ `content_indexing` bật (đọc cờ qua `isFlagEnabled`; thêm `listSitemapMerchants` vào `db/merchants.ts`). Footer: không đổi ở task này (link `/disclosure` đi kèm Task 6). i18n nhãn offer (khóa `offer.label.<label>`, đủ 4 locale): `learn_more` = Learn more about {name} / Tìm hiểu thêm về {name} / 了解 {name} / 瞭解 {name}; `get_started` = Get started with {name} / Bắt đầu với {name} / 开始使用 {name} / 開始使用 {name}; `start_trial` = Start a trial with {name} / Bắt đầu dùng thử {name} / 开始试用 {name} / 開始試用 {name}; `visit_site` = Visit {name} / Truy cập {name} / 访问 {name} / 前往 {name}; **`try_it` = Try {name} / Dùng thử {name} / 试用 {name} / 試用 {name}** (Owner 2026-10-05; offer mặc định của ElevenLabs); câu disclosure A (4 locale, đã Owner duyệt), "Learn more", chuỗi trang. Không có Buy / Customize / Hire.

**Files (dự kiến):** Create `src/routes/tools.tsx`, `src/views/ToolPage.tsx`, `src/views/Disclosure.tsx`; Modify `src/domain/offer.ts`, `src/db/merchants.ts`, `src/routes/seo.ts`, `src/app.ts`, 4 file locale, `test/architecture.test.ts` (nếu thêm file xếp hạng: không); Test `test/monetization/tools.test.ts`, `test/domain/disclosure.test.ts`, mở rộng `test/seo/sitemap.test.ts`.

**Tiêu chí chấp nhận:**
- Review Focus 4: có offer có `program_id` → HTML chứa câu disclosure đúng 4 locale, link `/disclosure` và `rel="sponsored noopener"` trên chính link đó; chỉ offer không chương trình → không câu, không `sponsored`; không offer → không khối offer, không disclosure; offer `paused` / ngoài thời hạn không hiện.
- Merchant `paused` / `archived` / không tồn tại → 404 ở cả 4 locale; trang hiện không có từ Buy, Customize, Hire.
- `noindex` + không canonical khi `indexable = 0` hoặc cờ `content_indexing` tắt (đây là trạng thái ra mắt của `/tools/elevenlabs`, Owner 2026-10-05: không index, không sitemap); có canonical + hreflang 4 locale + `x-default` khi cả hai bật.
- Sitemap: ngay dưới điều kiện (thiếu một trong ba) không có `/tools/elevenlabs`; đủ ba thì có 4 dòng kèm alternate; `/tools/*` của merchant `paused` không có.
- Tên và mô tả được escape (merchant tên `<script>` không tạo markup); mô tả render theo quy tắc văn bản thuần (spec 8.6).
- Mô tả hiển thị bọc `lang="en"` trên `/vi`, `/zh-hans`, `/zh-hant`; nhãn `try_it` hiện đúng 4 locale.
- Danh sách cho phép của test kiến trúc thêm `routes/tools.tsx`, `routes/seo.ts`.
- Nút offer mặc định trỏ `/go/<slug>?src=tools`; test không có link trực tiếp tới host đối tác trong HTML (mọi link ra ngoài đi qua `/go/`).
- Kiểm tay ElevenLabs (không thuộc CI, ghi trong báo cáo): nhập qua `/admin/merchants` theo `docs/partners/registry.md`, bật `affiliate`, `/tools/elevenlabs` → `/go/elevenlabs`.
- `npm run typecheck -w apps/web`, `npm test` xanh. Diff ≲ 600 dòng không tính locale. Commit `feat(web): /tools/:slug with offers, disclosure and sitemap rule (VNX-2104a)`.

---

### Task 6: VNX-2104b — Trang `/disclosure`

**Lưu ý:** `docs/legal/privacy.md` trên `main` đã có thêm các dòng của form liên hệ; chép khối C vào bản mới đó, và footer / layout theo `main` mới (giữ xanh `test/design/layout.test.ts`, `test/design/assets.test.ts`).

**Phạm vi:** Reviewer đã tạo `docs/legal/disclosure.md` (mục B, sau khi Owner duyệt). `src/legal/content.ts` thêm `disclosure` vào `LegalPageId` / `LEGAL` (`rest: "/disclosure"`, `dated: true`) chép nguyên văn EN và VI; `routes/legal.tsx` render phần tĩnh bằng `LegalPage` và chèn khối động dưới mục 3: danh sách merchant có chương trình `active` (`listActiveProgramMerchants` của Task 2; tên → `/tools/:slug` chỉ khi merchant `active`; trống thì dòng `disclosure.noPartners`). Footer thêm link "Disclosure" (`footer.disclosure`, 4 locale) cạnh Terms / Privacy; câu disclosure ở `/tools` (Task 5) đã trỏ về đây. Sitemap thêm `/disclosure` (`localized: true`). `zh-Hans` / `zh-Hant` theo cơ chế hiện có.

**Files (dự kiến):** Modify `src/legal/content.ts`, `src/routes/legal.tsx`, `src/views/LegalPage.tsx` (nhận `children` cho khối động nếu cần), `src/views/Layout.tsx` (footer), `src/routes/seo.ts`, 4 file locale; Test mở rộng `test/legal/content.test.ts` (CASES thêm `disclosure`), `test/seo/sitemap.test.ts`, `test/monetization/disclosure-page.test.ts`.

**Tiêu chí chấp nhận:**
- `npm test -w apps/web -- test/legal/content.test.ts` xanh: trang `/disclosure` EN và VI khớp từng dòng với `docs/legal/disclosure.md`; zh-* hiện bản EN kèm câu "chỉ có bản tiếng Anh".
- Khối động: không có chương trình `active` → dòng "None at the moment." (4 locale); có chương trình `active` → tên merchant và link `/tools/<slug>`; chương trình `draft` / `paused` / merchant `paused` không xuất hiện (không liệt kê partner chưa `active`, ràng buộc của media-kit).
- `/disclosure` có trong sitemap 4 locale; có canonical và hreflang; footer có link ở 4 locale.
- `npm run typecheck -w apps/web`, `npm test` xanh. Diff ≲ 600 dòng không tính locale. Commit `feat(web): /disclosure page with active partner list (VNX-2104b)`.

Sau Task 6, nghĩa vụ để lại cho M7: (1) VNX-0707 dùng lại bảng `outbound_clicks`, `db/clicks.ts` và `routes/go.ts` của epic này, **không tạo migration thứ hai** cho bảng này (chỉ thêm `/go/p/:slug/{demo,site}`, `product_daily_stats.outbound_clicks` và `visitor_hash`); (2) migration của M7 đánh số sau số cuối của epic này (0012 nếu không đổi); (3) M7 thêm các file Trending / Top vào `RANKING_FILES` của test kiến trúc và hợp nhất `isBotRequest` với luật bot của spec 8.11; (4) giữ 13 tháng đã chốt, M7 không đặt lại; (5) M7 cập nhật câu Privacy "hiện chưa gắn mã nhận diện người xem" khi thêm `visitor_hash`. Reviewer cập nhật `.ai/context/CURRENT-STATUS.md` (trạng thái VNX-2101–2104, SHA, nghĩa vụ còn treo: Owner điền `terms_url` / `terms_verified_at`, tham số sub-id, bật cờ trên production, thứ tự deploy `0009` → `0010` → `0011`) và ghi VNX-2105–2109 vẫn để sau.
