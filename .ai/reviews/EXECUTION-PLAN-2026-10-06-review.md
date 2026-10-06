# Review: Execution plan marketing/designer (2026-10-06)

- **Tài liệu được review:** `docs/VNXSI_EXECUTION_PLAN_APPROVED.md` v1.1. File chưa được track trong git, tự ghi "Approved for implementation".
- **Reviewer:** Claude (Opus điều phối). Phân tích dựa trên đối chiếu với governance và danh mục code thực tế ở nhánh `feat/m7-metrics` `4572243`.
- **Ngày:** 2026-10-06.
- **Kết luận ngắn:** hướng đi tốt và phần lớn khớp nguyên tắc của VNX.SI ("seed inventory, not trust", minh bạch, không bán xếp hạng). Nhưng tài liệu **chưa phải là quyết định có hiệu lực** theo quy trình dự án. Thứ tự ưu tiên ở `docs/blueprint/README.md:18` là ADR > spec > blueprint > roadmap > plan, nên một plan không ghi đè được ADR, spec hay quyết định của Owner. Tài liệu chứa:
  - 6 điểm mâu thuẫn trực tiếp với quyết định đã khóa;
  - nhiều phần trùng với EPIC 21 đã xây;
  - một khối lớn (Pulse) chưa có nguồn dữ liệu.

  Đề xuất: coi đây là **định hướng đã duyệt**, dịch dần sang spec addendum, ADR và roadmap qua quy trình chuẩn, sau khi M7 xong.

---

## 1. Những gì khớp, làm được ngay hoặc đã có

| Mục trong tài liệu | Hiện trạng |
|---|---|
| Không bịa số liệu, review, logo, traction ("seed inventory, not trust", §31) | Trùng nguyên tắc 1 của Charter và luật cứng trong CLAUDE.md. |
| Xếp hạng tự nhiên tách khỏi tiền; không link thẳng từ ranking sang affiliate (§5.1, §6) | ADR-004, ADR-007 luật 2 và 7 đã khóa; test kiến trúc `RANKING_FILES` đã chặn. |
| `/go/:partner` redirect kèm ghi click (§12) | **Đã xây** ở EPIC 21: `/go/:merchantSlug`, `/go/o/:offerId`, bảng `outbound_clicks`, cờ tính năng, khung giờ của offer. |
| Huy hiệu Listed / Demo verified / In production (§16) | Đã có (`product_verifications`), hiện kèm ngày "since {date}". |
| Card có ảnh, tên, outcome, verification, giá, builder (§21) | Phần lớn đã có ở `ProductCard`; thiếu nút demo và loại giao hàng. |
| Canonical, hreflang, sitemap, robots, OG; JSON-LD Organization và SoftwareApplication (§23–25, P0 SEO) | **Đã xây** (M4). Thiếu WebSite, BreadcrumbList, ProfilePage, chỉ cần bổ sung. Search Console và Bing là việc của Owner. |
| CTA "Explore products / Post what you need / List what you built" | Có sẵn đích: `/products`, `/request`, `/for-builders` (M7 Task 9). |
| Sự kiện `product_view`, `demo_click`, `contact_builder`, `post_request` (§29) | **Đang xây** ở M7: `product_daily_stats`, `outbound_clicks`, Inquiry. |
| "VNX Picks" khi traffic thấp, Trending chỉ từ sự kiện thật (§26) | Khớp thiết kế M7: Trending có ngưỡng; dưới ngưỡng hiện "Founding products". |

## 2. Mâu thuẫn với quyết định đã khóa (cần Owner chọn trước)

| # | Mục | Mâu thuẫn với |
|---|---|---|
| C1 | **`/requests` công khai** kèm ngân sách "$800" và quốc gia (§4, §22) | Spec §4 và §8.8 ("Request không bao giờ có trang public"), NFR, và Privacy §4 đã hứa với người gửi rằng chỉ builder được mời mới thấy. Ngân sách hiện là *dải*, không phải con số. Bảng request công khai đã nằm trong backlog Wave 4 (VNX-1901). |
| C2 | **Listing bên thứ ba "Curated, builder not yet claimed"** trong marketplace (§15) | Quyết định Owner Q1 ngày 2026-10-04: bên thứ ba chỉ ở `/tools/:merchant`, `/products` chỉ có product của builder. `products.builder_id NOT NULL`; Inquiry luôn đi tới builder. |
| C3 | **Homepage 3 cột, thay hero** (§3, §17) | Quyết định A2 (M7): giữ landing VNX-0708, đặt các khối dữ liệu bên dưới. |
| C4 | **`user_session` trong click** (§14) | ADR-007 luật 11, Privacy §2 ("không gắn tài khoản với bản ghi click") và B1 (băm đổi mỗi ngày). |
| C5 | **Affiliate "Recommended stack" trên trang product** (§19) | Addendum §3.4: platform không gắn offer bên thứ ba lên trang product của builder; ADR-008, ADR-009. |
| C6 | **URL `/zh-cn/`, `/zh-tw/`** và `/products/{slug}`, `/builders/{handle}`, `/categories/` (§23, §25) | ADR-003 (`/zh-hans/`, `/zh-hant/`); spec §5.2 (`/p/`, `/b/`); Q9 (`/products/c/:category`). Đổi URL đang được index thì cần 301 hàng loạt. |

Các mâu thuẫn nhỏ hơn:
- Câu disclosure mới ("at no extra cost to you") khác câu Owner đã duyệt, và là một khẳng định phải kiểm cho từng partner.
- "Sponsored" cho vendor nằm ngoài ADR-008, vốn chỉ áp dụng sau cổng Wave 1 và chỉ cho product của builder.
- "Mock UI clearly marked as example" trái luật cứng: dữ liệu mẫu chỉ có trong prototype và test.
- "Weekly returning users" không đo được, vì theo B1 cookie hết hạn mỗi ngày và băm không nối được giữa các ngày.
- "Weights may be adjusted later" trái ADR-004: mọi thay đổi trọng số phải nằm trong spec.

## 3. Cần ADR hoặc nguồn dữ liệu trước khi lên plan

- **VNX Pulse (xếp hạng AI model/tool, Momentum Score):**
  - chưa có nguồn dữ liệu cho search interest, GitHub, thảo luận hay news;
  - chưa rõ giấy phép, tần suất cập nhật và người phụ trách;
  - "VNX engagement" sẽ đụng cookie B1 (chỉ dùng cho trang product) và luật ranking không đọc dữ liệu click;
  - trang entity `/pulse/models/x` trùng vai với `/tools/:merchant` của EPIC 21.

  Cần một ADR cho module mới và đặt tên khác "Trending", vì Trending của product đã gắn lời hứa "không ai trả tiền".
- **Build Kits** (`/build`, wizard, master prompt):
  - kéo nội dung biên tập của Wave 2 (EPIC 22) lên sớm;
  - phần gợi ý stack phải là dữ liệu, không được đọc bảng tiền và không có tên vendor trong code (ADR-007);
  - prompt phải là template xác định; nếu dùng LLM thì cần ADR (Wave 1 không có code AI).
- **Mô hình Partner / Placement mới** (§14): trùng `merchants`, `partner_programs`, `offers`, `outbound_clicks`.
  - Cột `affiliate_url` thô sẽ vượt qua cổng "program chỉ active khi có `terms_url` + `terms_verified_at`".
  - Cột `priority` có rủi ro rò vào ranking.
  - Hướng đúng: **mở rộng** EPIC 21 bằng `placement` và `campaign` không định danh, cộng một registry placement (sửa đổi ADR-007), thay vì tạo bảng mới.
- **Origin states + claim flow** (§15): cần ADR. `builder_id` hiện là bắt buộc. Cần định tuyến Inquiry khi chưa có builder, chứng minh quyền sở hữu, quy trình gỡ bỏ (takedown), và Terms/Privacy cho dữ liệu bên thứ ba.
- **Analytics events mới** (impression, search, wizard, prompt_copy, share, save): mở rộng ra ngoài "chỉ trang product" của Privacy đã duyệt, và câu tìm kiếm có thể chứa dữ liệu cá nhân. Nếu theo dõi xuyên trang thì phải xem lại căn cứ "lợi ích chính đáng, không banner".
- **Newsletter:** cần opt-in riêng (không dùng lại waitlist, vì waitlist chỉ có đồng ý nhận thông báo ra mắt), unsubscribe và một dòng retention trong Privacy. Không đưa request vào newsletter (C1).

## 4. Tác động pháp lý (mỗi mục cần câu chữ Owner duyệt trước khi code)

1. Request công khai: phải có opt-in mới cho từng request; không công khai hồi tố. Nguy cơ nhận diện được doanh nghiệp khi ghép ngân sách, quốc gia và ngách.
2. `user_session`: cần căn cứ pháp lý mới và sửa Privacy §2, §3, §6.
3. Sự kiện analytics mới: là thay đổi quan trọng theo Privacy §10 (báo trước); có thể cần banner đồng ý.
4. Newsletter: GDPR/PECR, CAN-SPAM; ở Việt Nam là NĐ 91/2020 và NĐ 13/2023 (cần chuyên gia kiểm).
5. Mở rộng affiliate: mỗi placement cần disclosure ngay cạnh link và `rel="sponsored"`.
6. Listing curated: rủi ro nhãn hiệu, ảnh chụp màn hình, hàm ý liên kết, dữ liệu cá nhân của builder chưa có tài khoản. Cần quy trình takedown.
7. Pulse: giấy phép của từng nguồn dữ liệu, nhãn hiệu, nguy cơ phỉ báng ở mục "why trending", và xung đột lợi ích khi vừa xếp hạng vừa hưởng hoa hồng từ vendor.
8. Công khai nội dung "What VNX checked": không công khai chữ admin nhập, vì có thể chứa dữ liệu khách. Thay vào đó làm một trang chung giải thích "mỗi huy hiệu kiểm tra gì".

## 5. Plan đề xuất theo giai đoạn

**Giai đoạn 0, ngay bây giờ (không cần quyết định mới):** hoàn tất M7 như đã duyệt.
- Task 3p/3 (đang làm), Task 9 `/for-builders`, Task 10 (a11y).
- Review toàn nhánh, merge `origin/main` (Ops O1, sửa `isStaff`), merge và push.
- Task 7a/7b (các khối số liệu) tiếp tục nếu giữ A2. Các khối được viết thành component **không phụ thuộc vị trí**, để homepage 3 cột sau này dùng lại: Numbers, Live (= "Recent verified"), Trending/Founding, Top.
- Việc của Owner, không đổi sản phẩm: Search Console, Bing (purge sitemap trước), tiếp cận builder (VNX-0806).

**Giai đoạn 1, sau M7 (spec addendum "Execution plan v1", mỗi mục một task plan):**
1. Hero và định vị mới "Don't build from zero" (nếu Owner chấp nhận): đổi copy 4 locale; zh cần người bản ngữ duyệt.
2. Homepage 3 cột: tái dùng component M7; rail trái = Recent verified / VNX Picks (tiêu chí công bố) / Trending; rail phải = lối vào Build Kits (khi có), không offer. Ngân sách hiệu năng: ≤ 8 query D1, JS homepage ≤ 60 KB.
3. Card và trang product V2 (design wave B/C): nút demo trên card, loại giao hàng, trang "mỗi huy hiệu kiểm tra gì", mục lục "On this page", Related theo `tech_stack`. **Không** đặt builder khác, Alternatives hay affiliate trên trang product.
4. Bổ sung JSON-LD: WebSite, BreadcrumbList, ProfilePage.
5. Mở rộng EPIC 21: `placement` + `campaign` không định danh trên `outbound_clicks` (rebuild bảng vì CHECK enum), registry placement trong ADR-007 sửa đổi, câu Privacy mới. Không `user_session`.

**Giai đoạn 2 (sau cổng Wave 1 hoặc khi có ADR và nguồn dữ liệu):**
- Một Build Kit thí điểm (tĩnh, prompt template xác định, gợi ý stack dạng dữ liệu, affiliate qua merchant/offer đã có kèm disclosure).
- Pulse ở dạng danh sách biên tập hằng tuần, có nhãn, không điểm số; Momentum Score chỉ khi có nguồn dữ liệu hợp lệ.
- Request công khai dạng tóm tắt ẩn danh có opt-in (VNX-1901).
- Origin states và claim flow (ADR).
- Newsletter (Ops O3).

## 6. Quyết định cần Owner (theo ưu tiên)

**Ưu tiên 1, chặn mọi việc lên plan:**
1. "Approved" nghĩa là gì? Định hướng, để Reviewer dịch sang spec/ADR **(đề xuất)**; hay ghi đè trực tiếp ADR/spec?
2. Homepage trong M7: giữ A2, làm 3 cột sau **(đề xuất)**; chỉ đổi hero copy; hay bỏ A2, làm 3 cột ngay?
3. Listing bên thứ ba: giữ Q1, tiếp cận builder để họ tự đăng **(đề xuất)**; hay cho listing curated chưa claim?
4. Request công khai: giữ riêng tư bây giờ, tóm tắt ẩn danh opt-in sau cổng Wave 1 **(đề xuất)**; hay bảng công khai đầy đủ?
5. VNX Labs: không đưa vào marketplace ở Wave 1 **(đề xuất)**; tài khoản riêng có nhãn và loại khỏi mọi xếp hạng; hay coi như builder thường?

**Ưu tiên 2, trước khi làm monetization/SEO:**

6. Chỉ đặt affiliate ở trang nội dung và trang tool; không ở `/`, `/p/`, `/b/`, catalogue **(đề xuất)**.
7. Click: thêm `placement` và `campaign` không định danh; từ chối `user_session` **(đề xuất)**.
8. Analytics: chỉ bộ đếm tổng hợp không cookie cho sự kiện ngoài trang product; bỏ "weekly returning users" **(đề xuất)**.
9. Định vị "Don't build from zero": dùng làm câu hero, giữ tagline marketplace **(đề xuất)**.
10. Disclosure: giữ câu đã duyệt; bỏ "at no extra cost" trừ khi đã kiểm từng partner **(đề xuất)**.
11. Giữ `/p/`, `/b/`, `/zh-hans/`, `/zh-hant/`, `/products/c/:category` **(đề xuất)**.
12. North star: giữ của Charter; thêm "qualified connections/week" làm chỉ số phụ ở Ops O2 **(đề xuất)**.

**Ưu tiên 3, quyết khi tới lượt:** Pulse (13), Build Kits (14), trang so sánh vendor (15), newsletter (16), rail trang product (17), chỉ số seeding và cổng exit (18), video trên card, save/share, tái dùng nội dung builder trên mạng xã hội, công khai bằng chứng huy hiệu (19). Khuyến nghị cho từng mục nằm ở mục 3 và 5.

## 7. Quyết định của Owner (2026-10-06)

1. "Approved" = **định hướng đã duyệt**. Reviewer chuyển sang spec addendum, ADR và roadmap qua quy trình chuẩn; M7 làm xong trước.
2. Homepage: **giữ A2**. Homepage 3 cột làm sau M7. Các khối của Task 7 viết thành component không phụ thuộc vị trí.
3. Listing bên thứ ba: **giữ Q1**. `/products` chỉ có product của builder; seed bằng cách tiếp cận và mời builder.
4. Request: **bảng công khai đầy đủ** (khác đề xuất). Làm sau M7, cần:
   - spec addendum sửa spec §4, §8.8 và §11;
   - câu chữ Privacy và Terms mới do Owner duyệt, báo trước theo Privacy §10;
   - opt-in cho từng request (request đã gửi không bị công khai hồi tố);
   - trường quốc gia mới;
   - quy tắc hiển thị ngân sách (dải hay con số);
   - kiểm duyệt trước khi công khai.

   Các câu hỏi chi tiết sẽ đưa ra khi lên plan.
5. Còn chờ: VNX Labs (câu 5) và các câu ưu tiên 2–3.

---

**Nguồn:**
- đối chiếu governance (Opus);
- danh mục code (Sonnet);
- lưu tại `.superpowers/sdd/execution-plan-review/progress.md`.
