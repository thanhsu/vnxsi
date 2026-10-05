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

### Task 2: VNX-2102a-1 — Kiểm URL, template và merchant (domain thuần)

> Backlog VNX-2102a (domain, migration, db: ≈ 1 900 dòng kể cả test) được tách thành ba commit làm liên tiếp trên cùng nhánh (Planner đề nghị): **2102a-1 = Task này** (`offer-url`, `merchant`), **2102a-2 = Task 2b** (`offer`: chương trình, offer, `resolveOfferRedirect`), **2102a-3 = Task 2c** (migration `0011_partners`, db, fixtures, nối test kiến trúc). Hàng 2 của bảng thứ tự task ở đầu file không đổi.

**Files:**
- Create: `apps/web/src/domain/offer-url.ts`, `apps/web/src/domain/merchant.ts`
- Test: `apps/web/test/domain/offer-url.test.ts`, `apps/web/test/domain/merchant.test.ts`
- Không sửa file nào khác. Không có chuỗi giao diện (mã lỗi dạng khóa được Task 3 ánh xạ sang `t()`), không có SQL, không có route.

**Interfaces:**
- Consumes (đã có trên nhánh): `SLUG_RE` (`domain/slug.ts`: `^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$`), `normalizeNewlines` (`domain/product-input.ts`).
- Produces:
  - `domain/offer-url.ts` (mỗi luật URL là một hàm thuần có tên, để test từng luật): `MAX_URL_LENGTH = 2048`, `MAX_ALLOWED_HOSTS = 20`, `PLACEHOLDERS` (`["click_id","locale","src"]`), `type Placeholder`, `type TemplateValues = Record<Placeholder, string>`, `SAMPLE_VALUES` (`click_id` = `01HZZZZZZZZZZZZZZZZZZZZZZZ`, `locale` = `en`, `src` = `tools`), `type UrlError = "length" | "chars" | "scheme" | "authority" | "parse" | "userinfo" | "port" | "host" | "not_allowed"`, `type UrlResult`, `isPrintableAscii(raw)`, `hasHttpsPrefix(raw)`, `authorityOf(raw)`, `isAuthorityClean(authority)`, `originError(url: URL): "userinfo" | "port" | null`, `isPublicHostname(hostname)`, `hostAllowed(hostname, allowed)`, `validateFinalUrl(raw, allowed): UrlResult`, `type TemplateError = "braces" | "placeholder" | "placeholder_position"`, `placeholderNames(raw)`, `fillTemplate(template, values)`, `fillAndValidate(template, values, allowed): UrlResult`, `previewUrl(template, allowed): UrlResult` (giá trị mẫu), `parseTemplate(raw, allowed)`, `appendUtm(url)`.
  - `domain/merchant.ts`: `MERCHANT_STATUSES`, `type MerchantStatus`, `RESERVED_MERCHANT_SLUGS`, `MERCHANT_NAME_MAX = 80`, `MERCHANT_DESCRIPTION_MAX = 2000`, `merchantSlugError(slug)`, `parseAllowedHosts(raw)`, `type MerchantFormValues`, `type MerchantInput`, `parseMerchantForm(values)`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. Chặt thêm một lớp so với header: `hostname` (sau `new URL`) phải gồm các nhãn LDH (`[a-z0-9]`, `-` ở giữa, ≤ 63 ký tự, tổng ≤ 253). Cùng hàm `isPublicHostname` dùng cho `allowed_hosts`, nên hai nơi không lệch. Mọi luật header vẫn là kiểm riêng, có mã lỗi riêng. Ghi chú: host có nhãn cuối toàn số và có chữ ở nhãn trước (`example.123`) bị bộ phân tích URL từ chối trước (mã `parse`); luật "nhãn cuối có chữ cái" chặn các dạng IPv4 sau khi phân tích (`0x7f.1` → `127.0.0.1`).
2. Giá trị lưu của `website_url` (và `destination_url` ở Task 2b) là `href` đã chuẩn hóa (`https://elevenlabs.io` → `https://elevenlabs.io/`); `tracking_template` lưu nguyên văn người nhập đã `trim`.
3. `RESERVED_MERCHANT_SLUGS` = `p`, `o` (header chỉ nêu hai từ này; `SLUG_RE` vốn đã loại chúng nhưng mã lỗi `reserved` vẫn được kiểm trước). `MERCHANT_DESCRIPTION_MAX = 2000` theo `bio` của builder (spec 8.6 không ghi con số; Owner đổi được).
4. `fillAndValidate` bắt `URIError` của `encodeURIComponent` (surrogate lẻ) và trả `chars`, không ném ngoại lệ. `appendUtm` giữ nguyên chuỗi query sẵn có từng byte (không dựng lại bằng `URLSearchParams`).

- [ ] **Step 1: Test `offer-url` (fail)**

`apps/web/test/domain/offer-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  appendUtm,
  authorityOf,
  fillAndValidate,
  fillTemplate,
  hasHttpsPrefix,
  hostAllowed,
  isAuthorityClean,
  isPrintableAscii,
  isPublicHostname,
  MAX_ALLOWED_HOSTS,
  MAX_URL_LENGTH,
  originError,
  parseTemplate,
  placeholderNames,
  PLACEHOLDERS,
  previewUrl,
  SAMPLE_VALUES,
  validateFinalUrl,
} from "../../src/domain/offer-url.ts";

const HOSTS = ["try.elevenlabs.io", "elevenlabs.io"];
const code = (raw: string, hosts: readonly string[] = HOSTS) => {
  const r = validateFinalUrl(raw, hosts);
  return r.ok ? "ok" : r.error;
};
const allCode = (expected: string, raws: string[]) => {
  for (const raw of raws) expect(code(raw), JSON.stringify(raw)).toBe(expected);
};

describe("constants", () => {
  it("has the three placeholders and the limits of the plan header", () => {
    expect([...PLACEHOLDERS]).toEqual(["click_id", "locale", "src"]);
    expect(MAX_URL_LENGTH).toBe(2048);
    expect(MAX_ALLOWED_HOSTS).toBe(20);
    expect(SAMPLE_VALUES).toEqual({ click_id: "01HZZZZZZZZZZZZZZZZZZZZZZZ", locale: "en", src: "tools" });
  });
});

describe("rule 1: printable ASCII [\\x21-\\x7E], no backslash, at most 2048 characters", () => {
  it("isPrintableAscii accepts URL characters and rejects everything else", () => {
    expect(isPrintableAscii("https://elevenlabs.io/a?b=c#d")).toBe(true);
    for (const bad of ["", "a b", "a\tb", "a\rb", "a\nb", "a\0b", "a\x7fb", "é", "ｅ", "a。b", "a\\b", "a​b"]) expect(isPrintableAscii(bad), JSON.stringify(bad)).toBe(false);
  });

  it("validateFinalUrl rejects space, control, non-ASCII, fullwidth, ideographic full stop and backslash as chars", () => {
    allCode("chars", [
      "",
      "https://elevenlabs.io/ x",
      "https://elevenlabs.io/\r\n",
      "https://elevenlabs.io/\tx",
      "https://elevenlabs.io/\x00",
      "https://ｅlevenlabs.io/",
      "https://elevenlabs。io/",
      "https://elevenlabs.io/é",
      "https://elevenlabs.io\\@evil.com",
      "https://elevenlabs.io/a\\b",
    ]);
  });

  it("accepts exactly 2048 characters and rejects 2049", () => {
    const base = "https://elevenlabs.io/";
    expect(code(base + "a".repeat(MAX_URL_LENGTH - base.length))).toBe("ok");
    expect(code(base + "a".repeat(MAX_URL_LENGTH - base.length + 1))).toBe("length");
  });
});

describe("rule 2: starts with lowercase https://", () => {
  it("hasHttpsPrefix is case sensitive", () => {
    expect(hasHttpsPrefix("https://a.io")).toBe(true);
    for (const bad of ["HTTPS://a.io", "Https://a.io", "http://a.io", "https:a.io", "//a.io", "a.io"]) expect(hasHttpsPrefix(bad), bad).toBe(false);
  });

  it("rejects an uppercase scheme, https:evil.com, scheme-relative, http:, javascript:, data: and ftp: as scheme", () => {
    allCode("scheme", [
      "HTTPS://elevenlabs.io/",
      "Https://elevenlabs.io/",
      "https:evil.com",
      "//evil.com",
      "http://elevenlabs.io/",
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://elevenlabs.io/",
      "elevenlabs.io",
    ]);
  });

  it("rejects https:///evil.com and an empty authority as authority", () => {
    allCode("authority", ["https:///evil.com", "https://", "https:///", "https://?x=1"]);
  });
});

describe("rule 3: the authority has no @, %, { or }", () => {
  it("authorityOf stops at the first / ? or #", () => {
    expect(authorityOf("https://a.io/p?q#f")).toBe("a.io");
    expect(authorityOf("https://a.io?q")).toBe("a.io");
    expect(authorityOf("https://a.io#f")).toBe("a.io");
    expect(authorityOf("https://a.io:443")).toBe("a.io:443");
  });

  it("isAuthorityClean", () => {
    expect(isAuthorityClean("elevenlabs.io")).toBe(true);
    expect(isAuthorityClean("elevenlabs.io:443")).toBe(true);
    for (const bad of ["", "u@a.io", "a.io@evil.com", "a%2eio", "{src}.a.io", "a.io}"]) expect(isAuthorityClean(bad), bad).toBe(false);
  });

  it("rejects userinfo, %2e in the host and a placeholder in the host as authority", () => {
    allCode("authority", [
      "https://elevenlabs.io@evil.com/",
      "https://user:pw@elevenlabs.io/",
      "https://elevenlabs.io:443@evil.com/",
      "https://elevenlabs%2eio/",
      "https://elevenlabs.io%2f@evil.com/",
      "https://%65levenlabs.io/",
      "https://{src}.elevenlabs.io/",
    ]);
  });

  it("an @ or %0d%0a after the authority is harmless: the host does not change and CR/LF stay percent-encoded", () => {
    const at = validateFinalUrl("https://elevenlabs.io/@evil.com", HOSTS);
    expect(at.ok && new URL(at.url).hostname).toBe("elevenlabs.io");
    const crlf = validateFinalUrl("https://elevenlabs.io/%0d%0aSet-Cookie:x", HOSTS);
    expect(crlf.ok).toBe(true);
    expect(crlf.ok && /[\r\n]/.test(crlf.url)).toBe(false);
  });
});

describe("rule 4: WHATWG URL parse", () => {
  it("a string the URL parser refuses is parse", () => {
    allCode("parse", ["https://exa<mple.io/", "https://elevenlabs.io:99999/", "https://exa^mple.io/"]);
  });
});

describe("rule 5: no userinfo, only the default port", () => {
  it("originError", () => {
    expect(originError(new URL("https://u@elevenlabs.io/"))).toBe("userinfo");
    expect(originError(new URL("https://u:p@elevenlabs.io/"))).toBe("userinfo");
    expect(originError(new URL("https://elevenlabs.io:8443/"))).toBe("port");
    expect(originError(new URL("https://elevenlabs.io:443/"))).toBeNull();
    expect(originError(new URL("https://elevenlabs.io/"))).toBeNull();
  });

  it("accepts :443 (href drops it) and rejects :8443", () => {
    expect(validateFinalUrl("https://elevenlabs.io:443/x", HOSTS)).toEqual({ ok: true, url: "https://elevenlabs.io/x" });
    allCode("port", ["https://elevenlabs.io:8443/", "https://elevenlabs.io:80/", "https://elevenlabs.io:444/x"]);
  });
});

describe("rule 6: the hostname is a public name", () => {
  it("isPublicHostname", () => {
    for (const good of ["elevenlabs.io", "try.elevenlabs.io", "a-b.example.co.uk", "xn--p1ai.xn--p1ai", "a1.io"]) expect(isPublicHostname(good), good).toBe(true);
    for (const bad of ["", "localhost", "a.localhost", "elevenlabs", "elevenlabs.io.", ".elevenlabs.io", "a..io", "-a.io", "a-.io", "[::1]", "127.0.0.1", "1.2.3.4", "127.1", "a.1", "example.123", "a_b.io", "a b.io", `${"a".repeat(64)}.io`]) {
      expect(isPublicHostname(bad), bad).toBe(false);
    }
  });

  it("rejects an IPv4 address in every form: decimal, merged, hex, octal", () => {
    allCode("host", ["https://127.0.0.1/", "https://2130706433/", "https://0x7f.1/", "https://0x7f000001/", "https://0177.0.0.1/", "https://127.1/", "https://169.254.169.254/", "https://10.0.0.1/"]);
  });

  it("rejects an IPv6 literal, including an IPv4-mapped one", () => {
    allCode("host", ["https://[::1]/", "https://[::ffff:127.0.0.1]/", "https://[2001:db8::1]/"]);
  });

  it("rejects localhost and *.localhost", () => {
    allCode("host", ["https://localhost/", "https://a.localhost/", "https://LOCALHOST/"]);
  });

  it("rejects a trailing dot and a host with no dot", () => {
    allCode("host", ["https://elevenlabs.io./", "https://elevenlabs/"]);
  });

  it("requires a letter in the last label (a numeric last label is refused already by the URL parser)", () => {
    allCode("parse", ["https://example.123/", "https://a.b.1/"]);
  });
});

describe("rule 7: the host is one of allowed_hosts, exactly or as a subdomain", () => {
  it("hostAllowed does not match a bare string suffix", () => {
    expect(hostAllowed("elevenlabs.io", HOSTS)).toBe(true);
    expect(hostAllowed("try.elevenlabs.io", HOSTS)).toBe(true);
    expect(hostAllowed("a.b.elevenlabs.io", HOSTS)).toBe(true);
    for (const bad of ["evilelevenlabs.io", "elevenlabs.io.evil.com", "io", "elevenlabs.com", "xelevenlabs.io"]) expect(hostAllowed(bad, HOSTS), bad).toBe(false);
    expect(hostAllowed("elevenlabs.io", [])).toBe(false);
  });

  it("validateFinalUrl: look-alike hosts and unlisted hosts are not_allowed", () => {
    allCode("not_allowed", ["https://evil.com/", "https://evilelevenlabs.io/", "https://elevenlabs.io.evil.com/", "https://elevenlabs.com/"]);
    expect(code("https://elevenlabs.io/", [])).toBe("not_allowed");
  });

  it("accepts the host, a listed host and a subdomain", () => {
    allCode("ok", ["https://elevenlabs.io", "https://try.elevenlabs.io/7fnly5cv33k3", "https://a.b.elevenlabs.io/", "https://ELEVENLABS.IO/x"]);
  });
});

describe("rule 8: Location is the re-validated new URL(final).href", () => {
  it("returns the normalised href and it validates to itself", () => {
    for (const [raw, href] of [
      ["https://elevenlabs.io", "https://elevenlabs.io/"],
      ["https://ELEVENLABS.IO/Path?X=1", "https://elevenlabs.io/Path?X=1"],
      ["https://elevenlabs.io:443/x", "https://elevenlabs.io/x"],
      ["https://elevenlabs.io?x=1", "https://elevenlabs.io/?x=1"],
    ] as const) {
      const first = validateFinalUrl(raw, HOSTS);
      expect(first, raw).toEqual({ ok: true, url: href });
      expect(validateFinalUrl(href, HOSTS)).toEqual(first);
    }
  });

  it("open-redirect shapes in the path or query never change the host", () => {
    for (const raw of ["https://elevenlabs.io//evil.com", "https://elevenlabs.io/?next=https://evil.com", "https://elevenlabs.io/%2F%2Fevil.com"]) {
      const r = validateFinalUrl(raw, HOSTS);
      expect(r.ok && new URL(r.url).hostname, raw).toBe("elevenlabs.io");
    }
  });
});

describe("template: placeholders", () => {
  it("placeholderNames", () => {
    expect(placeholderNames("https://a.io/{click_id}?l={locale}")).toEqual(["click_id", "locale"]);
    expect(placeholderNames("https://a.io/")).toEqual([]);
    for (const bad of ["https://a.io/{", "https://a.io/}", "https://a.io/{click_id", "https://a.io/{{click_id}}", "https://a.io/{a{b}"]) expect(placeholderNames(bad), bad).toBeNull();
  });

  it("accepts a link with no placeholder (the first partner link) and a bare host", () => {
    expect(parseTemplate("https://try.elevenlabs.io/7fnly5cv33k3", HOSTS)).toEqual({ ok: true, template: "https://try.elevenlabs.io/7fnly5cv33k3" });
    expect(parseTemplate("https://elevenlabs.io", HOSTS).ok).toBe(true);
  });

  it("accepts the three placeholders after the host: path, query, fragment", () => {
    for (const t of ["https://try.elevenlabs.io/r/{click_id}", "https://try.elevenlabs.io?c={click_id}&l={locale}&s={src}", "https://try.elevenlabs.io#{src}", "https://try.elevenlabs.io/{locale}/x?c={click_id}"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: true, template: t });
    }
  });

  it("rejects an unknown placeholder, an empty one and a wrong-case one", () => {
    for (const t of ["https://try.elevenlabs.io/{foo}", "https://try.elevenlabs.io/{}", "https://try.elevenlabs.io/{CLICK_ID}", "https://try.elevenlabs.io/{click_id }"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: false, error: "placeholder" });
    }
  });

  it("rejects an odd { or }", () => {
    for (const t of ["https://try.elevenlabs.io/{", "https://try.elevenlabs.io/}", "https://try.elevenlabs.io/{click_id", "https://try.elevenlabs.io/{{click_id}}"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: false, error: "braces" });
    }
  });

  it("rejects a placeholder in the scheme, host, port or userinfo", () => {
    for (const t of ["https://{src}.elevenlabs.io/", "https://a.{src}.io/", "https://elevenlabs.io{click_id}", "https://elevenlabs.io:{src}/", "https://{click_id}@elevenlabs.io/", "https://elevenlabs.io@{src}/", "{src}https://elevenlabs.io/", "http://elevenlabs.io/{src}"]) {
      expect(parseTemplate(t, HOSTS), t).toEqual({ ok: false, error: "placeholder_position" });
    }
  });

  it("also applies every URL rule to the template, with the sample values filled in", () => {
    expect(parseTemplate("https://evil.com/{click_id}", HOSTS)).toEqual({ ok: false, error: "not_allowed" });
    expect(parseTemplate("https://127.0.0.1/{src}", HOSTS)).toEqual({ ok: false, error: "host" });
    expect(parseTemplate("http://elevenlabs.io/x", HOSTS)).toEqual({ ok: false, error: "scheme" });
    expect(parseTemplate("https://try.elevenlabs.io:8443/{src}", HOSTS)).toEqual({ ok: false, error: "port" });
    expect(parseTemplate("https://try.elevenlabs.io/é{src}", HOSTS)).toEqual({ ok: false, error: "chars" });
  });
});

describe("template: fill with encodeURIComponent, validate at save (sample) and at redirect (real values)", () => {
  it("fillTemplate encodes every value", () => {
    const filled = fillTemplate("https://a.io/{src}?c={click_id}&l={locale}", { click_id: "a&b=c/d", locale: "zh-hans", src: "@evil.com/x y" });
    expect(filled).toBe("https://a.io/%40evil.com%2Fx%20y?c=a%26b%3Dc%2Fd&l=zh-hans");
  });

  it("previewUrl fills the sample values and validates", () => {
    expect(previewUrl("https://try.elevenlabs.io/r/{click_id}?l={locale}&s={src}", HOSTS)).toEqual({
      ok: true,
      url: "https://try.elevenlabs.io/r/01HZZZZZZZZZZZZZZZZZZZZZZZ?l=en&s=tools",
    });
    expect(previewUrl("https://evil.com/{src}", HOSTS)).toEqual({ ok: false, error: "not_allowed" });
  });

  it("real values cannot change the host, even hostile ones", () => {
    const r = fillAndValidate("https://try.elevenlabs.io/{src}?c={click_id}", { click_id: "../../x", locale: "en", src: "@evil.com" }, HOSTS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(new URL(r.url).hostname).toBe("try.elevenlabs.io");
      expect(r.url).not.toContain("@");
    }
  });

  it("refuses a { or } left after filling", () => {
    expect(fillAndValidate("https://try.elevenlabs.io/{foo}", SAMPLE_VALUES, HOSTS)).toEqual({ ok: false, error: "chars" });
    expect(fillAndValidate("https://try.elevenlabs.io/{click_id", SAMPLE_VALUES, HOSTS)).toEqual({ ok: false, error: "chars" });
  });

  it("re-validates after filling: a value that makes the URL too long fails, a lone surrogate does not throw", () => {
    expect(fillAndValidate("https://try.elevenlabs.io/{click_id}", { ...SAMPLE_VALUES, click_id: "a".repeat(3000) }, HOSTS)).toEqual({ ok: false, error: "length" });
    expect(fillAndValidate("https://try.elevenlabs.io/{click_id}", { ...SAMPLE_VALUES, click_id: "\ud800" }, HOSTS)).toEqual({ ok: false, error: "chars" });
  });
});

describe("appendUtm", () => {
  const UTM = "utm_source=vnx.si&utm_medium=referral";

  it("adds the two parameters when the URL has no utm_* parameter", () => {
    expect(appendUtm("https://elevenlabs.io/")).toBe(`https://elevenlabs.io/?${UTM}`);
    expect(appendUtm("https://elevenlabs.io/?a=1%20b")).toBe(`https://elevenlabs.io/?a=1%20b&${UTM}`);
    expect(appendUtm("https://elevenlabs.io/x#y")).toBe(`https://elevenlabs.io/x?${UTM}#y`);
  });

  it("leaves a URL with any utm_* parameter (any case) alone", () => {
    for (const url of ["https://elevenlabs.io/?utm_campaign=x", "https://elevenlabs.io/?a=1&UTM_Source=x", "https://elevenlabs.io/?utm_medium="]) expect(appendUtm(url), url).toBe(url);
  });

  it("the result still passes validateFinalUrl unchanged", () => {
    const withUtm = appendUtm("https://elevenlabs.io/");
    expect(validateFinalUrl(withUtm, HOSTS)).toEqual({ ok: true, url: withUtm });
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/offer-url.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 2: Domain `offer-url`**

`apps/web/src/domain/offer-url.ts`:

```ts
/**
 * Rules for every outbound URL (ADR-007 rule 7, plan header "Global Constraints"). Pure: no Hono, no D1, no I/O.
 * The same function runs when an admin saves (sample values) and on every redirect (real values).
 */

export const MAX_URL_LENGTH = 2048;
export const MAX_ALLOWED_HOSTS = 20;
export const PLACEHOLDERS = ["click_id", "locale", "src"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type TemplateValues = Record<Placeholder, string>;
/** Values filled in when an admin saves or previews a template. */
export const SAMPLE_VALUES: TemplateValues = { click_id: "01HZZZZZZZZZZZZZZZZZZZZZZZ", locale: "en", src: "tools" };

export type UrlError = "length" | "chars" | "scheme" | "authority" | "parse" | "userinfo" | "port" | "host" | "not_allowed";
export type UrlResult = { ok: true; url: string } | { ok: false; error: UrlError };

const SCHEME = "https://";
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOSTNAME_RE = new RegExp(`^(?:${LABEL}\\.)+${LABEL}$`);

/** Printable ASCII only (no space, control or non-ASCII such as fullwidth letters or U+3002), and no backslash. */
export function isPrintableAscii(raw: string): boolean {
  return /^[\x21-\x7E]+$/.test(raw) && !raw.includes("\\");
}

/** Exactly lowercase `https://`; `https:evil.com`, `HTTPS://` and `//evil.com` fail. */
export function hasHttpsPrefix(raw: string): boolean {
  return raw.startsWith(SCHEME);
}

/** Text after `https://` up to the first `/`, `?` or `#`. */
export function authorityOf(raw: string): string {
  return raw.slice(SCHEME.length).split(/[/?#]/, 1)[0] ?? "";
}

/** Not empty, and no userinfo (`@`), percent escape (`%2e`) or placeholder brace in it. */
export function isAuthorityClean(authority: string): boolean {
  return authority !== "" && !/[@%{}]/.test(authority);
}

/** After WHATWG parsing: no userinfo; port is empty (the parser drops `:443`, so `:8443` is the only way to a port). */
export function originError(url: URL): "userinfo" | "port" | null {
  if (url.username !== "" || url.password !== "") return "userinfo";
  return url.port === "" ? null : "port";
}

/**
 * A name with at least two LDH labels whose last label has a letter. That rejects IPv4 in every form (decimal, merged,
 * hex, octal all parse to dotted numbers), IPv6 literals, a trailing dot, `localhost` and `*.localhost`. Also the format of allowed_hosts.
 */
export function isPublicHostname(hostname: string): boolean {
  if (hostname.startsWith("[") || hostname.endsWith(".")) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || !hostname.includes(".")) return false;
  if (!/[a-z]/.test(hostname.slice(hostname.lastIndexOf(".") + 1))) return false;
  return hostname.length <= 253 && HOSTNAME_RE.test(hostname);
}

/** Exact match or a subdomain of an allowed host; never a bare string suffix (`evilexample.com` vs `example.com`). */
export function hostAllowed(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

function check(raw: string, allowed: readonly string[]): UrlResult {
  const fail = (error: UrlError): UrlResult => ({ ok: false, error });
  if (raw.length > MAX_URL_LENGTH) return fail("length");
  if (!isPrintableAscii(raw)) return fail("chars");
  if (!hasHttpsPrefix(raw)) return fail("scheme");
  if (!isAuthorityClean(authorityOf(raw))) return fail("authority");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("parse");
  }
  if (url.protocol !== "https:") return fail("parse");
  const origin = originError(url);
  if (origin) return fail(origin);
  if (!isPublicHostname(url.hostname)) return fail("host");
  if (!hostAllowed(url.hostname, allowed)) return fail("not_allowed");
  return { ok: true, url: url.href };
}

/**
 * The one gate for destination_url, website_url, a filled template and every redirect. On success `url` is `new URL(raw).href`,
 * checked again: the value a route puts in `Location` is this, never the raw string.
 */
export function validateFinalUrl(raw: string, allowed: readonly string[]): UrlResult {
  const first = check(raw, allowed);
  if (!first.ok) return first;
  const second = check(first.url, allowed);
  return second.ok && second.url === first.url ? second : { ok: false, error: "parse" };
}

export type TemplateError = "braces" | "placeholder" | "placeholder_position";

/** Names inside `{...}`, or null when a `{` or `}` is left over (odd or nested). */
export function placeholderNames(raw: string): string[] | null {
  const names = [...raw.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
  return /[{}]/.test(raw.replace(/\{[^{}]*\}/g, "")) ? null : names;
}

export function fillTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(click_id|locale|src)\}/g, (_m, name: Placeholder) => encodeURIComponent(values[name]));
}

/** Fill (encoded) then validate. Used with sample values at save and with real values at redirect. */
export function fillAndValidate(template: string, values: TemplateValues, allowed: readonly string[]): UrlResult {
  let filled: string;
  try {
    filled = fillTemplate(template, values);
  } catch {
    return { ok: false, error: "chars" };
  }
  // A { or } still there means an unknown or odd placeholder reached a redirect: refuse it.
  if (/[{}]/.test(filled)) return { ok: false, error: "chars" };
  return validateFinalUrl(filled, allowed);
}

export const previewUrl = (template: string, allowed: readonly string[]): UrlResult => fillAndValidate(template, SAMPLE_VALUES, allowed);

// Everything before the first `{` must be scheme + host (+ one of / ? #), so a placeholder is never in the scheme, host, port or userinfo.
const TEMPLATE_PREFIX_RE = /^https:\/\/[^/?#@{}\\]+[/?#]/;

export function parseTemplate(raw: string, allowed: readonly string[]): { ok: true; template: string } | { ok: false; error: TemplateError | UrlError } {
  const names = placeholderNames(raw);
  if (names === null) return { ok: false, error: "braces" };
  if (names.some((n) => !(PLACEHOLDERS as readonly string[]).includes(n))) return { ok: false, error: "placeholder" };
  if (names.length > 0 && !TEMPLATE_PREFIX_RE.test(raw.slice(0, raw.indexOf("{")))) return { ok: false, error: "placeholder_position" };
  const sample = previewUrl(raw, allowed);
  return sample.ok ? { ok: true, template: raw } : { ok: false, error: sample.error };
}

/** `utm_source=vnx.si&utm_medium=referral`, unless the URL already has any utm_* parameter. Existing query text is kept byte for byte. */
export function appendUtm(url: string): string {
  const u = new URL(url);
  if ([...u.searchParams.keys()].some((k) => k.toLowerCase().startsWith("utm_"))) return url;
  u.search = `${u.search === "" ? "?" : `${u.search}&`}utm_source=vnx.si&utm_medium=referral`;
  return u.href;
}
```

Chạy lại `npm test -w apps/web -- test/domain/offer-url.test.ts` → PASS.

- [ ] **Step 3: Test `merchant` (fail)**

`apps/web/test/domain/merchant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MERCHANT_DESCRIPTION_MAX,
  MERCHANT_NAME_MAX,
  MERCHANT_STATUSES,
  merchantSlugError,
  parseAllowedHosts,
  parseMerchantForm,
  RESERVED_MERCHANT_SLUGS,
  type MerchantFormValues,
} from "../../src/domain/merchant.ts";
import { MAX_ALLOWED_HOSTS } from "../../src/domain/offer-url.ts";
import { SLUG_RE } from "../../src/domain/slug.ts";

describe("merchant slug (same rule as a product slug, plus reserved words)", () => {
  it("reserves p and o for /go/p/… and /go/o/…", () => {
    expect([...RESERVED_MERCHANT_SLUGS].sort()).toEqual(["o", "p"]);
    expect(merchantSlugError("p")).toBe("reserved");
    expect(merchantSlugError("o")).toBe("reserved");
  });

  it("accepts and rejects exactly what SLUG_RE accepts and rejects", () => {
    for (const slug of ["elevenlabs", "eleven-labs", "abc", "a1b", "x".repeat(60)]) {
      expect(SLUG_RE.test(slug)).toBe(true);
      expect(merchantSlugError(slug), slug).toBeNull();
    }
    for (const slug of ["", "ab", "-abc", "abc-", "a_b", "a b", "ABC", "x".repeat(61), "ab/c"]) {
      expect(SLUG_RE.test(slug)).toBe(false);
      expect(merchantSlugError(slug), slug).toBe("format");
    }
  });

  it("has the three statuses", () => {
    expect([...MERCHANT_STATUSES]).toEqual(["active", "paused", "archived"]);
  });
});

describe("allowed_hosts", () => {
  it("accepts a comma or line separated list and lower-cases it", () => {
    expect(parseAllowedHosts("try.elevenlabs.io, elevenlabs.io")).toEqual({ ok: true, hosts: ["try.elevenlabs.io", "elevenlabs.io"] });
    expect(parseAllowedHosts("A.Example.COM\r\nb.example.com\n")).toEqual({ ok: true, hosts: ["a.example.com", "b.example.com"] });
  });

  it("rejects an empty list", () => {
    for (const raw of ["", "  ", ",\n,"]) expect(parseAllowedHosts(raw), JSON.stringify(raw)).toEqual({ ok: false, error: "empty" });
  });

  it("rejects scheme, path, port, wildcard, IP, single label, localhost, trailing dot, non-ASCII", () => {
    for (const raw of ["https://elevenlabs.io", "elevenlabs.io/x", "elevenlabs.io:443", "*.elevenlabs.io", "127.0.0.1", "0x7f.1", "elevenlabs", "localhost", "a.localhost", "elevenlabs.io.", "elevenlabs。io", "élevenlabs.io", "a_b.io"]) {
      expect(parseAllowedHosts(raw), raw).toEqual({ ok: false, error: "format" });
    }
  });

  it("rejects a duplicate and more than 20 entries", () => {
    expect(parseAllowedHosts("a.io, A.io")).toEqual({ ok: false, error: "duplicate" });
    const ok = Array.from({ length: MAX_ALLOWED_HOSTS }, (_, i) => `h${i}.example.com`);
    expect(parseAllowedHosts(ok.join(",")).ok).toBe(true);
    expect(parseAllowedHosts([...ok, "extra.example.com"].join(","))).toEqual({ ok: false, error: "too_many" });
  });
});

const values = (o: Partial<MerchantFormValues> = {}): MerchantFormValues => ({
  name: "ElevenLabs",
  slug: "elevenlabs",
  websiteUrl: "https://elevenlabs.io",
  allowedHosts: "try.elevenlabs.io, elevenlabs.io",
  description: "Voice AI.\r\n\r\n- Text to speech",
  indexable: false,
  ...o,
});

describe("parseMerchantForm", () => {
  it("accepts the first partner and normalises", () => {
    expect(parseMerchantForm(values({ slug: "  ElevenLabs " }))).toEqual({
      ok: true,
      merchant: {
        name: "ElevenLabs",
        slug: "elevenlabs",
        websiteUrl: "https://elevenlabs.io/",
        allowedHosts: ["try.elevenlabs.io", "elevenlabs.io"],
        description: "Voice AI.\n\n- Text to speech",
        indexable: false,
      },
    });
  });

  it("rejects the reserved slugs p and o, and a bad slug", () => {
    expect(parseMerchantForm(values({ slug: "p" }))).toEqual({ ok: false, errors: { slug: "reserved" } });
    expect(parseMerchantForm(values({ slug: " O " }))).toEqual({ ok: false, errors: { slug: "reserved" } });
    expect(parseMerchantForm(values({ slug: "a_b" }))).toEqual({ ok: false, errors: { slug: "format" } });
  });

  it("requires a name of at most 80 characters and a description of at most 2000", () => {
    expect(parseMerchantForm(values({ name: "  " }))).toEqual({ ok: false, errors: { name: "required" } });
    expect(parseMerchantForm(values({ name: "x".repeat(MERCHANT_NAME_MAX + 1) }))).toEqual({ ok: false, errors: { name: "too_long" } });
    expect(parseMerchantForm(values({ description: "x".repeat(MERCHANT_DESCRIPTION_MAX + 1) }))).toEqual({ ok: false, errors: { description: "too_long" } });
    expect(parseMerchantForm(values({ description: "x".repeat(MERCHANT_DESCRIPTION_MAX) })).ok).toBe(true);
  });

  it("checks website_url with every URL rule against the merchant's own allowed_hosts", () => {
    expect(parseMerchantForm(values({ websiteUrl: "" }))).toEqual({ ok: false, errors: { websiteUrl: "required" } });
    expect(parseMerchantForm(values({ websiteUrl: "http://elevenlabs.io" }))).toEqual({ ok: false, errors: { websiteUrl: "url_scheme" } });
    expect(parseMerchantForm(values({ websiteUrl: "https://evil.com" }))).toEqual({ ok: false, errors: { websiteUrl: "url_not_allowed" } });
    expect(parseMerchantForm(values({ websiteUrl: "https://elevenlabs.io@evil.com" }))).toEqual({ ok: false, errors: { websiteUrl: "url_authority" } });
    expect(parseMerchantForm(values({ websiteUrl: "https://127.0.0.1" }))).toEqual({ ok: false, errors: { websiteUrl: "url_host" } });
  });

  it("reports allowed_hosts errors and skips the website_url check then", () => {
    expect(parseMerchantForm(values({ allowedHosts: "https://elevenlabs.io" }))).toEqual({ ok: false, errors: { allowedHosts: "format" } });
    expect(parseMerchantForm(values({ allowedHosts: "" }))).toEqual({ ok: false, errors: { allowedHosts: "empty" } });
  });

  it("keeps indexable as given", () => {
    const r = parseMerchantForm(values({ indexable: true }));
    expect(r.ok && r.merchant.indexable).toBe(true);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/merchant.test.ts` → FAIL (thiếu module).

- [ ] **Step 4: Domain `merchant`**

`apps/web/src/domain/merchant.ts`:

```ts
import { isPublicHostname, MAX_ALLOWED_HOSTS, validateFinalUrl, type UrlError } from "./offer-url.ts";
import { normalizeNewlines } from "./product-input.ts";
import { SLUG_RE } from "./slug.ts";

/** Merchants (addendum §3.2). Pure rules: no Hono, no D1. */

export const MERCHANT_STATUSES = ["active", "paused", "archived"] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

/** Taken by /go/p/… and /go/o/…. */
export const RESERVED_MERCHANT_SLUGS: ReadonlySet<string> = new Set(["p", "o"]);
export const MERCHANT_NAME_MAX = 80;
export const MERCHANT_DESCRIPTION_MAX = 2000;

/** The product slug rule, plus the reserved words (checked first so the error says why). */
export function merchantSlugError(slug: string): "reserved" | "format" | null {
  if (RESERVED_MERCHANT_SLUGS.has(slug)) return "reserved";
  return SLUG_RE.test(slug) ? null : "format";
}

export type AllowedHostsError = "empty" | "too_many" | "format" | "duplicate";

/** Comma or line separated host names, lower-cased; same host format as the URL rules (`isPublicHostname`). */
export function parseAllowedHosts(raw: string): { ok: true; hosts: string[] } | { ok: false; error: AllowedHostsError } {
  const hosts = raw
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((h) => h !== "");
  if (hosts.length === 0) return { ok: false, error: "empty" };
  if (hosts.length > MAX_ALLOWED_HOSTS) return { ok: false, error: "too_many" };
  if (!hosts.every((h) => isPublicHostname(h))) return { ok: false, error: "format" };
  if (new Set(hosts).size !== hosts.length) return { ok: false, error: "duplicate" };
  return { ok: true, hosts };
}

export type MerchantFormValues = { name: string; slug: string; websiteUrl: string; allowedHosts: string; description: string; indexable: boolean };
export type MerchantField = "name" | "slug" | "websiteUrl" | "allowedHosts" | "description";
export type MerchantFieldError = "required" | "too_long" | "format" | "reserved" | AllowedHostsError | `url_${UrlError}`;
export type MerchantInput = { name: string; slug: string; websiteUrl: string; allowedHosts: string[]; description: string; indexable: boolean };

export function parseMerchantForm(v: MerchantFormValues): { ok: true; merchant: MerchantInput } | { ok: false; errors: Partial<Record<MerchantField, MerchantFieldError>> } {
  const errors: Partial<Record<MerchantField, MerchantFieldError>> = {};
  const name = v.name.trim();
  if (name === "") errors.name = "required";
  else if (name.length > MERCHANT_NAME_MAX) errors.name = "too_long";

  const slug = v.slug.trim().toLowerCase();
  const slugError = merchantSlugError(slug);
  if (slugError) errors.slug = slugError;

  const description = normalizeNewlines(v.description).trim();
  if (description.length > MERCHANT_DESCRIPTION_MAX) errors.description = "too_long";

  const hosts = parseAllowedHosts(v.allowedHosts);
  let websiteUrl = "";
  if (!hosts.ok) {
    errors.allowedHosts = hosts.error;
  } else if (v.websiteUrl.trim() === "") {
    errors.websiteUrl = "required";
  } else {
    const url = validateFinalUrl(v.websiteUrl.trim(), hosts.hosts);
    if (url.ok) websiteUrl = url.url;
    else errors.websiteUrl = `url_${url.error}`;
  }

  if (!hosts.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, merchant: { name, slug, websiteUrl, allowedHosts: hosts.hosts, description, indexable: v.indexable } };
}
```

Chạy lại `npm test -w apps/web -- test/domain/merchant.test.ts` → PASS.

- [ ] **Step 5: Kiểm ranh giới**

Test kiến trúc hiện có đã phủ domain (không import `hono`, không `D1Database`, không import `db/`) và `src/` không chứa `elevenlabs` / `partnerstack`; hai file domain mới không được làm hỏng chúng (đừng viết từ khóa SQL in hoa kiểu `UPDATE x` hay `FROM offers` trong chú thích). Chạy:

```bash
npm test -w apps/web -- test/architecture.test.ts
grep -rniE "elevenlabs|partnerstack" apps/web/src; test $? -eq 1
```

- [ ] **Step 6: Kiểm toàn bộ và commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/domain/offer-url.ts apps/web/src/domain/merchant.ts apps/web/test/domain/offer-url.test.ts apps/web/test/domain/merchant.test.ts
git commit -m "feat(web): pure URL rules, template and merchant form validation (VNX-2102a-1)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận:**
- `npm test -w apps/web -- test/domain/offer-url.test.ts test/domain/merchant.test.ts test/architecture.test.ts` xanh.
- Mỗi luật URL của header có một `describe` / `it` mang tên luật (rule 1–8, template, fill, utm). Review Focus 1, 2 ở tầng domain có test: `0177.0.0.1`, `0x7f.1`, `0x7f000001`, `2130706433`, `[::1]`, `[::ffff:127.0.0.1]`, `%2e` trong host, chữ rộng và `。`, `https:evil.com`, `https:///evil.com`, scheme viết hoa (bị từ chối), `:443` được, `:8443` bị từ chối, userinfo, `evilelevenlabs.io`, `elevenlabs.io.evil.com`, `http:`, `javascript:`, `data:`, `\`, CR/LF, `%0d%0a`, `localhost`, dấu chấm cuối.
- Slug merchant `p`, `o` bị từ chối (`reserved`), slug sai định dạng bị từ chối (`format`), `allowed_hosts` kiểm đủ: định dạng, nhãn cuối có chữ cái, ≤ 20, trùng, rỗng.
- `grep -rniE "elevenlabs|partnerstack" apps/web/src` không in dòng nào; hai file domain không chứa `D1Database` hay `hono`.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ≈ 630 dòng: `offer-url.ts` ~135, `merchant.ts` ~65, test ~430 (bảng ca URL chiếm phần lớn).

---

### Task 2b: VNX-2102a-2 — Chương trình, offer và `resolveOfferRedirect` (domain thuần)

**Files:**
- Create: `apps/web/src/domain/offer.ts`
- Test: `apps/web/test/domain/offer.test.ts`
- Không sửa file nào khác. Không có chuỗi giao diện, không có SQL.

**Interfaces:**
- Consumes (Task 2 và Task 1, đã commit): `validateFinalUrl`, `parseTemplate`, `previewUrl`, `fillAndValidate`, `appendUtm`, `type UrlError`, `type UrlResult` (`domain/offer-url.ts`); `MERCHANT_STATUSES`, `type MerchantStatus` (`domain/merchant.ts`); `type FlagState` (`domain/flags.ts`); `isHttpsUrl` (`domain/builder-input.ts`); `normalizeNewlines` (`domain/product-input.ts`).
- Produces (`domain/offer.ts`): `PROGRAM_TYPES`, `PROGRAM_STATUSES`, `PROGRAM_PROVIDERS`, `COMMISSION_MODELS`, `OFFER_KINDS`, `LABELS` (5 giá trị, có `try_it`), `OFFER_STATUSES` cùng các `type` tương ứng; `programActivationError(p)`; `type ProgramFormValues`, `type ProgramInput`, `parseProgramForm(values)`; `flagForProgram(type)`; `type OfferFormValues`, `type OfferContext`, `type OfferInput`, `parseOfferForm(values, ctx)`; `type RedirectOffer`, `type RedirectProgram`, `type RedirectMerchant`, `type RedirectInput`, `type RedirectResult`, `type FallbackReason`, `type NotFoundReason`, `resolveOfferRedirect(input)` (Task 2c, 3, 4 dùng).

**Quyết định kỹ thuật (Reviewer kiểm):**
1. Kết quả `resolveOfferRedirect` dùng tên của header đã duyệt: `tracked | fallback | not_found`. `tracked` cũng dùng cho offer không chương trình (đi tới `destination_url` + UTM, không cần cờ); `programId` cho biết có qua chương trình hay không. `tracked` và `fallback` đều là redirect mà caller ghi click; `not_found` không ghi. `click_id` của dòng click chính là `clickId` truyền vào (route Task 4 sinh trước khi gọi).
2. URL đích của nhánh `tracked` không hợp lệ (template điền ra host lạ, `destination_url` hỏng trong DB) → `not_found`, **không** hạ xuống `fallback` (link kiếm tiền hỏng thì để chết, không đổi đích im lặng). `website_url` không hợp lệ cũng → `not_found`.
3. Khung thời gian của offer: `startsAt` ≤ now (bao gồm), now < `endsAt` (loại trừ). Chuỗi thời gian không đọc được trong DB → `not_found` (`window_invalid`). Form nhận `YYYY-MM-DD` (nửa đêm UTC) hoặc `YYYY-MM-DDTHH:MM[:SS[.mmm]]Z`.
4. Chương trình: chỉ kiểm định dạng và khoảng hợp lý của số (`commission_rate_bps` 0–10 000, `commission_flat_minor` 0–1 000 000 000, `cookie_days` 0–3 650, `currency` 3 chữ in hoa), **không có giá trị mặc định nào** và không có luật chéo giữa mô hình hoa hồng và số tiền (không bịa luật nghiệp vụ).


- [ ] **Step 1: Test `offer` (fail)**

`apps/web/test/domain/offer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MERCHANT_STATUSES } from "../../src/domain/merchant.ts";
import {
  COMMISSION_MODELS,
  flagForProgram,
  LABELS,
  OFFER_KINDS,
  OFFER_STATUSES,
  parseOfferForm,
  parseProgramForm,
  PROGRAM_PROVIDERS,
  PROGRAM_STATUSES,
  PROGRAM_TYPES,
  programActivationError,
  resolveOfferRedirect,
  type OfferContext,
  type OfferFormValues,
  type ProgramFormValues,
  type RedirectInput,
  type RedirectMerchant,
  type RedirectOffer,
  type RedirectProgram,
} from "../../src/domain/offer.ts";

const HOSTS = ["try.elevenlabs.io", "elevenlabs.io"];

describe("enums", () => {
  it("match the addendum, with try_it in the labels", () => {
    expect([...LABELS]).toEqual(["learn_more", "get_started", "start_trial", "visit_site", "try_it"]);
    expect([...OFFER_KINDS]).toEqual(["official", "trial", "affiliate", "referral", "sponsored"]);
    expect([...OFFER_STATUSES]).toEqual(["active", "paused", "archived"]);
    expect([...PROGRAM_TYPES]).toEqual(["affiliate", "referral", "revenue_share", "direct"]);
    expect([...PROGRAM_STATUSES]).toEqual(["draft", "active", "paused", "ended"]);
    expect([...PROGRAM_PROVIDERS]).toEqual(["generic_template", "manual"]);
    expect([...COMMISSION_MODELS]).toEqual(["percent", "flat", "tiered", "custom"]);
  });

  it("flagForProgram: affiliate -> affiliate; referral and revenue_share -> partner_referral; direct has no flag", () => {
    expect(flagForProgram("affiliate")).toBe("affiliate");
    expect(flagForProgram("referral")).toBe("partner_referral");
    expect(flagForProgram("revenue_share")).toBe("partner_referral");
    expect(flagForProgram("direct")).toBeNull();
  });
});

const program = (o: Partial<ProgramFormValues> = {}): ProgramFormValues => ({
  name: "ElevenLabs affiliate",
  type: "affiliate",
  network: "PartnerStack",
  provider: "generic_template",
  commissionModel: "",
  commissionRateBps: "",
  commissionFlatMinor: "",
  currency: "",
  cookieDays: "",
  attributionNotes: "",
  termsUrl: "",
  termsVerifiedAt: "",
  status: "draft",
  ...o,
});
const TERMS = { termsUrl: "https://elevenlabs.io/affiliate-terms", termsVerifiedAt: "2026-10-05" };

describe("program rules (ADR-007 rules 5 and 9)", () => {
  it("a draft with no terms saves with every commission and cookie field null: no default is ever invented", () => {
    const r = parseProgramForm(program());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program).toMatchObject({ commissionModel: null, commissionRateBps: null, commissionFlatMinor: null, currency: null, cookieDays: null, termsUrl: null, termsVerifiedAt: null, status: "draft" });
    }
  });

  it("active needs terms_url and terms_verified_at", () => {
    expect(parseProgramForm(program({ status: "active" }))).toEqual({ ok: false, errors: { status: "terms_missing" } });
    expect(parseProgramForm(program({ status: "active", termsUrl: TERMS.termsUrl }))).toEqual({ ok: false, errors: { status: "terms_missing" } });
    expect(parseProgramForm(program({ status: "active", termsVerifiedAt: TERMS.termsVerifiedAt }))).toEqual({ ok: false, errors: { status: "terms_missing" } });
    expect(parseProgramForm(program({ status: "active", ...TERMS })).ok).toBe(true);
  });

  it("paused and ended need no terms", () => {
    for (const status of ["paused", "ended"]) expect(parseProgramForm(program({ status })).ok, status).toBe(true);
  });

  it("type direct can never be active in the slice, even with terms", () => {
    expect(parseProgramForm(program({ type: "direct", status: "active", ...TERMS }))).toEqual({ ok: false, errors: { status: "direct_not_active" } });
    expect(parseProgramForm(program({ type: "direct", status: "draft" })).ok).toBe(true);
    expect(programActivationError({ type: "direct", termsUrl: "https://a.io", termsVerifiedAt: "2026-10-05" })).toBe("direct_not_active");
    expect(programActivationError({ type: "affiliate", termsUrl: null, termsVerifiedAt: null })).toBe("terms_missing");
    expect(programActivationError({ type: "referral", termsUrl: "https://a.io", termsVerifiedAt: "2026-10-05" })).toBeNull();
  });

  it("checks enums, the terms URL and the terms date", () => {
    expect(parseProgramForm(program({ type: "x", provider: "y", status: "z", commissionModel: "w" }))).toEqual({
      ok: false,
      errors: { type: "choice", provider: "choice", status: "choice", commissionModel: "choice" },
    });
    expect(parseProgramForm(program({ termsUrl: "http://a.io/t" }))).toEqual({ ok: false, errors: { termsUrl: "url" } });
    for (const d of ["2026-02-31", "05/10/2026", "2026-10-05T00:00:00Z"]) expect(parseProgramForm(program({ termsVerifiedAt: d })), d).toEqual({ ok: false, errors: { termsVerifiedAt: "date" } });
    expect(parseProgramForm(program({ name: " " }))).toEqual({ ok: false, errors: { name: "required" } });
  });

  it("checks the numbers and the currency format only", () => {
    const ok = parseProgramForm(program({ commissionModel: "percent", commissionRateBps: "1500", commissionFlatMinor: "0", currency: "usd", cookieDays: "30" }));
    expect(ok.ok && ok.program).toMatchObject({ commissionModel: "percent", commissionRateBps: 1500, commissionFlatMinor: 0, currency: "USD", cookieDays: 30 });
    for (const bad of ["-1", "10001", "1.5", "abc", "1e3"]) expect(parseProgramForm(program({ commissionRateBps: bad })), bad).toEqual({ ok: false, errors: { commissionRateBps: "number" } });
    expect(parseProgramForm(program({ cookieDays: "3651" }))).toEqual({ ok: false, errors: { cookieDays: "number" } });
    expect(parseProgramForm(program({ currency: "US" }))).toEqual({ ok: false, errors: { currency: "currency" } });
  });
});

const offerValues = (o: Partial<OfferFormValues> = {}): OfferFormValues => ({
  kind: "affiliate",
  label: "try_it",
  destinationUrl: "https://elevenlabs.io",
  trackingTemplate: "https://try.elevenlabs.io/7fnly5cv33k3",
  startsAt: "",
  endsAt: "",
  status: "active",
  ...o,
});
const ctx = (o: Partial<OfferContext> = {}): OfferContext => ({ merchant: { id: "M1", allowedHosts: HOSTS }, program: { id: "P1", merchantId: "M1" }, ...o });

describe("parseOfferForm", () => {
  it("accepts the first partner's default offer (label try_it, link with no placeholder)", () => {
    expect(parseOfferForm(offerValues(), ctx())).toEqual({
      ok: true,
      offer: {
        programId: "P1",
        subjectType: "merchant",
        subjectId: "M1",
        kind: "affiliate",
        label: "try_it",
        destinationUrl: "https://elevenlabs.io/",
        trackingTemplate: "https://try.elevenlabs.io/7fnly5cv33k3",
        startsAt: null,
        endsAt: null,
        status: "active",
      },
    });
  });

  it("accepts an offer with no program and no template", () => {
    const r = parseOfferForm(offerValues({ kind: "official", label: "visit_site", trackingTemplate: "" }), ctx({ program: null }));
    expect(r.ok && r.offer).toMatchObject({ programId: null, trackingTemplate: null, kind: "official" });
  });

  it("rejects a template on an offer with no program", () => {
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://try.elevenlabs.io/x" }), ctx({ program: null }))).toEqual({ ok: false, errors: { trackingTemplate: "template_without_program" } });
  });

  it("rejects a program of another merchant", () => {
    expect(parseOfferForm(offerValues(), ctx({ program: { id: "P9", merchantId: "M2" } }))).toEqual({ ok: false, errors: { programId: "program_merchant" } });
  });

  it("an offer with a program must have a tracking template", () => {
    expect(parseOfferForm(offerValues({ trackingTemplate: "" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_required" } });
  });

  it("destination_url must not equal the filled or the normalised template", () => {
    expect(parseOfferForm(offerValues({ destinationUrl: "https://try.elevenlabs.io/7fnly5cv33k3" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "same_as_template" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://elevenlabs.io/", trackingTemplate: "https://elevenlabs.io" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "same_as_template" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://try.elevenlabs.io/r?c=01HZZZZZZZZZZZZZZZZZZZZZZZ", trackingTemplate: "https://try.elevenlabs.io/r?c={click_id}" }), ctx())).toEqual({
      ok: false,
      errors: { destinationUrl: "same_as_template" },
    });
  });

  it("applies every URL rule to destination_url and to the template", () => {
    expect(parseOfferForm(offerValues({ destinationUrl: "" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "required" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "http://elevenlabs.io" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "url_scheme" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://evil.com" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "url_not_allowed" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://elevenlabs.io@evil.com" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "url_authority" } });
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://try.elevenlabs.io/{foo}" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_placeholder" } });
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://evil.com/{click_id}" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_not_allowed" } });
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://{src}.elevenlabs.io/" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_placeholder_position" } });
  });

  it("checks kind, label (try_it is valid, buy_now is not) and status", () => {
    expect(parseOfferForm(offerValues({ label: "buy_now", kind: "x", status: "y" }), ctx())).toEqual({ ok: false, errors: { label: "choice", kind: "choice", status: "choice" } });
    for (const label of LABELS) expect(parseOfferForm(offerValues({ label }), ctx()).ok, label).toBe(true);
  });

  it("reads the window: empty is null, a date is midnight UTC, an impossible date or an inverted window is an error", () => {
    const r = parseOfferForm(offerValues({ startsAt: "2026-10-05", endsAt: "2026-11-01T10:00Z" }), ctx());
    expect(r.ok && [r.offer.startsAt, r.offer.endsAt]).toEqual(["2026-10-05T00:00:00.000Z", "2026-11-01T10:00:00.000Z"]);
    expect(parseOfferForm(offerValues({ startsAt: "2026-02-31" }), ctx())).toEqual({ ok: false, errors: { startsAt: "date" } });
    expect(parseOfferForm(offerValues({ startsAt: "yesterday" }), ctx())).toEqual({ ok: false, errors: { startsAt: "date" } });
    expect(parseOfferForm(offerValues({ startsAt: "2026-11-01", endsAt: "2026-10-05" }), ctx())).toEqual({ ok: false, errors: { endsAt: "date_order" } });
    expect(parseOfferForm(offerValues({ startsAt: "2026-10-05", endsAt: "2026-10-05" }), ctx())).toEqual({ ok: false, errors: { endsAt: "date_order" } });
  });
});

const NOW = "2026-10-05T12:00:00.000Z";
const CLICK = "01J00000000000000000000000";
const TEMPLATE = "https://try.elevenlabs.io/r/{click_id}?l={locale}&s={src}";
const TRACKED_URL = `https://try.elevenlabs.io/r/${CLICK}?l=vi&s=tools`;
const UTM = "utm_source=vnx.si&utm_medium=referral";
const FLAGS_OFF = { affiliate: false, partner_referral: false };

const merchant = (o: Partial<RedirectMerchant> = {}): RedirectMerchant => ({ id: "M1", status: "active", websiteUrl: "https://elevenlabs.io", allowedHosts: HOSTS, ...o });
const prog = (o: Partial<RedirectProgram> = {}): RedirectProgram => ({ id: "P1", merchantId: "M1", type: "affiliate", status: "active", ...o });
const offer = (o: Partial<RedirectOffer> = {}): RedirectOffer => ({
  id: "O1",
  subjectType: "merchant",
  subjectId: "M1",
  programId: "P1",
  status: "active",
  destinationUrl: "https://elevenlabs.io",
  trackingTemplate: TEMPLATE,
  startsAt: null,
  endsAt: null,
  ...o,
});
const plainOffer = (o: Partial<RedirectOffer> = {}) => offer({ programId: null, trackingTemplate: null, ...o });
const input = (o: Partial<RedirectInput> = {}): RedirectInput => ({
  offer: offer(),
  program: prog(),
  merchant: merchant(),
  flags: { affiliate: true, partner_referral: false },
  now: NOW,
  clickId: CLICK,
  locale: "vi",
  src: "tools",
  ...o,
});
const resolve = (o: Partial<RedirectInput> = {}) => resolveOfferRedirect(input(o));

describe("resolveOfferRedirect: tracked", () => {
  it("fills the template with the click id, locale and src and returns the validated href", () => {
    expect(resolve()).toEqual({ kind: "tracked", url: TRACKED_URL, programId: "P1" });
  });

  it("uses partner_referral for referral and revenue_share", () => {
    for (const type of ["referral", "revenue_share"] as const) {
      expect(resolve({ program: prog({ type }), flags: { affiliate: false, partner_referral: true } }).kind, type).toBe("tracked");
    }
  });

  it("hostile locale or src cannot change the host", () => {
    const r = resolve({ locale: "../../@evil.com", src: "https://evil.com" });
    expect(r.kind).toBe("tracked");
    if (r.kind === "tracked") {
      expect(new URL(r.url).hostname).toBe("try.elevenlabs.io");
      expect(r.url).not.toContain("@");
    }
  });

  it("an offer without a program needs no flag, goes to destination_url with utm, and keeps an existing utm", () => {
    expect(resolve({ program: null, offer: plainOffer(), flags: FLAGS_OFF })).toEqual({ kind: "tracked", url: `https://elevenlabs.io/?${UTM}`, programId: null });
    expect(resolve({ program: null, offer: plainOffer({ destinationUrl: "https://elevenlabs.io/?utm_source=x" }), flags: FLAGS_OFF })).toEqual({
      kind: "tracked",
      url: "https://elevenlabs.io/?utm_source=x",
      programId: null,
    });
  });

  it("a program offer gets no utm: the partner's own link is used as it is", () => {
    const r = resolve();
    expect(r.kind === "tracked" && r.url.includes("utm_")).toBe(false);
  });

  it("the start of the window is inclusive and the end is exclusive", () => {
    expect(resolve({ offer: offer({ startsAt: NOW }) }).kind).toBe("tracked");
    expect(resolve({ offer: offer({ endsAt: NOW }) })).toEqual({ kind: "fallback", url: `https://elevenlabs.io/?${UTM}`, reason: "offer_ended" });
  });
});

describe("resolveOfferRedirect: fallback to the merchant's website_url (the caller records a click)", () => {
  const fallback = (reason: string) => ({ kind: "fallback", url: `https://elevenlabs.io/?${UTM}`, reason });

  it("flag off for the program's type", () => {
    expect(resolve({ flags: { affiliate: false, partner_referral: true } })).toEqual(fallback("flag_off"));
    expect(resolve({ program: prog({ type: "referral" }), flags: { affiliate: true, partner_referral: false } })).toEqual(fallback("flag_off"));
  });

  it("program draft, paused or ended", () => {
    for (const status of ["draft", "paused", "ended"] as const) expect(resolve({ program: prog({ status }) }), status).toEqual(fallback("program_not_active"));
  });

  it("program type direct has no flag, so it never tracks", () => {
    expect(resolve({ program: prog({ type: "direct" }), flags: { affiliate: true, partner_referral: true } })).toEqual(fallback("program_direct"));
  });

  it("offer paused or outside its window", () => {
    expect(resolve({ offer: offer({ status: "paused" }) })).toEqual(fallback("offer_paused"));
    expect(resolve({ offer: offer({ startsAt: "2026-10-06T00:00:00.000Z" }) })).toEqual(fallback("offer_not_started"));
    expect(resolve({ offer: offer({ endsAt: "2026-10-04T00:00:00.000Z" }) })).toEqual(fallback("offer_ended"));
  });

  it("merchant paused", () => {
    expect(resolve({ merchant: merchant({ status: "paused" }) })).toEqual(fallback("merchant_paused"));
  });

  it("an offer without a program that is paused", () => {
    expect(resolve({ program: null, offer: plainOffer({ status: "paused" }) })).toEqual(fallback("offer_paused"));
  });

  it("reports the first failing condition: merchant, offer, window, program status, flag", () => {
    const all = { merchant: merchant({ status: "paused" }), offer: offer({ status: "paused", endsAt: "2026-10-04T00:00:00.000Z" }), program: prog({ status: "draft" }), flags: FLAGS_OFF };
    expect(resolve(all)).toMatchObject({ reason: "merchant_paused" });
    expect(resolve({ ...all, merchant: merchant() })).toMatchObject({ reason: "offer_paused" });
    expect(resolve({ ...all, merchant: merchant(), offer: offer({ endsAt: "2026-10-04T00:00:00.000Z" }) })).toMatchObject({ reason: "offer_ended" });
    expect(resolve({ ...all, merchant: merchant(), offer: offer() })).toMatchObject({ reason: "program_not_active" });
    expect(resolve({ ...all, merchant: merchant(), offer: offer(), program: prog() })).toMatchObject({ reason: "flag_off" });
  });

  it("has no template and no click id in it, and the href is the normalised website_url", () => {
    const r = resolve({ flags: FLAGS_OFF, merchant: merchant({ websiteUrl: "https://ELEVENLABS.IO" }) });
    expect(r).toEqual(fallback("flag_off"));
    expect(JSON.stringify(r)).not.toContain(CLICK);
  });
});

describe("resolveOfferRedirect: not_found", () => {
  const notFound = (reason: string) => ({ kind: "not_found", reason });

  it("missing offer or merchant", () => {
    expect(resolve({ offer: null })).toEqual(notFound("offer_missing"));
    expect(resolve({ merchant: null })).toEqual(notFound("merchant_missing"));
  });

  it("an archived offer or merchant is dead, even when everything else would fall back", () => {
    expect(resolve({ flags: FLAGS_OFF, offer: offer({ status: "archived" }) })).toEqual(notFound("offer_archived"));
    expect(resolve({ flags: FLAGS_OFF, merchant: merchant({ status: "archived" }) })).toEqual(notFound("merchant_archived"));
  });

  it("broken references: no program row, a program of another merchant, a program offer with no template", () => {
    expect(resolve({ program: null })).toEqual(notFound("program_missing"));
    expect(resolve({ program: prog({ id: "P2" }) })).toEqual(notFound("program_missing"));
    expect(resolve({ program: prog({ merchantId: "M2" }) })).toEqual(notFound("program_merchant"));
    expect(resolve({ offer: offer({ trackingTemplate: null }) })).toEqual(notFound("template_missing"));
    expect(resolve({ offer: offer({ trackingTemplate: null }), flags: FLAGS_OFF })).toEqual(notFound("template_missing"));
  });

  it("an offer whose subject is not this merchant (with or without a program)", () => {
    expect(resolve({ offer: offer({ subjectId: "M2" }) })).toEqual(notFound("subject_merchant"));
    expect(resolve({ program: null, offer: plainOffer({ subjectId: "M2" }) })).toEqual(notFound("subject_merchant"));
    expect(resolve({ program: null, offer: plainOffer({ subjectType: "product" }), flags: FLAGS_OFF })).toEqual(notFound("subject_merchant"));
  });

  it("a window the database cannot be read as", () => {
    expect(resolve({ offer: offer({ startsAt: "garbage" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ endsAt: "2026-13-45" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ startsAt: "Oct 5 2026" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ endsAt: "2026-02-31T00:00:00.000Z" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ startsAt: "2026-10-05" }) })).toEqual(notFound("window_invalid"));
  });

  it("corrupt data in the tracked path never redirects: bad template host, bad destination_url", () => {
    expect(resolve({ offer: offer({ trackingTemplate: "https://evil.com/{click_id}" }) })).toEqual(notFound("invalid_url"));
    for (const destinationUrl of ["http://elevenlabs.io", "https://user@elevenlabs.io", "https://127.0.0.1", "https://evil.com", "https://[::1]/"]) {
      expect(resolve({ program: null, offer: plainOffer({ destinationUrl }) }), destinationUrl).toEqual(notFound("invalid_url"));
    }
  });

  it("a website_url that fails the URL rules or allowed_hosts is not_found when a fallback is needed", () => {
    for (const websiteUrl of ["http://elevenlabs.io", "https://evil.com", "https://elevenlabs.io@evil.com", "https://localhost", "https://elevenlabs.io:8443"]) {
      expect(resolve({ flags: FLAGS_OFF, merchant: merchant({ websiteUrl }) }), websiteUrl).toEqual(notFound("website_invalid"));
    }
  });
});

describe("resolveOfferRedirect: the full truth table", () => {
  const WINDOWS = {
    inside: { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" },
    before: { startsAt: "2026-11-01T00:00:00.000Z", endsAt: null },
    after: { startsAt: null, endsAt: "2026-10-01T00:00:00.000Z" },
  } as const;

  it("with a program: 4 types x 4 flag states x 4 program statuses x 3 offer statuses x 3 windows x 3 merchant statuses", () => {
    const wrong: string[] = [];
    let count = 0;
    for (const type of PROGRAM_TYPES)
      for (const affiliate of [true, false])
        for (const partner_referral of [true, false])
          for (const pStatus of PROGRAM_STATUSES)
            for (const oStatus of OFFER_STATUSES)
              for (const [w, window] of Object.entries(WINDOWS))
                for (const mStatus of MERCHANT_STATUSES) {
                  const flagOn = type === "affiliate" ? affiliate : type === "direct" ? false : partner_referral;
                  const expected =
                    oStatus === "archived" || mStatus === "archived"
                      ? "not_found"
                      : oStatus === "active" && w === "inside" && mStatus === "active" && pStatus === "active" && flagOn
                        ? "tracked"
                        : "fallback";
                  const got = resolve({
                    offer: offer({ status: oStatus, ...window }),
                    program: prog({ type, status: pStatus }),
                    merchant: merchant({ status: mStatus }),
                    flags: { affiliate, partner_referral },
                  }).kind;
                  count++;
                  if (got !== expected) wrong.push(`${type}/aff=${affiliate}/ref=${partner_referral}/${pStatus}/${oStatus}/${w}/${mStatus}: ${got} != ${expected}`);
                }
    expect(count).toBe(1728);
    expect(wrong).toEqual([]);
  });

  it("without a program the flags never matter: 3 offer statuses x 3 windows x 3 merchant statuses x 4 flag states", () => {
    const wrong: string[] = [];
    let count = 0;
    for (const oStatus of OFFER_STATUSES)
      for (const [w, window] of Object.entries(WINDOWS))
        for (const mStatus of MERCHANT_STATUSES)
          for (const affiliate of [true, false])
            for (const partner_referral of [true, false]) {
              const expected = oStatus === "archived" || mStatus === "archived" ? "not_found" : oStatus === "active" && w === "inside" && mStatus === "active" ? "tracked" : "fallback";
              const got = resolve({ program: null, offer: plainOffer({ status: oStatus, ...window }), merchant: merchant({ status: mStatus }), flags: { affiliate, partner_referral } }).kind;
              count++;
              if (got !== expected) wrong.push(`${oStatus}/${w}/${mStatus}/${affiliate}/${partner_referral}: ${got} != ${expected}`);
            }
    expect(count).toBe(108);
    expect(wrong).toEqual([]);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/offer.test.ts` → FAIL (thiếu module).

- [ ] **Step 2: Domain `offer`**

`apps/web/src/domain/offer.ts`:

```ts
import { isHttpsUrl } from "./builder-input.ts";
import type { FlagState } from "./flags.ts";
import type { MerchantStatus } from "./merchant.ts";
import { appendUtm, fillAndValidate, parseTemplate, previewUrl, validateFinalUrl, type UrlError, type UrlResult } from "./offer-url.ts";
import { normalizeNewlines } from "./product-input.ts";

/** Programs and offers (addendum §3.2–3.3 with the 2026-10-05 amendments). Pure rules: no Hono, no D1. */

export const PROGRAM_TYPES = ["affiliate", "referral", "revenue_share", "direct"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];
export const PROGRAM_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];
export const PROGRAM_PROVIDERS = ["generic_template", "manual"] as const;
export type ProgramProvider = (typeof PROGRAM_PROVIDERS)[number];
export const COMMISSION_MODELS = ["percent", "flat", "tiered", "custom"] as const;
export type CommissionModel = (typeof COMMISSION_MODELS)[number];
export const OFFER_KINDS = ["official", "trial", "affiliate", "referral", "sponsored"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];
/** i18n keys of the button text; `try_it` is "Try {name}" (Owner 2026-10-05). */
export const LABELS = ["learn_more", "get_started", "start_trial", "visit_site", "try_it"] as const;
export type OfferLabel = (typeof LABELS)[number];
export const OFFER_STATUSES = ["active", "paused", "archived"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

const oneOf = <T extends string>(list: readonly T[], raw: string): T | null => ((list as readonly string[]).includes(raw) ? (raw as T) : null);

/** `YYYY-MM-DD` (midnight UTC) or a full `…Z` instant: the ISO instant, null for empty, or not ok. */
function parseInstant(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z)?$/.test(s)) return { ok: false };
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(s.slice(0, 10))) return { ok: false };
  return { ok: true, value: d.toISOString() };
}

function optInt(raw: string, max: number): { ok: true; value: number | null } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };
  return /^\d{1,10}$/.test(s) && Number(s) <= max ? { ok: true, value: Number(s) } : { ok: false };
}

// ---- Programs ----

/** The conditions to move a program to `active` (ADR-007 rule 5, and the slice rule that `direct` has no flag). Also a CHECK in 0011. */
export function programActivationError(p: { type: ProgramType; termsUrl: string | null; termsVerifiedAt: string | null }): "direct_not_active" | "terms_missing" | null {
  if (p.type === "direct") return "direct_not_active";
  return p.termsUrl && p.termsVerifiedAt ? null : "terms_missing";
}

export type ProgramFormValues = {
  name: string;
  type: string;
  network: string;
  provider: string;
  commissionModel: string;
  commissionRateBps: string;
  commissionFlatMinor: string;
  currency: string;
  cookieDays: string;
  attributionNotes: string;
  termsUrl: string;
  termsVerifiedAt: string;
  status: string;
};
export type ProgramField = keyof ProgramFormValues;
export type ProgramFieldError = "required" | "too_long" | "choice" | "number" | "currency" | "url" | "date" | "terms_missing" | "direct_not_active";
export type ProgramInput = {
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commissionModel: CommissionModel | null;
  commissionRateBps: number | null;
  commissionFlatMinor: number | null;
  currency: string | null;
  cookieDays: number | null;
  attributionNotes: string | null;
  termsUrl: string | null;
  termsVerifiedAt: string | null;
  status: ProgramStatus;
};

/** Empty means null: no commission, cookie or currency value is ever defaulted (ADR-007 rule 5). */
export function parseProgramForm(v: ProgramFormValues): { ok: true; program: ProgramInput } | { ok: false; errors: Partial<Record<ProgramField, ProgramFieldError>> } {
  const errors: Partial<Record<ProgramField, ProgramFieldError>> = {};
  const name = v.name.trim();
  if (name === "") errors.name = "required";
  else if (name.length > 80) errors.name = "too_long";
  const network = v.network.trim();
  if (network.length > 80) errors.network = "too_long";
  const notes = normalizeNewlines(v.attributionNotes).trim();
  if (notes.length > 1000) errors.attributionNotes = "too_long";

  const type = oneOf(PROGRAM_TYPES, v.type);
  if (!type) errors.type = "choice";
  const provider = oneOf(PROGRAM_PROVIDERS, v.provider);
  if (!provider) errors.provider = "choice";
  const status = oneOf(PROGRAM_STATUSES, v.status);
  if (!status) errors.status = "choice";
  const modelRaw = v.commissionModel.trim();
  const commissionModel = modelRaw === "" ? null : oneOf(COMMISSION_MODELS, modelRaw);
  if (modelRaw !== "" && !commissionModel) errors.commissionModel = "choice";

  const rate = optInt(v.commissionRateBps, 10_000);
  if (!rate.ok) errors.commissionRateBps = "number";
  const flat = optInt(v.commissionFlatMinor, 1_000_000_000);
  if (!flat.ok) errors.commissionFlatMinor = "number";
  const cookie = optInt(v.cookieDays, 3650);
  if (!cookie.ok) errors.cookieDays = "number";
  const currency = v.currency.trim().toUpperCase();
  if (currency !== "" && !/^[A-Z]{3}$/.test(currency)) errors.currency = "currency";

  const termsUrl = v.termsUrl.trim();
  if (termsUrl !== "" && (termsUrl.length > 500 || !isHttpsUrl(termsUrl))) errors.termsUrl = "url";
  const verified = v.termsVerifiedAt.trim();
  if (verified !== "" && !(verified.length === 10 && parseInstant(verified).ok)) errors.termsVerifiedAt = "date";

  if (type && status === "active" && !errors.termsUrl && !errors.termsVerifiedAt) {
    const why = programActivationError({ type, termsUrl: termsUrl || null, termsVerifiedAt: verified || null });
    if (why) errors.status = why;
  }

  if (Object.keys(errors).length > 0 || !type || !provider || !status || !rate.ok || !flat.ok || !cookie.ok) return { ok: false, errors };
  return {
    ok: true,
    program: {
      name,
      type,
      network: network || null,
      provider,
      commissionModel,
      commissionRateBps: rate.value,
      commissionFlatMinor: flat.value,
      currency: currency || null,
      cookieDays: cookie.value,
      attributionNotes: notes || null,
      termsUrl: termsUrl || null,
      termsVerifiedAt: verified || null,
      status,
    },
  };
}

/** The flag that must be on for a program of this type to track a click; `direct` has none, so it can never track. */
export function flagForProgram(type: ProgramType): "affiliate" | "partner_referral" | null {
  if (type === "affiliate") return "affiliate";
  return type === "direct" ? null : "partner_referral";
}

// ---- Offers ----

export type OfferFormValues = { kind: string; label: string; destinationUrl: string; trackingTemplate: string; startsAt: string; endsAt: string; status: string };
export type OfferField = "programId" | "kind" | "label" | "destinationUrl" | "trackingTemplate" | "startsAt" | "endsAt" | "status";
export type OfferFieldError =
  | "required"
  | "choice"
  | "date"
  | "date_order"
  | "program_merchant"
  | "template_required"
  | "template_without_program"
  | "same_as_template"
  | `url_${UrlError}`
  | `template_${"braces" | "placeholder" | "placeholder_position" | UrlError}`;
/** The merchant the offer belongs to (subject) and the program picked for it, if any. The caller loads both; the merchant match is checked here. */
export type OfferContext = { merchant: { id: string; allowedHosts: readonly string[] }; program: { id: string; merchantId: string } | null };
export type OfferInput = {
  programId: string | null;
  subjectType: "merchant";
  subjectId: string;
  kind: OfferKind;
  label: OfferLabel;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
};

export function parseOfferForm(v: OfferFormValues, ctx: OfferContext): { ok: true; offer: OfferInput } | { ok: false; errors: Partial<Record<OfferField, OfferFieldError>> } {
  const errors: Partial<Record<OfferField, OfferFieldError>> = {};
  const hosts = ctx.merchant.allowedHosts;
  const kind = oneOf(OFFER_KINDS, v.kind);
  if (!kind) errors.kind = "choice";
  const label = oneOf(LABELS, v.label);
  if (!label) errors.label = "choice";
  const status = oneOf(OFFER_STATUSES, v.status);
  if (!status) errors.status = "choice";
  if (ctx.program && ctx.program.merchantId !== ctx.merchant.id) errors.programId = "program_merchant";

  let destinationUrl = "";
  const destRaw = v.destinationUrl.trim();
  if (destRaw === "") {
    errors.destinationUrl = "required";
  } else {
    const d = validateFinalUrl(destRaw, hosts);
    if (d.ok) destinationUrl = d.url;
    else errors.destinationUrl = `url_${d.error}`;
  }

  let trackingTemplate: string | null = null;
  const tplRaw = v.trackingTemplate.trim();
  if (tplRaw !== "") {
    const t = parseTemplate(tplRaw, hosts);
    if (t.ok) trackingTemplate = t.template;
    else errors.trackingTemplate = `template_${t.error}`;
  } else if (ctx.program) {
    errors.trackingTemplate = "template_required";
  }
  if (tplRaw !== "" && !ctx.program) errors.trackingTemplate = "template_without_program";
  // destination_url is the untracked link: it must differ from the partner link once both are normalised (placeholders filled with the samples).
  if (destinationUrl && trackingTemplate) {
    const sample = previewUrl(trackingTemplate, hosts);
    if (sample.ok && sample.url === destinationUrl) errors.destinationUrl = "same_as_template";
  }

  const starts = parseInstant(v.startsAt);
  if (!starts.ok) errors.startsAt = "date";
  const ends = parseInstant(v.endsAt);
  if (!ends.ok) errors.endsAt = "date";
  if (starts.ok && ends.ok && starts.value && ends.value && ends.value <= starts.value) errors.endsAt = "date_order";

  if (Object.keys(errors).length > 0 || !kind || !label || !status || !starts.ok || !ends.ok) return { ok: false, errors };
  return {
    ok: true,
    offer: {
      programId: ctx.program?.id ?? null,
      subjectType: "merchant",
      subjectId: ctx.merchant.id,
      kind,
      label,
      destinationUrl,
      trackingTemplate,
      startsAt: starts.value,
      endsAt: ends.value,
      status,
    },
  };
}

// ---- Redirect resolution ----

export type RedirectOffer = {
  id: string;
  subjectType: "product" | "merchant" | "article";
  subjectId: string;
  programId: string | null;
  status: OfferStatus;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
};
export type RedirectProgram = { id: string; merchantId: string; type: ProgramType; status: ProgramStatus };
export type RedirectMerchant = { id: string; status: MerchantStatus; websiteUrl: string; allowedHosts: readonly string[] };
export type RedirectInput = {
  offer: RedirectOffer | null;
  program: RedirectProgram | null;
  merchant: RedirectMerchant | null;
  flags: Pick<FlagState, "affiliate" | "partner_referral">;
  /** ISO instant. */
  now: string;
  /** ULID the caller generated; it is the id of the click row and fills `{click_id}`. */
  clickId: string;
  locale: string;
  src: string;
};
export type FallbackReason = "merchant_paused" | "offer_paused" | "offer_not_started" | "offer_ended" | "program_not_active" | "program_direct" | "flag_off";
export type NotFoundReason =
  | "offer_missing"
  | "offer_archived"
  | "merchant_missing"
  | "merchant_archived"
  | "subject_merchant"
  | "program_missing"
  | "program_merchant"
  | "template_missing"
  | "window_invalid"
  | "invalid_url"
  | "website_invalid";
/**
 * `tracked` and `fallback` both redirect and the caller records a click (id = `clickId`); `fallback` carries no template, so no click id
 * reaches the partner. `not_found` records nothing. `url` is always a re-validated href: put it in `Location` and nowhere else.
 */
export type RedirectResult =
  | { kind: "tracked"; url: string; programId: string | null }
  | { kind: "fallback"; url: string; reason: FallbackReason }
  | { kind: "not_found"; reason: NotFoundReason };

const notFound = (reason: NotFoundReason): RedirectResult => ({ kind: "not_found", reason });

/** Validate, add utm, validate again: the string that is returned is the one that was checked. */
function withUtm(raw: string, allowed: readonly string[]): UrlResult {
  const first = validateFinalUrl(raw, allowed);
  return first.ok ? validateFinalUrl(appendUtm(first.url), allowed) : first;
}

/** Only the canonical `YYYY-MM-DDTHH:MM:SS.mmmZ` form (what the form saves), round-tripped; anything else reads as NaN. */
const instantMs = (s: string): number => {
  const t = Date.parse(s);
  return !Number.isNaN(t) && new Date(t).toISOString() === s ? t : NaN;
};

function windowState(offer: RedirectOffer, now: string): "inside" | "before" | "after" | "invalid" {
  const at = Date.parse(now);
  const starts = offer.startsAt === null ? -Infinity : instantMs(offer.startsAt);
  const ends = offer.endsAt === null ? Infinity : instantMs(offer.endsAt);
  if (Number.isNaN(at) || Number.isNaN(starts) || Number.isNaN(ends)) return "invalid";
  if (at < starts) return "before";
  return at >= ends ? "after" : "inside";
}

/**
 * Plan header, Reviewer decisions 8–10. Missing or archived offer or merchant, a broken reference, or a URL that fails the rules: not_found.
 * Otherwise, when every condition of addendum §3.3 holds: tracked. When one fails: fallback to the merchant's website_url (the first
 * failing condition is the reason), or not_found when that URL fails the rules. No I/O; the destination comes only from the rows passed in.
 */
export function resolveOfferRedirect(i: RedirectInput): RedirectResult {
  const { offer, merchant } = i;
  if (!offer) return notFound("offer_missing");
  if (offer.status === "archived") return notFound("offer_archived");
  if (!merchant) return notFound("merchant_missing");
  if (merchant.status === "archived") return notFound("merchant_archived");
  if (offer.subjectType !== "merchant" || offer.subjectId !== merchant.id) return notFound("subject_merchant");
  const program = offer.programId === null ? null : i.program;
  if (offer.programId !== null) {
    if (!program || program.id !== offer.programId) return notFound("program_missing");
    if (program.merchantId !== merchant.id) return notFound("program_merchant");
    if (offer.trackingTemplate === null) return notFound("template_missing");
  }
  const window = windowState(offer, i.now);
  if (window === "invalid") return notFound("window_invalid");

  let reason: FallbackReason | null = null;
  if (merchant.status !== "active") reason = "merchant_paused";
  else if (offer.status !== "active") reason = "offer_paused";
  else if (window === "before") reason = "offer_not_started";
  else if (window === "after") reason = "offer_ended";
  else if (program) {
    const flag = flagForProgram(program.type);
    if (program.status !== "active") reason = "program_not_active";
    else if (flag === null) reason = "program_direct";
    else if (!i.flags[flag]) reason = "flag_off";
  }

  if (reason === null) {
    if (!program) {
      const url = withUtm(offer.destinationUrl, merchant.allowedHosts);
      return url.ok ? { kind: "tracked", url: url.url, programId: null } : notFound("invalid_url");
    }
    const url = fillAndValidate(offer.trackingTemplate ?? "", { click_id: i.clickId, locale: i.locale, src: i.src }, merchant.allowedHosts);
    return url.ok ? { kind: "tracked", url: url.url, programId: program.id } : notFound("invalid_url");
  }
  const site = withUtm(merchant.websiteUrl, merchant.allowedHosts);
  return site.ok ? { kind: "fallback", url: site.url, reason } : notFound("website_invalid");
}
```

Chạy: `npm test -w apps/web -- test/domain/offer.test.ts test/domain/offer-url.test.ts test/domain/merchant.test.ts` → PASS.

- [ ] **Step 3: Kiểm ranh giới**

```bash
npm test -w apps/web -- test/architecture.test.ts
grep -rniE "elevenlabs|partnerstack" apps/web/src; test $? -eq 1
```

- [ ] **Step 4: Kiểm toàn bộ và commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/domain/offer.ts apps/web/test/domain/offer.test.ts
git commit -m "feat(web): pure program and offer rules and redirect resolution (VNX-2102a-2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận:**
- `npm test -w apps/web -- test/domain/offer.test.ts test/architecture.test.ts` xanh.
- `resolveOfferRedirect`: test bảng đầy đủ 1728 tổ hợp có chương trình và 108 tổ hợp không chương trình (test đếm `count`), cộng các ca có tên cho từng lý do `fallback` và `not_found`; archived → `not_found` kể cả khi cờ tắt; `fallback` không chứa template hay `click_id`; `website_url` hỏng → `not_found`.
- Review Focus 6 ở tầng domain: `parseProgramForm` từ chối `active` thiếu `terms_url` hoặc `terms_verified_at` và `direct` → `active`; trường trống là `null` (không mặc định); offer có chương trình thiếu template, `program.merchant_id` khác merchant của offer, `destination_url` bằng template chuẩn hóa hoặc điền mẫu đều bị từ chối; nhãn `try_it` hợp lệ.
- `grep -rniE "elevenlabs|partnerstack" apps/web/src` không in dòng nào; `domain/offer.ts` không chứa `D1Database` hay `hono`.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ≈ 745 dòng: `offer.ts` ~290, test ~455, phần lớn là bảng sự thật. Vượt ngưỡng ≲ 600 vì test; nếu Owner muốn giữ ngưỡng theo nghĩa đen, tách `resolveOfferRedirect` (+ `flagForProgram`, ~150 dòng mã, ~250 dòng test) thành 2b-ii; mã không đổi khi tách.

---

### Task 2c: VNX-2102a-3 — Migration `0011_partners`, db merchant và chương trình, nối test kiến trúc

**Tách đôi (Planner đề xuất, kích thước):** cả phần 2c gốc ước ≈ 940 dòng (migration ~75, db ~470, fixtures ~60, test ~330). Task này là phần một, ≈ 640 dòng (không locale): migration cho cả ba bảng, guard audit mới, `db/merchants.ts`, `db/programs.ts`, fixtures `makeMerchant` / `makeProgram`, nối test kiến trúc. Phần hai là Task 2d (bên dưới): `db/offers.ts`, `setDefaultOffer`, `makeOffer`. Các hàm đọc dành cho `/tools` và `/disclosure` (`findMerchantBySlug`, `listActiveMerchantOffers`, `listActiveProgramMerchants`) **không** nằm ở 2c/2d: Task 5 và 6 tự thêm (Task 3 không cần).

**Files:**
- Create: `apps/web/migrations/0011_partners.sql`
- Create: `apps/web/src/db/merchants.ts`, `apps/web/src/db/programs.ts`
- Modify: `apps/web/src/db/audit.ts` (guard `AuditPartnerGuard`, hàm `runAudited`)
- Modify: `apps/web/src/domain/merchant.ts` (`merchantTransitionAllowed`), `apps/web/src/domain/offer.ts` (`programTransitionAllowed`)
- Modify: `apps/web/test/fixtures.ts` (`makeMerchant`, `makeProgram`), `apps/web/test/architecture.test.ts`, `apps/web/wrangler.jsonc` (chỉ comment)
- Test: `apps/web/test/domain/merchant.test.ts`, `apps/web/test/domain/offer.test.ts` (thêm test chuyển trạng thái), `apps/web/test/db/partners-migration.test.ts`, `apps/web/test/db/merchants.test.ts`, `apps/web/test/db/programs.test.ts`
- Không có chuỗi giao diện, không sửa route.

**Interfaces:**
- Consumes (đã commit): `MerchantInput`, `MerchantStatus` (`domain/merchant.ts`); `ProgramInput`, `ProgramType`, `ProgramStatus`, `ProgramProvider`, `CommissionModel` (`domain/offer.ts`); `isPublicHostname` (`domain/offer-url.ts`); `auditStatement`, `AuditInput` (`db/audit.ts`); `ulid` (`lib/ulid.ts`).
- Produces (`db/audit.ts`): `type AuditPartnerGuard = { partnerTable: "merchants" | "partner_programs"; id: string; writeId: string }` (Task 2d thêm `"offers"`) (thêm vào union `onlyIf` của `auditStatement`); `runAudited<T>(db, write, audit, guard): Promise<T | null>`.
- Produces (domain): `merchantTransitionAllowed(from, to)`, `programTransitionAllowed(from, to)`.
- Produces (`db/merchants.ts`): `type Merchant`; `parseStoredHosts(raw)`; `createMerchant(db, { merchant, status, actorUserId, now })` → `{ ok: true; merchant } | { ok: false; reason: "slug_taken" }`; `updateMerchant(db, { id, merchant: Omit<MerchantInput, "slug">, actorUserId, now })` → `Merchant | null`; `setMerchantStatus(db, { id, from, to, actorUserId, now })` → `Merchant | null`; `findMerchantById(db, id)`; `listMerchants(db)`.
- Produces (`db/programs.ts`): `type PartnerProgram`; `createProgram(db, { merchantId, program, actorUserId, now })` → `PartnerProgram | null` (null khi merchant không tồn tại); `updateProgram(db, { id, program, expectedStatus, actorUserId, now })` → `PartnerProgram | null` (null khi không có dòng hoặc `status` hiện tại khác `expectedStatus`); `findProgramById(db, id)`; `listProgramsByMerchant(db, merchantId)`.
- Produces (`test/fixtures.ts`): `makeMerchant(overrides?)`, `makeProgram(merchant, overrides?)`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **`write_id` trên cả ba bảng** (bài học Task 1): mỗi lệnh ghi đặt `write_id` mới (ULID); dòng audit đi cùng `db.batch` chỉ được ghi khi `write_id` hiện tại của dòng bằng giá trị đó (`AuditPartnerGuard`). Ghi thua (compare-and-set không khớp, `ON CONFLICT DO NOTHING`, không có dòng) thì không có audit. `runAudited` gom việc "một câu ghi có `RETURNING` + audit có guard trong một batch", trả dòng hoặc `null`. Không dùng `meta.changes`. SQL guard viết **literal từng bảng** (`FROM merchants`, `FROM partner_programs`; Task 2d thêm `FROM offers`), không nội suy tên bảng, để test allowlist tiền nhìn thấy chúng; vì vậy `db/audit.ts` nằm trong `MONEY_ALLOWED` (chỉ đọc `write_id` để canh dòng audit). `MONEY_ALLOWED` sau 2c đúng ba file: `db/merchants.ts`, `db/programs.ts`, `db/audit.ts`.
2. **CHECK vi phạm thì ném lỗi, không trả `null`** (chốt chặn cuối, không phải cơ chế chính; các test không dùng chúng để chứng minh tính nguyên tử, việc đó do thiết kế `write_id` + batch). `createProgram` / `updateProgram` không tự kiểm lại luật `active` ở SQL (domain Task 2b đã kiểm, CHECK của CSDL là chốt chặn cuối); Route Task 3 chỉ gọi sau khi `parseProgramForm` đã ok nên lỗi này nghĩa là lỗi lập trình, trả 500.
3. **Compare-and-set theo `status`:** `setMerchantStatus` (`WHERE status = from`), `updateProgram` (`WHERE status = expectedStatus`, kể cả khi form không đổi status). Sửa trường khác không có CAS thứ hai (người sửa sau thắng; chấp nhận cho một admin). Audit action: `merchant.status` / `program.status` khi `status` đổi, `merchant.update` / `program.update` khi không.
4. **`slug` merchant không đổi được sau khi tạo** (`updateMerchant` không nhận slug): `/go/:slug` và `/tools/:slug` là URL được chia sẻ, đổi slug làm chết link. Task 3 hiện slug chỉ đọc ở form sửa.
5. **`createMerchant` bắt buộc truyền `status`** (không mặc định ở db): luật nghiệp vụ "merchant mới ở trạng thái nào" thuộc Task 3 (xem câu hỏi mở trong báo cáo Planner). Fixture `makeMerchant` mặc định `active`.
6. **Không có DEFAULT trên bất kỳ cột nào** (Controller, theo review): `indexable`, `status`, `write_id`, `description`… do db truyền (`createMerchant` truyền `indexable` tường minh). Test migration khẳng định không có `\bDEFAULT\b` nào.
7. **`ON DELETE`:** mọi FK để mặc định (NO ACTION: xóa dòng cha còn con bị từ chối); không có lệnh xóa nào ở slice nên không có xóa dây chuyền. `merchants.default_offer_id` và `offers.subject_id` không có FK (vòng / đa hình), kiểm ở db (Task 2d).
8. `allowed_hosts` có `CHECK (json_valid(allowed_hosts))` nên chuỗi không phải JSON không vào được CSDL; `parseStoredHosts` vẫn phòng thủ cho JSON sai hình dạng (ví dụ `{"a":1}`, mảng lẫn IP) và JSON hỏng.
9. **CHECK chương trình `active` và offer (theo review):** chương trình `active` cần `terms_url` và `terms_verified_at` khác NULL **và khác chuỗi rỗng**, và `type != 'direct'`; `CHECK (program_id IS NULL OR (tracking_template IS NOT NULL AND tracking_template <> ''))`: offer có chương trình cần `tracking_template` khác NULL và khác rỗng. Có test cho cả chuỗi rỗng.
10. **Trạng thái cuối (Controller):** merchant `archived` và chương trình `ended` là **cuối cùng**, không chuyển ra được. Ép ở domain bằng hàm thuần `merchantTransitionAllowed(from, to)` (`domain/merchant.ts`) và `programTransitionAllowed(from, to)` (`domain/offer.ts`; `from === to` là "không đổi", luôn được), và ở db trong chính câu compare-and-set (`setMerchantStatus`: `AND ?2 <> ?3 AND ?2 <> 'archived'`, nên `from === to` cũng không ghi gì; `updateProgram`: `AND (status <> 'ended' OR ?15 = 'ended')`). Task 3 dùng hai hàm domain để ẩn nút và báo lỗi. Slug merchant không đổi sau khi tạo (mục 4). Form Task 3 tạo merchant mới ở `paused` (db vẫn bắt buộc truyền `status`, mục 5).
11. **`created_at` trong fixture:** `makeMerchant` và `makeProgram` dùng chung đồng hồ `fixtureClock` tăng 1 giây mỗi lần gọi, bắt đầu `2026-10-01T00:00:00.000Z`, trước mọi `at(n)` (`2026-10-05...`) của test, nên `merchant.create` luôn sắp trước `merchant.update`.
12. Lưu ý khi viết chuỗi SQL: test kiến trúc "ghi bảng chỉ từ module sở hữu" quét `INSERT INTO|UPDATE|DELETE FROM <tên>` viết hoa; không viết các cụm đó (viết hoa) trong comment hay chuỗi không phải SQL.

- [ ] **Step 1: Test migration (fail)**

`apps/web/test/db/partners-migration.test.ts` (không dùng fixtures; chỉ SQL thô, nên chạy được trước khi có module db):

```ts
import { describe, expect, it } from "vitest";
import { ulid } from "../../src/lib/ulid.ts";
import { testEnv } from "../helpers.ts";

const files = import.meta.glob("../../migrations/0011_partners.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const code = (Object.values(files)[0] ?? "")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const NOW = "2026-10-05T00:00:00.000Z";

type Cols = Record<string, string | number | null>;
async function insert(table: string, cols: Cols): Promise<string> {
  const id = ulid();
  const all: Cols = { id, write_id: "w", created_at: NOW, updated_at: NOW, ...cols };
  const keys = Object.keys(all);
  await testEnv.DB.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(", ")})`)
    .bind(...keys.map((k) => all[k] ?? null))
    .run();
  return id;
}
const merchant = (o: Cols = {}) =>
  insert("merchants", { indexable: 0, slug: `m-${ulid().slice(-10).toLowerCase()}`, name: "M", website_url: "https://example.com/", allowed_hosts: '["example.com"]', description: "", status: "active", ...o });
const program = (merchantId: string, o: Cols = {}) =>
  insert("partner_programs", { merchant_id: merchantId, name: "P", type: "affiliate", provider: "manual", status: "draft", ...o });
const offer = (merchantId: string, o: Cols = {}) =>
  insert("offers", { subject_type: "merchant", subject_id: merchantId, kind: "official", label: "visit_site", destination_url: "https://example.com/", status: "active", ...o });

describe("0011_partners (addendum §3.2, Review Focus 6)", () => {
  it("is additive, has no DEFAULT at all and no cascade", () => {
    expect(code).toMatch(/CREATE TABLE merchants/);
    expect(code).not.toMatch(/\b(DROP|ALTER)\b/i);
    expect(code).not.toMatch(/ON DELETE/i);
    expect(code).not.toMatch(/\bDEFAULT\b/i);
  });

  it("leaves commission, cookie and currency empty when nothing is given", async () => {
    const p = await program(await merchant());
    const row = await testEnv.DB.prepare("SELECT commission_model, commission_rate_bps, commission_flat_minor, currency, cookie_days FROM partner_programs WHERE id = ?1").bind(p).first();
    expect(row).toEqual({ commission_model: null, commission_rate_bps: null, commission_flat_minor: null, currency: null, cookie_days: null });
  });

  it("merchants: slug unique, status and JSON checked, indexable has no default", async () => {
    await merchant({ slug: "dup-slug-0011" });
    await expect(merchant({ slug: "dup-slug-0011" })).rejects.toThrow();
    await expect(merchant({ status: "deleted" })).rejects.toThrow();
    await expect(merchant({ allowed_hosts: "not json" })).rejects.toThrow();
    await expect(merchant({ indexable: 2 })).rejects.toThrow();
    await expect(
      testEnv.DB.prepare("INSERT INTO merchants (id, slug, name, website_url, allowed_hosts, description, status, write_id, created_at, updated_at) VALUES ('x', 'no-indexable', 'M', 'https://example.com/', '[]', '', 'active', 'w', ?1, ?1)").bind(NOW).run(),
    ).rejects.toThrow();
  });

  it("programs: active needs terms_url, terms_verified_at and a type other than direct", async () => {
    const m = await merchant();
    const terms = { terms_url: "https://example.com/terms", terms_verified_at: NOW };
    await expect(program(m, { status: "active" })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_url: terms.terms_url })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_verified_at: NOW })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_url: "", terms_verified_at: NOW })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_url: terms.terms_url, terms_verified_at: "" })).rejects.toThrow();
    await expect(program(m, { status: "active", type: "direct", ...terms })).rejects.toThrow();
    await expect(program(m, { status: "active", ...terms })).resolves.toBeTypeOf("string");
    await expect(program(m, { status: "draft", type: "direct" })).resolves.toBeTypeOf("string");
    await expect(program(m, { status: "paused" })).resolves.toBeTypeOf("string");
    await expect(program(m, { type: "barter" })).rejects.toThrow();
    await expect(program(m, { commission_model: "magic" })).rejects.toThrow();
  });

  it("programs: merchant_id must exist and a merchant with programs cannot be deleted", async () => {
    await expect(program("no-such-merchant")).rejects.toThrow();
    const m = await merchant();
    await program(m);
    await expect(testEnv.DB.prepare("DELETE FROM merchants WHERE id = ?1").bind(m).run()).rejects.toThrow();
  });

  it("offers: a program needs a non-empty tracking template; label and subject_type are enums", async () => {
    const m = await merchant();
    const p = await program(m);
    await expect(offer(m, { program_id: p })).rejects.toThrow();
    await expect(offer(m, { program_id: p, tracking_template: "" })).rejects.toThrow();
    await expect(offer(m, { program_id: p, tracking_template: "https://example.com/c?x={click_id}" })).resolves.toBeTypeOf("string");
    await expect(offer(m)).resolves.toBeTypeOf("string");
    await expect(offer(m, { label: "try_it" })).resolves.toBeTypeOf("string");
    await expect(offer(m, { label: "buy_now" })).rejects.toThrow();
    await expect(offer(m, { subject_type: "person" })).rejects.toThrow();
    await expect(offer(m, { kind: "gift" })).rejects.toThrow();
    await expect(offer(m, { status: "deleted" })).rejects.toThrow();
    await expect(offer(m, { program_id: "no-such-program", tracking_template: "https://example.com/c" })).rejects.toThrow();
  });
});
```

```bash
npm test -w apps/web -- test/db/partners-migration.test.ts
```

Expected: FAIL (không có bảng `merchants`).

- [ ] **Step 2: Migration**

`apps/web/migrations/0011_partners.sql`:

```sql
-- EPIC 21 partners (addendum §3.2). Additive only: three new tables, nothing existing is changed.
-- Terms are never defaulted (ADR-007 rule 5): commission, cookie and currency columns may be NULL.
-- No DEFAULT anywhere: every value is chosen by the db module. Foreign keys keep the default NO ACTION: nothing cascades.
-- `write_id` is the random id of the last write; the audit row of that write is guarded on it (see AuditPartnerGuard).
-- No FK on merchants.default_offer_id (a cycle with offers) or offers.subject_id (polymorphic): the db modules check them.
CREATE TABLE merchants (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  website_url      TEXT NOT NULL,
  -- JSON array of host names (domain/offer-url.ts#isPublicHostname); read through parseStoredHosts.
  allowed_hosts    TEXT NOT NULL CHECK (json_valid(allowed_hosts)),
  logo_key         TEXT,
  description      TEXT NOT NULL,
  default_offer_id TEXT,
  indexable        INTEGER NOT NULL CHECK (indexable IN (0, 1)),
  status           TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  write_id         TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE partner_programs (
  id                    TEXT PRIMARY KEY,
  merchant_id           TEXT NOT NULL REFERENCES merchants (id),
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('affiliate', 'referral', 'revenue_share', 'direct')),
  network               TEXT,
  provider              TEXT NOT NULL CHECK (provider IN ('generic_template', 'manual')),
  commission_model      TEXT CHECK (commission_model IS NULL OR commission_model IN ('percent', 'flat', 'tiered', 'custom')),
  commission_rate_bps   INTEGER,
  commission_flat_minor INTEGER,
  currency              TEXT,
  cookie_days           INTEGER,
  attribution_notes     TEXT,
  terms_url             TEXT,
  terms_verified_at     TEXT,
  status                TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  write_id              TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  -- ADR-007 rule 5, and the slice rule that `direct` has no flag so it can never be active (also checked in domain/offer.ts).
  CHECK (status != 'active' OR (terms_url IS NOT NULL AND terms_url <> '' AND terms_verified_at IS NOT NULL AND terms_verified_at <> '' AND type != 'direct'))
);
CREATE INDEX idx_programs_merchant ON partner_programs (merchant_id, status);

CREATE TABLE offers (
  id                TEXT PRIMARY KEY,
  -- NULL = an offer that earns nothing (the merchant's own link).
  program_id        TEXT REFERENCES partner_programs (id),
  subject_type      TEXT NOT NULL CHECK (subject_type IN ('product', 'merchant', 'article')),
  subject_id        TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('official', 'trial', 'affiliate', 'referral', 'sponsored')),
  label             TEXT NOT NULL CHECK (label IN ('learn_more', 'get_started', 'start_trial', 'visit_site', 'try_it')),
  destination_url   TEXT NOT NULL,
  tracking_template TEXT,
  status            TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  starts_at         TEXT,
  ends_at           TEXT,
  write_id          TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  -- An offer with a program needs a real template: NULL and the empty string are both refused.
  CHECK (program_id IS NULL OR (tracking_template IS NOT NULL AND tracking_template <> ''))
);
CREATE INDEX idx_offers_subject ON offers (subject_type, subject_id, status);
CREATE INDEX idx_offers_program ON offers (program_id);
```

```bash
npm test -w apps/web -- test/db/partners-migration.test.ts
```

Expected: PASS (`applyD1Migrations` đọc thư mục `migrations`).

- [ ] **Step 3: Guard audit, `db/merchants.ts`, fixture `makeMerchant` (test trước)**

`apps/web/test/db/merchants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import { createMerchant, findMerchantById, listMerchants, parseStoredHosts, setMerchantStatus, updateMerchant } from "../../src/db/merchants.ts";
import type { MerchantInput } from "../../src/domain/merchant.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeMerchant } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
// Distinct instants: ULIDs are not monotonic inside one millisecond, so audit order is never read from ids.
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const slugOf = () => `acme-${ulid().slice(-8).toLowerCase()}`;
const input = (o: Partial<MerchantInput> = {}): MerchantInput => ({
  name: "Acme",
  slug: slugOf(),
  websiteUrl: "https://example.com/",
  allowedHosts: ["example.com", "app.example.com"],
  description: "Plain text.",
  indexable: false,
  ...o,
});
const audits = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, actor_user_id, data FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; actor_user_id: string; data: string }>()).results;
const actionsOf = async (entityId: string) => (await audits(entityId)).map((a) => a.action);

describe("db/merchants (addendum §3.2)", () => {
  it("creates a merchant with one audit row", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = input();
    const res = await createMerchant(testEnv.DB, { merchant: m, status: "paused", actorUserId: admin.id, now: at(1) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.merchant).toMatchObject({ slug: m.slug, name: "Acme", status: "paused", indexable: false, defaultOfferId: null, logoKey: null, allowedHosts: ["example.com", "app.example.com"], createdAt: at(1), updatedAt: at(1) });
    const rows = await audits(res.merchant.id);
    expect(rows.map((r) => r.action)).toEqual(["merchant.create"]);
    expect(rows[0]?.actor_user_id).toBe(admin.id);
    expect(JSON.parse(rows[0]?.data ?? "{}")).toEqual({ slug: m.slug });
  });

  it("a taken slug returns slug_taken and writes neither a row nor an audit row", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const first = input();
    await createMerchant(testEnv.DB, { merchant: first, status: "active", actorUserId: admin.id, now: at(1) });
    const second = await createMerchant(testEnv.DB, { merchant: { ...first, name: "Other" }, status: "active", actorUserId: admin.id, now: at(2) });
    expect(second).toEqual({ ok: false, reason: "slug_taken" });
    const n = async (sql: string) => (await testEnv.DB.prepare(sql).bind(first.slug).first<{ n: number }>())?.n;
    expect(await n("SELECT COUNT(*) AS n FROM merchants WHERE slug = ?1")).toBe(1);
    expect(await n("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'merchant.create' AND json_extract(data, '$.slug') = ?1")).toBe(1);
  });

  it("updates every field except slug and status, with one merchant.update audit row; an unknown id changes nothing", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant({ status: "paused" });
    const next = { name: "Renamed", websiteUrl: "https://shop.example.org/", allowedHosts: ["example.org"], description: "New text.", indexable: true };
    const updated = await updateMerchant(testEnv.DB, { id: m.id, merchant: next, actorUserId: admin.id, now: at(5) });
    expect(updated).toMatchObject({ ...next, slug: m.slug, status: "paused", updatedAt: at(5) });
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.update"]);

    expect(await updateMerchant(testEnv.DB, { id: "missing", merchant: next, actorUserId: admin.id, now: at(6) })).toBeNull();
    expect(await actionsOf("missing")).toEqual([]);
  });

  it("setMerchantStatus is a compare-and-set: the loser writes nothing and audits nothing", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant();
    const won = await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "paused", actorUserId: admin.id, now: at(2) });
    expect(won?.status).toBe("paused");
    const lost = await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "archived", actorUserId: admin.id, now: at(3) });
    expect(lost).toBeNull();
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("paused");
    const rows = await audits(m.id);
    expect(rows.map((r) => r.action)).toEqual(["merchant.create", "merchant.status"]);
    expect(JSON.parse(rows[1]?.data ?? "{}")).toEqual({ from: "active", to: "paused" });
  });

  it("archived is terminal and a status to itself is not a change: nothing is written or audited", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant();
    expect(await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "active", actorUserId: admin.id, now: at(2) })).toBeNull();
    expect((await setMerchantStatus(testEnv.DB, { id: m.id, from: "active", to: "archived", actorUserId: admin.id, now: at(3) }))?.status).toBe("archived");
    for (const to of ["active", "paused", "archived"] as const) {
      expect(await setMerchantStatus(testEnv.DB, { id: m.id, from: "archived", to, actorUserId: admin.id, now: at(4) }), to).toBeNull();
    }
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.status"]);
  });

  it("the audit guard is keyed on the row's last write id (a lost write audits nothing)", async () => {
    const admin = await ensureUser("m-admin@vnx.si");
    const m = await makeMerchant();
    const audit = (writeId: string) =>
      auditStatement(testEnv.DB, { actorUserId: admin.id, action: "merchant.update", entity: "merchant", entityId: m.id, now: at(9) }, { partnerTable: "merchants", id: m.id, writeId });
    await audit("not-the-last-write").run();
    expect(await actionsOf(m.id)).toEqual(["merchant.create"]);
    const real = await testEnv.DB.prepare("SELECT write_id FROM merchants WHERE id = ?1").bind(m.id).first<{ write_id: string }>();
    await audit(real?.write_id ?? "").run();
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.update"]);
  });

  it("parseStoredHosts keeps only public host names and never throws", () => {
    expect(parseStoredHosts('["example.com","Evil.COM","127.0.0.1","localhost","a b.com",7,null]')).toEqual(["example.com"]);
    for (const bad of ["not json", '{"a":1}', '"example.com"', "null", ""]) expect(parseStoredHosts(bad), bad).toEqual([]);
  });

  it("reads allowed_hosts through parseStoredHosts", async () => {
    const m = await makeMerchant();
    await testEnv.DB.prepare("UPDATE merchants SET allowed_hosts = ?2 WHERE id = ?1").bind(m.id, '["example.com","127.0.0.1"]').run();
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual(["example.com"]);
    await testEnv.DB.prepare("UPDATE merchants SET allowed_hosts = ?2 WHERE id = ?1").bind(m.id, '{"a":1}').run();
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual([]);
  });

  it("finds by id and lists by name", async () => {
    const tag = ulid().slice(-6);
    const z = await makeMerchant({ name: `Zed ${tag}` });
    const a = await makeMerchant({ name: `alpha ${tag}` });
    expect(await findMerchantById(testEnv.DB, "missing")).toBeNull();
    const ids = (await listMerchants(testEnv.DB)).map((m) => m.id).filter((id) => id === z.id || id === a.id);
    expect(ids).toEqual([a.id, z.id]);
  });
});
```

```bash
npm test -w apps/web -- test/db/merchants.test.ts
```

Expected: FAIL (không có `db/merchants.ts`, `makeMerchant`).

Sửa `apps/web/src/db/audit.ts`:

1. Thêm kiểu sau `AuditFlagGuard`:

```ts
/** Written only when that merchant / program row's last write carries this write id, i.e. this batch's statement created or changed it (see runAudited). Reads the table only for that. */
export type AuditPartnerGuard = { partnerTable: "merchants" | "partner_programs"; id: string; writeId: string };
```

2. Thêm `| AuditPartnerGuard` vào kiểu tham số `onlyIf` của `auditStatement`, thêm "`partnerTable` on that row's last write id" vào docblock, và thêm nhánh này ngay sau nhánh `"flagKey" in onlyIf` (SQL literal từng bảng):

```ts
  if ("partnerTable" in onlyIf) {
    if (onlyIf.partnerTable === "merchants") {
      return db
        .prepare(
          `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
           WHERE EXISTS (SELECT 1 FROM merchants WHERE id = ?8 AND write_id = ?9)`,
        )
        .bind(...values, onlyIf.id, onlyIf.writeId);
    }
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM partner_programs WHERE id = ?8 AND write_id = ?9)`,
      )
      .bind(...values, onlyIf.id, onlyIf.writeId);
  }
```

3. Thêm sau `writeAudit`:

```ts
/**
 * One write statement that ends in RETURNING, and its audit row guarded on that write, in one db.batch (so both or neither).
 * Returns the row, or null when the statement changed nothing; then no audit row exists either.
 */
export async function runAudited<T>(db: D1Database, write: D1PreparedStatement, audit: AuditInput, guard: AuditPartnerGuard): Promise<T | null> {
  const [res] = await db.batch<T>([write, auditStatement(db, audit, guard)]);
  return res?.results[0] ?? null;
}
```

`apps/web/src/db/merchants.ts`:

```ts
import type { MerchantInput, MerchantStatus } from "../domain/merchant.ts";
import { isPublicHostname } from "../domain/offer-url.ts";
import { ulid } from "../lib/ulid.ts";
import { runAudited } from "./audit.ts";

/** The only writer of `merchants` (module `monetization`, addendum §3.2). */

export type Merchant = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  allowedHosts: string[];
  logoKey: string | null;
  description: string;
  defaultOfferId: string | null;
  indexable: boolean;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  allowed_hosts: string;
  logo_key: string | null;
  description: string;
  default_offer_id: string | null;
  indexable: number;
  status: MerchantStatus;
  write_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * The stored JSON array, keeping only entries that are public host names (`isPublicHostname`). Anything else (not JSON, not an
 * array, an IP, an upper-case name) is dropped, so a damaged row can only shrink the allow-list, never widen it.
 */
export function parseStoredHosts(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((h): h is string => typeof h === "string" && isPublicHostname(h)) : [];
  } catch {
    return [];
  }
}

export const toMerchant = (r: Row): Merchant => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  websiteUrl: r.website_url,
  allowedHosts: parseStoredHosts(r.allowed_hosts),
  logoKey: r.logo_key,
  description: r.description,
  defaultOfferId: r.default_offer_id,
  indexable: r.indexable === 1,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Actor = { actorUserId: string; now: string };

/** The slug is taken: nothing is written (no row, no audit row). `status` is the caller's choice: the db has no default. */
export async function createMerchant(
  db: D1Database,
  input: Actor & { merchant: MerchantInput; status: MerchantStatus },
): Promise<{ ok: true; merchant: Merchant } | { ok: false; reason: "slug_taken" }> {
  const id = ulid(Date.parse(input.now));
  const writeId = ulid();
  const m = input.merchant;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `INSERT INTO merchants (id, slug, name, website_url, allowed_hosts, description, indexable, status, write_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
         ON CONFLICT(slug) DO NOTHING
         RETURNING *`,
      )
      .bind(id, m.slug, m.name, m.websiteUrl, JSON.stringify(m.allowedHosts), m.description, m.indexable ? 1 : 0, input.status, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.create", entity: "merchant", entityId: id, data: { slug: m.slug }, now: input.now },
    { partnerTable: "merchants", id, writeId },
  );
  return row ? { ok: true, merchant: toMerchant(row) } : { ok: false, reason: "slug_taken" };
}

/** Every editable field except `slug` (shared links) and `status` (use setMerchantStatus). Null when there is no such merchant. */
export async function updateMerchant(db: D1Database, input: Actor & { id: string; merchant: Omit<MerchantInput, "slug"> }): Promise<Merchant | null> {
  const writeId = ulid();
  const m = input.merchant;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE merchants SET name = ?2, website_url = ?3, allowed_hosts = ?4, description = ?5, indexable = ?6, write_id = ?7, updated_at = ?8
         WHERE id = ?1
         RETURNING *`,
      )
      .bind(input.id, m.name, m.websiteUrl, JSON.stringify(m.allowedHosts), m.description, m.indexable ? 1 : 0, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.update", entity: "merchant", entityId: input.id, now: input.now },
    { partnerTable: "merchants", id: input.id, writeId },
  );
  return row ? toMerchant(row) : null;
}

/**
 * Compare-and-set: changes the merchant only while it is still in `from`; null otherwise (nothing written, nothing audited). `archived` is
 * terminal and `from === to` is not a change, so both also return null.
 */
export async function setMerchantStatus(db: D1Database, input: Actor & { id: string; from: MerchantStatus; to: MerchantStatus }): Promise<Merchant | null> {
  const writeId = ulid();
  const row = await runAudited<Row>(
    db,
    db
      .prepare("UPDATE merchants SET status = ?3, write_id = ?4, updated_at = ?5 WHERE id = ?1 AND status = ?2 AND ?2 <> ?3 AND ?2 <> 'archived' RETURNING *")
      .bind(input.id, input.from, input.to, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.status", entity: "merchant", entityId: input.id, data: { from: input.from, to: input.to }, now: input.now },
    { partnerTable: "merchants", id: input.id, writeId },
  );
  return row ? toMerchant(row) : null;
}

export async function findMerchantById(db: D1Database, id: string): Promise<Merchant | null> {
  const row = await db.prepare("SELECT * FROM merchants WHERE id = ?1").bind(id).first<Row>();
  return row ? toMerchant(row) : null;
}

/** For /admin/merchants: every merchant, by name. */
export async function listMerchants(db: D1Database): Promise<Merchant[]> {
  const { results } = await db.prepare("SELECT * FROM merchants ORDER BY name COLLATE NOCASE, id").all<Row>();
  return results.map(toMerchant);
}
```

Fixtures. Thêm vào `apps/web/test/fixtures.ts` các import `import { createMerchant, type Merchant } from "../src/db/merchants.ts";`, `import type { MerchantInput, MerchantStatus } from "../src/domain/merchant.ts";`, `import { ulid } from "../src/lib/ulid.ts";` (nếu chưa có) và thêm cuối file:

```ts
// One increasing clock for every fixture row, starting before any `at(n)` of the tests (2026-10-05), so create audit rows sort first.
let fixtureClock = Date.parse("2026-10-01T00:00:00.000Z");
const fixtureNow = () => new Date((fixtureClock += 1000)).toISOString();

/** A merchant on example.com (generic test data; real partner names appear nowhere in src). Defaults to `active`, not indexable. */
export async function makeMerchant(overrides: Partial<MerchantInput> & { status?: MerchantStatus } = {}): Promise<Merchant> {
  const { status = "active", ...fields } = overrides;
  const tag = ulid().slice(-8).toLowerCase();
  const merchant: MerchantInput = {
    name: `Acme ${tag}`,
    slug: `acme-${tag}`,
    websiteUrl: "https://example.com/",
    allowedHosts: ["example.com"],
    description: "Plain text description.",
    indexable: false,
    ...fields,
  };
  const admin = await ensureUser("partner-fixtures@vnx.si");
  const res = await createMerchant(testEnv.DB, { merchant, status, actorUserId: admin.id, now: fixtureNow() });
  if (!res.ok) throw new Error(res.reason);
  return res.merchant;
}
```

```bash
npm test -w apps/web -- test/db/merchants.test.ts test/db/partners-migration.test.ts
```

Expected: PASS.

- [ ] **Step 4: `db/programs.ts` và fixture `makeProgram` (test trước)**

`apps/web/test/db/programs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createProgram, findProgramById, listProgramsByMerchant, updateProgram } from "../../src/db/programs.ts";
import type { ProgramInput } from "../../src/domain/offer.ts";
import { ensureUser, makeMerchant, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const program = (o: Partial<ProgramInput> = {}): ProgramInput => ({
  name: "Acme program",
  type: "affiliate",
  network: null,
  provider: "manual",
  commissionModel: null,
  commissionRateBps: null,
  commissionFlatMinor: null,
  currency: null,
  cookieDays: null,
  attributionNotes: null,
  termsUrl: null,
  termsVerifiedAt: null,
  status: "draft",
  ...o,
});
const TERMS = { termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" };
const audits = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; data: string }>()).results;
const createAudits = async (merchantId: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'program.create' AND json_extract(data, '$.merchantId') = ?1").bind(merchantId).first<{ n: number }>())?.n;

describe("db/programs (addendum §3.2, Review Focus 6)", () => {
  it("creates a program with no commission, cookie or currency defaulted, and one program.create audit row", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await createProgram(testEnv.DB, { merchantId: m.id, program: program({ network: "ExampleNet" }), actorUserId: admin.id, now: at(1) });
    expect(p).toMatchObject({ merchantId: m.id, name: "Acme program", type: "affiliate", network: "ExampleNet", status: "draft", commissionModel: null, commissionRateBps: null, commissionFlatMinor: null, currency: null, cookieDays: null, termsUrl: null, termsVerifiedAt: null });
    const rows = await audits(p?.id ?? "");
    expect(rows.map((a) => a.action)).toEqual(["program.create"]);
    expect(JSON.parse(rows[0]?.data ?? "{}")).toEqual({ merchantId: m.id, type: "affiliate" });
  });

  it("stores the numbers given and nothing else", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await createProgram(testEnv.DB, {
      merchantId: m.id,
      program: program({ commissionModel: "percent", commissionRateBps: 3000, currency: "USD", cookieDays: 60, attributionNotes: "last click", ...TERMS, status: "active" }),
      actorUserId: admin.id,
      now: at(1),
    });
    expect(p).toMatchObject({ commissionModel: "percent", commissionRateBps: 3000, commissionFlatMinor: null, currency: "USD", cookieDays: 60, attributionNotes: "last click", status: "active", ...TERMS });
  });

  it("a merchant that does not exist gets no program and no audit row", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    expect(await createProgram(testEnv.DB, { merchantId: "missing", program: program(), actorUserId: admin.id, now: at(1) })).toBeNull();
    expect(await createAudits("missing")).toBe(0);
  });

  it("the database also refuses an active program without terms, or of type direct (defence in depth: the domain refuses first), leaving no row and no audit row", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    for (const bad of [program({ status: "active" }), program({ status: "active", termsUrl: TERMS.termsUrl }), program({ status: "active", type: "direct", ...TERMS })]) {
      await expect(createProgram(testEnv.DB, { merchantId: m.id, program: bad, actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    }
    expect((await listProgramsByMerchant(testEnv.DB, m.id)).length).toBe(0);
    expect(await createAudits(m.id)).toBe(0);
  });

  it("updateProgram: a field edit audits program.update, a status change audits program.status with from and to", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft" });
    const edited = await updateProgram(testEnv.DB, { id: p.id, program: { ...program(), name: "Renamed", cookieDays: 30 }, expectedStatus: "draft", actorUserId: admin.id, now: at(2) });
    expect(edited).toMatchObject({ name: "Renamed", cookieDays: 30, status: "draft", updatedAt: at(2) });
    const activated = await updateProgram(testEnv.DB, { id: p.id, program: program({ ...TERMS, status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(3) });
    expect(activated).toMatchObject({ status: "active", ...TERMS });
    const rows = await audits(p.id);
    expect(rows.map((r) => r.action)).toEqual(["program.create", "program.update", "program.status"]);
    expect(JSON.parse(rows[2]?.data ?? "{}")).toEqual({ from: "draft", to: "active" });
  });

  it("updateProgram is a compare-and-set on status: a stale caller changes and audits nothing", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "paused" });
    const lost = await updateProgram(testEnv.DB, { id: p.id, program: program({ name: "Late", ...TERMS, status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(2) });
    expect(lost).toBeNull();
    expect(await findProgramById(testEnv.DB, p.id)).toMatchObject({ name: p.name, status: "paused" });
    expect((await audits(p.id)).map((a) => a.action)).toEqual(["program.create"]);
    expect(await updateProgram(testEnv.DB, { id: "missing", program: program(), expectedStatus: "draft", actorUserId: admin.id, now: at(3) })).toBeNull();
  });

  it("the database also refuses updateProgram to active without terms or of type direct (defence in depth), leaving row and audit unchanged", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft" });
    await expect(updateProgram(testEnv.DB, { id: p.id, program: program({ status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(2) })).rejects.toThrow();
    await expect(updateProgram(testEnv.DB, { id: p.id, program: program({ type: "direct", ...TERMS, status: "active" }), expectedStatus: "draft", actorUserId: admin.id, now: at(3) })).rejects.toThrow();
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("draft");
    expect((await audits(p.id)).map((a) => a.action)).toEqual(["program.create"]);
  });

  it("ended is terminal: no transition out of it, but an ended program can still be edited", async () => {
    const admin = await ensureUser("p-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "ended" });
    for (const to of ["draft", "active", "paused"] as const) {
      expect(await updateProgram(testEnv.DB, { id: p.id, program: program({ ...TERMS, status: to }), expectedStatus: "ended", actorUserId: admin.id, now: at(2) }), to).toBeNull();
    }
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("ended");
    expect((await updateProgram(testEnv.DB, { id: p.id, program: program({ ...TERMS, name: "Closed", status: "ended" }), expectedStatus: "ended", actorUserId: admin.id, now: at(3) }))?.name).toBe("Closed");
    expect((await audits(p.id)).map((a) => a.action)).toEqual(["program.create", "program.update"]);
  });

  it("finds by id and lists a merchant's programs oldest first", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const a = await makeProgram(m, { name: "A" });
    const b = await makeProgram(m, { name: "B" });
    await makeProgram(other);
    expect(await findProgramById(testEnv.DB, "missing")).toBeNull();
    expect((await listProgramsByMerchant(testEnv.DB, m.id)).map((p) => p.id)).toEqual([a.id, b.id]);
  });
});
```

Ghi chú: `makeProgram` dùng `fixtureNow` (đồng hồ chung với `makeMerchant`) để `created_at` khác nhau; test cuối vì vậy không dựa vào thứ tự ULID. Implementer giữ đúng đoạn fixture.

```bash
npm test -w apps/web -- test/db/programs.test.ts
```

Expected: FAIL (không có `db/programs.ts`, `makeProgram`).

`apps/web/src/db/programs.ts`:

```ts
import type { CommissionModel, ProgramInput, ProgramProvider, ProgramStatus, ProgramType } from "../domain/offer.ts";
import { ulid } from "../lib/ulid.ts";
import { runAudited } from "./audit.ts";

/** The only writer of `partner_programs` (module `monetization`, addendum §3.2). */

export type PartnerProgram = {
  id: string;
  merchantId: string;
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commissionModel: CommissionModel | null;
  commissionRateBps: number | null;
  commissionFlatMinor: number | null;
  currency: string | null;
  cookieDays: number | null;
  attributionNotes: string | null;
  termsUrl: string | null;
  termsVerifiedAt: string | null;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  merchant_id: string;
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commission_model: CommissionModel | null;
  commission_rate_bps: number | null;
  commission_flat_minor: number | null;
  currency: string | null;
  cookie_days: number | null;
  attribution_notes: string | null;
  terms_url: string | null;
  terms_verified_at: string | null;
  status: ProgramStatus;
  write_id: string;
  created_at: string;
  updated_at: string;
};

const toProgram = (r: Row): PartnerProgram => ({
  id: r.id,
  merchantId: r.merchant_id,
  name: r.name,
  type: r.type,
  network: r.network,
  provider: r.provider,
  commissionModel: r.commission_model,
  commissionRateBps: r.commission_rate_bps,
  commissionFlatMinor: r.commission_flat_minor,
  currency: r.currency,
  cookieDays: r.cookie_days,
  attributionNotes: r.attribution_notes,
  termsUrl: r.terms_url,
  termsVerifiedAt: r.terms_verified_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Actor = { actorUserId: string; now: string };

/**
 * Null when the merchant does not exist. A program that breaks the CHECK of 0011 (active without terms, or `direct` and active) is rejected
 * by the database (defence in depth: the caller has already run parseProgramForm, so that is a bug, not a user error).
 */
export async function createProgram(db: D1Database, input: Actor & { merchantId: string; program: ProgramInput }): Promise<PartnerProgram | null> {
  const id = ulid(Date.parse(input.now));
  const writeId = ulid();
  const p = input.program;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `INSERT INTO partner_programs (id, merchant_id, name, type, network, provider, commission_model, commission_rate_bps, commission_flat_minor, currency,
                                       cookie_days, attribution_notes, terms_url, terms_verified_at, status, write_id, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17
         WHERE EXISTS (SELECT 1 FROM merchants WHERE id = ?2)
         RETURNING *`,
      )
      .bind(id, input.merchantId, p.name, p.type, p.network, p.provider, p.commissionModel, p.commissionRateBps, p.commissionFlatMinor, p.currency, p.cookieDays, p.attributionNotes, p.termsUrl, p.termsVerifiedAt, p.status, writeId, input.now),
    { actorUserId: input.actorUserId, action: "program.create", entity: "program", entityId: id, data: { merchantId: input.merchantId, type: p.type }, now: input.now },
    { partnerTable: "partner_programs", id, writeId },
  );
  return row ? toProgram(row) : null;
}

/**
 * Writes every field (the merchant never changes) as a compare-and-set on `status = expectedStatus`, and never moves a program out of `ended` (terminal); null when the program is missing or its
 * status moved meanwhile. Audit: `program.status` (data from, to) when the status changes, else `program.update`. Same CHECK behaviour as createProgram.
 */
export async function updateProgram(db: D1Database, input: Actor & { id: string; program: ProgramInput; expectedStatus: ProgramStatus }): Promise<PartnerProgram | null> {
  const writeId = ulid();
  const p = input.program;
  const changed = p.status !== input.expectedStatus;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE partner_programs SET name = ?3, type = ?4, network = ?5, provider = ?6, commission_model = ?7, commission_rate_bps = ?8, commission_flat_minor = ?9,
                currency = ?10, cookie_days = ?11, attribution_notes = ?12, terms_url = ?13, terms_verified_at = ?14, status = ?15, write_id = ?16, updated_at = ?17
         WHERE id = ?1 AND status = ?2 AND (status <> 'ended' OR ?15 = 'ended')
         RETURNING *`,
      )
      .bind(input.id, input.expectedStatus, p.name, p.type, p.network, p.provider, p.commissionModel, p.commissionRateBps, p.commissionFlatMinor, p.currency, p.cookieDays, p.attributionNotes, p.termsUrl, p.termsVerifiedAt, p.status, writeId, input.now),
    {
      actorUserId: input.actorUserId,
      action: changed ? "program.status" : "program.update",
      entity: "program",
      entityId: input.id,
      ...(changed ? { data: { from: input.expectedStatus, to: p.status } } : {}),
      now: input.now,
    },
    { partnerTable: "partner_programs", id: input.id, writeId },
  );
  return row ? toProgram(row) : null;
}

export async function findProgramById(db: D1Database, id: string): Promise<PartnerProgram | null> {
  const row = await db.prepare("SELECT * FROM partner_programs WHERE id = ?1").bind(id).first<Row>();
  return row ? toProgram(row) : null;
}

/** Oldest first. */
export async function listProgramsByMerchant(db: D1Database, merchantId: string): Promise<PartnerProgram[]> {
  const { results } = await db.prepare("SELECT * FROM partner_programs WHERE merchant_id = ?1 ORDER BY created_at, id").bind(merchantId).all<Row>();
  return results.map(toProgram);
}
```

Fixture. Thêm vào `apps/web/test/fixtures.ts` (import `createProgram, type PartnerProgram` từ `../src/db/programs.ts`, `type ProgramInput` từ `../src/domain/offer.ts`):

```ts
/**
 * A program of `merchant` with terms filled in and status `active` (the common test case); override `status: "draft"` etc.
 * Shares `fixtureNow` with `makeMerchant`.
 */
export async function makeProgram(merchant: { id: string }, overrides: Partial<ProgramInput> = {}): Promise<PartnerProgram> {
  const program: ProgramInput = {
    name: "Acme affiliate",
    type: "affiliate",
    network: null,
    provider: "generic_template",
    commissionModel: null,
    commissionRateBps: null,
    commissionFlatMinor: null,
    currency: null,
    cookieDays: null,
    attributionNotes: null,
    termsUrl: "https://example.com/terms",
    termsVerifiedAt: "2026-10-01",
    status: "active",
    ...overrides,
  };
  const admin = await ensureUser("partner-fixtures@vnx.si");
  const created = await createProgram(testEnv.DB, { merchantId: merchant.id, program, actorUserId: admin.id, now: fixtureNow() });
  if (!created) throw new Error("merchant not found");
  return created;
}
```

(Điều khoản mặc định chỉ có trong fixture test, không có trong db.)

```bash
npm test -w apps/web -- test/db/programs.test.ts test/db/merchants.test.ts test/db/partners-migration.test.ts
```

Expected: PASS.

- [ ] **Step 4b: Chuyển trạng thái cuối ở domain (test trước)**

Thêm vào `apps/web/test/domain/merchant.test.ts` (import `merchantTransitionAllowed`, `MERCHANT_STATUSES`) và `apps/web/test/domain/offer.test.ts` (import `programTransitionAllowed`, `PROGRAM_STATUSES`):

```ts
describe("merchantTransitionAllowed", () => {
  it("archived is terminal; everything else moves freely; no change is always fine", () => {
    for (const from of MERCHANT_STATUSES) {
      for (const to of MERCHANT_STATUSES) expect(merchantTransitionAllowed(from, to), `${from}->${to}`).toBe(from === to || from !== "archived");
    }
  });
});
```

```ts
describe("programTransitionAllowed", () => {
  it("ended is terminal; everything else moves freely; no change is always fine", () => {
    for (const from of PROGRAM_STATUSES) {
      for (const to of PROGRAM_STATUSES) expect(programTransitionAllowed(from, to), `${from}->${to}`).toBe(from === to || from !== "ended");
    }
  });
});
```

```bash
npm test -w apps/web -- test/domain/merchant.test.ts test/domain/offer.test.ts
```

Expected: FAIL (hàm chưa có). Thêm vào `domain/merchant.ts`:

```ts
/** `archived` is terminal (Controller 2026-10-05); staying where it is is not a transition. Also enforced in db/merchants.ts#setMerchantStatus. */
export function merchantTransitionAllowed(from: MerchantStatus, to: MerchantStatus): boolean {
  return from === to || from !== "archived";
}
```

và vào `domain/offer.ts` (sau `flagForProgram`):

```ts
/** `ended` is terminal (Controller 2026-10-05); staying where it is is not a transition. Also enforced in db/programs.ts#updateProgram. */
export function programTransitionAllowed(from: ProgramStatus, to: ProgramStatus): boolean {
  return from === to || from !== "ended";
}
```

Expected: PASS.

- [ ] **Step 5: Nối test kiến trúc và ghi chú deploy**

`apps/web/test/architecture.test.ts`:
- Thêm vào `WRITERS`: `merchants: "../src/db/merchants.ts",` và `partner_programs: "../src/db/programs.ts",` (`offers` thêm ở Task 2d).
- `MONEY_ALLOWED`: đổi thành `new Set<string>(["../src/db/merchants.ts", "../src/db/programs.ts", "../src/db/audit.ts"])`; sửa comment trên đó: "Task 2c: db/{merchants,programs}.ts, and db/audit.ts (it only reads `write_id` of those rows to guard audit rows); Task 2d: db/offers.ts; Task 3: …".
- Thêm test trong `describe` "ranking never reads money" để allowlist không phình ngầm:

```ts
  it("the allowlist holds only files that exist, and no ranking file is on it", () => {
    for (const file of MONEY_ALLOWED) expect(sources[file], file).toBeDefined();
    for (const file of RANKING_FILES) expect(MONEY_ALLOWED.has(file), file).toBe(false);
  });
```

`apps/web/wrangler.jsonc` (chỉ comment): trong dòng bước 1 thêm `, 0011_partners` sau `0010_feature_flags`; đổi dòng `// 0010_feature_flags (EPIC 21) ships with its code the same way: migrate first, then deploy.` thành `// 0010_feature_flags and 0011_partners (EPIC 21) ship with their code the same way: migrate first, then deploy.`

```bash
npm test -w apps/web -- test/architecture.test.ts
grep -rniE "elevenlabs|partnerstack" apps/web/src; test $? -eq 1
grep -n "0011_partners" apps/web/wrangler.jsonc
```

Expected: PASS; `grep` thứ nhất không in dòng nào; `grep` thứ hai in hai dòng.

- [ ] **Step 6: Kiểm toàn bộ và commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/migrations/0011_partners.sql apps/web/src/domain/merchant.ts apps/web/src/domain/offer.ts apps/web/test/domain/merchant.test.ts apps/web/test/domain/offer.test.ts apps/web/src/db/audit.ts apps/web/src/db/merchants.ts apps/web/src/db/programs.ts apps/web/test/fixtures.ts apps/web/test/architecture.test.ts apps/web/test/db/partners-migration.test.ts apps/web/test/db/merchants.test.ts apps/web/test/db/programs.test.ts apps/web/wrangler.jsonc
git commit -m "feat(web): partner schema, merchant and program db modules (VNX-2102a-3)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận:**
- `npm test -w apps/web -- test/db/partners-migration.test.ts test/db/merchants.test.ts test/db/programs.test.ts test/architecture.test.ts` xanh.
- Review Focus 6 ở CSDL: INSERT chương trình `active` thiếu `terms_url`, thiếu `terms_verified_at`, hoặc `type = 'direct'` bị CHECK từ chối (test migration, cả INSERT thô lẫn qua `createProgram` / `updateProgram`, audit không còn dòng); INSERT offer có `program_id` mà `tracking_template` NULL **hoặc rỗng** bị từ chối; migration không có `DEFAULT` nào, không `ON DELETE`, không `DROP` / `ALTER`; `terms_url` hoặc `terms_verified_at` là chuỗi rỗng cũng bị từ chối khi `active`.
- Trạng thái cuối: `merchantTransitionAllowed` / `programTransitionAllowed` (bảng đầy đủ); `setMerchantStatus` từ `archived` hoặc `from === to` → null, không ghi; `updateProgram` ra khỏi `ended` → null, không ghi.
- Ghi bảng chỉ từ module sở hữu: `merchants` và `partner_programs` có trong `WRITERS`; `MONEY_ALLOWED` sau task đúng ba file: `db/merchants.ts`, `db/programs.ts`, `db/audit.ts` (audit.ts chứa SQL literal `FROM merchants` / `FROM partner_programs` chỉ để đọc `write_id`).
- Mỗi thao tác ghi đúng một dòng `audit_log` (`merchant.create|update|status`, `program.create|update|status`); compare-and-set thua, `slug_taken`, merchant không tồn tại → không có audit; guard `write_id` sai → không ghi audit (test trực tiếp `auditStatement`).
- `grep -rniE "elevenlabs|partnerstack" apps/web/src` không in dòng nào.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ≈ 680 dòng (migration ~80, domain + test ~45, `audit.ts` ~25, `merchants.ts` ~125, `programs.ts` ~125, fixtures ~50, test ~380 trong đó test migration ~85). Commit `feat(web): partner schema, merchant and program db modules (VNX-2102a-3)`.

---

### Task 2d: VNX-2102a-4 — `db/offers.ts`, offer mặc định và đọc cho `/go/`

**Files:**
- Create: `apps/web/src/db/offers.ts`
- Modify: `apps/web/src/db/audit.ts` (guard cho `"offers"`), `apps/web/src/db/merchants.ts` (`setDefaultOffer`), `apps/web/src/domain/offer.ts` (`offerTransitionAllowed`)
- Modify: `apps/web/test/fixtures.ts` (`makeOffer`), `apps/web/test/architecture.test.ts`
- Test: `apps/web/test/domain/offer.test.ts` (thêm), `apps/web/test/db/offers.test.ts`, `apps/web/test/db/offer-context.test.ts`
- Không có chuỗi giao diện, không sửa route, không migration (bảng `offers` đã có ở `0011`; ghi chú deploy của `0011` đã có, không cần thêm).

**Interfaces:**
- Consumes (đã commit): `OfferInput`, `OfferKind`, `OfferLabel`, `OfferStatus`, `RedirectInput`, `RedirectOffer`, `RedirectProgram`, `RedirectMerchant`, `resolveOfferRedirect`, `ProgramType`, `ProgramStatus` (`domain/offer.ts`); `MerchantStatus` (`domain/merchant.ts`); `runAudited`, `auditStatement`, `AuditPartnerGuard` (`db/audit.ts`); `parseStoredHosts`, `Merchant` (`db/merchants.ts`); `ulid`.
- Produces (domain): `offerTransitionAllowed(from: OfferStatus, to: OfferStatus): boolean`.
- Produces (`db/audit.ts`): `AuditPartnerGuard.partnerTable` thêm `"offers"`.
- Produces (`db/offers.ts`): `type Offer`; `type RedirectRows = Pick<RedirectInput, "offer" | "program" | "merchant">`; `createOffer(db, { offer, actorUserId, now })` → `Offer | null`; `updateOffer(db, { id, offer, expectedStatus, actorUserId, now })` → `Offer | null`; `findOfferById(db, id)`; `listOffersByMerchant(db, merchantId)`; `findOfferWithContext(db, offerId)` → `RedirectRows` (ba trường `null` khi không có offer); `findDefaultOfferContext(db, merchantSlug)` → `(RedirectRows & { offer: RedirectOffer; merchant: RedirectMerchant }) | null`.
- Produces (`db/merchants.ts`): `setDefaultOffer(db, { merchantId, offerId, actorUserId, now })` → `Merchant | null`.
- Produces (`test/fixtures.ts`): `makeOffer(merchant, program | null, overrides?)`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **`setDefaultOffer` nằm trong `db/merchants.ts`, không phải `db/offers.ts`:** nó ghi `merchants.default_offer_id`, mà test sở hữu bảng chỉ cho `db/merchants.ts` ghi `merchants`. `db/merchants.ts` đã thuộc `MONEY_ALLOWED` nên subselect `FROM offers` trong đó hợp lệ. Chữ ký dùng object (khớp 2c) và có `actorUserId`, `now` cho audit; `offerId: null` là xóa offer mặc định.
2. **Quyền sở hữu nằm trong chính câu UPDATE:** `WHERE id = merchant AND (offerId IS NULL OR EXISTS (SELECT 1 FROM offers WHERE id = offerId AND subject_type = 'merchant' AND subject_id = merchant AND status <> 'archived'))`. Không có bước "đọc rồi ghi". Guard `write_id` như 2c: audit `merchant.update` (`data.defaultOfferId`) chỉ ghi khi câu UPDATE thật sự ghi. Offer `archived` sau khi đã là mặc định không bị gỡ tự động: `resolveOfferRedirect` trả `offer_archived` (404); Task 3 nên hiện cảnh báo (ghi nhận cho Task 3, ngoài phạm vi 2d).
3. **`write_id` cho `offers`** như ba bảng của 2c: `AuditPartnerGuard` thêm `"offers"`, nhánh SQL literal `FROM offers` trong `db/audit.ts` (không nội suy tên bảng). `MONEY_ALLOWED` sau 2d đúng **bốn** file: `db/merchants.ts`, `db/programs.ts`, `db/offers.ts`, `db/audit.ts`.
4. **`createOffer`:** `INSERT … SELECT … WHERE` chỉ ghi khi merchant `subject_id` tồn tại **và** (không có chương trình hoặc chương trình đó thuộc đúng merchant). Domain `parseOfferForm` đã kiểm `program_merchant`; đây là chốt chặn thứ hai, nên `null` gộp "merchant không có" và "chương trình của merchant khác" (Task 3 đã kiểm trước, nên `null` là lỗi lập trình hoặc đua dữ liệu). Không có DEFAULT: `status`, nhãn… do input truyền. CHECK của `0011` (template rỗng khi có chương trình, `label` ngoài enum, `kind`) là chốt chặn cuối và **ném lỗi** (cùng quy ước 2c mục 2), không trả `null`.
5. **`updateOffer`** là compare-and-set theo `status = expectedStatus`, thêm `AND subject_type = 'merchant' AND subject_id = input.offer.subjectId` (offer không đổi chủ; id của merchant khác thì không khớp), cùng điều kiện chương trình như `createOffer`, và **`archived` là cuối cùng**: `AND (status <> 'archived' OR ?10 = 'archived')` (cùng mẫu `updateProgram`; offer `archived` vẫn sửa được trường khác, như chương trình `ended`). Domain: `offerTransitionAllowed(from, to)` = `from === to || from !== "archived"` (chưa có trong code, thêm kèm test), Task 3 dùng để ẩn nút. Audit: `offer.status` (`data` from, to) khi `status` đổi, `offer.update` khi không; `offer.create` có `data { merchantId, programId }`. `updateOffer` không đụng `merchants.default_offer_id`.
6. **Hàm đọc cho `/go/`** trả đúng kiểu `RedirectOffer` / `RedirectProgram` / `RedirectMerchant` của Task 2b (đã đọc từ code): **một** truy vấn `offers o LEFT JOIN partner_programs p ON p.id = o.program_id LEFT JOIN merchants m ON m.id = o.subject_id AND o.subject_type = 'merchant'`. Merchant nạp theo `subject_id` của offer (không theo chương trình); chương trình nạp theo `program_id`, còn việc `program.merchantId` khớp merchant là của domain (`program_merchant`). `allowed_hosts` qua `parseStoredHosts` (JSON hỏng thì `[]`, không ném). `findOfferWithContext` trả đối tượng ba trường để đưa thẳng vào `resolveOfferRedirect` (offer không tồn tại: ba `null`, domain trả `offer_missing`). `findDefaultOfferContext` dùng cùng SELECT với `WHERE m.slug = ?1 AND m.default_offer_id = o.id AND o.subject_type = 'merchant'`; vì `m` nối theo `o.subject_id`, offer mặc định của merchant khác không bao giờ khớp: trả `null`. Trạng thái merchant (`paused` → 404 của `/go/:slug`) là việc của route Task 4, đọc từ `merchant.status` (merchant `paused` vẫn được trả về).
7. `makeOffer` dùng `fixtureNow` chung và host chung (`example.com`); mặc định `active`, nhãn `visit_site`, `destination_url = https://example.com/`; có chương trình thì `kind = affiliate` và template `https://example.com/r?c={click_id}`. Hàm không kiểm host (db không kiểm URL; domain kiểm).
8. Lưu ý chuỗi SQL: không viết `INSERT INTO|UPDATE|DELETE FROM` viết hoa trong comment (test sở hữu bảng quét chúng).

- [ ] **Step 1: Chuyển trạng thái offer ở domain (test trước)**

Thêm vào `apps/web/test/domain/offer.test.ts` (import `offerTransitionAllowed`, `OFFER_STATUSES`; nếu đã import `OFFER_STATUSES` thì không thêm lần nữa):

```ts
describe("offerTransitionAllowed", () => {
  it("archived is terminal; everything else moves freely; no change is always fine", () => {
    for (const from of OFFER_STATUSES) {
      for (const to of OFFER_STATUSES) expect(offerTransitionAllowed(from, to), `${from}->${to}`).toBe(from === to || from !== "archived");
    }
  });

  it("lists the forbidden and the allowed pairs explicitly", () => {
    expect(offerTransitionAllowed("archived", "active")).toBe(false);
    expect(offerTransitionAllowed("archived", "paused")).toBe(false);
    expect(offerTransitionAllowed("archived", "archived")).toBe(true);
    expect(offerTransitionAllowed("active", "archived")).toBe(true);
    expect(offerTransitionAllowed("paused", "active")).toBe(true);
  });
});
```

```bash
npm test -w apps/web -- test/domain/offer.test.ts
```

Expected: FAIL (hàm chưa có). Thêm vào `domain/offer.ts` (ngay sau `programTransitionAllowed`):

```ts
/** `archived` is terminal for offers too (Controller 2026-10-05); staying where it is is not a transition. Also enforced in db/offers.ts#updateOffer. */
export function offerTransitionAllowed(from: OfferStatus, to: OfferStatus): boolean {
  return from === to || from !== "archived";
}
```

Expected: PASS.

- [ ] **Step 2: Guard audit, `db/offers.ts` (ghi), fixture `makeOffer` (test trước)**

`apps/web/test/db/offers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import { createOffer, findOfferById, listOffersByMerchant, updateOffer } from "../../src/db/offers.ts";
import type { OfferInput } from "../../src/domain/offer.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const input = (merchant: { id: string }, program: { id: string } | null, o: Partial<OfferInput> = {}): OfferInput => ({
  programId: program?.id ?? null,
  subjectType: "merchant",
  subjectId: merchant.id,
  kind: program ? "affiliate" : "official",
  label: "visit_site",
  destinationUrl: "https://example.com/",
  trackingTemplate: program ? "https://example.com/r?c={click_id}" : null,
  startsAt: null,
  endsAt: null,
  status: "active",
  ...o,
});
const audits = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; data: string }>()).results;
const actionsOf = async (entityId: string) => (await audits(entityId)).map((a) => a.action);
const countFor = async (merchantId: string) => {
  const n = async (sql: string) => (await testEnv.DB.prepare(sql).bind(merchantId).first<{ n: number }>())?.n;
  return {
    offers: await n("SELECT COUNT(*) AS n FROM offers WHERE subject_id = ?1"),
    audits: await n("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'offer.create' AND json_extract(data, '$.merchantId') = ?1"),
  };
};

describe("db/offers writes (addendum §3.2)", () => {
  it("creates an offer with and without a program, one offer.create audit row each", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const tracked = await createOffer(testEnv.DB, { offer: input(m, p, { label: "try_it", startsAt: "2026-10-01T00:00:00.000Z" }), actorUserId: admin.id, now: at(1) });
    expect(tracked).toMatchObject({ programId: p.id, subjectType: "merchant", subjectId: m.id, kind: "affiliate", label: "try_it", destinationUrl: "https://example.com/", trackingTemplate: "https://example.com/r?c={click_id}", startsAt: "2026-10-01T00:00:00.000Z", endsAt: null, status: "active", createdAt: at(1), updatedAt: at(1) });
    const plain = await createOffer(testEnv.DB, { offer: input(m, null), actorUserId: admin.id, now: at(2) });
    expect(plain).toMatchObject({ programId: null, trackingTemplate: null });
    const rows = await audits(tracked?.id ?? "");
    expect(rows.map((r) => r.action)).toEqual(["offer.create"]);
    expect(JSON.parse(rows[0]?.data ?? "{}")).toEqual({ merchantId: m.id, programId: p.id });
    expect(await actionsOf(plain?.id ?? "")).toEqual(["offer.create"]);
  });

  it("a merchant that does not exist, or a program of another merchant, gets no offer and no audit row", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    expect(await createOffer(testEnv.DB, { offer: input({ id: "missing" }, null), actorUserId: admin.id, now: at(1) })).toBeNull();
    expect(await countFor("missing")).toEqual({ offers: 0, audits: 0 });
    expect(await createOffer(testEnv.DB, { offer: input(m, foreign), actorUserId: admin.id, now: at(2) })).toBeNull();
    expect(await countFor(m.id)).toEqual({ offers: 0, audits: 0 });
  });

  it("the database is the last barrier: an empty template with a program, or an unknown label, throws and leaves nothing", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await expect(createOffer(testEnv.DB, { offer: input(m, p, { trackingTemplate: "" }), actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    await expect(createOffer(testEnv.DB, { offer: input(m, p, { trackingTemplate: null }), actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    await expect(createOffer(testEnv.DB, { offer: input(m, null, { label: "buy_now" as never }), actorUserId: admin.id, now: at(1) })).rejects.toThrow();
    expect(await countFor(m.id)).toEqual({ offers: 0, audits: 0 });
  });

  it("updateOffer: a field edit audits offer.update, a status change audits offer.status with from and to", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const o = await makeOffer(m, p);
    const edited = await updateOffer(testEnv.DB, { id: o.id, offer: input(m, p, { label: "try_it", endsAt: "2027-01-01T00:00:00.000Z" }), expectedStatus: "active", actorUserId: admin.id, now: at(2) });
    expect(edited).toMatchObject({ label: "try_it", endsAt: "2027-01-01T00:00:00.000Z", status: "active", subjectId: m.id, updatedAt: at(2), createdAt: o.createdAt });
    const paused = await updateOffer(testEnv.DB, { id: o.id, offer: input(m, p, { status: "paused" }), expectedStatus: "active", actorUserId: admin.id, now: at(3) });
    expect(paused?.status).toBe("paused");
    const rows = await audits(o.id);
    expect(rows.map((r) => r.action)).toEqual(["offer.create", "offer.update", "offer.status"]);
    expect(JSON.parse(rows[2]?.data ?? "{}")).toEqual({ from: "active", to: "paused" });
  });

  it("updateOffer is a compare-and-set on status: a stale caller changes and audits nothing", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { status: "paused" });
    const lost = await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { label: "try_it", status: "active" }), expectedStatus: "active", actorUserId: admin.id, now: at(2) });
    expect(lost).toBeNull();
    expect(await findOfferById(testEnv.DB, o.id)).toMatchObject({ label: "visit_site", status: "paused" });
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
    expect(await updateOffer(testEnv.DB, { id: "missing", offer: input(m, null), expectedStatus: "active", actorUserId: admin.id, now: at(3) })).toBeNull();
  });

  it("updateOffer never moves an offer to another merchant or onto another merchant's program", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    const o = await makeOffer(m, null);
    expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(other, null), expectedStatus: "active", actorUserId: admin.id, now: at(2) })).toBeNull();
    expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(m, foreign), expectedStatus: "active", actorUserId: admin.id, now: at(3) })).toBeNull();
    expect(await findOfferById(testEnv.DB, o.id)).toMatchObject({ subjectId: m.id, programId: null });
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
  });

  it("archived is terminal: no transition out of it, but an archived offer can still be edited", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { status: "archived" });
    for (const to of ["active", "paused"] as const) {
      expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { status: to }), expectedStatus: "archived", actorUserId: admin.id, now: at(2) }), to).toBeNull();
    }
    expect((await findOfferById(testEnv.DB, o.id))?.status).toBe("archived");
    expect((await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { label: "learn_more", status: "archived" }), expectedStatus: "archived", actorUserId: admin.id, now: at(3) }))?.label).toBe("learn_more");
    const live = await makeOffer(m, null);
    expect((await updateOffer(testEnv.DB, { id: live.id, offer: input(m, null, { status: "archived" }), expectedStatus: "active", actorUserId: admin.id, now: at(4) }))?.status).toBe("archived");
    expect(await actionsOf(o.id)).toEqual(["offer.create", "offer.update"]);
  });

  it("updateOffer only touches merchant offers: one whose subject_type is product returns null and stays unchanged", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET subject_type = 'product' WHERE id = ?1").bind(o.id).run();
    expect(await updateOffer(testEnv.DB, { id: o.id, offer: input(m, null, { label: "try_it" }), expectedStatus: "active", actorUserId: admin.id, now: at(2) })).toBeNull();
    expect(await findOfferById(testEnv.DB, o.id)).toMatchObject({ label: "visit_site", subjectType: "product" });
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
  });

  it("the audit guard is keyed on the offer's last write id (a lost write audits nothing)", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const audit = (writeId: string) =>
      auditStatement(testEnv.DB, { actorUserId: admin.id, action: "offer.update", entity: "offer", entityId: o.id, now: at(9) }, { partnerTable: "offers", id: o.id, writeId });
    await audit("not-the-last-write").run();
    expect(await actionsOf(o.id)).toEqual(["offer.create"]);
    const real = await testEnv.DB.prepare("SELECT write_id FROM offers WHERE id = ?1").bind(o.id).first<{ write_id: string }>();
    await audit(real?.write_id ?? "").run();
    expect(await actionsOf(o.id)).toEqual(["offer.create", "offer.update"]);
  });

  it("finds by id and lists a merchant's offers oldest first, none of another merchant's", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const a = await makeOffer(m, null);
    const b = await makeOffer(m, null, { label: "try_it" });
    await makeOffer(other, null);
    expect(await findOfferById(testEnv.DB, "missing")).toBeNull();
    expect((await listOffersByMerchant(testEnv.DB, m.id)).map((o) => o.id)).toEqual([a.id, b.id]);
  });
});
```

```bash
npm test -w apps/web -- test/db/offers.test.ts
```

Expected: FAIL (không có `db/offers.ts`, `makeOffer`).

Sửa `apps/web/src/db/audit.ts`: đổi kiểu (docblock thêm "offer"):

```ts
export type AuditPartnerGuard = { partnerTable: "merchants" | "partner_programs" | "offers"; id: string; writeId: string };
```

Cập nhật docblock của kiểu này ("merchant / program / offer row's last write") và docblock của `auditStatement` ("`partnerTable` + `id` on that merchant / program / offer row's last write id").

và thêm nhánh literal ngay sau khối `if (onlyIf.partnerTable === "merchants") { … }`, trước `return` của `partner_programs`:

```ts
    if (onlyIf.partnerTable === "offers") {
      return db
        .prepare(
          `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
           WHERE EXISTS (SELECT 1 FROM offers WHERE id = ?8 AND write_id = ?9)`,
        )
        .bind(...values, onlyIf.id, onlyIf.writeId);
    }
```

`apps/web/src/db/offers.ts` (phần ghi; phần đọc ở Step 4):

```ts
import type { OfferInput, OfferKind, OfferLabel, OfferStatus } from "../domain/offer.ts";
import { ulid } from "../lib/ulid.ts";
import { runAudited } from "./audit.ts";

/** The only writer of `offers` (module `monetization`, addendum §3.2). */

export type Offer = {
  id: string;
  programId: string | null;
  subjectType: "product" | "merchant" | "article";
  subjectId: string;
  kind: OfferKind;
  label: OfferLabel;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  program_id: string | null;
  subject_type: "product" | "merchant" | "article";
  subject_id: string;
  kind: OfferKind;
  label: OfferLabel;
  destination_url: string;
  tracking_template: string | null;
  status: OfferStatus;
  starts_at: string | null;
  ends_at: string | null;
  write_id: string;
  created_at: string;
  updated_at: string;
};

const toOffer = (r: Row): Offer => ({
  id: r.id,
  programId: r.program_id,
  subjectType: r.subject_type,
  subjectId: r.subject_id,
  kind: r.kind,
  label: r.label,
  destinationUrl: r.destination_url,
  trackingTemplate: r.tracking_template,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Actor = { actorUserId: string; now: string };

/**
 * Null when the merchant (`subject_id`) does not exist or the program belongs to another merchant: nothing is written, nothing audited
 * (the caller has already run parseOfferForm, so that is a bug or a race, not a user error). A CHECK of 0011 (a program without a
 * template, an unknown label) is rejected by the database and throws.
 */
export async function createOffer(db: D1Database, input: Actor & { offer: OfferInput }): Promise<Offer | null> {
  const id = ulid(Date.parse(input.now));
  const writeId = ulid();
  const o = input.offer;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `INSERT INTO offers (id, program_id, subject_type, subject_id, kind, label, destination_url, tracking_template, status, starts_at, ends_at, write_id, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13
         WHERE ?3 = 'merchant' AND EXISTS (SELECT 1 FROM merchants WHERE id = ?4)
           AND (?2 IS NULL OR EXISTS (SELECT 1 FROM partner_programs WHERE id = ?2 AND merchant_id = ?4))
         RETURNING *`,
      )
      .bind(id, o.programId, o.subjectType, o.subjectId, o.kind, o.label, o.destinationUrl, o.trackingTemplate, o.status, o.startsAt, o.endsAt, writeId, input.now),
    { actorUserId: input.actorUserId, action: "offer.create", entity: "offer", entityId: id, data: { merchantId: o.subjectId, programId: o.programId }, now: input.now },
    { partnerTable: "offers", id, writeId },
  );
  return row ? toOffer(row) : null;
}

/**
 * Compare-and-set on `status = expectedStatus`; the offer keeps its merchant (`subject_id` must equal the input's) and may only point at a
 * program of that merchant; `archived` is terminal (the status may only stay `archived`). Null when any of these fails or the offer is missing:
 * nothing written, nothing audited. Audit: `offer.status` (data from, to) when the status changes, else `offer.update`.
 */
export async function updateOffer(db: D1Database, input: Actor & { id: string; offer: OfferInput; expectedStatus: OfferStatus }): Promise<Offer | null> {
  const writeId = ulid();
  const o = input.offer;
  const changed = o.status !== input.expectedStatus;
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE offers SET program_id = ?3, kind = ?4, label = ?5, destination_url = ?6, tracking_template = ?7, starts_at = ?8, ends_at = ?9,
                status = ?10, write_id = ?11, updated_at = ?12
         WHERE id = ?1 AND status = ?2 AND subject_type = 'merchant' AND subject_id = ?13
           AND (status <> 'archived' OR ?10 = 'archived')
           AND (?3 IS NULL OR EXISTS (SELECT 1 FROM partner_programs WHERE id = ?3 AND merchant_id = ?13))
         RETURNING *`,
      )
      .bind(input.id, input.expectedStatus, o.programId, o.kind, o.label, o.destinationUrl, o.trackingTemplate, o.startsAt, o.endsAt, o.status, writeId, input.now, o.subjectId),
    {
      actorUserId: input.actorUserId,
      action: changed ? "offer.status" : "offer.update",
      entity: "offer",
      entityId: input.id,
      ...(changed ? { data: { from: input.expectedStatus, to: o.status } } : {}),
      now: input.now,
    },
    { partnerTable: "offers", id: input.id, writeId },
  );
  return row ? toOffer(row) : null;
}

export async function findOfferById(db: D1Database, id: string): Promise<Offer | null> {
  const row = await db.prepare("SELECT * FROM offers WHERE id = ?1").bind(id).first<Row>();
  return row ? toOffer(row) : null;
}

/** For /admin/merchants/:id: the merchant's own offers (subject_type merchant), oldest first. */
export async function listOffersByMerchant(db: D1Database, merchantId: string): Promise<Offer[]> {
  const { results } = await db.prepare("SELECT * FROM offers WHERE subject_type = 'merchant' AND subject_id = ?1 ORDER BY created_at, id").bind(merchantId).all<Row>();
  return results.map(toOffer);
}
```

Fixture. Thêm vào `apps/web/test/fixtures.ts` (import `createOffer, type Offer` từ `../src/db/offers.ts`, `type OfferInput` vào import sẵn có từ `../src/domain/offer.ts`):

```ts
/**
 * An `active` offer of `merchant` on example.com. With a program it is an affiliate offer with a template; without, the merchant's own link.
 * Shares `fixtureNow` with the other fixtures. Does not check hosts (the domain does that).
 */
export async function makeOffer(merchant: { id: string }, program: { id: string } | null, overrides: Partial<OfferInput> = {}): Promise<Offer> {
  const offer: OfferInput = {
    programId: program?.id ?? null,
    subjectType: "merchant",
    subjectId: merchant.id,
    kind: program ? "affiliate" : "official",
    label: "visit_site",
    destinationUrl: "https://example.com/",
    trackingTemplate: program ? "https://example.com/r?c={click_id}" : null,
    startsAt: null,
    endsAt: null,
    status: "active",
    ...overrides,
  };
  const admin = await ensureUser("partner-fixtures@vnx.si");
  const created = await createOffer(testEnv.DB, { offer, actorUserId: admin.id, now: fixtureNow() });
  if (!created) throw new Error("merchant or program not found");
  return created;
}
```

```bash
npm test -w apps/web -- test/db/offers.test.ts test/db/merchants.test.ts test/db/programs.test.ts
```

Expected: PASS.

- [ ] **Step 3: `setDefaultOffer` (test trước)**

`apps/web/test/db/offer-context.test.ts` (toàn bộ file sau Step 4; ở bước này viết trước phần dưới đây, với các import `findDefaultOfferContext`, `findOfferWithContext`, `resolveOfferRedirect`, `ulid` và hằng `FLAGS_ON`, `run` thêm ở Step 4):

```ts
import { describe, expect, it } from "vitest";
import { findMerchantById, setDefaultOffer } from "../../src/db/merchants.ts";
import { ensureUser, makeMerchant, makeOffer } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const actionsOf = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((a) => a.action);

describe("setDefaultOffer (ownership inside the UPDATE)", () => {
  it("sets the merchant's own offer, audits merchant.update with the offer id, and can clear it", async () => {
    const admin = await ensureUser("d-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const set = await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: admin.id, now: at(2) });
    expect(set).toMatchObject({ id: m.id, defaultOfferId: o.id, updatedAt: at(2) });
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity_id = ?1 AND action = 'merchant.update'").bind(m.id).first<{ data: string }>();
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ defaultOfferId: o.id });
    expect((await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: null, actorUserId: admin.id, now: at(3) }))?.defaultOfferId).toBeNull();
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.update", "merchant.update"]);
  });

  it("another merchant's offer, an archived offer, a non-merchant offer, an unknown offer or merchant: null, nothing written, nothing audited", async () => {
    const admin = await ensureUser("d-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeOffer(other, null);
    const archived = await makeOffer(m, null, { status: "archived" });
    const productOffer = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET subject_type = 'product' WHERE id = ?1").bind(productOffer.id).run();
    for (const offerId of [foreign.id, archived.id, productOffer.id, "missing"]) {
      expect(await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId, actorUserId: admin.id, now: at(2) }), offerId).toBeNull();
    }
    expect(await setDefaultOffer(testEnv.DB, { merchantId: "missing", offerId: null, actorUserId: admin.id, now: at(3) })).toBeNull();
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
    expect(await actionsOf(m.id)).toEqual(["merchant.create"]);
    expect(await actionsOf("missing")).toEqual([]);
  });
});
```

```bash
npm test -w apps/web -- test/db/offer-context.test.ts
```

Expected: FAIL (`setDefaultOffer` chưa có). Thêm vào `apps/web/src/db/merchants.ts` (trước `findMerchantById`):

```ts
/**
 * The merchant's default offer (what /go/:slug follows). The ownership check is inside the UPDATE: the offer must be of this merchant
 * (subject_type merchant, subject_id) and not archived, or `offerId` is null (clear). Null otherwise (no such merchant, or the check
 * failed): nothing written, nothing audited.
 */
export async function setDefaultOffer(db: D1Database, input: Actor & { merchantId: string; offerId: string | null }): Promise<Merchant | null> {
  const writeId = ulid();
  const row = await runAudited<Row>(
    db,
    db
      .prepare(
        `UPDATE merchants SET default_offer_id = ?2, write_id = ?3, updated_at = ?4
         WHERE id = ?1
           AND (?2 IS NULL OR EXISTS (SELECT 1 FROM offers WHERE id = ?2 AND subject_type = 'merchant' AND subject_id = ?1 AND status <> 'archived'))
         RETURNING *`,
      )
      .bind(input.merchantId, input.offerId, writeId, input.now),
    { actorUserId: input.actorUserId, action: "merchant.update", entity: "merchant", entityId: input.merchantId, data: { defaultOfferId: input.offerId }, now: input.now },
    { partnerTable: "merchants", id: input.merchantId, writeId },
  );
  return row ? toMerchant(row) : null;
}
```

```bash
npm test -w apps/web -- test/db/offer-context.test.ts test/db/merchants.test.ts
```

Expected: PASS.

- [ ] **Step 4: Hàm đọc cho `/go/` (test trước)**

Trong `apps/web/test/db/offer-context.test.ts` thêm import `import { findDefaultOfferContext, findOfferWithContext, type RedirectRows } from "../../src/db/offers.ts";`, `import { resolveOfferRedirect } from "../../src/domain/offer.ts";`, `import { ulid } from "../../src/lib/ulid.ts";`, thêm `makeProgram` vào import fixtures, và thêm cuối file:

```ts
const FLAGS_ON = { affiliate: true, partner_referral: false };
const resolve = (rows: RedirectRows, clickId = ulid()) =>
  resolveOfferRedirect({ ...rows, flags: FLAGS_ON, now: at(1), clickId, locale: "en", src: "tools" });

describe("findOfferWithContext (exactly what resolveOfferRedirect needs)", () => {
  it("returns offer, program and merchant, and the result feeds resolveOfferRedirect as is", async () => {
    const m = await makeMerchant({ allowedHosts: ["example.com", "app.example.com"] });
    const p = await makeProgram(m);
    const o = await makeOffer(m, p);
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.offer).toEqual({ id: o.id, subjectType: "merchant", subjectId: m.id, programId: p.id, status: "active", destinationUrl: "https://example.com/", trackingTemplate: "https://example.com/r?c={click_id}", startsAt: null, endsAt: null });
    expect(rows.program).toEqual({ id: p.id, merchantId: m.id, type: "affiliate", status: "active" });
    expect(rows.merchant).toEqual({ id: m.id, status: "active", websiteUrl: "https://example.com/", allowedHosts: ["example.com", "app.example.com"] });
    const clickId = ulid();
    expect(resolve(rows, clickId)).toEqual({ kind: "tracked", url: `https://example.com/r?c=${clickId}`, programId: p.id });
  });

  it("an offer without a program has a null program and still resolves", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { destinationUrl: "https://example.com/page" });
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.program).toBeNull();
    expect(rows.merchant?.id).toBe(m.id);
    expect(resolve(rows).kind).toBe("tracked");
  });

  it("an unknown offer gives three nulls (resolveOfferRedirect says offer_missing)", async () => {
    const rows = await findOfferWithContext(testEnv.DB, "missing");
    expect(rows).toEqual({ offer: null, program: null, merchant: null });
    expect(resolve(rows)).toEqual({ kind: "not_found", reason: "offer_missing" });
  });

  it("the merchant is loaded by subject_id, only for subject_type merchant", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET subject_type = 'product' WHERE id = ?1").bind(o.id).run();
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.offer?.subjectType).toBe("product");
    expect(rows.merchant).toBeNull();
  });

  it("a program of another merchant is returned as stored; the domain refuses it", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    const o = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET program_id = ?2, tracking_template = 'https://example.com/r' WHERE id = ?1").bind(o.id, foreign.id).run();
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.program?.merchantId).toBe(other.id);
    expect(rows.merchant?.id).toBe(m.id);
    expect(resolve(rows)).toEqual({ kind: "not_found", reason: "program_merchant" });
  });

  it("damaged allowed_hosts read as an empty list and never throw", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    for (const bad of ['{"a":1}', '["127.0.0.1"]', '"example.com"']) {
      await testEnv.DB.prepare("UPDATE merchants SET allowed_hosts = ?2 WHERE id = ?1").bind(m.id, bad).run();
      expect((await findOfferWithContext(testEnv.DB, o.id)).merchant?.allowedHosts, bad).toEqual([]);
    }
  });
});

describe("findDefaultOfferContext", () => {
  const admin = () => ensureUser("d-admin@vnx.si");

  it("returns the merchant's default offer with its program and merchant, and it resolves", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const o = await makeOffer(m, p);
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: (await admin()).id, now: at(2) });
    const rows = await findDefaultOfferContext(testEnv.DB, m.slug);
    expect(rows?.offer.id).toBe(o.id);
    expect(rows?.program?.id).toBe(p.id);
    expect(rows?.merchant.id).toBe(m.id);
    expect(rows && resolve(rows).kind).toBe("tracked");
  });

  it("an unknown slug, or a merchant without a default offer, gives null", async () => {
    const m = await makeMerchant();
    await makeOffer(m, null);
    expect(await findDefaultOfferContext(testEnv.DB, "no-such-slug-0000")).toBeNull();
    expect(await findDefaultOfferContext(testEnv.DB, m.slug)).toBeNull();
  });

  it("a default offer that belongs to another merchant gives null, even when written straight into the row", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeOffer(other, null);
    await testEnv.DB.prepare("UPDATE merchants SET default_offer_id = ?2 WHERE id = ?1").bind(m.id, foreign.id).run();
    expect(await findDefaultOfferContext(testEnv.DB, m.slug)).toBeNull();
    expect(await findDefaultOfferContext(testEnv.DB, other.slug)).toBeNull();
  });

  it("a paused merchant and an archived default offer are still returned (the route and the domain decide)", async () => {
    const m = await makeMerchant({ status: "paused" });
    const o = await makeOffer(m, null);
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: (await admin()).id, now: at(2) });
    expect((await findDefaultOfferContext(testEnv.DB, m.slug))?.merchant.status).toBe("paused");
    await testEnv.DB.prepare("UPDATE offers SET status = 'archived' WHERE id = ?1").bind(o.id).run();
    const rows = await findDefaultOfferContext(testEnv.DB, m.slug);
    expect(rows && resolve(rows)).toEqual({ kind: "not_found", reason: "offer_archived" });
  });
});
```

```bash
npm test -w apps/web -- test/db/offer-context.test.ts
```

Expected: FAIL (`findOfferWithContext`, `findDefaultOfferContext` chưa có). Thêm vào `apps/web/src/db/offers.ts` (import thêm `import type { MerchantStatus } from "../domain/merchant.ts";`, `ProgramStatus`, `ProgramType`, `RedirectInput`, `RedirectMerchant`, `RedirectOffer`, `RedirectProgram` vào import type từ `../domain/offer.ts`, và `import { parseStoredHosts } from "./merchants.ts";`):

```ts
/** What resolveOfferRedirect takes from the database (domain/offer.ts#RedirectInput). */
export type RedirectRows = Pick<RedirectInput, "offer" | "program" | "merchant">;

type ContextRow = {
  o_id: string;
  o_subject_type: "product" | "merchant" | "article";
  o_subject_id: string;
  o_program_id: string | null;
  o_status: OfferStatus;
  o_destination_url: string;
  o_tracking_template: string | null;
  o_starts_at: string | null;
  o_ends_at: string | null;
  p_id: string | null;
  p_merchant_id: string | null;
  p_type: ProgramType | null;
  p_status: ProgramStatus | null;
  m_id: string | null;
  m_status: MerchantStatus | null;
  m_website_url: string | null;
  m_allowed_hosts: string | null;
};

// One query. The merchant is the offer's subject (never the program's merchant: the domain compares the two); the program comes from program_id.
const CONTEXT_SQL = `SELECT o.id AS o_id, o.subject_type AS o_subject_type, o.subject_id AS o_subject_id, o.program_id AS o_program_id, o.status AS o_status,
       o.destination_url AS o_destination_url, o.tracking_template AS o_tracking_template, o.starts_at AS o_starts_at, o.ends_at AS o_ends_at,
       p.id AS p_id, p.merchant_id AS p_merchant_id, p.type AS p_type, p.status AS p_status,
       m.id AS m_id, m.status AS m_status, m.website_url AS m_website_url, m.allowed_hosts AS m_allowed_hosts
  FROM offers o
  LEFT JOIN partner_programs p ON p.id = o.program_id
  LEFT JOIN merchants m ON m.id = o.subject_id AND o.subject_type = 'merchant'`;

function toRedirectRows(r: ContextRow): { offer: RedirectOffer; program: RedirectProgram | null; merchant: RedirectMerchant | null } {
  return {
    offer: {
      id: r.o_id,
      subjectType: r.o_subject_type,
      subjectId: r.o_subject_id,
      programId: r.o_program_id,
      status: r.o_status,
      destinationUrl: r.o_destination_url,
      trackingTemplate: r.o_tracking_template,
      startsAt: r.o_starts_at,
      endsAt: r.o_ends_at,
    },
    program: r.p_id === null || r.p_merchant_id === null || r.p_type === null || r.p_status === null ? null : { id: r.p_id, merchantId: r.p_merchant_id, type: r.p_type, status: r.p_status },
    merchant:
      r.m_id === null || r.m_status === null || r.m_website_url === null || r.m_allowed_hosts === null
        ? null
        : { id: r.m_id, status: r.m_status, websiteUrl: r.m_website_url, allowedHosts: parseStoredHosts(r.m_allowed_hosts) },
  };
}

/** For /go/o/:offerId. An unknown offer gives three nulls, which resolveOfferRedirect answers with `offer_missing`. */
export async function findOfferWithContext(db: D1Database, offerId: string): Promise<RedirectRows> {
  const row = await db.prepare(`${CONTEXT_SQL} WHERE o.id = ?1`).bind(offerId).first<ContextRow>();
  return row ? toRedirectRows(row) : { offer: null, program: null, merchant: null };
}

/**
 * For /go/:merchantSlug: the merchant's default offer. Null when the slug is unknown, the merchant has no default offer, or the default
 * offer is not a merchant offer of that same merchant (the merchant is joined through the offer's subject_id, so a foreign offer never matches).
 * A paused merchant is still returned: the route turns `merchant.status !== "active"` into 404.
 */
export async function findDefaultOfferContext(db: D1Database, merchantSlug: string): Promise<(RedirectRows & { offer: RedirectOffer; merchant: RedirectMerchant }) | null> {
  const row = await db.prepare(`${CONTEXT_SQL} WHERE m.slug = ?1 AND m.default_offer_id = o.id AND o.subject_type = 'merchant'`).bind(merchantSlug).first<ContextRow>();
  if (!row) return null;
  const rows = toRedirectRows(row);
  return rows.merchant ? { ...rows, merchant: rows.merchant } : null;
}
```

```bash
npm test -w apps/web -- test/db/offer-context.test.ts test/db/offers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Nối test kiến trúc**

`apps/web/test/architecture.test.ts`:
- Thêm vào `WRITERS` sau `partner_programs`: `offers: "../src/db/offers.ts",`.
- `MONEY_ALLOWED` thành `new Set<string>(["../src/db/merchants.ts", "../src/db/programs.ts", "../src/db/offers.ts", "../src/db/audit.ts"])`; trong comment phía trên đổi "Task 2d: db/offers.ts;" thành "Task 2d: db/offers.ts (setDefaultOffer stays in db/merchants.ts, which owns `merchants`);".
- Thêm test vào `describe` "ranking never reads money":

```ts
  it("after Task 2d the allowlist is exactly the four db files", () => {
    expect([...MONEY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/merchants.ts", "../src/db/offers.ts", "../src/db/programs.ts"]);
  });
```

(Task 3 sửa test này khi thêm `routes/admin-merchants.tsx`.)

```bash
npm test -w apps/web -- test/architecture.test.ts
grep -rniE "elevenlabs|partnerstack" apps/web/src; test $? -eq 1
```

Expected: PASS; `grep` không in dòng nào.

- [ ] **Step 6: Kiểm toàn bộ và commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/db/offers.ts apps/web/src/db/audit.ts apps/web/src/db/merchants.ts apps/web/src/domain/offer.ts apps/web/test/fixtures.ts apps/web/test/architecture.test.ts apps/web/test/domain/offer.test.ts apps/web/test/db/offers.test.ts apps/web/test/db/offer-context.test.ts
git commit -m "feat(web): offer db module and redirect reads (VNX-2102a-4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận:**
- `npm test -w apps/web -- test/db/offers.test.ts test/db/offer-context.test.ts test/domain/offer.test.ts test/architecture.test.ts` xanh.
- `findOfferWithContext` / `findDefaultOfferContext` trả đúng `RedirectOffer` / `RedirectProgram` / `RedirectMerchant`, đưa thẳng vào `resolveOfferRedirect` ra `tracked` (có / không chương trình); merchant nạp theo `subject_id` với `subject_type = 'merchant'`; chương trình của merchant khác → domain `program_merchant`; `allowed_hosts` hỏng → `[]`, không ném; offer mặc định của merchant khác → `null`.
- `setDefaultOffer`: offer của merchant khác, `archived`, không phải `subject_type = 'merchant'`, không tồn tại → `null`, không ghi, không audit (kiểm trong chính UPDATE; test đọc lại `default_offer_id`).
- `createOffer`: merchant không tồn tại hoặc chương trình của merchant khác → `null`, không dòng, không audit; template rỗng / `null` khi có chương trình, nhãn lạ → ném lỗi, không để lại dòng.
- `updateOffer`: CAS theo `expectedStatus`; đổi chủ hoặc sang chương trình của merchant khác → `null`; `archived` cuối cùng (`offerTransitionAllowed` bảng đầy đủ, db khớp); audit `offer.create|update|status`; guard `write_id` sai không ghi audit (test trực tiếp `auditStatement`).
- `MONEY_ALLOWED` đúng 4 file; `offers` có trong `WRITERS` (chỉ `db/offers.ts` ghi bảng `offers`; `db/merchants.ts` chỉ đọc `offers` trong subselect); `grep -rniE "elevenlabs|partnerstack" apps/web/src` không in dòng nào.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ≈ 640 dòng (`offers.ts` ~215, `audit.ts` ~12, `merchants.ts` ~25, domain ~5, fixtures ~30, architecture ~8, test ~345). Hơi trên mức 600 chỉ vì test (mã chạy được ≈ 300 dòng); không tách thêm. Commit `feat(web): offer db module and redirect reads (VNX-2102a-4)`.

---

### Task 3: VNX-2102b-1 — Admin merchant và chương trình (phần 1 trong 2)

**Tách task (Planner):** phạm vi gốc của Task 3 (merchant + chương trình + offer + xem trước + offer mặc định, kèm nghĩa vụ của review 2 và 2d) ước tính ≈ 1 200 dòng kể cả test, quá xa mức 600. Tách theo đường ranh giới của dữ liệu: **Task 3 (VNX-2102b-1) = `/admin/merchants` (danh sách, tạo, sửa, đổi trạng thái, kiểm lại offer khi đổi host, cảnh báo hậu tố nhiều người thuê) + chương trình**, **Task 3b (VNX-2102b-2) = offer, xem trước URL cuối, offer mặc định**. Trang chi tiết merchant sau Task 3 chưa có khu offer; Task 3b thêm vào cùng trang. Hai task cùng một nhánh, hai commit; Task 3b phụ thuộc Task 3.

**Phạm vi (Task 3):** route `routes/admin-merchants.tsx` (đăng ký bằng `registerAdminMerchantRoutes`), view `views/admin/{MerchantsPage,MerchantDetailPage,partner-fields}.tsx`, mục nav `merchants`. Ba hàm thuần mới trong domain (`MULTI_TENANT_SUFFIXES` / `multiTenantHosts`, `hostsChanged`, `offersBrokenByHosts`). Hai test db hoãn từ review 2d. Quyền admin, kiểm Origin và `Cache-Control: no-store` do `requireAdmin`, middleware chung và `AdminLayout` (`noindex`) đảm nhiệm, giống `/admin/flags`; test xác nhận từng cái. Mọi ghi dùng db Task 2c (đã audit trong cùng `db.batch`).

**Files:**
- Create: `apps/web/src/routes/admin-merchants.tsx`
- Create: `apps/web/src/views/admin/partner-fields.tsx`, `apps/web/src/views/admin/MerchantsPage.tsx`, `apps/web/src/views/admin/MerchantDetailPage.tsx`
- Modify: `apps/web/src/domain/merchant.ts` (`MULTI_TENANT_SUFFIXES`, `multiTenantHosts`, `hostsChanged`), `apps/web/src/domain/offer.ts` (`offersBrokenByHosts`)
- Modify: `apps/web/src/app.ts` (đăng ký), `apps/web/src/views/admin/AdminLayout.tsx` (mục `merchants`), 4 file `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Modify: `apps/web/test/architecture.test.ts` (`MONEY_ALLOWED` thêm `routes/admin-merchants.tsx`; bài "danh sách đúng 5 file")
- Test: `apps/web/test/domain/merchant.test.ts` (thêm), `apps/web/test/domain/offer.test.ts` (thêm), `apps/web/test/db/offers.test.ts` (thêm 1 bài), `apps/web/test/db/offer-context.test.ts` (thêm 1 bài), `apps/web/test/admin/merchants.test.ts`

**Interfaces:**
- Consumes (đã commit): `parseMerchantForm`, `MerchantFormValues`, `MerchantField`, `MerchantFieldError`, `MERCHANT_STATUSES`, `merchantTransitionAllowed` (`domain/merchant.ts`); `parseProgramForm`, `ProgramFormValues`, `ProgramField`, `ProgramFieldError`, `PROGRAM_TYPES`, `PROGRAM_PROVIDERS`, `COMMISSION_MODELS`, `PROGRAM_STATUSES`, `programTransitionAllowed`, `validateFinalUrl`-based `parseTemplate` (qua `offersBrokenByHosts`) (`domain/offer.ts`, `domain/offer-url.ts`); `createMerchant`, `updateMerchant`, `setMerchantStatus`, `findMerchantById`, `listMerchants`, `Merchant` (`db/merchants.ts`); `createProgram`, `updateProgram`, `findProgramById`, `listProgramsByMerchant`, `PartnerProgram` (`db/programs.ts`); `listOffersByMerchant` (`db/offers.ts`); `requireAdmin`, `onLocalized`, `requestOrigin`, `localizedPath`, `errorResponse`, `page`, `translator`, `AdminLayout`; fixtures `signIn`, `makeBuilder`, `makeMerchant`, `makeProgram`, `makeOffer`, `ensureUser`; `formPost`, `getReq`, `testEnv`.
- Produces (domain): `MULTI_TENANT_SUFFIXES` (17 hậu tố: 10 của đề + `appspot.com`, `blogspot.com`, `onrender.com`, `fly.dev`, `r2.dev`, `s3.amazonaws.com`, `ngrok-free.app`, thêm theo review Opus), `multiTenantHosts(hosts: readonly string[]): string[]`, `hostsChanged(a: readonly string[], b: readonly string[]): boolean`, `type BrokenOffer = { id: string; field: "destinationUrl" | "trackingTemplate"; error: UrlError | TemplateError }`, `offersBrokenByHosts(offers: readonly { id: string; destinationUrl: string; trackingTemplate: string | null }[], hosts: readonly string[]): BrokenOffer[]`.
- Produces (route): `registerAdminMerchantRoutes(app)`: `GET /admin/merchants`, `POST /admin/merchants`, `GET /admin/merchants/:id`, `POST /admin/merchants/:id`, `POST /admin/merchants/:id/status`, `POST /admin/merchants/:id/programs`, `POST /admin/merchants/:id/programs/:programId`. Task 3b thêm các route offer và offer mặc định.
- Produces (view): `AdminSection` thêm `"merchants"`; `MerchantView`, `ProgramView`, `MerchantEdit`, `ProgramEdit`, `MerchantFields` (dùng lại ở 3b: `Field`, `aria`, `STATUS_KEY` của `partner-fields.tsx`).

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **View không import `db/`** (test kiến trúc "views/ never import db" cấm cả `import type`). Vì vậy view khai báo kiểu prop cấu trúc `MerchantView`, `ProgramView` (chỉ trường cần dùng); kiểu `Merchant` / `PartnerProgram` của db gán được cho chúng. Hệ quả: **`MONEY_ALLOWED` chỉ thêm `routes/admin-merchants.tsx`** (không thêm file view; đính chính nghĩa vụ "route và view" của đề: view không chạm module db tiền nên không cần vào danh sách, và không được phép import). Bài "danh sách cho phép đúng N file" sửa thành đúng 5 file.
2. **Trang chi tiết là một trang, nhiều form POST**; lỗi (400) vẽ lại cả trang với giá trị đã nhập và lỗi cạnh trường, chỉ form lỗi mang giá trị đã nhập (`merchantEdit` hoặc `programEdit`), các form khác lấy từ DB. Thành công: `303` về `/admin/merchants/:id?done=1`.
3. **Slug chỉ đọc sau khi tạo:** form sửa không có `<input name="slug">` (hiện `<code>`); handler sửa gọi `parseMerchantForm({ ...values, slug: merchant.slug })` rồi bỏ `slug` trước khi gọi `updateMerchant` (db cũng không nhận slug). Giá trị `slug` do client gửi lên khi sửa bị bỏ qua.
4. **Merchant `archived`:** trang chi tiết **vẫn hiện form sửa** (db không chặn sửa trường, như chương trình `ended`; `status` là phần duy nhất bất biến); không có nút chuyển trạng thái, thay bằng ghi chú `merchants.archivedNote`. Chương trình `ended` tương tự: form hiện, ô `status` thay bằng `<input type="hidden" value="ended">` và ghi chú.
5. **Form tạo merchant mặc định `paused`;** chỉ nhận `active` hoặc `paused` (giá trị khác thành `paused`: giá trị an toàn; không tạo `archived`).
6. **Đổi trạng thái merchant** là POST riêng (`/status`, trường `to`): `to` ngoài enum → 400; `to` = trạng thái hiện tại hoặc `merchantTransitionAllowed` sai → 409; `setMerchantStatus` trả `null` (thua compare-and-set) → 409; `to = archived` đòi `confirm=1` (ô tick bắt buộc, vì không đảo ngược được) không thì 400.
7. **Đổi trạng thái chương trình** nằm trong form chương trình (trường `status`) cùng trường `expectedStatus` ẩn (trạng thái lúc vẽ form): `expectedStatus` ngoài enum → 400; `!programTransitionAllowed(expected, status)` → 409; `updateProgram` trả `null` → 409. Lỗi điều khoản (`terms_missing`, `direct_not_active`) hiện cạnh ô `status` (đã do `parseProgramForm` trả). `programId` không thuộc merchant trong URL → 404.
8. **Kiểm lại offer khi đổi `allowed_hosts` hoặc `website_url`** (nghĩa vụ review Task 2): chỉ chạy khi `hostsChanged(...)` hoặc `websiteUrl` khác bản đang lưu; lấy `listOffersByMerchant` bỏ `archived`, chạy `offersBrokenByHosts` (domain, dùng đúng `validateFinalUrl` / `parseTemplate` lúc redirect). Có offer hỏng → từ chối lưu (400), liệt kê `id` + trường + mã lỗi, **không ghi, không audit**. `website_url` mới đã được `parseMerchantForm` kiểm theo host mới; lý do vẫn kiểm offer khi `website_url` đổi là để tín hiệu "đổi cấu hình link" luôn đi qua cùng một cổng. Không có chốt chặn ở db (đua giữa kiểm và ghi chỉ xảy ra khi hai admin cùng sửa; công cụ một admin, chấp nhận, ghi trong báo cáo).
9. **Cảnh báo hậu tố nhiều người thuê** không chặn lưu: tính lúc vẽ trang chi tiết từ `allowedHosts` đang lưu (nên luôn hiện chừng nào còn host đó), khối `data-warning="multi-tenant"`. Khớp `host === s || host.endsWith("." + s)`.
10. **Nhãn enum (type, provider, commission model) hiện mã thô** trong `<code>` / `<option>` (như `flags` hiện `<code>{key}</code>`); trạng thái dịch qua `partner.status.*` dùng chung cho merchant, chương trình và (3b) offer. Lỗi trường dịch đủ 4 locale.
11. **`requireAdmin`, Origin, `no-store`:** giống `/admin/flags`; không thêm middleware. Redesign PR #4: `AdminLayout` đã dùng `<nav class="subnav">` với `aria-current`; mục `merchants` chỉ thêm vào mảng `NAV` / union `AdminSection`; view dùng lớp `table-wrap`, `table data`, `field`, `error-msg`, `notice`, `card`, `btn` có sẵn, và `test/design/layout.test.ts`, `test/design/assets.test.ts` phải vẫn xanh (không CSS mới, không tài nguyên ngoài).

- [ ] **Step 1: Hai test db hoãn từ review 2d (đặc tả hành vi đã có; phải xanh ngay)**

Thêm vào `apps/web/test/db/offers.test.ts` (trong `describe("db/offers writes …")`; `input`, `audits`, `countFor` đã có ở đầu file):

```ts
  it("an offer whose subject is a product, even with an id that is also a merchant's id, gets no row and no audit row", async () => {
    const admin = await ensureUser("o-admin@vnx.si");
    const m = await makeMerchant();
    const before = await countFor(m.id);
    const forged = { ...input(m, null), subjectType: "product" } as unknown as OfferInput; // `subjectId` is the merchant's id on purpose
    expect(await createOffer(testEnv.DB, { offer: forged, actorUserId: admin.id, now: at(1) })).toBeNull();
    expect(await countFor(m.id)).toEqual(before);
  });
```

Thêm vào `apps/web/test/db/offer-context.test.ts` (trong `describe("setDefaultOffer …")`):

```ts
  it("accepts the merchant's own paused offer (only archived is refused)", async () => {
    const admin = await ensureUser("d-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { status: "paused" });
    expect(await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: admin.id, now: at(2) })).toMatchObject({ defaultOfferId: o.id });
  });
```

```bash
npm test -w apps/web -- test/db/offers.test.ts test/db/offer-context.test.ts
```

Expected: PASS (nếu một bài FAIL thì đó là lỗi db của 2d: dừng và báo Reviewer, không sửa db trong task này).

- [ ] **Step 2: Hàm thuần của domain (test trước)**

Thêm vào `apps/web/test/domain/merchant.test.ts` (thêm `hostsChanged`, `MULTI_TENANT_SUFFIXES`, `multiTenantHosts` vào import):

```ts
describe("multi-tenant host suffixes", () => {
  it("lists the seventeen shared-hosting suffixes", () => {
    expect([...MULTI_TENANT_SUFFIXES].sort()).toEqual(
      [
        "appspot.com", "azurewebsites.net", "blogspot.com", "cloudfront.net", "firebaseapp.com", "fly.dev", "github.io", "herokuapp.com", "netlify.app",
        "ngrok-free.app", "onrender.com", "pages.dev", "r2.dev", "s3.amazonaws.com", "vercel.app", "web.app", "workers.dev",
      ],
    );
  });

  it("flags the suffix itself and its subdomains, never a look-alike", () => {
    expect(multiTenantHosts(["github.io", "foo.github.io", "a.b.vercel.app", "example.com", "notgithub.io", "github.io.example.com"])).toEqual(["github.io", "foo.github.io", "a.b.vercel.app"]);
    expect(multiTenantHosts([])).toEqual([]);
  });
});

describe("hostsChanged", () => {
  it("compares as sets: order does not matter, content does", () => {
    expect(hostsChanged(["a.com", "b.com"], ["b.com", "a.com"])).toBe(false);
    expect(hostsChanged(["a.com"], ["a.com", "b.com"])).toBe(true);
    expect(hostsChanged(["a.com"], ["b.com"])).toBe(true);
  });
});
```

Thêm vào `apps/web/test/domain/offer.test.ts` (thêm `offersBrokenByHosts` vào import):

```ts
describe("offersBrokenByHosts (re-check stored offers against new allowed hosts)", () => {
  const o = (id: string, destinationUrl: string, trackingTemplate: string | null = null) => ({ id, destinationUrl, trackingTemplate });

  it("returns nothing when every offer still passes", () => {
    expect(offersBrokenByHosts([o("a", "https://example.com/"), o("b", "https://x.example.com/", "https://example.com/r?c={click_id}")], ["example.com"])).toEqual([]);
  });

  it("lists each broken offer once, with the first failing field and the error code", () => {
    expect(
      offersBrokenByHosts(
        [o("a", "https://example.com/"), o("b", "https://other.com/"), o("c", "https://example.com/", "https://other.com/r?c={click_id}"), o("d", "http://example.com/", "https://other.com/")],
        ["example.com"],
      ),
    ).toEqual([
      { id: "b", field: "destinationUrl", error: "not_allowed" },
      { id: "c", field: "trackingTemplate", error: "not_allowed" },
      { id: "d", field: "destinationUrl", error: "scheme" },
    ]);
  });

  it("a stored template with an unknown placeholder is broken too", () => {
    expect(offersBrokenByHosts([o("e", "https://example.com/", "https://example.com/r?c={nope}")], ["example.com"])).toEqual([{ id: "e", field: "trackingTemplate", error: "placeholder" }]);
  });
});
```

```bash
npm test -w apps/web -- test/domain/merchant.test.ts test/domain/offer.test.ts
```

Expected: FAIL (hàm chưa có). Thêm vào `apps/web/src/domain/merchant.ts` (cuối file):

```ts
/** Shared-hosting suffixes: anyone can publish under them, so allowing one proves nothing about the merchant. A warning, not a rule. */
export const MULTI_TENANT_SUFFIXES = [
  "github.io",
  "vercel.app",
  "pages.dev",
  "netlify.app",
  "herokuapp.com",
  "workers.dev",
  "web.app",
  "firebaseapp.com",
  "azurewebsites.net",
  "cloudfront.net",
  "appspot.com",
  "blogspot.com",
  "onrender.com",
  "fly.dev",
  "r2.dev",
  "s3.amazonaws.com",
  "ngrok-free.app",
] as const;

/** The hosts that are a shared-hosting suffix or a subdomain of one (never a bare string suffix: `notgithub.io` is fine). */
export function multiTenantHosts(hosts: readonly string[]): string[] {
  return hosts.filter((h) => MULTI_TENANT_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`)));
}

/** True when the two allow-lists differ as sets. */
export function hostsChanged(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length !== right.length || left.some((h, i) => h !== right[i]);
}
```

Thêm vào `apps/web/src/domain/offer.ts` (ngay trước dòng `// ---- Redirect resolution ----`; thêm `type TemplateError` vào import từ `./offer-url.ts`):

```ts
export type BrokenOffer = { id: string; field: "destinationUrl" | "trackingTemplate"; error: UrlError | TemplateError };

/**
 * Stored offers that would no longer pass the URL rules under `hosts` (the rules of /go/ itself: validateFinalUrl and parseTemplate).
 * One entry per offer, the first failing field. Pure: the caller chooses which offers to pass (the admin passes the non-archived ones).
 */
export function offersBrokenByHosts(offers: readonly { id: string; destinationUrl: string; trackingTemplate: string | null }[], hosts: readonly string[]): BrokenOffer[] {
  const broken: BrokenOffer[] = [];
  for (const o of offers) {
    const dest = validateFinalUrl(o.destinationUrl, hosts);
    if (!dest.ok) {
      broken.push({ id: o.id, field: "destinationUrl", error: dest.error });
      continue;
    }
    if (o.trackingTemplate === null || o.trackingTemplate === "") continue;
    const tpl = parseTemplate(o.trackingTemplate, hosts);
    if (!tpl.ok) broken.push({ id: o.id, field: "trackingTemplate", error: tpl.error });
  }
  return broken;
}
```

Sửa import `./offer-url.ts` ở đầu `offer.ts` thành `import { appendUtm, fillAndValidate, parseTemplate, previewUrl, validateFinalUrl, type TemplateError, type UrlError, type UrlResult } from "./offer-url.ts";`. Chạy lại lệnh trên → PASS.

- [ ] **Step 3: Test admin merchant và chương trình (viết trước, phải FAIL)**

`apps/web/test/admin/merchants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findMerchantById } from "../../src/db/merchants.ts";
import { findProgramById } from "../../src/db/programs.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { makeBuilder, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const send = (req: Request) => createApp().request(req, undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });
const tag = () => ulid().slice(-8).toLowerCase();
const mfields = (o: Record<string, string> = {}) => ({ name: "Acme Tools", slug: `acme-${tag()}`, websiteUrl: "https://example.com/", allowedHosts: "example.com", description: "Plain.", status: "paused", ...o });
const pfields = (o: Record<string, string> = {}) => ({
  name: "Acme affiliate",
  type: "affiliate",
  network: "",
  provider: "generic_template",
  commissionModel: "",
  commissionRateBps: "",
  commissionFlatMinor: "",
  currency: "",
  cookieDays: "",
  attributionNotes: "",
  termsUrl: "",
  termsVerifiedAt: "",
  status: "draft",
  expectedStatus: "draft",
  ...o,
});
const n = async (sql: string, ...args: unknown[]) => (await testEnv.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? -1;
const auditActions = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((r) => r.action);
const merchantCount = () => n("SELECT COUNT(*) AS n FROM merchants");

describe("/admin/merchants access", () => {
  it("is for admins only; every page is no-store and noindex; a cross-site POST is refused", async () => {
    const m = await makeMerchant();
    const { cookie: userCookie } = await signIn("mer-user@vnx.si");
    await makeBuilder("mer-builder@vnx.si", "mer-builder", "approved");
    const b = await signIn("mer-builder@vnx.si");
    for (const path of ["/admin/merchants", `/admin/merchants/${m.id}`]) {
      expect((await send(getReq(path, userCookie))).status, path).toBe(403);
      expect((await send(getReq(path, b.cookie))).status, path).toBe(403);
      expect((await send(getReq(path))).status, path).toBe(303);
    }
    expect((await send(formPost("/admin/merchants", mfields(), { cookie: userCookie }))).status).toBe(403);
    const { cookie } = await admin();
    for (const path of ["/admin/merchants", `/admin/merchants/${m.id}`]) {
      const res = await send(getReq(path, cookie));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
      expect(await res.text(), path).toContain('<meta name="robots" content="noindex"');
    }
    const before = await merchantCount();
    expect((await send(formPost("/admin/merchants", mfields(), { cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect(await merchantCount()).toBe(before);
  });

  it("every POST route refuses a normal user and a builder with 403 and writes nothing", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const { cookie: userCookie } = await signIn("mer-user2@vnx.si");
    await makeBuilder("mer-builder2@vnx.si", "mer-builder2", "approved");
    const b = await signIn("mer-builder2@vnx.si");
    const snapshot = async () => [await merchantCount(), await n("SELECT COUNT(*) AS n FROM partner_programs"), await n("SELECT COUNT(*) AS n FROM audit_log"), JSON.stringify(await findMerchantById(testEnv.DB, m.id)), JSON.stringify(await findProgramById(testEnv.DB, p.id))];
    const before = await snapshot();
    const posts: [string, Record<string, string>][] = [
      [`/admin/merchants/${m.id}`, mfields({ name: "Hacked" })],
      [`/admin/merchants/${m.id}/status`, { to: "paused" }],
      [`/admin/merchants/${m.id}/programs`, pfields()],
      [`/admin/merchants/${m.id}/programs/${p.id}`, pfields({ name: "Hacked", expectedStatus: "draft" })],
    ];
    for (const who of [userCookie, b.cookie]) {
      for (const [path, fields] of posts) expect((await send(formPost(path, fields, { cookie: who }))).status, path).toBe(403);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("has a nav entry and works under every locale prefix", async () => {
    const m = await makeMerchant();
    const { cookie } = await admin();
    expect(await (await send(getReq("/admin/merchants", cookie))).text()).toContain('href="/admin/merchants"');
    for (const prefix of ["/vi", "/zh-hans", "/zh-hant"]) {
      expect((await send(getReq(`${prefix}/admin/merchants`, cookie))).status, prefix).toBe(200);
      expect((await send(getReq(`${prefix}/admin/merchants/${m.id}`, cookie))).status, prefix).toBe(200);
    }
    expect((await send(getReq("/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ", cookie))).status).toBe(404);
  });
});

describe("create merchant", () => {
  it("shows the new-merchant form with status paused selected", async () => {
    const { cookie } = await admin();
    const html = await (await send(getReq("/admin/merchants", cookie))).text();
    expect(html).toMatch(/<option value="paused" selected/);
  });

  it("creates paused by default, one merchant.create audit row, and redirects to the detail page", async () => {
    const { cookie, user } = await admin();
    const fields = mfields();
    delete (fields as Record<string, string | undefined>).status; // not sent at all: the safe default applies
    const res = await send(formPost("/admin/merchants", fields, { cookie }));
    expect(res.status).toBe(303);
    const row = await testEnv.DB.prepare("SELECT id, status, allowed_hosts FROM merchants WHERE slug = ?1").bind(fields.slug).first<{ id: string; status: string; allowed_hosts: string }>();
    expect(res.headers.get("location")).toBe(`/admin/merchants/${row?.id}?done=1`);
    expect(row?.status).toBe("paused");
    expect(JSON.parse(row?.allowed_hosts ?? "[]")).toEqual(["example.com"]);
    expect(await auditActions(row?.id ?? "")).toEqual(["merchant.create"]);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE entity_id = ?1").bind(row?.id).first<{ actor_user_id: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
  });

  it("only `active` is honoured as a chosen status; archived and junk fall back to paused", async () => {
    const { cookie } = await admin();
    for (const [status, expected] of [["active", "active"], ["archived", "paused"], ["x", "paused"]] as const) {
      const f = mfields({ status });
      await send(formPost("/admin/merchants", f, { cookie }));
      expect((await testEnv.DB.prepare("SELECT status FROM merchants WHERE slug = ?1").bind(f.slug).first<{ status: string }>())?.status, status).toBe(expected);
    }
  });

  it("refuses reserved, malformed and duplicate slugs and bad hosts with a field error and writes nothing", async () => {
    const { cookie } = await admin();
    const taken = await makeMerchant();
    const cases: [Record<string, string>, string][] = [
      [{ slug: "p" }, "merchants-slug-error"],
      [{ slug: "o" }, "merchants-slug-error"],
      [{ slug: "Bad Slug" }, "merchants-slug-error"],
      [{ slug: taken.slug }, "merchants-slug-error"],
      [{ allowedHosts: "127.0.0.1" }, "merchants-allowedHosts-error"],
      [{ allowedHosts: "https://example.com" }, "merchants-allowedHosts-error"],
      [{ websiteUrl: "http://example.com/" }, "merchants-websiteUrl-error"],
      [{ websiteUrl: "https://evil.com/" }, "merchants-websiteUrl-error"],
      [{ name: "" }, "merchants-name-error"],
    ];
    for (const [override, errorId] of cases) {
      const before = await merchantCount();
      const res = await send(formPost("/admin/merchants", mfields(override), { cookie }));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(await res.text(), JSON.stringify(override)).toContain(`id="${errorId}"`);
      expect(await merchantCount(), JSON.stringify(override)).toBe(before);
    }
    expect(await n("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'merchant.create' AND json_extract(data, '$.slug') IN ('p','o')")).toBe(0);
  });
});

describe("edit merchant", () => {
  it("never changes the slug and does not render a slug input on the detail page", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).not.toContain('name="slug"');
    expect(html).toContain(m.slug);
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ slug: "hijacked", name: "Renamed" }), { cookie }));
    expect(res.status).toBe(303);
    const after = await findMerchantById(testEnv.DB, m.id);
    expect(after).toMatchObject({ slug: m.slug, name: "Renamed" });
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.update"]);
  });

  it("a refused edit never echoes a slug from the request: the read-only slug shown is the stored one", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ slug: "hijacked", name: "" }), { cookie }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).not.toContain("hijacked");
    expect(html).toContain(m.slug);
  });

  it("unknown merchant: 404, nothing written", async () => {
    const { cookie } = await admin();
    expect((await send(formPost("/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ", mfields(), { cookie }))).status).toBe(404);
  });

  it("warns (without blocking) about a shared-hosting suffix in the stored hosts", async () => {
    const { cookie } = await admin();
    const clean = await makeMerchant();
    expect(await (await send(getReq(`/admin/merchants/${clean.id}`, cookie))).text()).not.toContain('data-warning="multi-tenant"');
    const shared = await makeMerchant({ websiteUrl: "https://acme.github.io/", allowedHosts: ["acme.github.io", "example.com"] });
    const html = await (await send(getReq(`/admin/merchants/${shared.id}`, cookie))).text();
    expect(html).toContain('data-warning="multi-tenant"');
    expect(html).toContain("acme.github.io");
    const saved = await send(formPost(`/admin/merchants/${clean.id}`, mfields({ websiteUrl: "https://x.vercel.app/", allowedHosts: "x.vercel.app\nexample.com" }), { cookie }));
    expect(saved.status).toBe(303); // a warning, not a refusal
  });

  it("refuses to save new hosts that would break a non-archived offer, lists it, and writes nothing", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const program = await makeProgram(m);
    const live = await makeOffer(m, program);
    const gone = await makeOffer(m, null, { status: "archived", destinationUrl: "https://example.com/old" });
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ websiteUrl: "https://other.com/", allowedHosts: "other.com" }), { cookie }));
    expect(res.status).toBe(400);
    const html = await res.text();
    const block = html.match(/data-broken[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(block).toContain(live.id);
    expect(block).not.toContain(gone.id); // archived offers are not checked
    expect(await findMerchantById(testEnv.DB, m.id)).toMatchObject({ allowedHosts: ["example.com"], websiteUrl: "https://example.com/" });
    expect(await auditActions(m.id)).toEqual(["merchant.create"]);
  });

  it("saves new hosts when every non-archived offer still passes, and widening the hosts needs no check", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    await makeOffer(m, null);
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ allowedHosts: "example.com\nwww.example.org", websiteUrl: "https://example.com/" }), { cookie }));
    expect(res.status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual(["example.com", "www.example.org"]);
  });

  it("the offer check also runs when only website_url changes (and passes); dropping a host an offer uses is refused (website_url alone cannot break an offer, since parseMerchantForm already checks it against the hosts)", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant({ allowedHosts: ["example.com", "other.com"] });
    const broken = await makeOffer(m, null, { destinationUrl: "https://example.com/p" });
    // hosts unchanged, only the site moves: offers still pass, so it saves
    expect((await send(formPost(`/admin/merchants/${m.id}`, mfields({ allowedHosts: "example.com\nother.com", websiteUrl: "https://other.com/" }), { cookie }))).status).toBe(303);
    // drop example.com while keeping the offer on it: refused, offer listed
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ allowedHosts: "other.com", websiteUrl: "https://other.com/" }), { cookie }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(broken.id);
  });
});

describe("merchant status", () => {
  it("moves between active and paused, audits merchant.status, and refuses a no-op or an unknown status", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant({ status: "paused" });
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "active" }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("active");
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.status"]);
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "active" }, { cookie }))).status).toBe(409);
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "bogus" }, { cookie }))).status).toBe(400);
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.status"]);
  });

  it("archiving needs the confirm tick; archived is final: no way out, no buttons, fields still editable", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "archived" }, { cookie }))).status).toBe(400);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("active");
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "archived", confirm: "1" }, { cookie }))).status).toBe(303);
    for (const to of ["active", "paused"]) expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to }, { cookie }))).status, to).toBe(409);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("archived");
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).not.toContain(`/admin/merchants/${m.id}/status`);
    expect(html).toContain(`action="/admin/merchants/${m.id}"`); // the edit form is still there
    expect((await send(formPost(`/admin/merchants/${m.id}`, mfields({ name: "Still editable" }), { cookie }))).status).toBe(303);
  });
});

describe("programs", () => {
  it("creates a draft with no defaulted terms (every optional field stays null) and audits program.create", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const res = await send(formPost(`/admin/merchants/${m.id}/programs`, pfields(), { cookie }));
    expect(res.status).toBe(303);
    const row = await testEnv.DB.prepare("SELECT * FROM partner_programs WHERE merchant_id = ?1").bind(m.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ status: "draft", commission_model: null, commission_rate_bps: null, commission_flat_minor: null, currency: null, cookie_days: null, terms_url: null, terms_verified_at: null });
    expect(await auditActions(String(row?.id))).toEqual(["program.create"]);
  });

  it("refuses active without terms_url or terms_verified_at, and a direct program as active, showing the error on the status field", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const cases: Record<string, string>[] = [
      { status: "active", expectedStatus: "draft" },
      { status: "active", termsUrl: "https://example.com/terms" },
      { status: "active", termsVerifiedAt: "2026-10-01" },
      { status: "active", type: "direct", termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" },
    ];
    for (const override of cases) {
      const res = await send(formPost(`/admin/merchants/${m.id}/programs`, pfields(override), { cookie }));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(await res.text(), JSON.stringify(override)).toContain('id="programs-new-status-error"');
    }
    expect(await n("SELECT COUNT(*) AS n FROM partner_programs WHERE merchant_id = ?1", m.id)).toBe(0);
  });

  it("an existing draft moves to active only once both terms fields are filled; a failed attempt leaves it untouched", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const url = `/admin/merchants/${m.id}/programs/${p.id}`;
    const bad = await send(formPost(url, pfields({ status: "active" }), { cookie }));
    expect(bad.status).toBe(400);
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("draft");
    const ok = await send(formPost(url, pfields({ status: "active", termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" }), { cookie }));
    expect(ok.status).toBe(303);
    expect(await findProgramById(testEnv.DB, p.id)).toMatchObject({ status: "active", termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" });
    expect(await auditActions(p.id)).toEqual(["program.create", "program.status"]);
  });

  it("answers 409 when the status moved since the form was drawn, 404 for a program of another merchant, 404 for an unknown merchant", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const p = await makeProgram(m, { status: "paused" });
    expect((await send(formPost(`/admin/merchants/${m.id}/programs/${p.id}`, pfields({ status: "draft", expectedStatus: "active" }), { cookie }))).status).toBe(409);
    expect((await send(formPost(`/admin/merchants/${m.id}/programs/${p.id}`, pfields({ status: "paused", expectedStatus: "bogus" }), { cookie }))).status).toBe(400);
    expect((await send(formPost(`/admin/merchants/${other.id}/programs/${p.id}`, pfields({ status: "paused", expectedStatus: "paused" }), { cookie }))).status).toBe(404);
    expect((await send(formPost(`/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ/programs`, pfields(), { cookie }))).status).toBe(404);
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("paused");
  });

  it("ended is final: the form has no status choice, a move out is a 409, other fields stay editable", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "ended" });
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain('<input type="hidden" name="status" value="ended"');
    const url = `/admin/merchants/${m.id}/programs/${p.id}`;
    const terms = { termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" };
    expect((await send(formPost(url, pfields({ status: "active", expectedStatus: "ended", ...terms }), { cookie }))).status).toBe(409);
    expect((await send(formPost(url, pfields({ status: "ended", expectedStatus: "ended", name: "Renamed", ...terms }), { cookie }))).status).toBe(303);
    expect(await findProgramById(testEnv.DB, p.id)).toMatchObject({ status: "ended", name: "Renamed" });
    expect(await auditActions(p.id)).toEqual(["program.create", "program.update"]);
  });
});
```

```bash
npm test -w apps/web -- test/admin/merchants.test.ts
```

Expected: FAIL (404 cho `/admin/merchants`).

- [ ] **Step 4: View dùng chung `partner-fields.tsx`**

`apps/web/src/views/admin/partner-fields.tsx`:

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import type { MessageKey } from "../../i18n/messages/en.ts";

/** One label for every status of a merchant, program or offer. */
export const STATUS_KEY: Record<"draft" | "active" | "paused" | "ended" | "archived", MessageKey> = {
  draft: "partner.status.draft",
  active: "partner.status.active",
  paused: "partner.status.paused",
  ended: "partner.status.ended",
  archived: "partner.status.archived",
};

type FieldProps = { id: string; label: string; error?: string | null; hint?: string };

/** Label, control (children), hint and error; the error id is `<id>-error` (the tests and aria-describedby use it). */
export const Field: FC<PropsWithChildren<FieldProps>> = (p) => (
  <div class="field">
    <label for={p.id}>{p.label}</label>
    {p.children}
    {p.hint ? (
      <p class="muted" id={`${p.id}-hint`}>
        {p.hint}
      </p>
    ) : null}
    {p.error ? (
      <p id={`${p.id}-error`} class="error-msg">
        {p.error}
      </p>
    ) : null}
  </div>
);

export const aria = (id: string, error: unknown) => ({ "aria-invalid": error ? "true" : undefined, "aria-describedby": error ? `${id}-error` : undefined });
```

- [ ] **Step 5: `MerchantsPage.tsx` (danh sách, tạo, và `MerchantFields` dùng chung)**

`apps/web/src/views/admin/MerchantsPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { MerchantField, MerchantFieldError, MerchantFormValues, MerchantStatus } from "../../domain/merchant.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";
import { aria, Field, STATUS_KEY } from "./partner-fields.tsx";

export type MerchantView = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  allowedHosts: readonly string[];
  description: string;
  indexable: boolean;
  status: MerchantStatus;
  defaultOfferId: string | null;
};
export type MerchantErrors = Partial<Record<MerchantField, MerchantFieldError | "taken">>;
export type MerchantEdit = { values: MerchantFormValues; errors: MerchantErrors; broken: { id: string; field: "destinationUrl" | "trackingTemplate"; error: string }[] };

const HOSTS_KEY: Record<string, MessageKey> = {
  empty: "merchants.err.hostsEmpty",
  too_many: "merchants.err.hostsTooMany",
  format: "merchants.err.hostsFormat",
  duplicate: "merchants.err.hostsDuplicate",
};

function errorText(tr: Translate, field: MerchantField, e: MerchantFieldError | "taken"): string {
  if (e.startsWith("url_")) return tr("merchants.err.url", { code: e.slice(4) });
  if (field === "slug") return tr(e === "reserved" ? "merchants.err.slugReserved" : e === "taken" ? "merchants.err.slugTaken" : "merchants.err.slugFormat");
  if (field === "allowedHosts") return tr(HOSTS_KEY[e] ?? "merchants.err.required");
  return tr(e === "too_long" ? "merchants.err.tooLong" : "merchants.err.required");
}

export const merchantValuesOf = (m: MerchantView): MerchantFormValues => ({
  name: m.name,
  slug: m.slug,
  websiteUrl: m.websiteUrl,
  allowedHosts: m.allowedHosts.join("\n"),
  description: m.description,
  indexable: m.indexable,
});

type FieldsProps = { locale: Locale; prefix: string; values: MerchantFormValues; errors: MerchantErrors; slugReadonly: boolean };

/** The merchant fields. With `slugReadonly` the slug is text, not an input: it cannot be sent, let alone changed. */
export const MerchantFields: FC<FieldsProps> = (p) => {
  const tr = translator(p.locale);
  const id = (f: string) => `${p.prefix}-${f}`;
  const err = (f: MerchantField) => (p.errors[f] ? errorText(tr, f, p.errors[f]!) : null);
  const v = p.values;
  return (
    <>
      <Field id={id("name")} label={tr("merchants.f.name")} error={err("name")}>
        <input id={id("name")} name="name" required maxlength={80} value={v.name} {...aria(id("name"), p.errors.name)} />
      </Field>
      {p.slugReadonly ? (
        <p>
          <strong>{tr("merchants.f.slug")}:</strong> <code>{v.slug}</code>
        </p>
      ) : (
        <Field id={id("slug")} label={tr("merchants.f.slug")} hint={tr("merchants.f.slugHint")} error={err("slug")}>
          <input id={id("slug")} name="slug" required maxlength={60} value={v.slug} {...aria(id("slug"), p.errors.slug)} />
        </Field>
      )}
      <Field id={id("websiteUrl")} label={tr("merchants.f.websiteUrl")} error={err("websiteUrl")}>
        <input id={id("websiteUrl")} name="websiteUrl" type="url" required maxlength={2048} value={v.websiteUrl} {...aria(id("websiteUrl"), p.errors.websiteUrl)} />
      </Field>
      <Field id={id("allowedHosts")} label={tr("merchants.f.hosts")} hint={tr("merchants.f.hostsHint")} error={err("allowedHosts")}>
        <textarea id={id("allowedHosts")} name="allowedHosts" rows={4} required {...aria(id("allowedHosts"), p.errors.allowedHosts)}>
          {v.allowedHosts}
        </textarea>
      </Field>
      <Field id={id("description")} label={tr("merchants.f.description")} error={err("description")}>
        <textarea id={id("description")} name="description" rows={6} maxlength={2000} {...aria(id("description"), p.errors.description)}>
          {v.description}
        </textarea>
      </Field>
      <p>
        <label>
          <input type="checkbox" name="indexable" value="1" checked={v.indexable} /> {tr("merchants.f.indexable")}
        </label>
      </p>
    </>
  );
};

type Props = { locale: Locale; origin: string; merchants: MerchantView[]; create: Pick<MerchantEdit, "values" | "errors"> & { status: "active" | "paused" } };

export const NEW_MERCHANT_VALUES: MerchantFormValues = { name: "", slug: "", websiteUrl: "", allowedHosts: "", description: "", indexable: false };

export const MerchantsPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("merchants.title")} rest="/admin/merchants" active="merchants">
      <h1>{tr("merchants.title")}</h1>
      <p>{tr("merchants.intro")}</p>
      {p.merchants.length === 0 ? (
        <p class="muted">{tr("merchants.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("merchants.f.name")}</th>
                <th>{tr("merchants.col.slug")}</th>
                <th>{tr("merchants.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {p.merchants.map((m) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/merchants/${m.id}`)}>{m.name}</a>
                  </td>
                  <td>
                    <code>{m.slug}</code>
                  </td>
                  <td>{tr(STATUS_KEY[m.status])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>{tr("merchants.new")}</h2>
      <form method="post" action={localizedPath(p.locale, "/admin/merchants")} class="card">
        <MerchantFields locale={p.locale} prefix="merchants" values={p.create.values} errors={p.create.errors} slugReadonly={false} />
        <div class="field">
          <label for="merchants-status">{tr("merchants.col.status")}</label>
          <select id="merchants-status" name="status">
            <option value="paused" selected={p.create.status === "paused"}>
              {tr("partner.status.paused")}
            </option>
            <option value="active" selected={p.create.status === "active"}>
              {tr("partner.status.active")}
            </option>
          </select>
          <p class="muted">{tr("merchants.newHint")}</p>
        </div>
        <button class="btn" type="submit">
          {tr("merchants.create")}
        </button>
      </form>
    </AdminLayout>
  );
};
```

(Ô lỗi của form tạo có id `merchants-slug-error`, `merchants-allowedHosts-error`, … theo `prefix = "merchants"`; test Step 3 dựa vào đó.)

- [ ] **Step 6: `MerchantDetailPage.tsx` (merchant, trạng thái, chương trình)**

`apps/web/src/views/admin/MerchantDetailPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { MERCHANT_STATUSES, merchantTransitionAllowed, multiTenantHosts } from "../../domain/merchant.ts";
import {
  COMMISSION_MODELS,
  PROGRAM_PROVIDERS,
  PROGRAM_STATUSES,
  PROGRAM_TYPES,
  type CommissionModel,
  type ProgramField,
  type ProgramFieldError,
  type ProgramFormValues,
  type ProgramProvider,
  type ProgramStatus,
  type ProgramType,
} from "../../domain/offer.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";
import { MerchantFields, merchantValuesOf, type MerchantEdit, type MerchantView } from "./MerchantsPage.tsx";
import { aria, Field, STATUS_KEY } from "./partner-fields.tsx";

export type ProgramView = {
  id: string;
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commissionModel: CommissionModel | null;
  commissionRateBps: number | null;
  commissionFlatMinor: number | null;
  currency: string | null;
  cookieDays: number | null;
  attributionNotes: string | null;
  termsUrl: string | null;
  termsVerifiedAt: string | null;
  status: ProgramStatus;
};
/** `id` is the program's id, or "new" for the create form. */
export type ProgramEdit = { id: string; values: ProgramFormValues; errors: Partial<Record<ProgramField, ProgramFieldError>> };

const PROGRAM_ERROR_KEY: Record<ProgramFieldError, MessageKey> = {
  required: "programs.err.required",
  too_long: "programs.err.tooLong",
  choice: "programs.err.choice",
  number: "programs.err.number",
  currency: "programs.err.currency",
  url: "programs.err.url",
  date: "programs.err.date",
  terms_missing: "programs.err.termsMissing",
  direct_not_active: "programs.err.directNotActive",
};

const s = (v: string | number | null): string => (v === null ? "" : String(v));
export const programValuesOf = (p: ProgramView): ProgramFormValues => ({
  name: p.name,
  type: p.type,
  network: s(p.network),
  provider: p.provider,
  commissionModel: s(p.commissionModel),
  commissionRateBps: s(p.commissionRateBps),
  commissionFlatMinor: s(p.commissionFlatMinor),
  currency: s(p.currency),
  cookieDays: s(p.cookieDays),
  attributionNotes: s(p.attributionNotes),
  termsUrl: s(p.termsUrl),
  termsVerifiedAt: s(p.termsVerifiedAt),
  status: p.status,
});
/** Nothing is defaulted except the safe status (draft). */
export const NEW_PROGRAM_VALUES: ProgramFormValues = {
  name: "", type: "affiliate", network: "", provider: "generic_template", commissionModel: "", commissionRateBps: "", commissionFlatMinor: "",
  currency: "", cookieDays: "", attributionNotes: "", termsUrl: "", termsVerifiedAt: "", status: "draft",
};

const TEXT_FIELDS: { name: ProgramField; label: MessageKey; type?: "number" | "url" | "textarea" }[] = [
  { name: "name", label: "programs.f.name" },
  { name: "network", label: "programs.f.network" },
  { name: "commissionRateBps", label: "programs.f.commissionRateBps", type: "number" },
  { name: "commissionFlatMinor", label: "programs.f.commissionFlatMinor", type: "number" },
  { name: "currency", label: "programs.f.currency" },
  { name: "cookieDays", label: "programs.f.cookieDays", type: "number" },
  { name: "attributionNotes", label: "programs.f.attributionNotes", type: "textarea" },
  { name: "termsUrl", label: "programs.f.termsUrl", type: "url" },
  { name: "termsVerifiedAt", label: "programs.f.termsVerifiedAt" },
];

type ProgramFormProps = { locale: Locale; action: string; edit: ProgramEdit; current: ProgramStatus | null };

/** One program form. `current` is the saved status (null for a new program); `ended` replaces the status choice with a hidden value. */
const ProgramForm: FC<ProgramFormProps> = (p) => {
  const tr = translator(p.locale);
  const v = p.edit.values;
  const id = (f: string) => `programs-${p.edit.id}-${f}`;
  const err = (f: ProgramField) => (p.edit.errors[f] ? tr(PROGRAM_ERROR_KEY[p.edit.errors[f]!]) : null);
  const ended = p.current === "ended";
  const select = (name: "type" | "provider" | "commissionModel" | "status", options: readonly string[], blank: boolean) => (
    <select id={id(name)} name={name} {...aria(id(name), p.edit.errors[name])}>
      {blank ? <option value="">{tr("programs.f.none")}</option> : null}
      {options.map((o) => (
        <option value={o} selected={v[name] === o}>
          {name === "status" ? tr(STATUS_KEY[o as ProgramStatus]) : o}
        </option>
      ))}
    </select>
  );
  return (
    <form method="post" action={p.action} class="card">
      <input type="hidden" name="expectedStatus" value={p.current ?? "draft"} />
      {TEXT_FIELDS.slice(0, 2).map((f) => (
        <Field id={id(f.name)} label={tr(f.label)} error={err(f.name)}>
          <input id={id(f.name)} name={f.name} value={v[f.name]} {...aria(id(f.name), p.edit.errors[f.name])} />
        </Field>
      ))}
      <Field id={id("type")} label={tr("programs.f.type")} error={err("type")}>
        {select("type", PROGRAM_TYPES, false)}
      </Field>
      <Field id={id("provider")} label={tr("programs.f.provider")} error={err("provider")}>
        {select("provider", PROGRAM_PROVIDERS, false)}
      </Field>
      <Field id={id("commissionModel")} label={tr("programs.f.commissionModel")} error={err("commissionModel")}>
        {select("commissionModel", COMMISSION_MODELS, true)}
      </Field>
      {TEXT_FIELDS.slice(2).map((f) => (
        <Field id={id(f.name)} label={tr(f.label)} error={err(f.name)}>
          {f.type === "textarea" ? (
            <textarea id={id(f.name)} name={f.name} rows={3} maxlength={1000} {...aria(id(f.name), p.edit.errors[f.name])}>
              {v[f.name]}
            </textarea>
          ) : (
            <input id={id(f.name)} name={f.name} type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} min={f.type === "number" ? 0 : undefined} value={v[f.name]} {...aria(id(f.name), p.edit.errors[f.name])} />
          )}
        </Field>
      ))}
      {ended ? (
        <>
          <input type="hidden" name="status" value="ended" />
          <p class="muted">{tr("programs.endedNote")}</p>
        </>
      ) : (
        <Field id={id("status")} label={tr("programs.f.status")} error={err("status")}>
          {select("status", PROGRAM_STATUSES, false)}
        </Field>
      )}
      <button class="btn" type="submit">
        {tr(p.current === null ? "programs.create" : "programs.save")}
      </button>
    </form>
  );
};

type Props = {
  locale: Locale;
  origin: string;
  merchant: MerchantView;
  programs: ProgramView[];
  done: boolean;
  merchantEdit?: MerchantEdit;
  programEdit?: ProgramEdit;
};

export const MerchantDetailPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const m = p.merchant;
  const base = `/admin/merchants/${m.id}`;
  const shared = multiTenantHosts(m.allowedHosts);
  const edit = p.merchantEdit ?? { values: merchantValuesOf(m), errors: {}, broken: [] };
  const targets = MERCHANT_STATUSES.filter((to) => to !== m.status && merchantTransitionAllowed(m.status, to));
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={m.name} rest={base} active="merchants">
      <p>
        <a href={localizedPath(p.locale, "/admin/merchants")}>{tr("merchants.back")}</a>
      </p>
      <h1>{m.name}</h1>
      <p>
        <code>{m.slug}</code> · {tr(STATUS_KEY[m.status])}
      </p>
      {p.done ? (
        <p class="notice good" role="status">
          {tr("partner.saved")}
        </p>
      ) : null}
      {shared.length > 0 ? (
        <p class="notice" role="note" data-warning="multi-tenant">
          {tr("merchants.hostsWarn", { hosts: shared.join(", "), name: m.name })}
        </p>
      ) : null}
      {edit.broken.length > 0 ? (
        <div class="notice" role="alert" data-broken>
          <p>{tr("merchants.brokenTitle")}</p>
          <ul>
            {edit.broken.map((b) => (
              <li>
                <code>{b.id}</code>: {tr(b.field === "destinationUrl" ? "partner.field.destinationUrl" : "partner.field.trackingTemplate")} ({b.error})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form method="post" action={localizedPath(p.locale, base)} class="card">
        <MerchantFields locale={p.locale} prefix="merchant" values={edit.values} errors={edit.errors} slugReadonly />
        <button class="btn" type="submit">
          {tr("merchants.save")}
        </button>
      </form>

      {m.status === "archived" ? (
        <p class="muted">{tr("merchants.archivedNote")}</p>
      ) : (
        <div class="row-actions">
          {targets.map((to) => (
            <form method="post" action={localizedPath(p.locale, `${base}/status`)}>
              <input type="hidden" name="to" value={to} />
              {to === "archived" ? (
                <label>
                  <input type="checkbox" name="confirm" value="1" required /> {tr("merchants.confirmArchive")}
                </label>
              ) : null}
              <button class="btn btn-ghost" type="submit">
                {tr("merchants.moveTo", { status: tr(STATUS_KEY[to]) })}
              </button>
            </form>
          ))}
        </div>
      )}

      <h2>{tr("programs.title")}</h2>
      <p>{tr("programs.intro")}</p>
      {p.programs.length === 0 ? <p class="muted">{tr("programs.empty")}</p> : null}
      {p.programs.map((program) => (
        <section aria-label={program.name}>
          <h3>
            {program.name} · {tr(STATUS_KEY[program.status])}
          </h3>
          <ProgramForm
            locale={p.locale}
            action={localizedPath(p.locale, `${base}/programs/${program.id}`)}
            edit={p.programEdit?.id === program.id ? p.programEdit : { id: program.id, values: programValuesOf(program), errors: {} }}
            current={program.status}
          />
        </section>
      ))}
      <h3>{tr("programs.new")}</h3>
      <ProgramForm
        locale={p.locale}
        action={localizedPath(p.locale, `${base}/programs`)}
        edit={p.programEdit?.id === "new" ? p.programEdit : { id: "new", values: NEW_PROGRAM_VALUES, errors: {} }}
        current={null}
      />
    </AdminLayout>
  );
};
```

Ghi chú cho Implementer: nếu `hono/jsx` không chấp nhận `selected={boolean}` / `checked={boolean}` như ở trên, dùng cùng cách các view hiện có xử lý (đối chiếu `ProductDetailPage.tsx`); test `<option value="paused" selected` ở Step 3 là hợp đồng đầu ra. Khi `maxlength` / `rows` / `min` là số, truyền bằng `{80}` như `InvitesPage.tsx`.

- [ ] **Step 7: Route**

`apps/web/src/routes/admin-merchants.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { createMerchant, findMerchantById, listMerchants, setMerchantStatus, updateMerchant, type Merchant } from "../db/merchants.ts";
import { listOffersByMerchant } from "../db/offers.ts";
import { createProgram, findProgramById, listProgramsByMerchant, updateProgram } from "../db/programs.ts";
import { hostsChanged, MERCHANT_STATUSES, merchantTransitionAllowed, parseMerchantForm, type MerchantFormValues } from "../domain/merchant.ts";
import { offersBrokenByHosts, parseProgramForm, PROGRAM_STATUSES, programTransitionAllowed, type ProgramFormValues, type ProgramStatus } from "../domain/offer.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { MerchantDetailPage, type ProgramEdit } from "../views/admin/MerchantDetailPage.tsx";
import { MerchantsPage, NEW_MERCHANT_VALUES, type MerchantEdit, type MerchantErrors } from "../views/admin/MerchantsPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const iso = () => new Date().toISOString();

const merchantValues = (b: Record<string, unknown>): MerchantFormValues => ({
  name: str(b.name),
  slug: str(b.slug),
  websiteUrl: str(b.websiteUrl),
  allowedHosts: str(b.allowedHosts),
  description: str(b.description),
  indexable: b.indexable === "1",
});

const programValues = (b: Record<string, unknown>): ProgramFormValues => ({
  name: str(b.name),
  type: str(b.type),
  network: str(b.network),
  provider: str(b.provider),
  commissionModel: str(b.commissionModel),
  commissionRateBps: str(b.commissionRateBps),
  commissionFlatMinor: str(b.commissionFlatMinor),
  currency: str(b.currency),
  cookieDays: str(b.cookieDays),
  attributionNotes: str(b.attributionNotes),
  termsUrl: str(b.termsUrl),
  termsVerifiedAt: str(b.termsVerifiedAt),
  status: str(b.status),
});

type DetailExtra = { merchantEdit?: MerchantEdit; programEdit?: ProgramEdit };

async function detail(c: Context<AppEnv>, merchant: Merchant, extra: DetailExtra = {}, status: 200 | 400 = 200) {
  const programs = await listProgramsByMerchant(c.env.DB, merchant.id);
  return page(c, <MerchantDetailPage locale={c.get("locale")} origin={requestOrigin(c)} merchant={merchant} programs={programs} done={c.req.query("done") === "1"} {...extra} />, status);
}

async function listPage(c: Context<AppEnv>, create: { values: MerchantFormValues; errors: MerchantErrors; status: "active" | "paused" }, status: 200 | 400 = 200) {
  return page(c, <MerchantsPage locale={c.get("locale")} origin={requestOrigin(c)} merchants={await listMerchants(c.env.DB)} create={create} />, status);
}

const back = (c: Context<AppEnv>, id: string) => c.redirect(localizedPath(c.get("locale"), `/admin/merchants/${id}?done=1`), 303);

export function registerAdminMerchantRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/merchants", requireAdmin, (c) => listPage(c, { values: NEW_MERCHANT_VALUES, errors: {}, status: "paused" }));

  onLocalized(app, "post", "/admin/merchants", requireAdmin, async (c) => {
    const body = await c.req.parseBody();
    const values = merchantValues(body);
    const status = body.status === "active" ? "active" : "paused"; // the safe default; archived is not offered on creation
    const parsed = parseMerchantForm(values);
    if (!parsed.ok) return listPage(c, { values, errors: parsed.errors, status }, 400);
    const created = await createMerchant(c.env.DB, { merchant: parsed.merchant, status, actorUserId: c.get("user")!.id, now: iso() });
    if (!created.ok) return listPage(c, { values, errors: { slug: "taken" }, status }, 400);
    return back(c, created.merchant.id);
  });

  onLocalized(app, "get", "/admin/merchants/:id", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    return merchant ? detail(c, merchant) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/merchants/:id", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const values = { ...merchantValues(await c.req.parseBody()), slug: merchant.slug }; // the slug is never read from the request, also not to redraw the form
    const parsed = parseMerchantForm(values);
    if (!parsed.ok) return detail(c, merchant, { merchantEdit: { values, errors: parsed.errors, broken: [] } }, 400);
    const { slug: _slug, ...fields } = parsed.merchant;
    if (hostsChanged(merchant.allowedHosts, fields.allowedHosts) || merchant.websiteUrl !== fields.websiteUrl) {
      const offers = (await listOffersByMerchant(c.env.DB, merchant.id)).filter((o) => o.status !== "archived");
      const broken = offersBrokenByHosts(offers, fields.allowedHosts);
      if (broken.length > 0) return detail(c, merchant, { merchantEdit: { values, errors: {}, broken } }, 400);
    }
    const saved = await updateMerchant(c.env.DB, { id: merchant.id, merchant: fields, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/merchants/:id/status", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const to = (MERCHANT_STATUSES as readonly string[]).includes(str(body.to)) ? (str(body.to) as Merchant["status"]) : null;
    if (!to || (to === "archived" && body.confirm !== "1")) return c.text("Bad request", 400);
    if (to === merchant.status || !merchantTransitionAllowed(merchant.status, to)) return errorResponse(c, "conflict", 409);
    const moved = await setMerchantStatus(c.env.DB, { id: merchant.id, from: merchant.status, to, actorUserId: c.get("user")!.id, now: iso() });
    return moved ? back(c, merchant.id) : errorResponse(c, "conflict", 409);
  });

  onLocalized(app, "post", "/admin/merchants/:id/programs", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const values = programValues(await c.req.parseBody());
    const parsed = parseProgramForm(values);
    if (!parsed.ok) return detail(c, merchant, { programEdit: { id: "new", values, errors: parsed.errors } }, 400);
    const created = await createProgram(c.env.DB, { merchantId: merchant.id, program: parsed.program, actorUserId: c.get("user")!.id, now: iso() });
    return created ? back(c, merchant.id) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/merchants/:id/programs/:programId", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    const program = merchant ? await findProgramById(c.env.DB, c.req.param("programId") ?? "") : null;
    if (!merchant || !program || program.merchantId !== merchant.id) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const expected = str(body.expectedStatus);
    if (!(PROGRAM_STATUSES as readonly string[]).includes(expected)) return c.text("Bad request", 400);
    const values = programValues(body);
    const parsed = parseProgramForm(values);
    if (!parsed.ok) return detail(c, merchant, { programEdit: { id: program.id, values, errors: parsed.errors } }, 400);
    if (!programTransitionAllowed(expected as ProgramStatus, parsed.program.status)) return errorResponse(c, "conflict", 409);
    const saved = await updateProgram(c.env.DB, { id: program.id, program: parsed.program, expectedStatus: expected as ProgramStatus, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "conflict", 409); // the status moved while the form was open
  });
}
```

Ghi chú: `errorResponse(c, "conflict", 409)` đã được dùng ở `admin-requests.tsx`; nếu `ErrorKind` không có `"conflict"`, dùng đúng kiểu hiện có của `ErrorPage.tsx` (không thêm kiểu mới). `_slug` bị bỏ có chủ ý (nếu lint `no-unused-vars` phàn nàn, đổi thành destructuring bằng `Object.fromEntries` hoặc `omit` nhỏ trong file; không tắt luật cho cả file).

`apps/web/src/app.ts`: import `registerAdminMerchantRoutes` từ `./routes/admin-merchants.tsx`, gọi sau `registerAdminFlagRoutes(app);`. `AdminLayout.tsx`: `AdminSection` thêm `"merchants"`; `NAV` thêm `{ key: "merchants", path: "/admin/merchants", label: "admin.nav.merchants" }` sau `flags`.

- [ ] **Step 8: i18n (đủ 4 locale; nối vào cuối mỗi file, trước `}`)**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `admin.nav.merchants` | Merchants | Merchant | 商家 | 商家 |
| `partner.saved` | Saved. | Đã lưu. | 已保存。 | 已儲存。 |
| `partner.status.active` | Active | Đang hoạt động | 启用 | 啟用 |
| `partner.status.paused` | Paused | Tạm dừng | 已暂停 | 已暫停 |
| `partner.status.archived` | Archived | Đã lưu trữ | 已归档 | 已封存 |
| `partner.status.draft` | Draft | Nháp | 草稿 | 草稿 |
| `partner.status.ended` | Ended | Đã kết thúc | 已结束 | 已結束 |
| `partner.field.destinationUrl` | Untracked link | Link không tracking | 无跟踪链接 | 無追蹤連結 |
| `partner.field.trackingTemplate` | Tracking template | Mẫu link tracking | 跟踪模板 | 追蹤範本 |
| `merchants.title` | Merchants | Merchant | 商家 | 商家 |
| `merchants.intro` | Companies we link to, with their partner programs and offers. Nothing here changes a ranking. | Các công ty chúng tôi dẫn link tới, cùng chương trình partner và offer của họ. Không mục nào ở đây thay đổi thứ hạng. | 我们链接到的公司及其合作计划和优惠。这里的任何内容都不会改变排名。 | 我們連結到的公司及其合作計畫和優惠。這裡的任何內容都不會改變排名。 |
| `merchants.empty` | No merchants yet. | Chưa có merchant nào. | 还没有商家。 | 還沒有商家。 |
| `merchants.col.slug` | Slug | Slug | Slug | Slug |
| `merchants.col.status` | Status | Trạng thái | 状态 | 狀態 |
| `merchants.new` | New merchant | Merchant mới | 新建商家 | 新增商家 |
| `merchants.newHint` | New merchants start paused; turn one on when its offers are ready. | Merchant mới bắt đầu ở trạng thái tạm dừng; bật khi các offer đã sẵn sàng. | 新商家默认为暂停；待优惠准备好后再启用。 | 新商家預設為暫停；待優惠準備好後再啟用。 |
| `merchants.create` | Create merchant | Tạo merchant | 创建商家 | 建立商家 |
| `merchants.save` | Save merchant | Lưu merchant | 保存商家 | 儲存商家 |
| `merchants.back` | All merchants | Tất cả merchant | 全部商家 | 全部商家 |
| `merchants.f.name` | Name | Tên | 名称 | 名稱 |
| `merchants.f.slug` | Slug (set once, cannot be changed) | Slug (đặt một lần, không đổi được) | Slug（一次设定，不可更改） | Slug（一次設定，不可更改） |
| `merchants.f.slugHint` | 3 to 60 lowercase letters, digits or hyphens; not "p" or "o". | 3 đến 60 chữ thường, số hoặc dấu gạch ngang; không được là "p" hay "o". | 3 到 60 个小写字母、数字或连字符；不能是 "p" 或 "o"。 | 3 到 60 個小寫字母、數字或連字號；不能是 "p" 或 "o"。 |
| `merchants.f.websiteUrl` | Website (https); also the fallback link when an offer cannot be tracked | Website (https); cũng là link thay thế khi offer không theo dõi được | 网站 (https)；offer 无法跟踪时也作为备用链接 | 網站 (https)；offer 無法追蹤時也作為備用連結 |
| `merchants.f.hosts` | Allowed hosts (one per line) | Host được phép (mỗi dòng một host) | 允许的主机（每行一个） | 允許的主機（每行一個） |
| `merchants.f.hostsHint` | Every link to this merchant must be on one of these hosts or a subdomain. Use the company's own domain. | Mọi link tới merchant này phải nằm trên một trong các host này hoặc subdomain của chúng. Dùng tên miền riêng của công ty. | 指向该商家的每个链接都必须在这些主机或其子域名上。请使用公司自己的域名。 | 指向該商家的每個連結都必須在這些主機或其子網域上。請使用公司自己的網域。 |
| `merchants.f.description` | Description (plain text, English, up to 2000 characters) | Mô tả (văn bản thuần, tiếng Anh, tối đa 2000 ký tự) | 描述（纯文本，英文，最多 2000 字符） | 描述（純文字，英文，最多 2000 字元） |
| `merchants.f.indexable` | Let search engines index the tool page (also needs the content_indexing flag) | Cho công cụ tìm kiếm index trang công cụ (cũng cần cờ content_indexing) | 允许搜索引擎收录工具页（还需开启 content_indexing 开关） | 允許搜尋引擎收錄工具頁（還需開啟 content_indexing 開關） |
| `merchants.err.required` | Required. | Bắt buộc. | 必填。 | 必填。 |
| `merchants.err.tooLong` | Too long. | Quá dài. | 太长。 | 太長。 |
| `merchants.err.slugReserved` | Reserved: "p" and "o" are used by /go/ addresses. | Đã dành riêng: "p" và "o" được dùng cho địa chỉ /go/. | 保留：“p” 和 “o” 用于 /go/ 地址。 | 保留：「p」和「o」用於 /go/ 位址。 |
| `merchants.err.slugFormat` | Use 3 to 60 lowercase letters, digits or hyphens. | Dùng 3 đến 60 chữ thường, số hoặc dấu gạch ngang. | 请使用 3 到 60 个小写字母、数字或连字符。 | 請使用 3 到 60 個小寫字母、數字或連字號。 |
| `merchants.err.slugTaken` | This slug is already taken. | Slug này đã có người dùng. | 此 slug 已被使用。 | 此 slug 已被使用。 |
| `merchants.err.hostsEmpty` | Enter at least one host. | Nhập ít nhất một host. | 请至少输入一个主机。 | 請至少輸入一個主機。 |
| `merchants.err.hostsTooMany` | At most 20 hosts. | Tối đa 20 host. | 最多 20 个主机。 | 最多 20 個主機。 |
| `merchants.err.hostsFormat` | Each line must be a plain domain name such as example.com (no https://, path, port, wildcard or IP address). | Mỗi dòng phải là một tên miền thuần như example.com (không có https://, đường dẫn, cổng, ký tự đại diện hay địa chỉ IP). | 每行必须是普通域名，如 example.com（不含 https://、路径、端口、通配符或 IP 地址）。 | 每行必須是普通網域名稱，如 example.com（不含 https://、路徑、連接埠、萬用字元或 IP 位址）。 |
| `merchants.err.hostsDuplicate` | A host is listed twice. | Có host bị liệt kê hai lần. | 有主机重复。 | 有主機重複。 |
| `merchants.err.url` | Link refused ({code}). It must be https, without user info, port or IP address, on an allowed host. | Link bị từ chối ({code}). Phải là https, không có thông tin người dùng, cổng hay địa chỉ IP, và nằm trên host được phép. | 链接被拒绝（{code}）。必须是 https，不含用户信息、端口或 IP 地址，且位于允许的主机上。 | 連結被拒絕（{code}）。必須是 https，不含使用者資訊、連接埠或 IP 位址，且位於允許的主機上。 |
| `merchants.moveTo` | Move to {status} | Chuyển sang {status} | 改为{status} | 改為{status} |
| `merchants.confirmArchive` | I understand that archived is final and this merchant's links will return 404. | Tôi hiểu rằng đã lưu trữ là không đảo ngược và link của merchant này sẽ trả 404. | 我了解归档不可撤销，且该商家的链接将返回 404。 | 我了解封存不可撤銷，且該商家的連結將回傳 404。 |
| `merchants.archivedNote` | Archived is final: the merchant cannot be activated again. Its fields can still be edited. | Đã lưu trữ là trạng thái cuối: không thể kích hoạt lại merchant. Vẫn sửa được các trường. | 归档为最终状态：商家无法再次启用，但字段仍可编辑。 | 封存為最終狀態：商家無法再次啟用，但欄位仍可編輯。 |
| `merchants.hostsWarn` | The allowed hosts include a shared-hosting domain ({hosts}). Anyone can publish a page there, so a link on that host proves nothing about {name}. Use the company's own domain. | Các host được phép có tên miền hosting dùng chung ({hosts}). Ai cũng đăng được trang ở đó, nên link trên host này không chứng minh gì về {name}. Hãy dùng tên miền riêng của công ty. | 允许的主机包含共享托管域名（{hosts}）。任何人都可以在那里发布页面，因此该主机上的链接无法证明与 {name} 有关。请使用公司自己的域名。 | 允許的主機包含共享代管網域（{hosts}）。任何人都可以在那裡發布頁面，因此該主機上的連結無法證明與 {name} 有關。請使用公司自己的網域。 |
| `merchants.brokenTitle` | Not saved. With these hosts or this website, these offers would no longer pass the link rules: | Chưa lưu. Với các host hoặc website này, các offer sau sẽ không còn qua được luật link: | 未保存。使用这些主机或网站后，以下优惠将不再通过链接规则： | 未儲存。使用這些主機或網站後，以下優惠將不再通過連結規則： |
| `programs.title` | Programs | Chương trình | 合作计划 | 合作計畫 |
| `programs.intro` | Type the terms as shown on the partner's page; nothing is filled in for you. A program can be active only with a terms link and the date you checked it, and a direct program can never be active. | Nhập điều khoản đúng như trên trang của partner; không có giá trị nào được điền sẵn. Chương trình chỉ active khi có link điều khoản và ngày bạn đã kiểm, và chương trình direct không bao giờ active được. | 按合作方页面上的原文填写条款，不会预填任何值。只有填写了条款链接和核对日期，计划才能启用；direct 类型的计划永远不能启用。 | 依合作方頁面上的原文填寫條款，不會預填任何值。只有填寫了條款連結和核對日期，計畫才能啟用；direct 類型的計畫永遠不能啟用。 |
| `programs.empty` | No programs yet. | Chưa có chương trình nào. | 还没有合作计划。 | 還沒有合作計畫。 |
| `programs.new` | New program | Chương trình mới | 新建合作计划 | 新增合作計畫 |
| `programs.create` | Create program | Tạo chương trình | 创建合作计划 | 建立合作計畫 |
| `programs.save` | Save program | Lưu chương trình | 保存合作计划 | 儲存合作計畫 |
| `programs.endedNote` | Ended is final: the program cannot be reopened. Its other fields can still be edited. | Đã kết thúc là trạng thái cuối: không mở lại được. Vẫn sửa được các trường khác. | 结束为最终状态：计划无法重新开启，但其他字段仍可编辑。 | 結束為最終狀態：計畫無法重新開啟，但其他欄位仍可編輯。 |
| `programs.f.name` | Name | Tên | 名称 | 名稱 |
| `programs.f.type` | Type | Loại | 类型 | 類型 |
| `programs.f.network` | Network (optional) | Mạng lưới (không bắt buộc) | 联盟网络（可选） | 聯盟網路（選填） |
| `programs.f.provider` | Provider | Cách tích hợp | 集成方式 | 整合方式 |
| `programs.f.commissionModel` | Commission model (optional) | Mô hình hoa hồng (không bắt buộc) | 佣金模式（可选） | 佣金模式（選填） |
| `programs.f.commissionRateBps` | Commission rate in basis points, 100 = 1% (optional) | Tỷ lệ hoa hồng theo điểm cơ bản, 100 = 1% (không bắt buộc) | 佣金比例，以基点计，100 = 1%（可选） | 佣金比例，以基點計，100 = 1%（選填） |
| `programs.f.commissionFlatMinor` | Flat commission in minor units, such as cents (optional) | Hoa hồng cố định theo đơn vị nhỏ nhất, ví dụ cent (không bắt buộc) | 固定佣金，以最小货币单位计，如分（可选） | 固定佣金，以最小貨幣單位計，如分（選填） |
| `programs.f.currency` | Currency, ISO code such as USD (optional) | Tiền tệ, mã ISO như USD (không bắt buộc) | 货币，ISO 代码，如 USD（可选） | 貨幣，ISO 代碼，如 USD（選填） |
| `programs.f.cookieDays` | Cookie days (optional) | Số ngày cookie (không bắt buộc) | Cookie 天数（可选） | Cookie 天數（選填） |
| `programs.f.attributionNotes` | Attribution notes (optional) | Ghi chú ghi nhận (không bắt buộc) | 归因备注（可选） | 歸因備註（選填） |
| `programs.f.termsUrl` | Terms link (https) | Link điều khoản (https) | 条款链接 (https) | 條款連結 (https) |
| `programs.f.termsVerifiedAt` | Terms verified on (YYYY-MM-DD, UTC) | Ngày đã kiểm điều khoản (YYYY-MM-DD, UTC) | 条款核对日期（YYYY-MM-DD，UTC） | 條款核對日期（YYYY-MM-DD，UTC） |
| `programs.f.status` | Status | Trạng thái | 状态 | 狀態 |
| `programs.f.none` | Not set | Chưa đặt | 未设置 | 未設定 |
| `programs.err.required` | Required. | Bắt buộc. | 必填。 | 必填。 |
| `programs.err.tooLong` | Too long. | Quá dài. | 太长。 | 太長。 |
| `programs.err.choice` | Pick one of the listed values. | Chọn một trong các giá trị trong danh sách. | 请选择列表中的一个值。 | 請選擇列表中的一個值。 |
| `programs.err.number` | Enter a whole number in range, or leave it empty. | Nhập số nguyên trong khoảng cho phép, hoặc để trống. | 请输入范围内的整数，或留空。 | 請輸入範圍內的整數，或留空。 |
| `programs.err.currency` | Use a three-letter ISO code such as USD, or leave it empty. | Dùng mã ISO ba chữ cái như USD, hoặc để trống. | 请使用三个字母的 ISO 代码，如 USD，或留空。 | 請使用三個字母的 ISO 代碼，如 USD，或留空。 |
| `programs.err.url` | Enter an https link, or leave it empty. | Nhập link https, hoặc để trống. | 请输入 https 链接，或留空。 | 請輸入 https 連結，或留空。 |
| `programs.err.date` | Use the format YYYY-MM-DD, or leave it empty. | Dùng định dạng YYYY-MM-DD, hoặc để trống. | 请使用 YYYY-MM-DD 格式，或留空。 | 請使用 YYYY-MM-DD 格式，或留空。 |
| `programs.err.termsMissing` | A program can be active only with a terms link and a verified date. | Chương trình chỉ active khi có link điều khoản và ngày đã kiểm. | 只有填写了条款链接和核对日期，计划才能启用。 | 只有填寫了條款連結和核對日期，計畫才能啟用。 |
| `programs.err.directNotActive` | A direct program cannot be active: it has no feature flag. | Chương trình direct không active được: nó không có cờ tính năng. | direct 类型的计划不能启用：它没有功能开关。 | direct 類型的計畫不能啟用：它沒有功能開關。 |

```bash
npm test -w apps/web -- test/admin/merchants.test.ts test/i18n/parity.test.ts test/design/layout.test.ts test/design/assets.test.ts
```

Expected: PASS.

- [ ] **Step 9: Test kiến trúc**

Trong `apps/web/test/architecture.test.ts`: thêm `"../src/routes/admin-merchants.tsx"` vào `MONEY_ALLOWED` (sau `db/audit.ts`), đổi bài "after Task 2d the allowlist is exactly the four db files" thành:

```ts
  it("after Task 3 the allowlist is exactly the four db files and the merchants admin route", () => {
    expect([...MONEY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/merchants.ts", "../src/db/offers.ts", "../src/db/programs.ts", "../src/routes/admin-merchants.tsx"]);
  });
```

và cập nhật chú thích trên `MONEY_ALLOWED` (Task 3: chỉ route; view không được import db). Chạy `npm test -w apps/web -- test/architecture.test.ts` → PASS (bài "views/ never import db" vẫn xanh vì view chỉ nhận kiểu cấu trúc).

- [ ] **Step 10: Kiểm toàn bộ và commit**

```bash
npm run typecheck -w apps/web
npm test
grep -rniE "elevenlabs|partnerstack" apps/web/src
git add apps/web/src/domain/merchant.ts apps/web/src/domain/offer.ts apps/web/src/routes/admin-merchants.tsx apps/web/src/views/admin/partner-fields.tsx apps/web/src/views/admin/MerchantsPage.tsx apps/web/src/views/admin/MerchantDetailPage.tsx apps/web/src/views/admin/AdminLayout.tsx apps/web/src/app.ts apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/architecture.test.ts apps/web/test/domain/merchant.test.ts apps/web/test/domain/offer.test.ts apps/web/test/db/offers.test.ts apps/web/test/db/offer-context.test.ts apps/web/test/admin/merchants.test.ts
git commit -m "feat(web): admin merchants and programs (VNX-2102b-1)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận (Task 3):**
- Chỉ admin: 403 người thường và builder, 303 chưa đăng nhập, POST sai Origin → 403 và không ghi; mọi trang `Cache-Control: no-store` và `<meta name="robots" content="noindex"`; mục nav `merchants` có mặt; 4 locale trả 200.
- Slug `p`, `o`, sai định dạng, trùng; `allowed_hosts` sai (IP, có `https://`); `website_url` `http:` hoặc ngoài host → 400 kèm lỗi cạnh trường, không ghi dòng, không audit. Merchant tạo mới mặc định `paused`; `archived` không tạo được lúc tạo.
- Sửa không đổi được slug (không có `<input name="slug">` trên trang chi tiết; giá trị gửi lên bị bỏ qua). Merchant `archived`: không có form `/status`, form sửa vẫn có và lưu được, mọi chuyển ra khỏi `archived` → 409; lưu trữ cần `confirm=1`.
- Đổi `allowed_hosts` hoặc `website_url` làm hỏng offer chưa `archived` → 400, liệt kê id offer, DB và audit không đổi; offer `archived` không bị kiểm; cảnh báo hậu tố nhiều người thuê hiện nhưng không chặn lưu.
- Chương trình: tạo không có giá trị mặc định (mọi trường tùy chọn `NULL`); sang `active` thiếu `terms_url` hoặc `terms_verified_at`, hoặc `direct` → 400 với lỗi trên ô `status`, trạng thái không đổi; `ended` là cuối (không có ô chọn, chuyển ra → 409, trường khác sửa được); `expectedStatus` cũ → 409; chương trình của merchant khác → 404; audit `program.create|status|update`.
- Hai test db hoãn từ 2d xanh (`createOffer` với `subjectType: "product"` → `null`, không dòng, không audit; `setDefaultOffer` nhận offer `paused` của chính merchant).
- `MONEY_ALLOWED` đúng 5 file; `grep -rniE "elevenlabs|partnerstack" apps/web/src` không in dòng nào; `test/design/*` xanh.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ước tính ≈ 640 dòng không tính locale (route 125, view 330, domain 40, nav/app 8, test ~330 gồm ~10 dòng test db): hơi trên mức 600 chỉ vì test; mã chạy được ≈ 500 dòng. Không tách thêm (đã tách 3 / 3b). Commit `feat(web): admin merchants and programs (VNX-2102b-1)`.

---

### Task 3b: VNX-2102b-2 — Offer, xem trước URL cuối, offer mặc định

**Phạm vi:** thêm vào trang chi tiết merchant của Task 3 khu **offer**: danh sách và form tạo / sửa offer (`programId` tùy chọn, `kind`, `label` gồm `try_it`, `destination_url` ghi nhãn "Untracked link", `tracking_template`, `starts_at` / `ends_at` ghi nhãn UTC, `status`), nút **"đặt làm offer mặc định"** / bỏ mặc định, **xem trước URL cuối** cho từng offer (URL tracking điền giá trị mẫu cạnh URL fallback `website_url` + UTM, kèm kết quả `resolveOfferRedirect` hiện tại), xác nhận khi lưu trữ offer mặc định, dòng "offer mặc định đã lưu trữ", ánh xạ `null` của db. Sửa `parseInstant` để nhận `YYYY-MM-DDTHH:MM` (UTC). Thêm hàm thuần `offerPreview`. Task 3 phải đã xong.

**Files:**
- Modify: `apps/web/src/domain/offer.ts` (`parseInstant` nhận dạng không có `Z`; `offerPreview`, `OfferPreview`)
- Create: `apps/web/src/views/admin/OfferSection.tsx`
- Modify: `apps/web/src/views/admin/MerchantDetailPage.tsx` (nhận `offers`, `previews`, `offerEdit`, hiện `OfferSection`; ghi chú offer mặc định đã lưu trữ), `apps/web/src/routes/admin-merchants.tsx` (3 route; `detail()` nạp offer và cờ), 4 file locale
- Test: `apps/web/test/domain/offer.test.ts` (thêm), `apps/web/test/admin/merchant-offers.test.ts`
- `test/architecture.test.ts`: không đổi (route đã trong `MONEY_ALLOWED`; `OfferSection.tsx` không import db). Bài danh sách vẫn đúng 5 file.

**Interfaces:**
- Consumes (đã commit hoặc từ Task 3): `parseOfferForm`, `OfferFormValues`, `OfferField`, `OfferFieldError`, `OfferContext`, `OFFER_KINDS`, `LABELS`, `OFFER_STATUSES`, `offerTransitionAllowed`, `resolveOfferRedirect`, `RedirectResult`, `RedirectOffer`, `RedirectProgram`, `RedirectMerchant`, `previewUrl`, `SAMPLE_VALUES`, `appendUtm`, `validateFinalUrl` (`domain/`); `createOffer`, `updateOffer`, `findOfferById`, `listOffersByMerchant`, `Offer` (`db/offers.ts`); `setDefaultOffer` (`db/merchants.ts`); `readFlags` (`db/flags.ts`); `Field`, `aria`, `STATUS_KEY`, `MerchantDetailPage`.
- Produces (domain): `type OfferPreview = { tracked: UrlResult; fallback: UrlResult; now: RedirectResult }`, `offerPreview(i: { offer: RedirectOffer; program: RedirectProgram | null; merchant: RedirectMerchant; flags: RedirectInput["flags"]; now: string }): OfferPreview`.
- Produces (route): `POST /admin/merchants/:id/offers`, `POST /admin/merchants/:id/offers/:offerId`, `POST /admin/merchants/:id/default-offer`.
- Produces (view): `OfferSection`, `OfferView`, `OfferEdit`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **`parseInstant` nhận hai dạng:** `YYYY-MM-DDTHH:MM` (cùng `:SS`, `.mmm` tùy chọn), hiểu là **UTC** (thêm `Z` trước khi `new Date`), và dạng ISO chuẩn có `Z` như cũ; `YYYY-MM-DD` vẫn là nửa đêm UTC. Trường kiểu ngày của offer là `<input type="text">` (không dùng `datetime-local`, vì nó dùng múi giờ trình duyệt); nhãn ghi "UTC" và gợi ý đổi giờ (`offers.dateHint`: 09:00 UTC = 16:00 giờ Hà Nội). Giá trị đã lưu hiển thị lại ở dạng ISO chuẩn (round-trip được). Thay đổi này thuần domain, `resolveOfferRedirect` giữ nguyên (`instantMs` vẫn chỉ nhận dạng chuẩn mà form lưu).
2. **Chương trình chọn bằng `programId`** (select; rỗng = không chương trình). Id lạ hoặc của merchant khác: nạp bằng `findProgramById`; không có → lỗi trường `programId` = `program_merchant` (400, không phải 404); có nhưng của merchant khác → `parseOfferForm` trả `program_merchant`. Quy tắc template bắt buộc / khác `destination_url` đã nằm trong `parseOfferForm` (Task 2b).
3. **Ánh xạ `null` (nghĩa vụ review 2d):** `updateOffer` → `null` = compare-and-set thua → `409` (`errorResponse(…, "conflict", 409)`); `createOffer` / `setDefaultOffer` → `null` **sau** khi route đã kiểm trước → `404`. Route kiểm trước: merchant tồn tại, offer thuộc merchant (`subjectType = "merchant"`, `subjectId`), với `setDefaultOffer` thêm offer chưa `archived`. Nhánh `null` sau kiểm trước chỉ xảy ra khi đua dữ liệu, được db test (2d) phủ; test route phủ phần kiểm trước.
4. **Lưu trữ offer mặc định cần xác nhận:** form offer của offer đang là `default_offer_id` có thêm ô `confirmArchive` (hiện luôn, ghi rõ hậu quả: `/go/<slug>` trả 404 tới khi đặt offer mặc định khác). Lưu `status = archived` cho offer mặc định mà thiếu `confirmArchive=1` → 400 với lỗi `offers.err.confirmArchive`, không ghi. Offer `archived` **không** bị tự gỡ khỏi `default_offer_id` (quyết định 2d mục 2); thay vào đó trang merchant hiện `merchants.defaultArchived` khi `defaultOfferId` trỏ tới offer `archived`.
5. **Xem trước là hàm thuần `offerPreview`** (domain, kiểm được bằng test không cần HTTP): `tracked` = `previewUrl(template)` (giá trị mẫu `SAMPLE_VALUES`) khi có template, không thì `destination_url` + UTM; `fallback` = `website_url` + UTM qua cùng cổng `validateFinalUrl`; `now` = `resolveOfferRedirect` với cờ thật đọc **thẳng D1** (`readFlags`, không cache, như `/admin/flags`) và `clickId` / `locale` / `src` mẫu. Lý do của `fallback` / `not_found` hiện bằng mã trong `<code>` (không dịch; là khóa ổn định của domain). Hiện ba dòng cạnh nhau: tracked, fallback, kết quả hiện tại.
6. **`kind` và `label` hiện mã thô** (như Task 3 mục 10). **Luật `kind` (phán quyết Controller, 2026-10-05, từ review Opus):** `affiliate` và `referral` BẮT BUỘC có chương trình (`errors.kind = "program_required"`); `official` và `trial` không cần (có hay không chương trình đều được); `sponsored` bị từ chối tới EPIC 23 (`errors.kind = "sponsored_unavailable"`, ADR-008). Luật nằm ở `parseOfferForm` (domain, Task 3b Step 1), test ở tầng domain.
7. **Danh sách offer của merchant chỉ có `subject_type = merchant`** (`listOffersByMerchant`). Sửa offer: route đọc `findOfferById` và từ chối (404) offer không thuộc merchant trong URL, rồi `updateOffer` với `expectedStatus` = trường ẩn `expectedStatus` của form.

- [ ] **Step 1: `parseInstant` nhận `YYYY-MM-DDTHH:MM` (UTC) và `offerPreview` (test trước)**

Thêm vào `apps/web/test/domain/offer.test.ts` (import `parseOfferForm`, `offerPreview`, `type OfferFormValues` nếu chưa có):

```ts
describe("offer date inputs (UTC)", () => {
  const ctx = { merchant: { id: "M", allowedHosts: ["example.com"] }, program: null };
  const form = (o: Partial<OfferFormValues> = {}): OfferFormValues => ({
    kind: "official", label: "visit_site", destinationUrl: "https://example.com/", trackingTemplate: "", startsAt: "", endsAt: "", status: "active", ...o,
  });
  const starts = (raw: string) => {
    const r = parseOfferForm(form({ startsAt: raw }), ctx);
    return r.ok ? r.offer.startsAt : r.errors.startsAt;
  };

  it("reads YYYY-MM-DDTHH:MM as UTC, and still accepts the canonical ISO form and a bare date", () => {
    expect(starts("2026-10-05T09:30")).toBe("2026-10-05T09:30:00.000Z");
    expect(starts("2026-10-05T09:30:15")).toBe("2026-10-05T09:30:15.000Z");
    expect(starts("2026-10-05T09:30:00.000Z")).toBe("2026-10-05T09:30:00.000Z");
    expect(starts("2026-10-05")).toBe("2026-10-05T00:00:00.000Z");
    expect(starts("")).toBeNull();
  });

  it("rejects local-style and impossible values", () => {
    for (const bad of ["2026-10-05 09:30", "2026-10-05T9:30", "2026-13-01T00:00", "2026-02-30T00:00", "2026-10-05T24:00", "2026-10-05T09:30+07:00", "tomorrow"]) expect(starts(bad), bad).toBe("date");
  });
});

describe("offer kind rules (Controller 2026-10-05)", () => {
  const withProgram = { merchant: { id: "M", allowedHosts: ["example.com"] }, program: { id: "P", merchantId: "M" } };
  const none = { merchant: withProgram.merchant, program: null };
  const form = (o: Partial<OfferFormValues>): OfferFormValues => ({
    kind: "official", label: "visit_site", destinationUrl: "https://example.com/", trackingTemplate: "", startsAt: "", endsAt: "", status: "active", ...o,
  });
  const tpl = { trackingTemplate: "https://example.com/r?c={click_id}" };
  const kindError = (v: OfferFormValues, ctx: Parameters<typeof parseOfferForm>[1]) => {
    const r = parseOfferForm(v, ctx);
    return r.ok ? null : (r.errors.kind ?? null);
  };

  it("affiliate and referral need a program", () => {
    for (const kind of ["affiliate", "referral"]) {
      expect(kindError(form({ kind }), none), kind).toBe("program_required");
      expect(kindError(form({ kind, ...tpl }), withProgram), kind).toBeNull();
    }
  });

  it("official and trial need none, and are fine with or without one", () => {
    for (const kind of ["official", "trial"]) {
      expect(kindError(form({ kind }), none), kind).toBeNull();
      expect(kindError(form({ kind, ...tpl }), withProgram), kind).toBeNull();
    }
  });

  it("sponsored is refused, with or without a program, until EPIC 23", () => {
    expect(kindError(form({ kind: "sponsored" }), none)).toBe("sponsored_unavailable");
    expect(kindError(form({ kind: "sponsored", ...tpl }), withProgram)).toBe("sponsored_unavailable");
  });
});

describe("offerPreview", () => {
  const merchant = { id: "M", status: "active" as const, websiteUrl: "https://example.com/", allowedHosts: ["example.com"] };
  const offer = {
    id: "O", subjectType: "merchant" as const, subjectId: "M", programId: "P", status: "active" as const,
    destinationUrl: "https://example.com/", trackingTemplate: "https://example.com/r?c={click_id}&l={locale}", startsAt: null, endsAt: null,
  };
  const program = { id: "P", merchantId: "M", type: "affiliate" as const, status: "active" as const };
  const base = { offer, program, merchant, now: "2026-10-05T00:00:00.000Z" };

  it("shows the tracked link with the sample values next to the fallback link, whatever the flag says", () => {
    for (const on of [true, false]) {
      const p = offerPreview({ ...base, flags: { affiliate: on, partner_referral: false } });
      expect(p.tracked).toEqual({ ok: true, url: "https://example.com/r?c=01HZZZZZZZZZZZZZZZZZZZZZZZ&l=en" });
      expect(p.fallback).toEqual({ ok: true, url: "https://example.com/?utm_source=vnx.si&utm_medium=referral" });
      expect(p.now).toMatchObject(on ? { kind: "tracked" } : { kind: "fallback", reason: "flag_off" });
    }
  });

  it("an offer without a program previews its own link with utm, and a broken template says why", () => {
    const own = offerPreview({ ...base, offer: { ...offer, programId: null, trackingTemplate: null }, program: null, flags: { affiliate: false, partner_referral: false } });
    expect(own.tracked).toEqual({ ok: true, url: "https://example.com/?utm_source=vnx.si&utm_medium=referral" });
    const bad = offerPreview({ ...base, offer: { ...offer, trackingTemplate: "https://other.com/r" }, flags: { affiliate: true, partner_referral: false } });
    expect(bad.tracked).toEqual({ ok: false, error: "not_allowed" });
    expect(bad.now).toEqual({ kind: "not_found", reason: "invalid_url" });
    // the same gate as /go/: an unknown placeholder is named as such, not reported as bad characters
    const unknown = offerPreview({ ...base, offer: { ...offer, trackingTemplate: "https://example.com/r?c={nope}" }, flags: { affiliate: true, partner_referral: false } });
    expect(unknown.tracked).toEqual({ ok: false, error: "placeholder" });
  });
});
```

```bash
npm test -w apps/web -- test/domain/offer.test.ts
```

Expected: FAIL (`T09:30` không có `Z` bị từ chối; `offerPreview` chưa có). Sửa `parseInstant` trong `domain/offer.ts`:

```ts
/** `YYYY-MM-DD` (midnight UTC), `YYYY-MM-DDTHH:MM[:SS[.mmm]]` (read as UTC) or the same with a trailing `Z`: the ISO instant, null for empty, or not ok. */
function parseInstant(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?)?$/.test(s)) return { ok: false };
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s.endsWith("Z") ? s : `${s}Z`);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(s.slice(0, 10))) return { ok: false };
  return { ok: true, value: d.toISOString() };
}
```

Luật `kind` trong `parseOfferForm` (cùng file; thêm `"program_required" | "sponsored_unavailable"` vào union `OfferFieldError`; thay dòng `if (!kind) errors.kind = "choice";` bằng):

```ts
  if (!kind) errors.kind = "choice";
  else if (kind === "sponsored") errors.kind = "sponsored_unavailable"; // not before EPIC 23 (ADR-008)
  else if ((kind === "affiliate" || kind === "referral") && !ctx.program) errors.kind = "program_required";
```

Các test `parseOfferForm` có sẵn dùng `kind: "affiliate"` mà không có chương trình phải sửa (thêm chương trình hoặc đổi sang `official`); không đổi ý nghĩa của chúng.

Thêm `offerPreview` ngay sau `withUtm` (cùng file; thêm `SAMPLE_VALUES` vào import từ `./offer-url.ts`):

```ts
export type PreviewLink = { ok: true; url: string } | { ok: false; error: UrlError | TemplateError };
export type OfferPreview = { tracked: PreviewLink; fallback: UrlResult; now: RedirectResult };

/**
 * What the admin sees for one offer: the tracked link (the template passes parseTemplate, the same gate /go/ applies, then gets the sample values; as it would be with the flag on; an offer without a template shows its own link with utm), the fallback link
 * (the merchant's website with utm) and the result /go/ gives right now with the flags passed in. Same gates as /go/; no I/O.
 */
export function offerPreview(i: { offer: RedirectOffer; program: RedirectProgram | null; merchant: RedirectMerchant; flags: RedirectInput["flags"]; now: string }): OfferPreview {
  const hosts = i.merchant.allowedHosts;
  let tracked: PreviewLink;
  if (i.offer.trackingTemplate) {
    const tpl = parseTemplate(i.offer.trackingTemplate, hosts);
    tracked = tpl.ok ? previewUrl(tpl.template, hosts) : { ok: false, error: tpl.error };
  } else {
    tracked = withUtm(i.offer.destinationUrl, hosts);
  }
  return {
    tracked,
    fallback: withUtm(i.merchant.websiteUrl, hosts),
    now: resolveOfferRedirect({ ...i, clickId: SAMPLE_VALUES.click_id, locale: SAMPLE_VALUES.locale, src: SAMPLE_VALUES.src }),
  };
}
```

Expected: PASS (đồng thời các test `parseOfferForm` / `resolveOfferRedirect` cũ vẫn xanh).

- [ ] **Step 2: Test admin offer (viết trước, phải FAIL)**

`apps/web/test/admin/merchant-offers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { findMerchantById, setDefaultOffer } from "../../src/db/merchants.ts";
import { findOfferById, listOffersByMerchant } from "../../src/db/offers.ts";
import { makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const send = (req: Request) => createApp().request(req, undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });
const ofields = (o: Record<string, string> = {}) => ({
  programId: "", kind: "official", label: "visit_site", destinationUrl: "https://example.com/", trackingTemplate: "", startsAt: "", endsAt: "", status: "active", expectedStatus: "active", ...o,
});
const auditActions = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((r) => r.action);
const offerCount = async (merchantId: string) => (await listOffersByMerchant(testEnv.DB, merchantId)).length;

beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags").run();
  resetFlagCache();
});

describe("create and edit offers", () => {
  it("enters the ElevenLabs-shaped data: untracked link, template, try_it label, set as default", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant({ websiteUrl: "https://elevenlabs.example/", allowedHosts: ["try.example.net", "elevenlabs.example"] });
    const p = await makeProgram(m);
    const res = await send(
      formPost(`/admin/merchants/${m.id}/offers`, ofields({ programId: p.id, kind: "affiliate", label: "try_it", destinationUrl: "https://elevenlabs.example/", trackingTemplate: "https://try.example.net/r/sample-code" }), { cookie }),
    );
    expect(res.status).toBe(303);
    const [offer] = await listOffersByMerchant(testEnv.DB, m.id);
    expect(offer).toMatchObject({ programId: p.id, label: "try_it", destinationUrl: "https://elevenlabs.example/", trackingTemplate: "https://try.example.net/r/sample-code", status: "active" });
    expect(await auditActions(offer!.id)).toEqual(["offer.create"]);

    const def = await send(formPost(`/admin/merchants/${m.id}/default-offer`, { offerId: offer!.id }, { cookie }));
    expect(def.status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(offer!.id);
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.update"]);
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("Untracked link");
    expect(html).toContain("{click_id}"); // the hint text keeps its literal placeholder
  });

  it("refuses a host outside allowed_hosts, an unknown placeholder, http:, a missing template, and a destination equal to the template; nothing is written", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const cases: [Record<string, string>, string][] = [
      [{ destinationUrl: "https://evil.com/" }, "destinationUrl"],
      [{ destinationUrl: "http://example.com/" }, "destinationUrl"],
      [{ destinationUrl: "https://example.com@evil.com/" }, "destinationUrl"],
      [{ programId: p.id, kind: "affiliate", trackingTemplate: "https://example.com/r?c={nope}" }, "trackingTemplate"],
      [{ programId: p.id, kind: "affiliate", trackingTemplate: "https://evil.com/r" }, "trackingTemplate"],
      [{ programId: p.id, kind: "affiliate", trackingTemplate: "" }, "trackingTemplate"],
      [{ programId: p.id, kind: "affiliate", destinationUrl: "https://example.com/r", trackingTemplate: "https://example.com/r" }, "destinationUrl"],
      [{ label: "buy_now" }, "label"],
      [{ kind: "affiliate" }, "kind"],
      [{ kind: "sponsored" }, "kind"],
      [{ startsAt: "2026-10-05 09:30" }, "startsAt"],
      [{ startsAt: "2026-10-06T00:00", endsAt: "2026-10-05T00:00" }, "endsAt"],
      [{ programId: "01HZZZZZZZZZZZZZZZZZZZZZZZ" }, "programId"],
    ];
    for (const [override, field] of cases) {
      const res = await send(formPost(`/admin/merchants/${m.id}/offers`, ofields(override), { cookie }));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(await res.text(), JSON.stringify(override)).toContain(`id="offers-new-${field}-error"`);
    }
    expect(await offerCount(m.id)).toBe(0);
  });

  it("a program of another merchant is refused", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    const res = await send(formPost(`/admin/merchants/${m.id}/offers`, ofields({ programId: foreign.id, kind: "affiliate", trackingTemplate: "https://example.com/r" }), { cookie }));
    expect(res.status).toBe(400);
    expect(await offerCount(m.id)).toBe(0);
  });

  it("dates: YYYY-MM-DDTHH:MM is stored as UTC, the form says UTC and shows the stored value back", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    await send(formPost(`/admin/merchants/${m.id}/offers`, ofields({ startsAt: "2026-10-05T09:30", endsAt: "2026-10-06T00:00:00.000Z" }), { cookie }));
    const [o] = await listOffersByMerchant(testEnv.DB, m.id);
    expect(o).toMatchObject({ startsAt: "2026-10-05T09:30:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" });
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("UTC");
    expect(html).toContain('value="2026-10-05T09:30:00.000Z"');
  });

  it("an update audits offer.update or offer.status; a stale expectedStatus is a 409; archived is final; an offer of another merchant is a 404", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const o = await makeOffer(m, null);
    const foreign = await makeOffer(other, null);
    const url = `/admin/merchants/${m.id}/offers/${o.id}`;
    expect((await send(formPost(url, ofields({ label: "learn_more" }), { cookie }))).status).toBe(303);
    expect((await send(formPost(url, ofields({ status: "paused" }), { cookie }))).status).toBe(303);
    expect(await auditActions(o.id)).toEqual(["offer.create", "offer.update", "offer.status"]);
    expect((await send(formPost(url, ofields({ status: "active", expectedStatus: "active" }), { cookie }))).status).toBe(409); // it is paused now
    expect((await send(formPost(url, ofields({ status: "archived", expectedStatus: "paused" }), { cookie }))).status).toBe(303);
    expect((await send(formPost(url, ofields({ status: "active", expectedStatus: "archived" }), { cookie }))).status).toBe(409);
    expect((await findOfferById(testEnv.DB, o.id))?.status).toBe("archived");
    expect((await send(formPost(url, ofields({ status: "archived", expectedStatus: "bogus" }), { cookie }))).status).toBe(400);
    expect((await send(formPost(`/admin/merchants/${m.id}/offers/${foreign.id}`, ofields(), { cookie }))).status).toBe(404);
    expect((await findOfferById(testEnv.DB, foreign.id))?.label).toBe("visit_site");
  });
});

describe("default offer", () => {
  it("sets the merchant's own offer, can clear it, and a foreign, archived or unknown offer is a 404 that writes nothing", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const mine = await makeOffer(m, null);
    const archived = await makeOffer(m, null, { status: "archived" });
    const foreign = await makeOffer(other, null);
    const url = `/admin/merchants/${m.id}/default-offer`;
    for (const id of [foreign.id, archived.id, "01HZZZZZZZZZZZZZZZZZZZZZZZ"]) expect((await send(formPost(url, { offerId: id }, { cookie }))).status, id).toBe(404);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
    expect(await auditActions(m.id)).toEqual(["merchant.create"]);
    expect((await send(formPost(url, { offerId: mine.id }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(mine.id);
    expect((await send(formPost(url, { offerId: "" }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
    expect((await send(formPost(`/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ/default-offer`, { offerId: mine.id }, { cookie }))).status).toBe(404);
  });

  it("archiving the current default offer needs the confirm tick; then the merchant page says the default offer is archived", async () => {
    const { cookie, user } = await admin();
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: user.id, now: new Date().toISOString() });
    const url = `/admin/merchants/${m.id}/offers/${o.id}`;
    expect(await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text()).not.toContain('data-warning="default-archived"');
    const refused = await send(formPost(url, ofields({ status: "archived" }), { cookie }));
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain('id="offers-' + o.id + '-confirmArchive-error"');
    expect((await findOfferById(testEnv.DB, o.id))?.status).toBe("active");
    expect((await send(formPost(url, ofields({ status: "archived", confirmArchive: "1" }), { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(o.id); // not cleared: /go/ answers 404 for it
    const warned = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(warned).toMatch(/data-warning="default-archived"[\s\S]*?\/default-offer/); // with a clear-default button inside
    expect((await send(formPost(`/admin/merchants/${m.id}/default-offer`, { offerId: "" }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
  });

  it("archiving an offer that is not the default needs no confirmation", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    expect((await send(formPost(`/admin/merchants/${m.id}/offers/${o.id}`, ofields({ status: "archived" }), { cookie }))).status).toBe(303);
  });
});

describe("final URL preview", () => {
  it("shows the tracked link and the fallback link side by side, with the flag on and with it off", async () => {
    const { cookie, user } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await makeOffer(m, p, { trackingTemplate: "https://example.com/r?c={click_id}&s={src}" });
    const tracked = "https://example.com/r?c=01HZZZZZZZZZZZZZZZZZZZZZZZ&amp;s=tools";
    const fallback = "https://example.com/?utm_source=vnx.si&amp;utm_medium=referral";

    const off = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(off).toContain(tracked);
    expect(off).toContain(fallback);
    expect(off).toContain("flag_off");
    expect(off).toContain('data-preview-now="fallback"');

    await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: user.id, now: new Date().toISOString() });
    const on = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(on).toContain(tracked);
    expect(on).toContain(fallback);
    expect(on).toContain('data-preview-now="tracked"');
  });

  it("a broken stored template shows its error instead of a link", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await makeOffer(m, p, { trackingTemplate: "https://evil.com/r?c={click_id}" }); // the db does not check hosts: corrupt data
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("not_allowed");
    expect(html).not.toContain("<code>https://evil.com"); // no link is shown for it
  });
});

describe("offer section access", () => {
  it("offer routes are admin only and refuse a cross-site POST", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const { cookie } = await signIn("offer-user@vnx.si");
    for (const path of [`/admin/merchants/${m.id}/offers`, `/admin/merchants/${m.id}/offers/${o.id}`, `/admin/merchants/${m.id}/default-offer`]) {
      expect((await send(formPost(path, ofields({ offerId: o.id }), { cookie }))).status, path).toBe(403);
    }
    const admin2 = await admin();
    const before = await offerCount(m.id);
    expect((await send(formPost(`/admin/merchants/${m.id}/offers`, ofields(), { cookie: admin2.cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect(await offerCount(m.id)).toBe(before);
  });
});
```

```bash
npm test -w apps/web -- test/admin/merchant-offers.test.ts
```

Expected: FAIL (route offer chưa có).

- [ ] **Step 3: View `OfferSection.tsx`**

`apps/web/src/views/admin/OfferSection.tsx`:

```tsx
import type { FC } from "hono/jsx";
import {
  LABELS,
  OFFER_KINDS,
  OFFER_STATUSES,
  type OfferField,
  type OfferFieldError,
  type OfferFormValues,
  type OfferKind,
  type OfferLabel,
  type OfferPreview,
  type OfferStatus,
} from "../../domain/offer.ts";
import type { UrlError } from "../../domain/offer-url.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { aria, Field, STATUS_KEY } from "./partner-fields.tsx";

export type OfferView = {
  id: string;
  programId: string | null;
  kind: OfferKind;
  label: OfferLabel;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
};
type ProgramOption = { id: string; name: string };
type Values = OfferFormValues & { programId: string };
type Errors = Partial<Record<OfferField | "confirmArchive", OfferFieldError | "confirm_archive">>;
/** `id` is the offer's id, or "new". */
export type OfferEdit = { id: string; values: Values; errors: Errors };

const ERROR_KEY: Record<Exclude<OfferFieldError, `url_${string}` | `template_${"braces" | "placeholder" | "placeholder_position" | UrlError}`> | "confirm_archive", MessageKey> = {
  required: "offers.err.required",
  choice: "offers.err.choice",
  date: "offers.err.date",
  date_order: "offers.err.dateOrder",
  program_merchant: "offers.err.programMerchant",
  program_required: "offers.err.programRequired",
  sponsored_unavailable: "offers.err.sponsored",
  template_required: "offers.err.templateRequired",
  template_without_program: "offers.err.templateWithoutProgram",
  same_as_template: "offers.err.sameAsTemplate",
  confirm_archive: "offers.err.confirmArchive",
};

export const NEW_OFFER_VALUES: Values = { programId: "", kind: "official", label: "visit_site", destinationUrl: "", trackingTemplate: "", startsAt: "", endsAt: "", status: "active" };
export const offerValuesOf = (o: OfferView): Values => ({
  programId: o.programId ?? "",
  kind: o.kind,
  label: o.label,
  destinationUrl: o.destinationUrl,
  trackingTemplate: o.trackingTemplate ?? "",
  startsAt: o.startsAt ?? "",
  endsAt: o.endsAt ?? "",
  status: o.status,
});

type FormProps = { locale: Locale; action: string; edit: OfferEdit; current: OfferStatus | null; programs: ProgramOption[]; isDefault: boolean };

const OfferForm: FC<FormProps> = (p) => {
  const tr = translator(p.locale);
  const v = p.edit.values;
  const id = (f: string) => `offers-${p.edit.id}-${f}`;
  const err = (f: OfferField | "confirmArchive"): string | null => {
    const e = p.edit.errors[f];
    if (!e) return null;
    if (e.startsWith("url_")) return tr("offers.err.url", { code: e.slice(4) });
    if (e.startsWith("template_") && e !== "template_required" && e !== "template_without_program") return tr("offers.err.template", { code: e.slice(9) });
    return tr(ERROR_KEY[e as keyof typeof ERROR_KEY]);
  };
  const select = (name: "kind" | "label" | "status", options: readonly string[]) => (
    <select id={id(name)} name={name} {...aria(id(name), p.edit.errors[name])}>
      {options.map((o) => (
        <option value={o} selected={v[name] === o}>
          {name === "status" ? tr(STATUS_KEY[o as OfferStatus]) : o}
        </option>
      ))}
    </select>
  );
  const archived = p.current === "archived";
  return (
    <form method="post" action={p.action} class="card">
      <input type="hidden" name="expectedStatus" value={p.current ?? "active"} />
      <Field id={id("programId")} label={tr("offers.f.program")} error={err("programId")}>
        <select id={id("programId")} name="programId" {...aria(id("programId"), p.edit.errors.programId)}>
          <option value="">{tr("offers.f.noProgram")}</option>
          {p.programs.map((pr) => (
            <option value={pr.id} selected={v.programId === pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={id("kind")} label={tr("offers.f.kind")} error={err("kind")}>
        {select("kind", OFFER_KINDS)}
      </Field>
      <Field id={id("label")} label={tr("offers.f.label")} error={err("label")}>
        {select("label", LABELS)}
      </Field>
      <Field id={id("destinationUrl")} label={tr("partner.field.destinationUrl")} hint={tr("offers.f.destinationHint")} error={err("destinationUrl")}>
        <input id={id("destinationUrl")} name="destinationUrl" type="url" required maxlength={2048} value={v.destinationUrl} {...aria(id("destinationUrl"), p.edit.errors.destinationUrl)} />
      </Field>
      <Field id={id("trackingTemplate")} label={tr("partner.field.trackingTemplate")} hint={tr("offers.f.templateHint")} error={err("trackingTemplate")}>
        <input id={id("trackingTemplate")} name="trackingTemplate" maxlength={2048} value={v.trackingTemplate} {...aria(id("trackingTemplate"), p.edit.errors.trackingTemplate)} />
      </Field>
      <Field id={id("startsAt")} label={tr("offers.f.startsAt")} hint={tr("offers.dateHint")} error={err("startsAt")}>
        <input id={id("startsAt")} name="startsAt" placeholder="YYYY-MM-DDTHH:MM" value={v.startsAt} {...aria(id("startsAt"), p.edit.errors.startsAt)} />
      </Field>
      <Field id={id("endsAt")} label={tr("offers.f.endsAt")} hint={tr("offers.dateHint")} error={err("endsAt")}>
        <input id={id("endsAt")} name="endsAt" placeholder="YYYY-MM-DDTHH:MM" value={v.endsAt} {...aria(id("endsAt"), p.edit.errors.endsAt)} />
      </Field>
      {archived ? (
        <>
          <input type="hidden" name="status" value="archived" />
          <p class="muted">{tr("offers.archivedNote")}</p>
        </>
      ) : (
        <Field id={id("status")} label={tr("offers.f.status")} error={err("status")}>
          {select("status", OFFER_STATUSES)}
        </Field>
      )}
      {p.isDefault && !archived ? (
        <Field id={id("confirmArchive")} label={tr("offers.f.confirmArchive")} error={err("confirmArchive")}>
          <input id={id("confirmArchive")} type="checkbox" name="confirmArchive" value="1" {...aria(id("confirmArchive"), p.edit.errors.confirmArchive)} />
        </Field>
      ) : null}
      <button class="btn" type="submit">
        {tr(p.current === null ? "offers.create" : "offers.save")}
      </button>
    </form>
  );
};

function Preview(p: { locale: Locale; preview: OfferPreview; hasProgram: boolean }) {
  const tr = translator(p.locale);
  const link = (r: OfferPreview["tracked"]) => (r.ok ? <code>{r.url}</code> : tr("offers.preview.invalid", { code: r.error }));
  const now = p.preview.now;
  return (
    <dl class="facts" data-preview>
      <dt>{tr(p.hasProgram ? "offers.preview.tracked" : "offers.preview.own")}</dt>
      <dd class="break">{link(p.preview.tracked)}</dd>
      <dt>{tr("offers.preview.fallback")}</dt>
      <dd class="break">{link(p.preview.fallback)}</dd>
      <dt>{tr("offers.preview.now")}</dt>
      <dd class="break" data-preview-now={now.kind}>
        {tr(now.kind === "tracked" ? "offers.preview.kind.tracked" : now.kind === "fallback" ? "offers.preview.kind.fallback" : "offers.preview.kind.notFound")}{" "}
        {now.kind === "tracked" ? <code>{now.url}</code> : <code>{now.reason}</code>}
        {now.kind === "fallback" ? (
          <>
            {" "}
            <code>{now.url}</code>
          </>
        ) : null}
      </dd>
    </dl>
  );
}

type Props = {
  locale: Locale;
  merchantId: string;
  defaultOfferId: string | null;
  offers: OfferView[];
  programs: ProgramOption[];
  previews: Record<string, OfferPreview>;
  edit?: OfferEdit;
};

export const OfferSection: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = `/admin/merchants/${p.merchantId}`;
  return (
    <>
      <h2>{tr("offers.title")}</h2>
      <p>{tr("offers.intro")}</p>
      {p.offers.length === 0 ? <p class="muted">{tr("offers.empty")}</p> : null}
      {p.offers.map((o) => {
        const isDefault = p.defaultOfferId === o.id;
        const preview = p.previews[o.id];
        return (
          <section aria-label={o.id}>
            <h3>
              <code>{o.id}</code> · <code>{o.label}</code> · {tr(STATUS_KEY[o.status])}
              {isDefault ? ` · ${tr("offers.isDefault")}` : ""}
            </h3>
            {preview ? (
              <>
                <h4>{tr("offers.preview.title")}</h4>
                <Preview locale={p.locale} preview={preview} hasProgram={o.programId !== null} />
              </>
            ) : null}
            {o.status !== "archived" ? (
              <form method="post" action={localizedPath(p.locale, `${base}/default-offer`)}>
                <input type="hidden" name="offerId" value={isDefault ? "" : o.id} />
                <button class="btn btn-ghost" type="submit">
                  {tr(isDefault ? "offers.clearDefault" : "offers.setDefault")}
                </button>
              </form>
            ) : null}
            <OfferForm
              locale={p.locale}
              action={localizedPath(p.locale, `${base}/offers/${o.id}`)}
              edit={p.edit?.id === o.id ? p.edit : { id: o.id, values: offerValuesOf(o), errors: {} }}
              current={o.status}
              programs={p.programs}
              isDefault={isDefault}
            />
          </section>
        );
      })}
      <h3>{tr("offers.new")}</h3>
      <OfferForm
        locale={p.locale}
        action={localizedPath(p.locale, `${base}/offers`)}
        edit={p.edit?.id === "new" ? p.edit : { id: "new", values: NEW_OFFER_VALUES, errors: {} }}
        current={null}
        programs={p.programs}
        isDefault={false}
      />
    </>
  );
};
```

Trong `MerchantDetailPage.tsx`: thêm props `offers: OfferView[]`, `previews: Record<string, OfferPreview>`, `offerEdit?: OfferEdit`; ngay sau khối `edit.broken` thêm

```tsx
      {m.defaultOfferId && p.offers.find((o) => o.id === m.defaultOfferId)?.status === "archived" ? (
        <div class="notice" role="note" data-warning="default-archived">
          <p>{tr("merchants.defaultArchived")}</p>
          <form method="post" action={localizedPath(p.locale, `${base}/default-offer`)}>
            <input type="hidden" name="offerId" value="" />
            <button class="btn btn-ghost" type="submit">
              {tr("offers.clearDefault")}
            </button>
          </form>
        </div>
      ) : null}
```

và sau khu chương trình (trước `</AdminLayout>`) thêm `<OfferSection locale={p.locale} merchantId={m.id} defaultOfferId={m.defaultOfferId} offers={p.offers} programs={p.programs.map((x) => ({ id: x.id, name: x.name }))} previews={p.previews} edit={p.offerEdit} />`.

- [ ] **Step 4: Route (thêm vào `routes/admin-merchants.tsx`)**

Imports thêm: `readFlags` (`../db/flags.ts`), `createOffer`, `findOfferById`, `updateOffer` (`../db/offers.ts`), `setDefaultOffer` (cùng dòng import `db/merchants.ts`), `LABELS`-không cần, `offerPreview`, `offerTransitionAllowed`, `OFFER_STATUSES`, `parseOfferForm`, `type OfferStatus` (`../domain/offer.ts`), `type OfferEdit` (`../views/admin/OfferSection.tsx`). Thêm hàm đọc form và mở rộng `detail()`:

```tsx
const offerValues = (b: Record<string, unknown>): OfferEdit["values"] => ({
  programId: str(b.programId),
  kind: str(b.kind),
  label: str(b.label),
  destinationUrl: str(b.destinationUrl),
  trackingTemplate: str(b.trackingTemplate),
  startsAt: str(b.startsAt),
  endsAt: str(b.endsAt),
  status: str(b.status),
});

type DetailExtra = { merchantEdit?: MerchantEdit; programEdit?: ProgramEdit; offerEdit?: OfferEdit };

async function detail(c: Context<AppEnv>, merchant: Merchant, extra: DetailExtra = {}, status: 200 | 400 = 200) {
  const [programs, offers, flags] = await Promise.all([listProgramsByMerchant(c.env.DB, merchant.id), listOffersByMerchant(c.env.DB, merchant.id), readFlags(c.env.DB)]);
  const now = iso();
  const previews = Object.fromEntries(
    offers.map((offer) => [offer.id, offerPreview({ offer, program: programs.find((p) => p.id === offer.programId) ?? null, merchant, flags, now })]),
  );
  return page(
    c,
    <MerchantDetailPage locale={c.get("locale")} origin={requestOrigin(c)} merchant={merchant} programs={programs} offers={offers} previews={previews} done={c.req.query("done") === "1"} {...extra} />,
    status,
  );
}
```

Ba route mới (trong `registerAdminMerchantRoutes`, cuối hàm):

```tsx
  /** Reads the form of an offer of `merchant` and runs the domain rules; the program is looked up, never trusted. */
  async function offerInput(c: Context<AppEnv>, merchant: Merchant, body: Record<string, unknown>) {
    const values = offerValues(body);
    const program = values.programId === "" ? null : await findProgramById(c.env.DB, values.programId);
    if (values.programId !== "" && !program) return { values, parsed: { ok: false as const, errors: { programId: "program_merchant" as const } } };
    const parsed = parseOfferForm(values, { merchant: { id: merchant.id, allowedHosts: merchant.allowedHosts }, program: program ? { id: program.id, merchantId: program.merchantId } : null });
    return { values, parsed };
  }

  onLocalized(app, "post", "/admin/merchants/:id/offers", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const { values, parsed } = await offerInput(c, merchant, await c.req.parseBody());
    if (!parsed.ok) return detail(c, merchant, { offerEdit: { id: "new", values, errors: parsed.errors } }, 400);
    const created = await createOffer(c.env.DB, { offer: parsed.offer, actorUserId: c.get("user")!.id, now: iso() });
    return created ? back(c, merchant.id) : errorResponse(c, "notFound", 404); // null after the checks above: a race
  });

  onLocalized(app, "post", "/admin/merchants/:id/offers/:offerId", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    const offer = merchant ? await findOfferById(c.env.DB, c.req.param("offerId") ?? "") : null;
    if (!merchant || !offer || offer.subjectType !== "merchant" || offer.subjectId !== merchant.id) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const expected = str(body.expectedStatus);
    if (!(OFFER_STATUSES as readonly string[]).includes(expected)) return c.text("Bad request", 400);
    const { values, parsed } = await offerInput(c, merchant, body);
    if (!parsed.ok) return detail(c, merchant, { offerEdit: { id: offer.id, values, errors: parsed.errors } }, 400);
    if (!offerTransitionAllowed(expected as OfferStatus, parsed.offer.status)) return errorResponse(c, "conflict", 409);
    if (parsed.offer.status === "archived" && expected !== "archived" && merchant.defaultOfferId === offer.id && body.confirmArchive !== "1") {
      return detail(c, merchant, { offerEdit: { id: offer.id, values, errors: { confirmArchive: "confirm_archive" } } }, 400);
    }
    const saved = await updateOffer(c.env.DB, { id: offer.id, offer: parsed.offer, expectedStatus: expected as OfferStatus, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "conflict", 409); // changed meanwhile
  });

  onLocalized(app, "post", "/admin/merchants/:id/default-offer", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const offerId = str((await c.req.parseBody()).offerId);
    if (offerId !== "") {
      const offer = await findOfferById(c.env.DB, offerId);
      if (!offer || offer.subjectType !== "merchant" || offer.subjectId !== merchant.id || offer.status === "archived") return errorResponse(c, "notFound", 404);
    }
    const saved = await setDefaultOffer(c.env.DB, { merchantId: merchant.id, offerId: offerId === "" ? null : offerId, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "notFound", 404); // null after the checks above: a race
  });
```

Ghi chú: `findOfferById` / `createOffer` / `updateOffer` / `setDefaultOffer` đã có (2d). Chữ ký lỗi của `parsed.errors` phải khớp `OfferEdit["errors"]`; nếu TypeScript không suy ra được nhánh `{ programId: "program_merchant" }`, khai báo kiểu trả về tường minh cho `offerInput`.

- [ ] **Step 5: i18n (đủ 4 locale)**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `offers.title` | Offers | Offer | 优惠 | 優惠 |
| `offers.intro` | An offer is one button on the tool page. It may carry a program (tracked link) or not (the merchant's own link). The default offer is what /go/<slug> follows. | Offer là một nút trên trang công cụ. Có thể gắn chương trình (link tracking) hoặc không (link chính thức của merchant). Offer mặc định là đích của /go/<slug>. | 优惠是工具页上的一个按钮。可以关联合作计划（跟踪链接），也可以不关联（商家自己的链接）。默认优惠是 /go/<slug> 的跳转目标。 | 優惠是工具頁上的一個按鈕。可以關聯合作計畫（追蹤連結），也可以不關聯（商家自己的連結）。預設優惠是 /go/<slug> 的跳轉目標。 |
| `offers.empty` | No offers yet. | Chưa có offer nào. | 还没有优惠。 | 還沒有優惠。 |
| `offers.new` | New offer | Offer mới | 新建优惠 | 新增優惠 |
| `offers.create` | Create offer | Tạo offer | 创建优惠 | 建立優惠 |
| `offers.save` | Save offer | Lưu offer | 保存优惠 | 儲存優惠 |
| `offers.isDefault` | Default offer | Offer mặc định | 默认优惠 | 預設優惠 |
| `offers.setDefault` | Make default | Đặt làm mặc định | 设为默认 | 設為預設 |
| `offers.clearDefault` | Clear default | Bỏ mặc định | 取消默认 | 取消預設 |
| `offers.archivedNote` | Archived is final: the offer cannot be reactivated. Its other fields can still be edited. | Đã lưu trữ là trạng thái cuối: không kích hoạt lại offer được. Vẫn sửa được các trường khác. | 归档为最终状态：优惠无法重新启用，但其他字段仍可编辑。 | 封存為最終狀態：優惠無法重新啟用，但其他欄位仍可編輯。 |
| `offers.f.program` | Program | Chương trình | 合作计划 | 合作計畫 |
| `offers.f.noProgram` | No program (the merchant's own link) | Không có chương trình (link chính thức của merchant) | 无合作计划（商家自己的链接） | 無合作計畫（商家自己的連結） |
| `offers.f.kind` | Kind | Loại | 类型 | 類型 |
| `offers.f.label` | Button label | Nhãn nút | 按钮文字 | 按鈕文字 |
| `offers.f.destinationHint` | The plain link without any tracking. It must differ from the tracking template and be on an allowed host. | Link thuần, không có tracking. Phải khác mẫu tracking và nằm trên host được phép. | 不含任何跟踪的普通链接。必须与跟踪模板不同，并位于允许的主机上。 | 不含任何追蹤的普通連結。必須與追蹤範本不同，並位於允許的主機上。 |
| `offers.f.templateHint` | Required when a program is selected. Placeholders: {click_id}, {locale}, {src}. A link with no placeholder is used as typed. | Bắt buộc khi chọn chương trình. Placeholder: {click_id}, {locale}, {src}. Link không có placeholder được dùng nguyên văn. | 选择合作计划时必填。占位符：{click_id}、{locale}、{src}。不含占位符的链接按原样使用。 | 選擇合作計畫時必填。佔位符：{click_id}、{locale}、{src}。不含佔位符的連結按原樣使用。 |
| `offers.f.startsAt` | Starts at (UTC, optional) | Bắt đầu lúc (UTC, không bắt buộc) | 开始时间（UTC，可选） | 開始時間（UTC，選填） |
| `offers.f.endsAt` | Ends at (UTC, optional) | Kết thúc lúc (UTC, không bắt buộc) | 结束时间（UTC，可选） | 結束時間（UTC，選填） |
| `offers.dateHint` | All times are UTC. Type YYYY-MM-DDTHH:MM or a full ISO time ending in Z. Hanoi is UTC+7: 09:00 here is 16:00 there. | Mọi giờ đều là UTC. Nhập YYYY-MM-DDTHH:MM hoặc giờ ISO đầy đủ kết thúc bằng Z. Hà Nội là UTC+7: 09:00 ở đây là 16:00 ở Hà Nội. | 所有时间均为 UTC。输入 YYYY-MM-DDTHH:MM 或以 Z 结尾的完整 ISO 时间。河内为 UTC+7：此处 09:00 即河内 16:00。 | 所有時間均為 UTC。輸入 YYYY-MM-DDTHH:MM 或以 Z 結尾的完整 ISO 時間。河內為 UTC+7：此處 09:00 即河內 16:00。 |
| `offers.f.status` | Status | Trạng thái | 状态 | 狀態 |
| `offers.f.confirmArchive` | Confirm: archive this default offer (the merchant's /go/ link will return 404 until another default is set) | Xác nhận: lưu trữ offer mặc định này (link /go/ của merchant sẽ trả 404 cho tới khi đặt offer mặc định khác) | 确认：归档此默认优惠（在设置新的默认优惠之前，该商家的 /go/ 链接将返回 404） | 確認：封存此預設優惠（在設定新的預設優惠之前，該商家的 /go/ 連結將回傳 404） |
| `offers.preview.title` | Final link preview (sample values) | Xem trước link cuối (giá trị mẫu) | 最终链接预览（示例值） | 最終連結預覽（範例值） |
| `offers.preview.tracked` | Tracked link | Link có tracking | 跟踪链接 | 追蹤連結 |
| `offers.preview.fallback` | Fallback link (website + UTM) | Link thay thế (website + UTM) | 备用链接（网站 + UTM） | 備用連結（網站 + UTM） |
| `offers.preview.now` | Right now | Hiện tại | 当前结果 | 目前結果 |
| `offers.preview.kind.tracked` | Tracked: | Có tracking: | 跟踪： | 追蹤： |
| `offers.preview.kind.fallback` | Fallback, because | Dùng link thay thế, vì | 使用备用链接，原因： | 使用備用連結，原因： |
| `offers.preview.kind.notFound` | Not found (404), because | Không tìm thấy (404), vì | 未找到（404），原因： | 找不到（404），原因： |
| `offers.preview.invalid` | Invalid ({code}) | Không hợp lệ ({code}) | 无效（{code}） | 無效（{code}） |
| `merchants.defaultArchived` | The default offer is archived: the merchant's /go/ link returns 404. Pick another default offer. | Offer mặc định đã lưu trữ: link /go/ của merchant trả 404. Hãy chọn offer mặc định khác. | 默认优惠已归档：该商家的 /go/ 链接返回 404。请选择其他默认优惠。 | 預設優惠已封存：該商家的 /go/ 連結回傳 404。請選擇其他預設優惠。 |
| `offers.err.required` | Required. | Bắt buộc. | 必填。 | 必填。 |
| `offers.err.choice` | Pick one of the listed values. | Chọn một trong các giá trị trong danh sách. | 请选择列表中的一个值。 | 請選擇列表中的一個值。 |
| `offers.err.date` | Use YYYY-MM-DDTHH:MM (UTC) or a full ISO time ending in Z, or leave it empty. | Dùng YYYY-MM-DDTHH:MM (UTC) hoặc giờ ISO đầy đủ kết thúc bằng Z, hoặc để trống. | 请使用 YYYY-MM-DDTHH:MM（UTC）或以 Z 结尾的完整 ISO 时间，或留空。 | 請使用 YYYY-MM-DDTHH:MM（UTC）或以 Z 結尾的完整 ISO 時間，或留空。 |
| `offers.err.dateOrder` | The end must be after the start. | Thời điểm kết thúc phải sau thời điểm bắt đầu. | 结束时间必须晚于开始时间。 | 結束時間必須晚於開始時間。 |
| `offers.err.programMerchant` | This program does not belong to this merchant. | Chương trình này không thuộc merchant này. | 该合作计划不属于此商家。 | 該合作計畫不屬於此商家。 |
| `offers.err.templateRequired` | A tracking template is required when a program is selected. | Cần mẫu tracking khi đã chọn chương trình. | 选择合作计划时必须填写跟踪模板。 | 選擇合作計畫時必須填寫追蹤範本。 |
| `offers.err.templateWithoutProgram` | A tracking template needs a program. Select one, or empty the template. | Mẫu tracking cần có chương trình. Hãy chọn chương trình hoặc xóa mẫu. | 跟踪模板需要合作计划。请选择一个，或清空模板。 | 追蹤範本需要合作計畫。請選擇一個，或清空範本。 |
| `offers.err.programRequired` | An affiliate or referral offer needs a program. | Offer affiliate hoặc referral cần có chương trình. | 联盟或推荐类优惠需要合作计划。 | 聯盟或推薦類優惠需要合作計畫。 |
| `offers.err.sponsored` | Sponsored offers are not available yet. | Offer tài trợ chưa dùng được. | 赞助类优惠暂不可用。 | 贊助類優惠暫不可用。 |
| `offers.preview.own` | Merchant link (no tracking) | Link của merchant (không tracking) | 商家链接（无跟踪） | 商家連結（無追蹤） |
| `offers.err.sameAsTemplate` | The untracked link must differ from the tracking template. | Link không tracking phải khác mẫu tracking. | 无跟踪链接必须与跟踪模板不同。 | 無追蹤連結必須與追蹤範本不同。 |
| `offers.err.url` | Link refused ({code}). It must be https, without user info, port or IP address, on an allowed host. | Link bị từ chối ({code}). Phải là https, không có thông tin người dùng, cổng hay địa chỉ IP, và nằm trên host được phép. | 链接被拒绝（{code}）。必须是 https，不含用户信息、端口或 IP 地址，且位于允许的主机上。 | 連結被拒絕（{code}）。必須是 https，不含使用者資訊、連接埠或 IP 位址，且位於允許的主機上。 |
| `offers.err.template` | Template refused ({code}). Use only {click_id}, {locale} and {src}, after the host, on an allowed host. | Mẫu bị từ chối ({code}). Chỉ dùng {click_id}, {locale} và {src}, đặt sau host, trên host được phép. | 模板被拒绝（{code}）。仅可使用 {click_id}、{locale} 和 {src}，且位于主机之后、允许的主机上。 | 範本被拒絕（{code}）。僅可使用 {click_id}、{locale} 和 {src}，且位於主機之後、允許的主機上。 |
| `offers.err.confirmArchive` | Tick the confirmation to archive the default offer. | Hãy tick ô xác nhận để lưu trữ offer mặc định. | 请勾选确认以归档默认优惠。 | 請勾選確認以封存預設優惠。 |

Lưu ý: chuỗi có `{click_id}` trong `offers.f.templateHint` và `offers.err.template` sẽ bị `t()` coi là tham số chưa cung cấp và giữ nguyên `{click_id}` (hàm `t` chỉ thay khi `name in params`), nên hiển thị đúng; kiểm bằng test ở Step 6.

- [ ] **Step 6: Chạy test, kiểm toàn bộ và commit**

```bash
npm test -w apps/web -- test/domain/offer.test.ts test/admin/merchant-offers.test.ts test/admin/merchants.test.ts test/i18n/parity.test.ts test/architecture.test.ts test/design/layout.test.ts test/design/assets.test.ts
npm run typecheck -w apps/web
npm test
grep -rniE "elevenlabs|partnerstack" apps/web/src
git add apps/web/src/domain/offer.ts apps/web/src/routes/admin-merchants.tsx apps/web/src/views/admin/OfferSection.tsx apps/web/src/views/admin/MerchantDetailPage.tsx apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/domain/offer.test.ts apps/web/test/admin/merchant-offers.test.ts
git commit -m "feat(web): admin offers with final-URL preview and default offer (VNX-2102b-2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận (Task 3b):**
- Nhập thử dữ liệu kiểu ElevenLabs (host `try.…` + host chính, `label = try_it`, template không placeholder, `destination_url` ≠ template, đặt làm mặc định) → lưu được, audit `offer.create` và `merchant.update`; nhãn của `destination_url` hiện "Untracked link".
- Offer có host ngoài `allowed_hosts`, template có placeholder lạ hoặc host lạ, `destination_url` `http:` hoặc có userinfo, template thiếu khi có chương trình, `destination_url` trùng template, nhãn lạ, ngày sai dạng, `endsAt <= startsAt`, chương trình của merchant khác hoặc không tồn tại → 400 với lỗi cạnh trường (`offers-<id>-<field>-error`), không ghi dòng.
- Ngày: `YYYY-MM-DDTHH:MM` lưu thành `…:00.000Z` (UTC); ISO có `Z` và `YYYY-MM-DD` vẫn nhận; dạng có khoảng trắng / `+07:00` / `T24:00` bị từ chối; nhãn và gợi ý ghi UTC.
- `updateOffer` trả `null` (đổi trạng thái giữa chừng, `archived` cuối) → 409; offer của merchant khác → 404; `expectedStatus` lạ → 400; offer mặc định của merchant khác, `archived` hoặc không tồn tại → 404, không ghi, không audit.
- Lưu trữ offer đang là mặc định thiếu `confirmArchive` → 400, không ghi; có → lưu được, `default_offer_id` giữ nguyên, trang merchant hiện `data-warning="default-archived"` (và không hiện trước khi lưu trữ).
- Xem trước hiện cạnh nhau URL tracking (giá trị mẫu `01HZZZZZZZZZZZZZZZZZZZZZZZ`, `en`, `tools`) và URL fallback (`website_url` + UTM) khi cờ `affiliate` bật và khi tắt (`data-preview-now="tracked"` / `"fallback"` kèm `flag_off`); template hỏng hiện mã lỗi, không hiện link.
- Route offer chỉ admin (403), sai Origin → 403 và không ghi; `MONEY_ALLOWED` vẫn đúng 5 file; `grep -rniE "elevenlabs|partnerstack" apps/web/src` không in dòng nào.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ước tính ≈ 590 dòng không tính locale (domain 35, view 175, route 85, test ~295). Commit `feat(web): admin offers with final-URL preview and default offer (VNX-2102b-2)`.

**Việc để lại cho Reviewer sau cả hai phần** (ghi vào `.ai/context/CURRENT-STATUS.md`): `kind` không bị ràng buộc với `programId` (spec im lặng); chưa có chốt chặn db cho đua giữa kiểm offer và lưu merchant (một admin); nhãn enum hiển thị mã thô; nút lưu trữ merchant dùng ô tick `confirm`, không có hộp thoại.

---

### Task 4: VNX-2103-1 — Bảng `outbound_clicks`, helper outbound, giữ 13 tháng, Privacy

**Tách đôi:** diff gộp ≈ 900 dòng (> 600), nên Task 4 tách thành **4 (dữ liệu, cron, Privacy)** và **4b (route `/go/`, HIGH-RISK)**. Thứ tự này đúng phụ thuộc (route cần `db/clicks.ts` và `domain/outbound.ts`) và đưa câu Privacy lên trước đoạn mã bắt đầu thu thập. Mã hóa task theo roadmap vẫn là VNX-2103; commit của hai phần cùng có hậu tố `(VNX-2103-1)` / `(VNX-2103-2)`.

**Điều kiện đầu vào:** Controller đã commit khối C của header vào `docs/legal/privacy.md` (dòng đầu "Bổ sung EPIC 21 (outbound, partner): APPROVED bởi Owner …"). Kiểm: `grep -c "Outbound click" docs/legal/privacy.md` ≥ 2. Nếu chưa có, dừng và báo Controller; không tự viết văn bản pháp lý.

**Files:**
- Create: `apps/web/migrations/0012_outbound_clicks.sql`
- Create: `apps/web/src/domain/outbound.ts`, `apps/web/src/db/clicks.ts`
- Modify: `apps/web/src/jobs/daily.ts` (bước `outbound_clicks`, cuối danh sách `STEPS`)
- Modify: `apps/web/src/legal/content.ts` (8 dòng của khối C, `LEGAL_UPDATED_AT`)
- Modify: `apps/web/wrangler.jsonc` (ghi chú thứ tự deploy)
- Modify: `apps/web/test/architecture.test.ts` (`WRITERS.outbound_clicks`; danh sách cho phép thêm `db/clicks.ts`, `jobs/daily.ts`)
- Test: `apps/web/test/domain/outbound.test.ts`, `apps/web/test/db/clicks.test.ts` (mới); `apps/web/test/jobs/daily.test.ts`, `apps/web/test/legal/content.test.ts` (mở rộng)

**Interfaces:**
- Consumes: `NotFoundReason` (`domain/offer.ts`), `localeFromPath`, `DEFAULT_LOCALE`, `Locale` (`i18n/locales.ts`), `runDaily` / `STEPS` (`jobs/daily.ts`), `ulid`, fixtures `testEnv`.
- Produces:
  - `domain/outbound.ts`: `OUTBOUND_SRCS` (6 giá trị), `type OutboundSrc = (typeof OUTBOUND_SRCS)[number] | "unknown"`, `parseSrc(raw: unknown): OutboundSrc`, `OFFER_ID_RE`, `OUTBOUND_CLICK_RETENTION_DAYS = 395`, `OUTBOUND_CLICK_PURGE_BATCH = 5000`, `CORRUPTION_REASONS: readonly NotFoundReason[]` (đúng 7 lý do dữ liệu hỏng), `type CfLike`, `isBotRequest(userAgent, cf)`, `referrerHost(referer)`, `localeFromReferer(referer, host)`, `countryOf(cf)`, `purgeCutoff(now: Date): string`.
  - `db/clicks.ts`: `type ClickInput`, `recordClick(db, click): Promise<void>`, `purgeOldClicks(db, now: Date): Promise<number>`.
  - `jobs/daily.ts`: bước `{ step: "outbound_clicks", counts: "deleted" }`.

**Quyết định kỹ thuật (Reviewer kiểm):**
- Bảng **không có khóa ngoại** (`product_id`, `offer_id`): đây là nhật ký chỉ thêm, cron xóa dần; không để nó chặn xóa product / offer, và M7 dùng lại bảng này không cần migration thứ hai. Phụ lục 2.2 cũng nói `offer_id` chưa có FK.
- CHECK enum cho `link_kind`, `src`, `locale`, `is_bot` ở CSDL (cùng giá trị với code), ngoài CHECK `product_id IS NOT NULL OR offer_id IS NOT NULL` của phụ lục.
- **Chỉ mục thứ tư `idx_clicks_created (created_at)` không có trong phụ lục:** để cron tìm dòng cũ mà không quét cả bảng. Ba chỉ mục của phụ lục giữ nguyên.
- Cron **có chặn**: mỗi lần xóa tối đa `OUTBOUND_CLICK_PURGE_BATCH = 5000` dòng (`DELETE … WHERE id IN (SELECT id … ORDER BY created_at LIMIT ?)`), phần còn lại để ngày mai và có `console.warn`. So sánh chuỗi ISO với `<` (dòng đúng bằng ngưỡng được giữ).
- Không có khóa i18n mới trong cả Task 4 và 4b (404 dùng `error.notFound.*` sẵn có).
- `LEGAL_UPDATED_AT` đặt bằng ngày commit (không sớm hơn `2026-10-05`). Hằng này **dùng chung với Terms**: ngày "Last updated" của cả Terms và Privacy đổi theo; test ở Step 9 kiểm cả hai.

- [ ] **Step 1: Migration**

`apps/web/migrations/0012_outbound_clicks.sql`:

```sql
-- EPIC 21 outbound clicks (addendum §2.2; created here because VNX-0707 is not done, and M7 reuses this table without a second migration). Additive only.
-- Never a column for an IP address, an e-mail address or a user id (Privacy). `visitor_hash` stays NULL until M7.
-- No foreign keys on purpose: an append-only log that the daily job trims; it must never block deleting a product or an offer.
CREATE TABLE outbound_clicks (
  id            TEXT PRIMARY KEY,
  product_id    TEXT,
  offer_id      TEXT,
  link_kind     TEXT NOT NULL CHECK (link_kind IN ('demo', 'site', 'offer')),
  src           TEXT NOT NULL CHECK (src IN ('product_page', 'builder_page', 'catalog', 'home', 'article', 'tools', 'unknown')),
  locale        TEXT NOT NULL CHECK (locale IN ('en', 'vi', 'zh-Hans', 'zh-Hant')),
  visitor_hash  TEXT,
  country       TEXT,
  referrer_host TEXT,
  is_bot        INTEGER NOT NULL CHECK (is_bot IN (0, 1)),
  created_at    TEXT NOT NULL,
  CHECK (product_id IS NOT NULL OR offer_id IS NOT NULL)
);
CREATE INDEX idx_clicks_product ON outbound_clicks (product_id, created_at);
CREATE INDEX idx_clicks_offer ON outbound_clicks (offer_id, created_at);
CREATE INDEX idx_clicks_visitor ON outbound_clicks (visitor_hash, product_id, link_kind, created_at);
-- Not in the addendum: lets the retention job find old rows without scanning the table.
CREATE INDEX idx_clicks_created ON outbound_clicks (created_at);
```

- [ ] **Step 2: Test domain (fail)**

`apps/web/test/domain/outbound.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { NotFoundReason } from "../../src/domain/offer.ts";
import {
  CORRUPTION_REASONS,
  OFFER_ID_RE,
  OUTBOUND_CLICK_PURGE_BATCH,
  OUTBOUND_CLICK_RETENTION_DAYS,
  OUTBOUND_SRCS,
  countryOf,
  isBotRequest,
  localeFromReferer,
  parseSrc,
  purgeCutoff,
  referrerHost,
} from "../../src/domain/outbound.ts";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("parseSrc", () => {
  it("accepts exactly the six places and maps everything else to unknown", () => {
    expect([...OUTBOUND_SRCS]).toEqual(["product_page", "builder_page", "catalog", "home", "article", "tools"]);
    for (const s of OUTBOUND_SRCS) expect(parseSrc(s)).toBe(s);
    for (const bad of ["", "TOOLS", "unknown", "https://evil.example.net", "//evil.example.net", "tools\r\nX: 1", " tools", null, undefined, ["tools"], 5]) {
      expect(parseSrc(bad)).toBe("unknown");
    }
  });
});

describe("isBotRequest (Reviewer decision 12)", () => {
  it.each([[""], [null], [undefined], ["   "], ["Googlebot/2.1 (+http://www.google.com/bot.html)"], ["curl/8.5.0"], ["Wget/1.21"], ["python-requests/2.31"], ["Mozilla/5.0 HeadlessChrome/120.0"], ["facebookexternalhit/1.1"], ["Mozilla/5.0 (compatible; Yahoo! Slurp)"], ["UptimeMonitor/1.0"]])(
    "UA %j is a bot",
    (ua) => {
      expect(isBotRequest(ua, undefined)).toBe(true);
    },
  );

  it("a browser is not, unless Cloudflare marks it a verified bot", () => {
    expect(isBotRequest(CHROME, undefined)).toBe(false);
    expect(isBotRequest(CHROME, { botManagement: { verifiedBot: false } })).toBe(false);
    expect(isBotRequest(CHROME, { botManagement: { verifiedBot: true } })).toBe(true);
  });
});

describe("referrerHost keeps the host only", () => {
  it.each([
    ["https://news.example.org/a/b?q=1#frag", "news.example.org"],
    ["http://Example.COM:8080/x", "example.com"],
    ["https://user:pw@example.org/", "example.org"],
    ["javascript:alert(1)", null],
    ["not a url", null],
    ["", null],
    [null, null],
  ])("%j gives %j", (raw, host) => {
    expect(referrerHost(raw)).toBe(host);
  });
});

describe("localeFromReferer reads the locale from a same-host Referer only", () => {
  it.each([
    ["https://vnx.si/vi/tools/x", "vi"],
    ["https://vnx.si/zh-hans", "zh-Hans"],
    ["https://vnx.si/zh-hant/p/a", "zh-Hant"],
    ["https://vnx.si/tools/x", "en"],
    ["https://vnx.si.evil.example.net/vi/x", "en"],
    ["https://other.example.org/vi/x", "en"],
    ["https://vnx.si:8443/vi/x", "en"],
    ["nonsense", "en"],
    [null, "en"],
  ])("%j gives %j", (referer, locale) => {
    expect(localeFromReferer(referer, "vnx.si")).toBe(locale);
  });
});

describe("countryOf and purgeCutoff", () => {
  it("takes a two-letter upper-case country and nothing else", () => {
    expect(countryOf({ country: "VN" })).toBe("VN");
    for (const bad of [undefined, null, {}, { country: "vn" }, { country: "VNM" }, { country: 5 }, { country: "V\nN" }]) expect(countryOf(bad)).toBeNull();
  });

  it("keeps clicks for 395 days (13 months, Owner 2026-10-05)", () => {
    expect(OUTBOUND_CLICK_RETENTION_DAYS).toBe(395);
    expect(OUTBOUND_CLICK_PURGE_BATCH).toBe(5000);
    expect(purgeCutoff(new Date("2026-10-05T01:00:00.000Z"))).toBe("2025-09-05T01:00:00.000Z");
  });
});

describe("OFFER_ID_RE and CORRUPTION_REASONS", () => {
  it("accepts a 26-character Crockford ULID only", () => {
    expect(OFFER_ID_RE.test("01HZ8K3M5N7P9Q2R4S6T8V0WXY")).toBe(true);
    for (const bad of ["", "01hz8k3m5n7p9q2r4s6t8v0wxy", "01HZ8K3M5N7P9Q2R4S6T8V0WX", "01HZ8K3M5N7P9Q2R4S6T8V0WXYZ", "01HZ8K3M5N7P9Q2R4S6T8V0WXU", "01HZ8K3M5N7P9Q2R4S6T8V0WXI", "../../etc", "01HZ8K3M5N7P9Q2R4S6T8V0WX\n"]) {
      expect(OFFER_ID_RE.test(bad), bad).toBe(false);
    }
  });

  it("logs exactly the corruption reasons of the plan; a new NotFoundReason forces a decision here", () => {
    // The Record type fails to compile when resolveOfferRedirect gains a reason that is not classified below.
    const kind: Record<NotFoundReason, "quiet" | "corrupt"> = {
      offer_missing: "quiet",
      offer_archived: "quiet",
      merchant_missing: "quiet",
      merchant_archived: "quiet",
      subject_merchant: "corrupt",
      program_missing: "corrupt",
      program_merchant: "corrupt",
      template_missing: "corrupt",
      window_invalid: "corrupt",
      invalid_url: "corrupt",
      website_invalid: "corrupt",
    };
    const corrupt = Object.entries(kind).filter(([, k]) => k === "corrupt").map(([r]) => r).sort();
    expect([...CORRUPTION_REASONS].sort()).toEqual(corrupt);
    expect(corrupt).toEqual(["invalid_url", "program_merchant", "program_missing", "subject_merchant", "template_missing", "website_invalid", "window_invalid"]);
  });
});
```

Run: `npm test -w apps/web -- test/domain/outbound.test.ts` → FAIL (module `src/domain/outbound.ts` không tồn tại).

- [ ] **Step 3: `domain/outbound.ts`**

`apps/web/src/domain/outbound.ts`:

```ts
import { DEFAULT_LOCALE, localeFromPath, type Locale } from "../i18n/locales.ts";
import type { NotFoundReason } from "./offer.ts";

/** Pure helpers for /go/ and the outbound click log (addendum §2.1–2.2). No I/O. */

/** The only `src` values /go/ reads (addendum §2.1); anything else is stored as `unknown`. */
export const OUTBOUND_SRCS = ["product_page", "builder_page", "catalog", "home", "article", "tools"] as const;
export type OutboundSrc = (typeof OUTBOUND_SRCS)[number] | "unknown";

export function parseSrc(raw: unknown): OutboundSrc {
  return typeof raw === "string" && (OUTBOUND_SRCS as readonly string[]).includes(raw) ? (raw as OutboundSrc) : "unknown";
}

/** An offer id is a ULID; anything else never reaches D1. */
export const OFFER_ID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Owner 2026-10-05: keep clicks 13 months. 395 days, a fixed number so tests can pin it. */
export const OUTBOUND_CLICK_RETENTION_DAYS = 395;
/** The daily job deletes at most this many rows per run; the rest waits for the next run. */
export const OUTBOUND_CLICK_PURGE_BATCH = 5000;

/** Rows older than this ISO instant are deleted (a row exactly at the cutoff is kept). */
export function purgeCutoff(now: Date): string {
  return new Date(now.getTime() - OUTBOUND_CLICK_RETENTION_DAYS * 86_400_000).toISOString();
}

/** `resolveOfferRedirect` not_found reasons that mean the data is broken (not a dead link): /go/ logs them with console.error. */
export const CORRUPTION_REASONS: readonly NotFoundReason[] = ["program_missing", "program_merchant", "template_missing", "window_invalid", "invalid_url", "website_invalid", "subject_merchant"];

/** The two fields of `request.cf` that /go/ reads. */
export type CfLike = { country?: unknown; botManagement?: { verifiedBot?: unknown } } | null | undefined;

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i;

/** Marks a click as `is_bot`; never blocks the redirect. M7 may replace this with the shared rule of spec 8.11. */
export function isBotRequest(userAgent: string | null | undefined, cf: CfLike): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_UA.test(userAgent) || cf?.botManagement?.verifiedBot === true;
}

/** Host only (lower case, no port, path, query or credentials); null for anything that is not an http(s) URL. */
export function referrerHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.slice(0, 253) : null;
  } catch {
    return null;
  }
}

/** The locale of the page that held the link, from a Referer on this same host (`host` includes the port); `en` otherwise. */
export function localeFromReferer(referer: string | null | undefined, host: string): Locale {
  if (!referer) return DEFAULT_LOCALE;
  try {
    const u = new URL(referer);
    return u.host === host ? localeFromPath(u.pathname).locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function countryOf(cf: CfLike): string | null {
  const country = cf?.country;
  return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null;
}
```

Run: `npm test -w apps/web -- test/domain/outbound.test.ts` → PASS.

- [ ] **Step 4: Test db (fail)**

`apps/web/test/db/clicks.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeOldClicks, recordClick, type ClickInput } from "../../src/db/clicks.ts";
import { OUTBOUND_CLICK_PURGE_BATCH, purgeCutoff } from "../../src/domain/outbound.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-05T01:00:00.000Z");
const shifted = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
const click = (o: Partial<ClickInput> = {}): ClickInput => ({
  id: ulid(),
  productId: null,
  offerId: "clicks-a",
  linkKind: "offer",
  src: "tools",
  locale: "en",
  visitorHash: null,
  country: null,
  referrerHost: null,
  isBot: false,
  createdAt: NOW.toISOString(),
  ...o,
});
const rowsOf = async (offerId: string) => (await testEnv.DB.prepare("SELECT * FROM outbound_clicks WHERE offer_id = ?1 ORDER BY created_at").bind(offerId).all<Record<string, unknown>>()).results;
const names = async (sql: string) => (await testEnv.DB.prepare(sql).all<{ name: string }>()).results.map((r) => r.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("outbound_clicks schema (addendum §2.2, Review Focus 7)", () => {
  it("has exactly the columns of the addendum and none that could hold an IP address, an e-mail address or a user id", async () => {
    const columns = await names("SELECT name FROM pragma_table_info('outbound_clicks')");
    expect(columns).toEqual(["id", "product_id", "offer_id", "link_kind", "src", "locale", "visitor_hash", "country", "referrer_host", "is_bot", "created_at"]);
    for (const c of columns) expect(c).not.toMatch(/ip|mail|user|uid/i);
  });

  it("has the three indexes of the addendum plus the retention index", async () => {
    const indexes = (await names("SELECT name FROM pragma_index_list('outbound_clicks')")).filter((n) => n.startsWith("idx_"));
    expect(indexes.sort()).toEqual(["idx_clicks_created", "idx_clicks_offer", "idx_clicks_product", "idx_clicks_visitor"]);
  });

  it("refuses a row with neither product nor offer, an unknown kind, src or locale", async () => {
    await expect(recordClick(testEnv.DB, click({ offerId: null }))).rejects.toThrow();
    await expect(recordClick(testEnv.DB, click({ linkKind: "other" as never }))).rejects.toThrow();
    await expect(recordClick(testEnv.DB, click({ src: "elsewhere" as never }))).rejects.toThrow();
    await expect(recordClick(testEnv.DB, click({ locale: "fr" as never }))).rejects.toThrow();
  });
});

describe("recordClick", () => {
  it("stores every field; a bot is 1; a product-only row (the M7 shape) is accepted", async () => {
    const id = ulid();
    await recordClick(testEnv.DB, click({ id, offerId: "clicks-b", src: "catalog", locale: "zh-Hant", country: "VN", referrerHost: "news.example.org", isBot: true, createdAt: "2026-10-05T00:00:00.000Z" }));
    expect(await rowsOf("clicks-b")).toEqual([
      { id, product_id: null, offer_id: "clicks-b", link_kind: "offer", src: "catalog", locale: "zh-Hant", visitor_hash: null, country: "VN", referrer_host: "news.example.org", is_bot: 1, created_at: "2026-10-05T00:00:00.000Z" },
    ]);
    await recordClick(testEnv.DB, click({ productId: "p-1", offerId: null, linkKind: "demo" }));
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM outbound_clicks WHERE product_id = 'p-1'").first<{ n: number }>())?.n).toBe(1);
  });
});

describe("purgeOldClicks (Owner 2026-10-05: 13 months)", () => {
  it("deletes rows older than the cutoff, keeps the one exactly at it and newer ones, and is idempotent", async () => {
    const cutoff = purgeCutoff(NOW);
    for (const createdAt of [shifted(cutoff, -1), cutoff, shifted(cutoff, 1), NOW.toISOString()]) await recordClick(testEnv.DB, click({ offerId: "purge-a", createdAt }));
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(1);
    expect((await rowsOf("purge-a")).map((r) => r.created_at)).toEqual([cutoff, shifted(cutoff, 1), NOW.toISOString()]);
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(0);
    expect(await rowsOf("purge-a")).toHaveLength(3);
  });

  it("deletes at most one batch per run, warns when it hit the cap, and finishes over the next runs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await testEnv.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1)
       INSERT INTO outbound_clicks (id, product_id, offer_id, link_kind, src, locale, is_bot, created_at)
       SELECT 'bulk-' || i, NULL, 'purge-bulk', 'offer', 'tools', 'en', 0, '2020-01-01T00:00:00.000Z' FROM n`,
    )
      .bind(OUTBOUND_CLICK_PURGE_BATCH + 3)
      .run();
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(OUTBOUND_CLICK_PURGE_BATCH);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({ event: "clicks.purge_capped", cap: OUTBOUND_CLICK_PURGE_BATCH });
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(3);
    expect(await purgeOldClicks(testEnv.DB, NOW)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npm test -w apps/web -- test/db/clicks.test.ts` → FAIL (module `src/db/clicks.ts` không tồn tại).

- [ ] **Step 5: `db/clicks.ts`**

`apps/web/src/db/clicks.ts`:

```ts
import { OUTBOUND_CLICK_PURGE_BATCH, purgeCutoff, type OutboundSrc } from "../domain/outbound.ts";
import type { Locale } from "../i18n/locales.ts";

/**
 * The only writer of `outbound_clicks` (module `monetization`, addendum §2.2). A click row never holds an IP address, an e-mail
 * address or a user id; this type has no field for them, and the table has no column for them.
 */
export type ClickInput = {
  /** ULID. For a tracked redirect it is also the `click_id` that went to the partner. */
  id: string;
  productId: string | null;
  offerId: string | null;
  linkKind: "demo" | "site" | "offer";
  src: OutboundSrc;
  locale: Locale;
  /** Always null until M7 (VNX-0707). */
  visitorHash: string | null;
  country: string | null;
  referrerHost: string | null;
  isBot: boolean;
  createdAt: string;
};

export async function recordClick(db: D1Database, c: ClickInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO outbound_clicks (id, product_id, offer_id, link_kind, src, locale, visitor_hash, country, referrer_host, is_bot, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(c.id, c.productId, c.offerId, c.linkKind, c.src, c.locale, c.visitorHash, c.country, c.referrerHost, c.isBot ? 1 : 0, c.createdAt)
    .run();
}

/**
 * Daily retention (Owner 2026-10-05: 13 months). Deletes at most OUTBOUND_CLICK_PURGE_BATCH rows older than the cutoff, oldest first;
 * the rest waits for the next run. Running it again changes nothing once the table is clean. Returns the number of rows deleted.
 */
export async function purgeOldClicks(db: D1Database, now: Date): Promise<number> {
  const result = await db
    .prepare("DELETE FROM outbound_clicks WHERE id IN (SELECT id FROM outbound_clicks WHERE created_at < ?1 ORDER BY created_at LIMIT ?2)")
    .bind(purgeCutoff(now), OUTBOUND_CLICK_PURGE_BATCH)
    .run();
  const deleted = result.meta.changes;
  if (deleted >= OUTBOUND_CLICK_PURGE_BATCH) console.warn(JSON.stringify({ event: "clicks.purge_capped", cap: OUTBOUND_CLICK_PURGE_BATCH }));
  return deleted;
}
```

Run: `npm test -w apps/web -- test/db/clicks.test.ts` → PASS.

- [ ] **Step 6: Test cron (fail)**

Sửa `apps/web/test/jobs/daily.test.ts`:
1. Import thêm: `import { recordClick } from "../../src/db/clicks.ts";`, `import { purgeCutoff } from "../../src/domain/outbound.ts";`, `import { ulid } from "../../src/lib/ulid.ts";`.
2. Thêm hằng dưới `IDLE_ACTIVITY_STEPS`: `const CLICK_STEP = { job: "daily", step: "outbound_clicks", deleted: 0 };` (bước mới chạy **cuối cùng**, sau `sessions`).
3. Ba mảng `toEqual` có `{ job: "daily", step: "sessions", … }` (test đầu, "is idempotent", "logs one JSON line per step") thêm `CLICK_STEP` ngay sau phần tử `sessions`; `toHaveLength(IDLE_ACTIVITY_STEPS.length + 3)` đổi thành `+ 4`.
4. Test "keeps going when one step fails": thêm `expect(results[at + 3]).toEqual(CLICK_STEP);` sau dòng kiểm `results[at + 2]`.
5. Test `scheduled`: danh sách tên bước cuối `"sessions"` thêm `, "outbound_clicks"`.
6. Thêm cuối file:

```ts
describe("outbound clicks step (VNX-2103, Owner 2026-10-05: keep 13 months)", () => {
  const clickAt = (offerId: string, createdAt: string) =>
    recordClick(testEnv.DB, { id: ulid(), productId: null, offerId, linkKind: "offer", src: "tools", locale: "en", visitorHash: null, country: null, referrerHost: null, isBot: false, createdAt });
  const clicksFor = (offerId: string) => count("SELECT COUNT(*) AS n FROM outbound_clicks WHERE offer_id = ?1", offerId);
  const clickStep = (results: Awaited<ReturnType<typeof runDaily>>) => results.find((r) => r.step === "outbound_clicks");

  it("deletes clicks older than 395 days, keeps the rest, and a second run deletes nothing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const cutoff = purgeCutoff(NOW);
    await clickAt("daily-old", new Date(Date.parse(cutoff) - 1).toISOString());
    await clickAt("daily-edge", cutoff);
    await clickAt("daily-new", NOW.toISOString());
    expect(clickStep(await runDaily(testEnv, NOW))).toEqual({ job: "daily", step: "outbound_clicks", deleted: 1 });
    expect([await clicksFor("daily-old"), await clicksFor("daily-edge"), await clicksFor("daily-new")]).toEqual([0, 1, 1]);
    expect(clickStep(await runDaily(testEnv, NOW))).toEqual(CLICK_STEP);
  });

  it("a failing clicks step is logged and the other steps are unaffected", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const results = await runDaily({ ...testEnv, DB: brokenOn("outbound_clicks") } as Bindings, NOW);
    expect(clickStep(results)).toEqual({ job: "daily", step: "outbound_clicks", error: "Error: boom on outbound_clicks" });
    expect(results.filter((r) => "error" in r)).toHaveLength(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npm test -w apps/web -- test/jobs/daily.test.ts` → FAIL (chưa có bước `outbound_clicks`).

- [ ] **Step 7: Bước cron**

`apps/web/src/jobs/daily.ts`: thêm `import { purgeOldClicks } from "../db/clicks.ts";` cạnh các import `db/` khác; sửa comment đầu file thêm một dòng "VNX-2103 (EPIC 21): deletes outbound clicks older than 13 months (OUTBOUND_CLICK_RETENTION_DAYS)."; thêm vào **cuối** `STEPS`:

```ts
  { step: "sessions", counts: "deleted", run: (env, now) => deleteExpiredSessions(env.DB, now) },
  // Owner 2026-10-05: outbound clicks are kept 13 months (Privacy says so). Bounded per run, see purgeOldClicks.
  { step: "outbound_clicks", counts: "deleted", run: (env, now) => purgeOldClicks(env.DB, now) },
];
```

Run: `npm test -w apps/web -- test/jobs/daily.test.ts test/jobs/daily-inquiries.test.ts test/jobs/daily-requests.test.ts` → PASS.

- [ ] **Step 8: Test kiến trúc (đỏ rồi xanh)**

Run: `npm test -w apps/web -- test/architecture.test.ts` → FAIL: `jobs/daily.ts imports db/clicks` (danh sách cho phép chưa có) và `writes unknown table outbound_clicks` (`db/clicks.ts`). Sửa `apps/web/test/architecture.test.ts`:
- `WRITERS` thêm `outbound_clicks: "../src/db/clicks.ts",` sau `offers`.
- Comment trên `MONEY_ALLOWED` giữ nguyên (đã ghi Task 4: `db/clicks.ts`, `routes/go.ts`, `jobs/daily.ts`).
- `MONEY_ALLOWED` thêm `"../src/db/clicks.ts"` và `"../src/jobs/daily.ts"` (`routes/go.ts` thêm ở Task 4b).
- Đổi test "after Task 2d the allowlist is exactly the four db files" thành danh sách đúng **sau Task 4**: lấy danh sách hiện có trong test (gồm cả mục Task 3 đã thêm, ví dụ `../src/routes/admin-merchants.tsx`) rồi chèn hai đường dẫn mới đúng vị trí sắp xếp:

```ts
  it("after Task 4 the allowlist is exactly the files of Tasks 2c–4", () => {
    expect([...MONEY_ALLOWED].sort()).toEqual([
      "../src/db/audit.ts",
      "../src/db/clicks.ts",
      "../src/db/merchants.ts",
      "../src/db/offers.ts",
      "../src/db/programs.ts",
      "../src/jobs/daily.ts",
      "../src/routes/admin-merchants.tsx", // thêm/bớt theo đúng danh sách Task 3 đã chốt
    ]);
  });
```

Run lại: `npm test -w apps/web -- test/architecture.test.ts` → PASS (kể cả "has no partner name in src").

- [ ] **Step 9: Privacy (đỏ rồi xanh)**

Thêm vào `apps/web/test/legal/content.test.ts`, sau khối `describe("privacy covers the contact form …")`:

```ts
/** Plan VNX-2103 block C (Owner approved 2026-10-05): where each line starts; the whole line is compared with the source file. */
const OUTBOUND_PRIVACY = {
  EN: ["- **Outbound clicks:**", "- To count how often links to other companies are followed", "- When you follow a link to a partner you leave VNX.SI.", "- Outbound click records: deleted after 13 months."],
  VI: ["- **Lượt bấm link ra ngoài:**", "- Đếm số lần các link tới công ty khác được bấm", "- Khi bạn bấm link tới một partner, bạn rời VNX.SI.", "- Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng."],
} as const;
const lineStarting = (part: string, start: string) => part.split("\n").find((l) => l.startsWith(start)) ?? "";

describe("privacy covers outbound clicks (VNX-2103)", () => {
  for (const [lang, prefix] of [
    ["EN", ""],
    ["VI", "/vi"],
  ] as const) {
    it(`${lang}: docs/legal/privacy.md has the four approved lines and /privacy shows each one whole`, async () => {
      const part = partOf(sourceOf("privacy"), lang);
      const text = textOf(mainOf(await (await get(`${prefix}/privacy`)).text()));
      for (const start of OUTBOUND_PRIVACY[lang]) {
        const line = lineStarting(part, start);
        expect(line, start).not.toBe("");
        expect(text, start).toContain(plain(line.replace(/^- /, "")));
      }
      // The collection line follows the waitlist line, as block C says.
      const waitlist = part.indexOf(lang === "EN" ? "- **Waitlist:**" : "- **Danh sách chờ:**");
      expect(part.slice(waitlist).split("\n")[1]?.startsWith(OUTBOUND_PRIVACY[lang][0])).toBe(true);
    });
  }

  it("LEGAL_UPDATED_AT moved forward, and Terms and Privacy both show it (the constant is shared)", async () => {
    expect(LEGAL_UPDATED_AT >= "2026-10-05").toBe(true);
    for (const path of ["/terms", "/privacy"]) expect(textOf(mainOf(await (await get(path)).text()))).toContain(LEGAL_UPDATED_AT);
  });
});
```

Run: `npm test -w apps/web -- test/legal/content.test.ts` → FAIL (cả test so từng dòng của `privacy` EN / VI lẫn test mới: `src/legal/content.ts` chưa có 4 dòng).

Sửa `apps/web/src/legal/content.ts`: **chép nguyên văn từng dòng từ `docs/legal/privacy.md` (khối C), bỏ "- " đầu dòng, giữ `**…**` và dấu backtick quanh `/go/`; không tự diễn đạt lại**. Chèn mỗi chuỗi vào mảng `ul` đúng vị trí nó có trong `privacy.md` (mở file đối chiếu), ngay sau dòng đứng trước:
- `privacyEn` mục 2: sau chuỗi bắt đầu `"**Waitlist:** …` → chuỗi `"**Outbound clicks:** when you follow a button or link …`.
- `privacyEn` mục 3: sau chuỗi bắt đầu `"To match requests with builders: …` → chuỗi `"To count how often links to other companies are followed …`.
- `privacyEn` mục 4: sau chuỗi bắt đầu `"Builders do not see clients' email addresses. …` → chuỗi `"When you follow a link to a partner you leave VNX.SI. …`.
- `privacyEn` mục 6: sau chuỗi bắt đầu `"Rate-limit counters (including IP addresses): …` → `"Outbound click records: deleted after 13 months.",`.
- `privacyVi`: bốn vị trí tương ứng, sau các chuỗi bắt đầu `"**Danh sách chờ:** …`, `"Ghép nhu cầu với builder: …`, `"Builder không thấy email của client. …`, `"Bộ đếm giới hạn (gồm địa chỉ IP): …`.
- `LEGAL_UPDATED_AT` đổi thành ngày commit (ví dụ `"2026-10-05"`), sửa comment thành "Shown as "Last updated" on Terms and Privacy; shared, so a change to either moves both."

Run: `npm test -w apps/web -- test/legal/content.test.ts` → PASS.

- [ ] **Step 10: Ghi chú deploy**

`apps/web/wrangler.jsonc`: dòng `1. npm run db:migrate:remote …` đổi `0011_partners)` thành `0011_partners, 0012_outbound_clicks)`; dòng ghi chú EPIC 21 đổi thành:

```jsonc
  // 0010_feature_flags, 0011_partners and 0012_outbound_clicks (EPIC 21) ship with their code the same way: migrate first, then deploy.
  // The daily cron also deletes outbound clicks older than 13 months, so it reads 0012 too.
```

- [ ] **Step 11: Kiểm tra cuối và commit**

Chạy: `npm run typecheck -w apps/web`, `npm test`, `grep -rniE "elevenlabs|partnerstack" apps/web/src` (không in dòng nào). Rồi:

```bash
git add apps/web/migrations/0012_outbound_clicks.sql apps/web/src/domain/outbound.ts apps/web/src/db/clicks.ts apps/web/src/jobs/daily.ts apps/web/src/legal/content.ts apps/web/wrangler.jsonc apps/web/test/architecture.test.ts apps/web/test/domain/outbound.test.ts apps/web/test/db/clicks.test.ts apps/web/test/jobs/daily.test.ts apps/web/test/legal/content.test.ts
git commit -m "feat(web): outbound_clicks table, 13-month retention and Privacy text (VNX-2103-1)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận (Task 4):**
- `npm test -w apps/web -- test/domain/outbound.test.ts test/db/clicks.test.ts test/jobs/daily.test.ts test/legal/content.test.ts test/architecture.test.ts` xanh.
- Bảng đúng 11 cột của phụ lục, không cột nào khớp `ip|mail|user|uid`; ba chỉ mục của phụ lục cộng `idx_clicks_created`; CHECK từ chối dòng không có product lẫn offer (Review Focus 7).
- Cron: dòng cũ hơn 395 ngày bị xóa, dòng đúng ngưỡng và dòng mới giữ, chạy lại không xóa thêm, tối đa 5000 dòng mỗi lần (có `console.warn`), bước lỗi không dừng bước khác; `outbound_clicks` là bước cuối, 4 test của `daily.test.ts` đã cập nhật.
- Privacy: `/privacy` EN và VI khớp từng dòng với `docs/legal/privacy.md` đã có khối C; `LEGAL_UPDATED_AT` ≥ `2026-10-05` và cả `/terms` lẫn `/privacy` hiện ngày đó.
- `MONEY_ALLOWED` thêm đúng `db/clicks.ts` và `jobs/daily.ts` (xếp theo thứ tự), `WRITERS.outbound_clicks = db/clicks.ts`; không file `src` nào có `elevenlabs` / `partnerstack`.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ước tính ≈ 440 dòng không tính locale (migration 22, domain 70, db 45, cron 4, test ≈ 300). Commit `feat(web): outbound_clicks table, 13-month retention and Privacy text (VNX-2103-1)`.

---

### Task 4b: VNX-2103-2 — `/go/:merchantSlug`, `/go/o/:offerId` (HIGH-RISK)

**Lưu ý:** Task này là mã redirect: Reviewer chạy lại toàn bộ `test/monetization/go.test.ts` và đọc từng dòng `routes/go.ts`. Task 4 phải đã xong (có `db/clicks.ts`, `domain/outbound.ts`, bảng `outbound_clicks`, Privacy).

**Files:**
- Create: `apps/web/src/routes/go.ts`
- Modify: `apps/web/src/app.ts` (đăng ký `registerGoRoutes`)
- Modify: `apps/web/test/architecture.test.ts` (danh sách cho phép thêm `routes/go.ts`)
- Test: `apps/web/test/monetization/go.test.ts` (mới, tên theo ADR-007); `test/seo/robots.test.ts` đã có `Disallow: /go/`, không sửa

**Interfaces:**
- Consumes: `findOfferWithContext`, `findDefaultOfferContext`, `RedirectRows` (`db/offers.ts`); `isFlagEnabled` (`db/flags.ts`); `recordClick`, `ClickInput` (`db/clicks.ts`); `resolveOfferRedirect` (`domain/offer.ts`); `RESERVED_MERCHANT_SLUGS` (`domain/merchant.ts`); `SLUG_RE` (`domain/slug.ts`); `CORRUPTION_REASONS`, `OFFER_ID_RE`, `parseSrc`, `isBotRequest`, `referrerHost`, `localeFromReferer`, `countryOf` (`domain/outbound.ts`); `ulid`; `errorResponse` (`views/error-response.tsx`).
- Produces: `routes/go.ts`: `registerGoRoutes(app: Hono<AppEnv>): void`.

**Quyết định kỹ thuật (Reviewer kiểm):**
- Thứ tự khai báo: `GET /go/o/:offerId`, `GET /go/:merchantSlug`, `GET /go/*` (404, nên `/go/p/…` của M7, `/go/https://…`, `/go/x/` đều 404 mà không rơi xuống `ASSETS`), rồi `app.all("/go/*")` → 405. Hono tự chạy handler GET cho `HEAD` (cùng header, không body) nên handler tự kiểm `c.req.method === "GET"` mới ghi click.
- Slug qua `SLUG_RE` và `RESERVED_MERCHANT_SLUGS`, offer id qua `OFFER_ID_RE` **trước** khi đọc D1 (id / slug sai dạng, `%2F`, `%0d%0a`, `\` đều dừng ở đây).
- Mọi 404 của `/go/` thêm `Cache-Control: no-store` và `X-Robots-Tag: noindex, nofollow` (không đổi trang lỗi: `errorResponse` ở locale mặc định vì đường dẫn không có tiền tố). `Referrer-Policy: origin` chỉ trên 302.
- `Location` được dựng bằng `new Response(null, { status: 302, headers })` (không qua `c.redirect`), giá trị = `result.url` đã được `resolveOfferRedirect` kiểm lại, không nối chuỗi nào khác.
- Ghi click qua `defer`: `c.executionCtx.waitUntil(work)`; khi không có `ExecutionContext` (Hono ném lỗi khi đọc `executionCtx`: test, local) thì `await work`. `work` tự bắt lỗi nên không bao giờ từ chối; lỗi chỉ `console.error` `go.click_failed`.
- Log hỏng dữ liệu: một dòng JSON `{ event: "go.corrupt_data", reason, offerId, merchantId, requestId }`, không URL, không IP, không UA, không Referer.
- Cờ đọc tuần tự (`affiliate` rồi `partner_referral`): lần đọc đầu nạp cache, lần hai trúng cache; lỗi đọc D1 là cờ tắt (đã xử lý trong `isFlagEnabled`), tức là `fallback`.
- `{locale}` của template và cột `locale` của click dùng chung một giá trị: locale của `Referer` cùng host, không thì `en`.
- Không tới được qua HTTP (CHECK / FK / phép nối của CSDL chặn), nên chỉ có test domain (Task 2b): `template_missing`, `program_missing`, `subject_merchant`, `program_direct`. Test ở đây bao phủ `invalid_url`, `window_invalid`, `program_merchant`, `website_invalid`.

- [ ] **Step 1: Test route (fail)**

`apps/web/test/monetization/go.test.ts` (ADR-007 "Được bảo đảm bởi"; Review Focus 1, 2, 3, 7):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { setDefaultOffer } from "../../src/db/merchants.ts";
import type { Bindings } from "../../src/env.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const UTM = "utm_source=vnx.si&utm_medium=referral";
const EVIL = "evil.example.net";
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type ClickRow = { id: string; product_id: string | null; offer_id: string | null; link_kind: string; src: string; locale: string; visitor_hash: string | null; country: string | null; referrer_host: string | null; is_bot: number; created_at: string };
type Seeded = Awaited<ReturnType<typeof seed>>;
type Call = { method?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; env?: Bindings; ctx?: ExecutionContext };

/** One request through the real app. `cf` is set on the Request itself, as Cloudflare does. */
async function call(path: string, o: Call = {}): Promise<Response> {
  const req = new Request(`https://vnx.si${path}`, { method: o.method ?? "GET", headers: o.headers });
  if (o.cf) Object.defineProperty(req, "cf", { value: o.cf });
  return await createApp().request(req, undefined, o.env ?? testEnv, o.ctx);
}

const run = (sql: string, ...binds: unknown[]) => testEnv.DB.prepare(sql).bind(...binds).run();
const clicksOf = async (offerId: string) => (await testEnv.DB.prepare("SELECT * FROM outbound_clicks WHERE offer_id = ?1 ORDER BY id").bind(offerId).all<ClickRow>()).results;
const totalClicks = async () => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM outbound_clicks").first<{ n: number }>())?.n ?? 0;

async function setFlags(on: { affiliate?: boolean; partner_referral?: boolean }) {
  const admin = await ensureUser("go-admin@vnx.si");
  for (const key of ["affiliate", "partner_referral"] as const) await setFlag(testEnv.DB, { key, enabled: on[key] ?? false, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}

/** A merchant on example.com with (by default) an active program, its offer, and that offer as the merchant's default. */
async function seed(o: { merchant?: Parameters<typeof makeMerchant>[0]; program?: Parameters<typeof makeProgram>[1] | null; offer?: Parameters<typeof makeOffer>[2] } = {}) {
  const merchant = await makeMerchant(o.merchant);
  const program = o.program === null ? null : await makeProgram(merchant, o.program);
  const offer = await makeOffer(merchant, program, o.offer);
  const admin = await ensureUser("go-admin@vnx.si");
  await setDefaultOffer(testEnv.DB, { merchantId: merchant.id, offerId: offer.id, actorUserId: admin.id, now: new Date().toISOString() });
  return { merchant, program, offer };
}

const tracked = (clickId: string) => `https://example.com/r?c=${clickId}`;
function expectRedirectHeaders(res: Response) {
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("referrer-policy")).toBe("origin");
}
const goLogs = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>).filter((l) => String(l.event).startsWith("go."));

beforeEach(async () => {
  await setFlags({ affiliate: true });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("/go/o/:offerId and /go/:merchantSlug: the redirect truth table over HTTP", () => {
  it("tracked: flag on, everything active → 302 to the filled template; the click row id is the click_id", async () => {
    const { offer, merchant } = await seed();
    const res = await call(`/go/o/${offer.id}?src=tools`);
    expect(res.status).toBe(302);
    expectRedirectHeaders(res);
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toMatch(ULID_RE);
    expect(res.headers.get("location")).toBe(tracked(rows[0]?.id ?? ""));
    // The same offer through the merchant's slug.
    const bySlug = await call(`/go/${merchant.slug}`);
    expect(bySlug.status).toBe(302);
    expectRedirectHeaders(bySlug);
    expect(bySlug.headers.get("location")).toBe(tracked((await clicksOf(offer.id)).find((r) => r.id !== rows[0]?.id)?.id ?? ""));
  });

  it("fills {src} and {locale} from the enum and the Referer, never from raw input", async () => {
    const { offer } = await seed({ offer: { trackingTemplate: "https://example.com/r?c={click_id}&s={src}&l={locale}" } });
    const a = await call(`/go/o/${offer.id}?src=tools`, { headers: { referer: "https://vnx.si/vi/tools/x" } });
    const b = await call(`/go/o/${offer.id}?src=${encodeURIComponent(`https://${EVIL}`)}`, { headers: { referer: `https://${EVIL}/vi/x` } });
    const ids = (await clicksOf(offer.id)).map((r) => r.id);
    expect(ids).toHaveLength(2);
    expect([a.headers.get("location"), b.headers.get("location")].map((l) => l?.replace(/c=[0-9A-Z]{26}/, "c=ID")).sort()).toEqual(["https://example.com/r?c=ID&s=tools&l=vi", "https://example.com/r?c=ID&s=unknown&l=en"]);
  });

  const FALLBACKS: [string, () => Promise<Seeded>][] = [
    ["merchant_paused", () => seed({ merchant: { status: "paused" } })],
    ["offer_paused", () => seed({ offer: { status: "paused" } })],
    ["offer_not_started", () => seed({ offer: { startsAt: "2999-01-01T00:00:00.000Z" } })],
    ["offer_ended", () => seed({ offer: { endsAt: "2000-01-01T00:00:00.000Z" } })],
    ["program_not_active (draft)", () => seed({ program: { status: "draft" } })],
    ["program_not_active (paused)", () => seed({ program: { status: "paused" } })],
    [
      "flag_off",
      async () => {
        const s = await seed();
        await setFlags({});
        return s;
      },
    ],
  ];

  it.each(FALLBACKS)("fallback (%s): 302 to the merchant website with utm, no click id, one click row", async (_reason, build) => {
    const { offer } = await build();
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://example.com/?${UTM}`);
    expectRedirectHeaders(res);
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(1);
    expect(res.headers.get("location")).not.toContain(rows[0]?.id ?? "?");
  });

  const SILENT: [string, () => Promise<string>][] = [
    ["offer unknown", async () => ulid()],
    [
      "offer archived",
      async () => {
        const s = await seed();
        await run("UPDATE offers SET status = 'archived' WHERE id = ?1", s.offer.id);
        return s.offer.id;
      },
    ],
    [
      "merchant archived",
      async () => {
        const s = await seed();
        await run("UPDATE merchants SET status = 'archived' WHERE id = ?1", s.merchant.id);
        return s.offer.id;
      },
    ],
  ];

  it.each(SILENT)("not found (%s): 404 in the default locale, no click, no error log", async (_what, build) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const offerId = await build();
    const res = await call(`/go/o/${offerId}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await clicksOf(offerId)).toHaveLength(0);
    expect(goLogs(error)).toEqual([]);
  });

  const CORRUPT: [string, () => Promise<Seeded>][] = [
    [
      "invalid_url",
      async () => {
        const s = await seed();
        await run("UPDATE offers SET tracking_template = ?1 WHERE id = ?2", `https://${EVIL}/r?c={click_id}`, s.offer.id);
        return s;
      },
    ],
    [
      "window_invalid",
      async () => {
        const s = await seed();
        await run("UPDATE offers SET starts_at = 'not-a-date' WHERE id = ?1", s.offer.id);
        return s;
      },
    ],
    [
      "program_merchant",
      async () => {
        const s = await seed();
        const foreign = await makeProgram(await makeMerchant());
        await run("UPDATE offers SET program_id = ?1 WHERE id = ?2", foreign.id, s.offer.id);
        return s;
      },
    ],
    [
      "website_invalid",
      async () => {
        const s = await seed();
        await setFlags({});
        await run("UPDATE merchants SET website_url = ?1 WHERE id = ?2", `https://${EVIL}/`, s.merchant.id);
        return s;
      },
    ],
  ];

  it.each(CORRUPT)("corrupt data (%s): 404, no click, one error log without personal data", async (reason, build) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = await build();
    const res = await call(`/go/o/${s.offer.id}`, { headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": CHROME, referer: "https://news.example.org/secret?q=1" } });
    expect(res.status).toBe(404);
    expect(await clicksOf(s.offer.id)).toHaveLength(0);
    expect(goLogs(error)).toEqual([{ event: "go.corrupt_data", reason, offerId: s.offer.id, merchantId: s.merchant.id, requestId: expect.any(String) }]);
    const line = String(error.mock.calls[0]?.[0]);
    for (const secret of [EVIL, "203.0.113.9", CHROME, "news.example.org"]) expect(line).not.toContain(secret);
  });

  it("an offer without a program needs no flag, redirects to its destination with utm, and records the click", async () => {
    await setFlags({});
    const { offer } = await seed({ program: null, offer: { destinationUrl: "https://example.com/pricing" } });
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://example.com/pricing?${UTM}`);
    expect(await clicksOf(offer.id)).toHaveLength(1);
    const kept = await seed({ program: null, offer: { destinationUrl: "https://example.com/pricing?utm_campaign=x" } });
    expect((await call(`/go/o/${kept.offer.id}`)).headers.get("location")).toBe("https://example.com/pricing?utm_campaign=x");
  });
});

describe("/go/:merchantSlug: which merchants answer", () => {
  it("a paused merchant, a merchant without a default offer, an unknown slug, an archived default offer: 404 and no click", async () => {
    const paused = await seed({ merchant: { status: "paused" } });
    const bare = await makeMerchant();
    const archivedOffer = await seed();
    await run("UPDATE offers SET status = 'archived' WHERE id = ?1", archivedOffer.offer.id);
    for (const slug of [paused.merchant.slug, bare.slug, "no-such-merchant", archivedOffer.merchant.slug]) {
      const res = await call(`/go/${slug}`);
      expect(res.status, slug).toBe(404);
      expect(res.headers.get("location"), slug).toBeNull();
    }
    expect(await clicksOf(paused.offer.id)).toHaveLength(0);
    expect(await clicksOf(archivedOffer.offer.id)).toHaveLength(0);
  });
});

describe("open redirect and URL tricks (Review Focus 1 and 2)", () => {
  it.each([
    `/go/https://${EVIL}`,
    `/go/%2F%2F${EVIL}`,
    `/go/%5C${EVIL}`,
    `/go//${EVIL}`,
    `/go/x%0d%0aLocation:%20https://${EVIL}`,
    `/go/..%2F..%2Fevil`,
    `/go/o/%2F%2F${EVIL}`,
    `/go/o/https://${EVIL}`,
  ])("%s is a 404 with no Location", async (path) => {
    const res = await call(path);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("query parameters other than src are ignored; a hostile src becomes unknown; no header is injected", async () => {
    const { merchant, offer } = await seed();
    const query = `src=${encodeURIComponent(`https://${EVIL}`)}&url=https://${EVIL}&next=//${EVIL}&redirect=%5C%5C${EVIL}&to=${encodeURIComponent(`tools\r\nX-Injected: 1`)}`;
    const res = await call(`/go/${merchant.slug}?${query}`);
    const [row] = await clicksOf(offer.id);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(tracked(row?.id ?? ""));
    expect(res.headers.get("x-injected")).toBeNull();
    expect(row?.src).toBe("unknown");
  });

  const BAD_TEMPLATES = [
    `https://${EVIL}/r?c={click_id}`,
    `https://example.com@${EVIL}/r?c={click_id}`,
    `https://example.com.${EVIL}/{click_id}`,
    "https://evilexample.com/{click_id}",
    "http://example.com/r?c={click_id}",
    "https://127.0.0.1/{click_id}",
    "https://2130706433/{click_id}",
    "https://[::1]/{click_id}",
    "https://{src}/x",
    "https://example.com:8443/{click_id}",
    "https://example.com/{click_id}{x}",
  ];
  it.each(BAD_TEMPLATES)("a stored template %s is never followed: 404 on both routes, no click", async (template) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer, merchant } = await seed();
    await run("UPDATE offers SET tracking_template = ?1 WHERE id = ?2", template, offer.id);
    for (const path of [`/go/o/${offer.id}`, `/go/${merchant.slug}`]) {
      const res = await call(path);
      expect(res.status, path).toBe(404);
      expect(res.headers.get("location"), path).toBeNull();
    }
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });

  const BAD_URLS = ["http://example.com/", `https://${EVIL}/`, "https://user:pw@example.com/", "https://127.0.0.1/", "javascript:alert(1)", `//${EVIL}`, `https:${EVIL}`, `https://example.com\\@${EVIL}/`, "https://example.com/\r\n"];
  it.each(BAD_URLS)("a stored destination_url %j on an offer without a program is never followed", async (destinationUrl) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer } = await seed({ program: null, offer: { destinationUrl } });
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(goLogs(error).map((l) => l.reason)).toEqual(["invalid_url"]);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });

  it.each(BAD_URLS)("a stored website_url %j is never a fallback target: 404, no click", async (websiteUrl) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer, merchant } = await seed();
    await setFlags({});
    await run("UPDATE merchants SET website_url = ?1 WHERE id = ?2", websiteUrl, merchant.id);
    const res = await call(`/go/o/${offer.id}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(goLogs(error).map((l) => l.reason)).toEqual(["website_invalid"]);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });
});

describe("what never reaches D1", () => {
  /** A D1 whose every entry point throws and counts: a request that gets this far read the database. */
  function untouchableDb() {
    const state = { calls: 0 };
    const DB = new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare" || prop === "batch" || prop === "exec") {
          return () => {
            state.calls++;
            throw new Error("D1 must not be called");
          };
        }
        const value = Reflect.get(target, prop) as unknown;
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    return { env: { ...testEnv, DB } as Bindings, state };
  }

  const NOT_ULIDS = ["01hz8k3m5n7p9q2r4s6t8v0wxy", "01HZ8K3M5N7P9Q2R4S6T8V0WX", "01HZ8K3M5N7P9Q2R4S6T8V0WXYZ", "01HZ8K3M5N7P9Q2R4S6T8V0WXU", "..", "%00", "abc"];
  it.each(NOT_ULIDS)("/go/o/%s is a 404 before any D1 read", async (id) => {
    const { env, state } = untouchableDb();
    const res = await call(`/go/o/${id}`, { env });
    expect(res.status).toBe(404);
    expect(state.calls).toBe(0);
  });

  it.each(["/go/p", "/go/o", "/go/ab", "/go/UPPER", "/go/-x-", "/go/p/some-product/demo", "/go/p/some-product/site", "/go/o/", "/go/some-slug/"])("%s is a 404 before any D1 read (reserved or malformed slug, /go/p/ stays M7's)", async (path) => {
    const { env, state } = untouchableDb();
    const res = await call(path, { env });
    expect(res.status).toBe(404);
    expect(state.calls).toBe(0);
  });
});

describe("methods", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s on /go/ with a valid Origin is 405 with Allow: GET, HEAD, and writes nothing", async (method) => {
    const { offer, merchant } = await seed();
    const before = await totalClicks();
    for (const path of [`/go/o/${offer.id}`, `/go/${merchant.slug}`, "/go/p/x/demo"]) {
      const res = await call(path, { method, headers: { origin: "https://vnx.si" } });
      expect(res.status, `${method} ${path}`).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, HEAD");
      expect(res.headers.get("location")).toBeNull();
    }
    expect(await totalClicks()).toBe(before);
  });

  it("OPTIONS is 405; a POST from another Origin is stopped earlier (403)", async () => {
    expect((await call("/go/some-slug", { method: "OPTIONS" })).status).toBe(405);
    expect((await call("/go/some-slug", { method: "POST", headers: { origin: `https://${EVIL}` } })).status).toBe(403);
  });

  it("HEAD redirects with the same headers and records no click, tracked and fallback alike", async () => {
    const { offer } = await seed();
    const head = await call(`/go/o/${offer.id}`, { method: "HEAD" });
    expect(head.status).toBe(302);
    expectRedirectHeaders(head);
    expect(head.headers.get("location")).toContain("https://example.com/r?c=");
    await setFlags({});
    expect((await call(`/go/o/${offer.id}`, { method: "HEAD" })).headers.get("location")).toBe(`https://example.com/?${UTM}`);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });
});

describe("the click row (Review Focus 7)", () => {
  it("one GET records one row: kind offer, src, locale from a same-host Referer, country, referrer host only, no visitor hash, nothing personal", async () => {
    const { offer } = await seed();
    const { user, cookie } = await signIn("go-click@vnx.si");
    const res = await call(`/go/o/${offer.id}?src=tools`, {
      headers: { referer: "https://vnx.si/vi/tools/x?utm=1", "user-agent": CHROME, "cf-connecting-ip": "203.0.113.9", cookie },
      cf: { country: "VN" },
    });
    expect(res.status).toBe(302);
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ product_id: null, offer_id: offer.id, link_kind: "offer", src: "tools", locale: "vi", visitor_hash: null, country: "VN", referrer_host: "vnx.si", is_bot: 0 });
    expect(Math.abs(Date.now() - Date.parse(rows[0]?.created_at ?? ""))).toBeLessThan(60_000);
    const stored = JSON.stringify(rows[0]);
    for (const secret of ["203.0.113.9", CHROME, user.id, "go-click@vnx.si", cookie, "utm=1"]) expect(stored).not.toContain(secret);
  });

  it.each([
    ["https://vnx.si/zh-hant/tools/x", "zh-Hant", "vnx.si"],
    ["https://news.example.org/a/b?q=1", "en", "news.example.org"],
    ["https://vnx.si.evil.example.net/vi/x", "en", "vnx.si.evil.example.net"],
    [undefined, "en", null],
  ])("Referer %j gives locale %s and referrer_host %s; no cf gives no country", async (referer, locale, host) => {
    const { offer } = await seed();
    await call(`/go/o/${offer.id}?src=zzz`, { headers: referer ? { referer, "user-agent": CHROME } : { "user-agent": CHROME } });
    expect((await clicksOf(offer.id))[0]).toMatchObject({ src: "unknown", locale, referrer_host: host, country: null, is_bot: 0 });
  });

  it.each([[""], ["Googlebot/2.1 (+http://www.google.com/bot.html)"], ["curl/8.5.0"]])("a bot (User-Agent %j) is redirected and its click is recorded with is_bot = 1", async (ua) => {
    const { offer } = await seed();
    const res = await call(`/go/o/${offer.id}`, { headers: { "user-agent": ua } });
    expect(res.status).toBe(302);
    expect((await clicksOf(offer.id))[0]?.is_bot).toBe(1);
  });

  it("a verified bot reported by Cloudflare is marked, and each GET is its own row", async () => {
    const { offer } = await seed();
    await call(`/go/o/${offer.id}`, { headers: { "user-agent": CHROME }, cf: { botManagement: { verifiedBot: true } } });
    await call(`/go/o/${offer.id}`, { headers: { "user-agent": CHROME } });
    const rows = await clicksOf(offer.id);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
    expect(rows.map((r) => r.is_bot).sort()).toEqual([0, 1]);
  });
});

describe("the click is written through waitUntil", () => {
  /** Wraps the INSERT into outbound_clicks (and only it) so a test can delay or break it. */
  function dbWithInsert(wrap: (run: () => Promise<unknown>) => Promise<unknown>): Bindings {
    const DB = new Proxy(testEnv.DB, {
      get(target, prop) {
        const value = Reflect.get(target, prop) as unknown;
        if (prop !== "prepare") return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        return (sql: string) => {
          const stmt = target.prepare(sql);
          if (!sql.includes("INSERT INTO outbound_clicks")) return stmt;
          return { bind: (...args: unknown[]) => { const bound = stmt.bind(...args); return { run: () => wrap(() => bound.run()) }; } } as unknown as D1PreparedStatement;
        };
      },
    });
    return { ...testEnv, DB } as Bindings;
  }
  const fakeCtx = () => {
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
    return { ctx, pending };
  };

  it("the response is returned before the write finishes, and the click is stored once the registered promise settles", async () => {
    const { offer } = await seed();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { ctx, pending } = fakeCtx();
    const res = await call(`/go/o/${offer.id}`, { env: dbWithInsert(async (insert) => { await gate; return insert(); }), ctx });
    expect(res.status).toBe(302);
    expect(pending).toHaveLength(1);
    expect(await clicksOf(offer.id)).toHaveLength(0);
    release();
    await Promise.all(pending);
    expect(await clicksOf(offer.id)).toHaveLength(1);
  });

  it("a failing write is logged and does not change the redirect", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { offer } = await seed();
    const { ctx, pending } = fakeCtx();
    const res = await call(`/go/o/${offer.id}`, { env: dbWithInsert(async () => { throw new Error("boom"); }), ctx });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(goLogs(error)).toEqual([{ event: "go.click_failed", clickId: new URL(location).searchParams.get("c"), error: "Error: boom" }]);
    expect(await clicksOf(offer.id)).toHaveLength(0);
  });

  it("HEAD registers no write; without an ExecutionContext the write is awaited", async () => {
    const { offer } = await seed();
    const { ctx, pending } = fakeCtx();
    await call(`/go/o/${offer.id}`, { method: "HEAD", ctx });
    expect(pending).toHaveLength(0);
    expect((await call(`/go/o/${offer.id}`)).status).toBe(302);
    expect(await clicksOf(offer.id)).toHaveLength(1);
  });
});

describe("flag cache (Review Focus 3, 60 s)", () => {
  it("a change made straight in D1 is not seen until the cache is reset; setFlag clears it at once", async () => {
    const { offer } = await seed();
    const kind = async () => ((await call(`/go/o/${offer.id}`)).headers.get("location") ?? "").includes("/r?c=") ? "tracked" : "fallback";
    expect(await kind()).toBe("tracked");
    await run("UPDATE feature_flags SET enabled = 0 WHERE key = 'affiliate'");
    expect(await kind()).toBe("tracked");
    resetFlagCache();
    expect(await kind()).toBe("fallback");
    await run("UPDATE feature_flags SET enabled = 1 WHERE key = 'affiliate'");
    expect(await kind()).toBe("fallback");
    await setFlags({ affiliate: true });
    expect(await kind()).toBe("tracked");
  });
});

describe("the rest of the site keeps its own headers", () => {
  it.each(["/", "/products", "/vi/products"])("%s does not get Referrer-Policy: origin (only /go/ sets it)", async (path) => {
    const res = await call(path);
    expect(res.headers.get("referrer-policy")).not.toBe("origin");
  });
});
```

Run: `npm test -w apps/web -- test/monetization/go.test.ts` → FAIL (chưa có route: các `/go/…` rơi xuống `notFound` của app; test redirect đỏ).

- [ ] **Step 2: `routes/go.ts` và nối vào app**

`apps/web/src/routes/go.ts`:

```ts
import type { Context, Hono } from "hono";
import { recordClick, type ClickInput } from "../db/clicks.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findDefaultOfferContext, findOfferWithContext, type RedirectRows } from "../db/offers.ts";
import { RESERVED_MERCHANT_SLUGS } from "../domain/merchant.ts";
import { resolveOfferRedirect } from "../domain/offer.ts";
import { CORRUPTION_REASONS, OFFER_ID_RE, countryOf, isBotRequest, localeFromReferer, parseSrc, referrerHost } from "../domain/outbound.ts";
import { SLUG_RE } from "../domain/slug.ts";
import type { AppEnv } from "../env.ts";
import { ulid } from "../lib/ulid.ts";
import { errorResponse } from "../views/error-response.tsx";

/**
 * /go/:merchantSlug and /go/o/:offerId (addendum §2.1, §3.3; ADR-007). HIGH-RISK: the destination comes only from the database through
 * resolveOfferRedirect, and `Location` is the href that function re-validated. Nothing from the path or query ever reaches `Location`:
 * the query is read for `src` only, and only as an enum.
 */

const NO_INDEX = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;

/** The default-locale 404 page (these paths have no locale prefix), never cached or indexed. */
function notFound(c: Context<AppEnv>): Promise<Response> {
  for (const [name, value] of Object.entries(NO_INDEX)) c.header(name, value);
  return errorResponse(c, "notFound", 404);
}

function redirectTo(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url, ...NO_INDEX, "Referrer-Policy": "origin" } });
}

/** Never rejects: a failed write is logged and must not touch the redirect. */
async function saveClick(db: D1Database, click: ClickInput): Promise<void> {
  try {
    await recordClick(db, click);
  } catch (err) {
    console.error(JSON.stringify({ event: "go.click_failed", clickId: click.id, error: String(err) }));
  }
}

/** waitUntil when the runtime has an ExecutionContext (Hono throws when it has none: tests, local), else wait for the write. */
async function defer(c: Context<AppEnv>, work: Promise<void>): Promise<void> {
  let ctx: ExecutionContext | null = null;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = null;
  }
  if (ctx) ctx.waitUntil(work);
  else await work;
}

async function respond(c: Context<AppEnv>, rows: RedirectRows | null): Promise<Response> {
  if (!rows?.offer) return notFound(c);
  const now = new Date();
  const clickId = ulid(now.getTime());
  const affiliate = await isFlagEnabled(c.env.DB, "affiliate", now.getTime());
  const partnerReferral = await isFlagEnabled(c.env.DB, "partner_referral", now.getTime());
  const url = new URL(c.req.url);
  const referer = c.req.header("referer");
  const locale = localeFromReferer(referer, url.host);
  const src = parseSrc(url.searchParams.get("src"));

  const result = resolveOfferRedirect({ ...rows, flags: { affiliate, partner_referral: partnerReferral }, now: now.toISOString(), clickId, locale, src });
  if (result.kind === "not_found") {
    if (CORRUPTION_REASONS.includes(result.reason)) {
      console.error(JSON.stringify({ event: "go.corrupt_data", reason: result.reason, offerId: rows.offer.id, merchantId: rows.merchant?.id ?? null, requestId: c.get("requestId") }));
    }
    return notFound(c);
  }

  // HEAD is answered by the GET handler (Hono); it must not count as a click.
  if (c.req.method === "GET") {
    const cf = c.req.raw.cf;
    await defer(
      c,
      saveClick(c.env.DB, {
        id: clickId,
        productId: null,
        offerId: rows.offer.id,
        linkKind: "offer",
        src,
        locale,
        visitorHash: null,
        country: countryOf(cf),
        referrerHost: referrerHost(referer),
        isBot: isBotRequest(c.req.header("user-agent"), cf),
        createdAt: now.toISOString(),
      }),
    );
  }
  return redirectTo(result.url);
}

export function registerGoRoutes(app: Hono<AppEnv>) {
  app.get("/go/o/:offerId", async (c) => {
    const id = c.req.param("offerId");
    if (!OFFER_ID_RE.test(id)) return notFound(c);
    return respond(c, await findOfferWithContext(c.env.DB, id));
  });

  app.get("/go/:merchantSlug", async (c) => {
    const slug = c.req.param("merchantSlug");
    if (RESERVED_MERCHANT_SLUGS.has(slug) || !SLUG_RE.test(slug)) return notFound(c);
    const rows = await findDefaultOfferContext(c.env.DB, slug);
    // A paused or archived merchant has no public /go/ (addendum §3.3), unlike /go/o/ where its offers fall back.
    return respond(c, rows !== null && rows.merchant.status === "active" ? rows : null);
  });

  // Everything else under /go/ that is not matched above (including /go/p/…, which is M7's) is a 404, never a static asset.
  app.get("/go/*", (c) => notFound(c));
  app.all("/go/*", (c) => c.body("Method Not Allowed", 405, { Allow: "GET, HEAD", "Cache-Control": "no-store" }));
}
```

`apps/web/src/app.ts`: thêm `import { registerGoRoutes } from "./routes/go.ts";` cạnh các import route khác, và `registerGoRoutes(app);` ngay trước `registerSeoRoutes(app);`.

Nếu `npm run typecheck` báo `c.req.raw.cf` không gán được cho `CfLike`, ép kiểu tại chỗ gọi (`as CfLike`, import type từ `domain/outbound.ts`); không nới `CfLike`.

Run: `npm test -w apps/web -- test/monetization/go.test.ts` → PASS. Nếu test `cf` báo `country` null do `Request` không giữ `cf`, giữ nguyên helper `Object.defineProperty` (đã dùng) và kiểm lại `c.req.raw` là chính request đó; không đổi mã production để chiều test.

- [ ] **Step 3: Test kiến trúc**

Run: `npm test -w apps/web -- test/architecture.test.ts` → FAIL (`routes/go.ts` import `db/clicks`, `db/offers` mà chưa trong danh sách cho phép). Sửa `apps/web/test/architecture.test.ts`: `MONEY_ALLOWED` thêm `"../src/routes/go.ts"`, và danh sách đúng của test "after Task 4" thêm `"../src/routes/go.ts"` sau `"../src/jobs/daily.ts"` (giữ các mục của Task 3); đổi tên test thành "after Task 4b the allowlist is exactly the files of Tasks 2c–4b". Run lại → PASS (kể cả "has no partner name in src").

- [ ] **Step 4: Kiểm tra cuối và commit**

Chạy: `npm run typecheck -w apps/web`, `npm test`, `grep -rniE "elevenlabs|partnerstack" apps/web/src` (không in dòng nào), và `npm test -w apps/web -- test/seo/robots.test.ts` (vẫn có `Disallow: /go/`). Kiểm tay (không thuộc CI, ghi vào báo cáo): `npm run dev`, `curl -sI http://localhost:8787/go/o/00000000000000000000000000` → 404 kèm `cache-control: no-store`. Rồi:

```bash
git add apps/web/src/routes/go.ts apps/web/src/app.ts apps/web/test/architecture.test.ts apps/web/test/monetization/go.test.ts
git commit -m "feat(web): /go/ redirects with click logging (VNX-2103-2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận (Task 4b; `npm test -w apps/web -- test/monetization/go.test.ts` bao phủ danh sách ADR-007 "Được bảo đảm bởi" và Review Focus 1, 2, 3, 7):**
- Bảng chân lý qua HTTP: `tracked` (`Location` = template điền, `id` dòng click = `click_id`, cả `/go/o/` lẫn `/go/:slug`); `fallback` cho từng lý do (`merchant_paused`, `offer_paused`, `offer_not_started`, `offer_ended`, `program_not_active` với `draft` và `paused`, `flag_off`) tới `website_url` + UTM, không `click_id` trong `Location`, **có** một dòng click; `not_found` cho offer không tồn tại, offer `archived`, merchant `archived` (không log, không click). `program_direct` không tới được qua HTTP (CHECK của CSDL), do test domain Task 2b bao phủ.
- Dữ liệu hỏng `invalid_url`, `window_invalid`, `program_merchant`, `website_invalid` → 404, không click, đúng một dòng `console.error` `go.corrupt_data` (JSON, có `reason`, `offerId`, `merchantId`, `requestId`; không có host lạ, IP, UA, Referer). Tập lý do được log đúng bảy mục (test domain Task 4).
- Open redirect và mánh URL: mọi đường dẫn `/go/https://…`, `%2F%2F`, `%5C`, `//`, CR/LF, `..` → 404 không `Location`; query ngoài `src` bị bỏ qua, `src` lạ → `unknown`, không chèn header; mười một template, chín `destination_url` và chín `website_url` hỏng → 404, không click.
- ULID sai dạng, slug `p` / `o` / sai dạng, `/go/p/…` → 404 trước khi đọc D1 (DB giả đếm số lần gọi = 0).
- Header: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin` trên mọi 302 (tracked, fallback, slug, HEAD); 404 có `no-store` và `noindex`; trang `/`, `/products`, `/vi/products` không có `Referrer-Policy: origin`.
- Phương thức: POST / PUT / PATCH / DELETE có Origin hợp lệ → 405 kèm `Allow: GET, HEAD`, không ghi click; OPTIONS → 405; POST khác Origin → 403; `HEAD` redirect không ghi click và không gọi `waitUntil`.
- Click: một dòng mỗi GET `tracked` / `fallback`, `link_kind = 'offer'`, `offer_id` đặt và `product_id` null, `src` ngoài enum → `unknown`, `locale` từ Referer cùng host (host giả `vnx.si.evil…` → `en`), `referrer_host` chỉ host, `country` từ `request.cf.country`, `visitor_hash` null, bot (UA rỗng, Googlebot, curl, `verifiedBot`) → `is_bot = 1` vẫn redirect và vẫn ghi; dòng không chứa IP, UA, cookie, user id, email hay query của Referer (kể cả khi đăng nhập).
- `waitUntil`: response trả về khi ghi chưa xong, click có mặt sau khi `await` promise đã đăng ký; ghi lỗi chỉ `console.error` `go.click_failed` và không đổi redirect; không có `ExecutionContext` thì `await` ghi.
- Cache cờ 60 s: đổi thẳng trong D1 không đổi hành vi tới khi `resetFlagCache`; `setFlag` xóa cache ngay (cả hai chiều bật và tắt).
- Test kiến trúc: `MONEY_ALLOWED` thêm đúng `routes/go.ts` (danh sách đúng, có sắp xếp); không file `src` nào có `elevenlabs` / `partnerstack`.
- `npm run typecheck -w apps/web` và `npm test` xanh. Diff ước tính ≈ 600 dòng không tính locale (route 100, app 2, test kiến trúc 4, `go.test.ts` ≈ 495, phần lớn là bảng dữ liệu `it.each`; chấp nhận vì HIGH-RISK, không tách thêm). Commit `feat(web): /go/ redirects with click logging (VNX-2103-2)`.

Ghi chú cho Reviewer: `test/monetization/conversions.test.ts` của ADR-007 hoãn tới VNX-2105+ (lát mỏng không có conversion); ghi vào `CURRENT-STATUS.md` cùng các nghĩa vụ M7 đã nêu cuối Task 6.

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
