# Privacy Policy — phiên bản board (bảng nhu cầu công khai, EPIC 27; câu chữ Owner đã duyệt 2026-10-07, EN và VI)

- **Trạng thái:** APPROVED (Owner 2026-10-07, EN và VI). Câu chữ thêm và thay của bảng công khai chép nguyên văn từ phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §12.2 (EN) và §12.6 (VI), không dịch lại, không sửa chữ ({N} = 30 đã điền ở phụ lục). Phần còn lại giống hệt `privacy-m7.md` hiện tại, kể cả bổ sung ADR-012 (tài khoản liên kết, VNX-2607) và cookie `__Host-vnx_oauth` đứng giữa `__Host-vnx_invite` và `__Host-vnx_vid`. Không chép phụ lục đối chiếu code ADR-012 của `privacy.md`. Không phải tư vấn pháp lý; Q16: cần người có chuyên môn đọc lại trước khi bật cờ.
- **Khi nào hiện:** `/privacy` hiện bản này từ `REQUEST_BOARD_GO_LIVE` − 14 ngày UTC, và từ đó về sau luôn hiện (`domain/legal-versions.ts` `privacyVersionOf`, `legal/select.ts` `selectLegal`, `routes/legal.tsx`); trước đó hiện `privacy-m7.md` (từ `PRIVACY_NOTICE_GO_LIVE` − 14 ngày) hoặc `privacy.md`. Biến rỗng hoặc sai dạng thì không bao giờ hiện bản này. Ngày "Last updated" của bản này là `REQUEST_BOARD_GO_LIVE`. `privacy.md` và `privacy-m7.md` **không** chứa câu chữ board.
- **Ba phiên bản:** cho tới task dọn, mọi thay đổi Privacy phải sửa cả ba tệp (`privacy.md`, `privacy-m7.md`, tệp này) và cả sáu hằng số trong `src/legal/content.ts` (`privacyEn`, `privacyVi`, `privacyEnM7`, `privacyViM7`, `privacyEnBoard`, `privacyViBoard`).
- **Thay đổi so với `privacy-m7.md`:** mục 2 gạch "Requests" / "Nhu cầu (request)" thay (thêm country) và hai gạch mới "Public requests", "Interest in public requests" (VI: "Nhu cầu công khai", "Quan tâm tới nhu cầu công khai"); mục 3 một gạch mới và một đoạn căn cứ sự đồng ý (đứng ngay sau đoạn "We rely on…" cũ, là đoạn riêng); mục 4 gạch **"Builders do not see clients' email addresses…"** (gạch có chữ này, sau khi OAuth thêm hai gạch nên không còn là gạch thứ hai) được thay bằng bản §12.2 và theo sau là hai gạch mới; mục 6 một gạch mới sau "Requests and proposals…".
- **Đối chiếu code (`feat/epic27-request-board`):** hằng số `privacyEnBoard`, `privacyViBoard` (`src/legal/content.ts`) đăng ký trong `BOARD_LEGAL.privacy`; `selectLegal` (`src/legal/select.ts`) chọn phiên bản; test `test/legal/content.test.ts` (so tệp này với hằng số từng dòng, và chặn câu chữ board trong ba tệp/bốn hằng số cũ), `test/legal/request-board-versions.test.ts` (HTTP: EN, VI, zh, ngày "Last updated", không quay lại, ca production-like), `test/config/wrangler-guard.test.ts` (tập cha của `privacy-m7.md`, danh sách dòng bị thay `REPLACED_PRIVACY`; cổng `REQUEST_BOARD_GO_LIVE` cần `BOARD_LEGAL` đủ câu chữ board). Hành vi mô tả khớp code VNX-2706b: chỉ đội ngũ thấy interest, client chỉ thấy khi builder được mời, từ chối interest không gửi email, dữ liệu giữ theo quy tắc của nhu cầu, không hứa điểm số hay thứ hạng.
- **Thông báo trước:** `views/privacy-notice.tsx` (khóa `privacyNotice.boardMessage`, `privacyNotice.readChanges`, `privacyNotice.dismiss`), cửa sổ `[REQUEST_BOARD_GO_LIVE − 14 ngày, + 31 ngày)`. Câu thông báo EN/VI là OP-2a (Owner 2026-10-07); zh-Hans/zh-Hant Owner duyệt nguyên văn 2026-10-13.

---

## EN

### Privacy Policy

Last updated: {date}

**1. Who we are**
This policy explains how VNX.SI ("we") handles personal data on vnx.si. Contact for any privacy question or request: contact@vnx.si.

**2. What we collect**
- **Account:** your email address, the display name you choose, your language, whether you are an admin, and when you last signed in.
- **Sign-in:** one-time sign-in links (stored only as a hash, valid for 15 minutes) and session records (stored only as a hash), including whether you signed in by email link or with a linked account.
- **Linked accounts:** if you link a Google, GitHub or LinkedIn account to your VNX.SI account, we store which service it is, the ID that service gives your account, and a label so you can recognise it (the email address for Google and LinkedIn, the username for GitHub), plus when you linked it and when you last signed in with it. When you sign in with one of these services, it sends us your basic profile; we keep only what is listed here. We never receive or store the password of that account, and we do not keep the access keys the service gives us.
- **Builder profile and products:** what you enter in your profile and listings (name, headline, bio, country, skills, rates, links, product descriptions, prices, images). This content is **public** once approved.
- **Inquiries:** when you contact a builder, the name you type, your messages, the type of request, your budget range, an optional deadline, and the product or builder it is about. If you are not signed in, we also take your email address and create an account for it; nothing reaches the builder until you confirm that email.
- **Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline, the languages you want to work in and the country you choose. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.
- **Public requests:** if you choose to show a request on our public request board, we record when you chose it and which version of this policy you saw. Our team reviews the request first and may shorten or edit the title and description to remove details that could identify you or others. We keep the version we publish next to your original.
- **Interest in public requests:** if you are a builder and tell us you are interested in a public request, we record that, when, and the note or product you add.
- **Proposals:** if you are a builder and we invite you to a request, the approach, price, timeline and notes you send, or that you declined.
- **Waitlist:** your email, the time you agreed to be contacted, the language of the page, your country as detected by our hosting provider, the website you came from (domain only, not the full address), and campaign tags (`utm_*`) if the link you followed had them.
- **Outbound clicks:** when you follow a button or link that goes to another company's website through our `/go/` address, we record the time, which link it was, which kind of page it was on, the language of the page you were on, your country (detected by our hosting provider), the website you came from (domain only) and whether the visit looks like an automated bot. We record the click even when the link carries no tracking code. We do not store your IP address, your email address or your account with that record. The record may hold the day-specific code described under "Visit counting", which cannot be matched across days.
- **Visit counting:** when you open a product page, we store the random code described in section 5 (Cookies) in a cookie. We combine it with a secret that changes every day, so each product page, and each of its demo or website links, is counted at most once per visitor per day, and the result cannot be matched from one day to the next. We do not count visits that look like automated bots, visits by the product's own builder, or visits by our team. If your browser blocks the cookie, the page works the same, but each visit may be counted.
- **Questions and feedback:** when you use our contact form, your email, the name you give (optional), whether you are a builder or a client, what your message is about, the message itself, the language of the page, and your account if you are signed in.
- **Security:** your IP address and a hash of your email in short-lived counters that limit how often a form can be used, and a record of actions taken by admins (for example approving a profile).
- **Bot check:** when you send an inquiry, a request or a contact message without signing in, Cloudflare Turnstile checks that you are a person. Cloudflare receives your IP address and information from your browser for this check.

We do not collect payment details. We do not use third-party analytics, advertising or tracking cookies.

**3. Why we use it**
- To sign you in and keep you signed in.
- To let you sign in with an account you have linked and, if you are a builder and choose to, to show on your public profile that you own a GitHub or LinkedIn account.
- To show builder profiles and products publicly, and to review them before they go public.
- To email you about your account, your listings, or, if you joined the waitlist, when the marketplace opens.
- To pass inquiries and replies between clients and builders, and to email the other side when there is a new message (the email includes the message).
- To match requests with builders: our team reads each request and invites up to five builders, who see the request and send proposals; when you pick a proposal we start an inquiry between you and that builder with the request and the proposal as the first message.
- To show the requests their authors chose to make public, so that builders can find them and tell us they are interested. Our team still decides which builders to invite.
- To count how often links to other companies are followed and, for partner links, to let the partner tell which of our links a visit came from (the link may carry a random click code; on VNX.SI it is not linked to your name, email address or account).
- To count visits to product pages and clicks on a product's demo and website links, so that we can show public statistics (for example which products are trending).
- To read and answer the questions and feedback you send us.
- To protect the site against spam and abuse.

We rely on your consent (waitlist, contact form), on what is needed to provide the service you asked for (account, listings), and on our legitimate interest in keeping the site secure. For counting visits we rely on our legitimate interest in measuring how the site is used. You can object at any time by turning on the Global Privacy Control signal in your browser: we then set no cookie and count nothing.

For public requests we rely on your consent. You can withdraw it at any time from your account page; the request then leaves the public board straight away, and it does not change what happened before.

**4. Who can see it**
- Builder profiles and approved products are public.
- Your linked accounts are shown only to you. A builder can choose to show their GitHub username, or the fact that their LinkedIn account is verified, on their public profile. Google accounts are never shown, and builders never see a client's linked accounts.
- When you sign in with Google, GitHub or LinkedIn, that service knows you signed in to VNX.SI and handles that under its own privacy policy.
- Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request. If you chose to make a request public, anyone, including search engines, can see the version we published, its category, budget range, country, deadline and languages, but never your name, email address or account.
- When a builder tells us they are interested in a public request, only our team sees it. The client does not see it unless we invite that builder.
- Search engines and other sites may keep copies of a public page for some time after we close or remove it. We ask search engines not to index closed requests, but we cannot delete copies that others hold.
- When you follow a link to a partner you leave VNX.SI. The partner can see that you came from VNX.SI, and the click code if the link carries one. It handles your data under its own privacy policy, and it may set its own cookies or tracking when you arrive on its site.
- Messages sent through the contact form are read only by the VNX.SI team; a copy is delivered to our mailbox through Resend.
- Service providers process data for us: **Cloudflare** (hosting, database, file storage, security, including the Turnstile bot check) and **Resend** (sending email). They may process data outside your country.
- We do not sell personal data. We share it with authorities only when the law requires it.

**5. Cookies**
We use only cookies that the site needs to work, and one cookie to count visits.
- `__Host-vnx_session`: keeps you signed in, for up to 30 days.
- `__Host-vnx_invite`: remembers a builder invite link for 1 hour.
- `__Host-vnx_oauth`: keeps a sign-in with Google, GitHub or LinkedIn secure while you go to that service and back, for up to 10 minutes.
- `__Host-vnx_vid`: a random code, not linked to your name, e-mail address or account, used only to count visits to product pages. It expires at the end of the current day (UTC). We do not set it if your browser sends the Global Privacy Control signal (`Sec-GPC: 1`).

**6. How long we keep it**
- Sign-in links: 15 minutes. Sessions: up to 30 days, or until you sign out.
- Linked accounts: until you unlink them or your account is deleted.
- Rate-limit counters (including IP addresses): deleted regularly once they expire.
- Outbound click records: deleted after 13 months.
- Daily de-duplication records: deleted after 2 days.
- Inquiries and their messages: while your account exists, under the same rule as your account below. Inquiries you never confirmed, and accounts created for them that were never confirmed: deleted after 48 hours.
- Requests and proposals: while your account exists, under the same rule as your account below. Requests you never confirmed: deleted after 48 hours.
- Public requests: shown while the request is open and for 30 days after it closes, unless you or we remove it earlier. The published version and your choice are then kept with the request, under the rule above. Interest records: under the same rule as requests.
- Questions and feedback: until we have answered and dealt with them, plus 12 months, or until you ask us to delete them.
- Account, profile and listings: while your account exists. When you ask us to delete it, we delete or anonymise it, except records we must keep by law or to protect the site.
- Waitlist: until the marketplace opens to clients plus 12 months, or until you ask us to remove you.

**7. Your rights**
You can ask to see, correct, export or delete your personal data, to withdraw your consent, or to object to how we use it. Email contact@vnx.si from the address you used with us. We reply within 30 days. You can also complain to the data protection authority where you live.

**8. Security**
Sessions and sign-in links are stored only as hashes, the site is served over HTTPS only, and admin actions are logged. We email you whenever an account is linked to or unlinked from yours. No system is perfectly secure; tell us at contact@vnx.si if you find a problem.

**9. Children**
VNX.SI is not for children. You must be at least 16 to join the waitlist and 18 to be a builder.

**10. Changes**
When we change this policy we update the date above. For important changes we will tell signed-in users before they apply.

**11. Language**
If a translation differs from the English version, the English version applies.

---

## VI

### Chính sách quyền riêng tư

Cập nhật lần cuối: {date}

**1. Chúng tôi là ai**
Chính sách này giải thích cách VNX.SI ("chúng tôi") xử lý dữ liệu cá nhân trên vnx.si. Liên hệ cho mọi câu hỏi hoặc yêu cầu về quyền riêng tư: contact@vnx.si.

**2. Chúng tôi thu thập gì**
- **Tài khoản:** email, tên hiển thị bạn chọn, ngôn ngữ, bạn có phải admin không, và lần đăng nhập gần nhất.
- **Đăng nhập:** link đăng nhập dùng một lần (chỉ lưu dạng hash, hiệu lực 15 phút) và bản ghi phiên đăng nhập (chỉ lưu dạng hash), gồm cả việc bạn đăng nhập bằng link qua email hay bằng tài khoản liên kết.
- **Tài khoản liên kết:** nếu bạn liên kết tài khoản Google, GitHub hoặc LinkedIn với tài khoản VNX.SI, chúng tôi lưu đó là dịch vụ nào, mã định danh dịch vụ đó cấp cho tài khoản của bạn, và một nhãn để bạn nhận ra (email với Google và LinkedIn, tên người dùng với GitHub), cùng thời điểm liên kết và lần gần nhất bạn đăng nhập bằng nó. Khi bạn đăng nhập bằng một trong các dịch vụ này, dịch vụ gửi cho chúng tôi thông tin hồ sơ cơ bản; chúng tôi chỉ giữ những gì ghi ở đây. Chúng tôi không bao giờ nhận hay lưu mật khẩu của tài khoản đó, và không giữ khóa truy cập mà dịch vụ cấp cho chúng tôi.
- **Hồ sơ builder và sản phẩm:** những gì bạn nhập vào hồ sơ và listing (tên, tiêu đề, giới thiệu, quốc gia, kỹ năng, mức giá, link, mô tả sản phẩm, giá, hình ảnh). Nội dung này **công khai** sau khi được duyệt.
- **Yêu cầu (Inquiry):** khi bạn liên hệ một builder, tên bạn gõ, các tin nhắn, loại yêu cầu, khoảng ngân sách, hạn chót (nếu có), và sản phẩm hoặc builder được hỏi. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; builder chưa nhận được gì cho tới khi bạn xác nhận email.
- **Nhu cầu (request):** khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có), các ngôn ngữ bạn muốn làm việc và quốc gia bạn chọn. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email.
- **Nhu cầu công khai:** nếu bạn chọn hiện một nhu cầu trên bảng nhu cầu công khai, chúng tôi ghi lại thời điểm bạn chọn và phiên bản chính sách này mà bạn đã thấy. Đội ngũ của chúng tôi xem nhu cầu trước và có thể rút gọn hoặc sửa tiêu đề, mô tả để bỏ những chi tiết có thể nhận ra bạn hoặc người khác. Chúng tôi giữ bản đã công khai cùng với bản gốc của bạn.
- **Quan tâm tới nhu cầu công khai:** nếu bạn là builder và báo với chúng tôi rằng bạn quan tâm tới một nhu cầu công khai, chúng tôi ghi lại điều đó, thời điểm, và ghi chú hoặc sản phẩm bạn kèm theo.
- **Đề xuất:** nếu bạn là builder và được mời vào một nhu cầu, cách làm, giá, thời gian và ghi chú bạn gửi, hoặc việc bạn từ chối.
- **Danh sách chờ:** email, thời điểm bạn đồng ý nhận liên hệ, ngôn ngữ của trang, quốc gia do nhà cung cấp hosting nhận diện, trang web bạn đến từ đó (chỉ tên miền, không phải địa chỉ đầy đủ), và thẻ chiến dịch (`utm_*`) nếu link bạn bấm có.
- **Lượt bấm link ra ngoài:** khi bạn bấm một nút hoặc link dẫn tới website của công ty khác qua địa chỉ `/go/` của chúng tôi, chúng tôi ghi lại thời điểm, đó là link nào, nằm trên loại trang nào, ngôn ngữ của trang bạn đang xem, quốc gia của bạn (do nhà cung cấp hosting nhận diện), trang web bạn đến từ đó (chỉ tên miền) và việc lượt truy cập có giống bot tự động không. Chúng tôi ghi lượt bấm cả khi link không mang mã theo dõi nào. Chúng tôi không lưu địa chỉ IP, email hay tài khoản của bạn cùng bản ghi đó. Bản ghi có thể chứa mã theo ngày nêu ở "Đếm lượt truy cập", mã này không thể đối chiếu giữa các ngày.
- **Đếm lượt truy cập:** khi bạn mở trang một product, chúng tôi lưu mã ngẫu nhiên nêu ở mục 5 (Cookie) trong cookie. Chúng tôi kết hợp mã đó với một khóa bí mật đổi mỗi ngày, nên mỗi trang product, và mỗi link demo hay website của nó, được đếm tối đa một lần cho mỗi người mỗi ngày, và kết quả không thể đối chiếu từ ngày này sang ngày khác. Chúng tôi không đếm lượt truy cập giống bot tự động, lượt của chính builder của product, hay của đội ngũ chúng tôi. Nếu trình duyệt chặn cookie, trang vẫn hoạt động như cũ, nhưng mỗi lượt truy cập có thể bị đếm.
- **Câu hỏi và góp ý:** khi bạn dùng form liên hệ, email của bạn, tên bạn cung cấp (không bắt buộc), bạn là builder hay client, tin nhắn nói về điều gì, nội dung tin nhắn, ngôn ngữ của trang, và tài khoản của bạn nếu đã đăng nhập.
- **Bảo mật:** địa chỉ IP và hash email của bạn trong các bộ đếm ngắn hạn để giới hạn số lần dùng form, và bản ghi thao tác của admin (ví dụ duyệt hồ sơ).
- **Kiểm tra chống bot:** khi bạn gửi yêu cầu, nhu cầu hoặc tin nhắn liên hệ mà chưa đăng nhập, Cloudflare Turnstile kiểm tra bạn là người thật. Cloudflare nhận địa chỉ IP và thông tin từ trình duyệt của bạn để kiểm tra.

Chúng tôi không thu thông tin thanh toán. Chúng tôi không dùng analytics, quảng cáo hay cookie theo dõi của bên thứ ba.

**3. Chúng tôi dùng để làm gì**
- Đăng nhập và giữ bạn đăng nhập.
- Cho bạn đăng nhập bằng tài khoản đã liên kết và, nếu bạn là builder và tự chọn, hiện trên hồ sơ công khai rằng bạn sở hữu tài khoản GitHub hoặc LinkedIn.
- Hiển thị công khai hồ sơ builder và sản phẩm, và duyệt chúng trước khi công khai.
- Gửi email về tài khoản, listing của bạn, hoặc, nếu bạn vào danh sách chờ, báo khi chợ mở.
- Chuyển yêu cầu và trả lời giữa client và builder, và gửi email báo bên kia khi có tin nhắn mới (email có kèm nội dung tin nhắn).
- Ghép nhu cầu với builder: đội ngũ của chúng tôi đọc từng nhu cầu và mời tối đa năm builder; các builder đó xem nhu cầu và gửi đề xuất; khi bạn chọn một đề xuất, chúng tôi mở một yêu cầu giữa bạn và builder đó với nội dung nhu cầu và đề xuất làm tin nhắn đầu tiên.
- Hiển thị các nhu cầu mà người đăng đã chọn công khai, để builder tìm thấy và báo với chúng tôi rằng họ quan tâm. Đội ngũ của chúng tôi vẫn quyết định mời builder nào.
- Đếm số lần các link tới công ty khác được bấm và, với link partner, để partner biết một lượt truy cập đến từ link nào của chúng tôi (link có thể mang một mã bấm ngẫu nhiên; trên VNX.SI mã đó không gắn với tên, email hay tài khoản của bạn).
- Đếm lượt truy cập trang product và lượt bấm link demo, website của product, để hiện thống kê công khai (ví dụ product nào đang trending).
- Đọc và trả lời các câu hỏi, góp ý bạn gửi cho chúng tôi.
- Bảo vệ trang khỏi spam và lạm dụng.

Căn cứ của chúng tôi là sự đồng ý của bạn (danh sách chờ, form liên hệ), nhu cầu để cung cấp dịch vụ bạn yêu cầu (tài khoản, listing), và lợi ích chính đáng trong việc giữ an toàn cho trang. Với việc đếm lượt truy cập, chúng tôi dựa trên lợi ích chính đáng trong việc đo lường cách trang được sử dụng. Bạn có thể phản đối bất cứ lúc nào bằng cách bật tín hiệu Global Privacy Control trong trình duyệt: khi đó chúng tôi không đặt cookie và không đếm gì.

Với nhu cầu công khai, căn cứ của chúng tôi là sự đồng ý của bạn. Bạn có thể rút lại bất cứ lúc nào từ trang tài khoản; nhu cầu khi đó rời bảng công khai ngay, và việc rút lại không ảnh hưởng tới những gì đã diễn ra trước đó.

**4. Ai thấy được dữ liệu**
- Hồ sơ builder và sản phẩm đã duyệt là công khai.
- Tài khoản liên kết của bạn chỉ hiện cho chính bạn. Builder có thể chọn hiện tên người dùng GitHub, hoặc việc tài khoản LinkedIn đã được xác minh, trên hồ sơ công khai. Tài khoản Google không bao giờ được hiện, và builder không bao giờ thấy tài khoản liên kết của client.
- Khi bạn đăng nhập bằng Google, GitHub hoặc LinkedIn, dịch vụ đó biết bạn đã đăng nhập vào VNX.SI và xử lý việc này theo chính sách quyền riêng tư của họ.
- Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó. Nếu bạn chọn công khai một nhu cầu, bất kỳ ai, kể cả công cụ tìm kiếm, đều thấy được bản chúng tôi đã công khai, cùng danh mục, khoảng ngân sách, quốc gia, hạn chót và ngôn ngữ, nhưng không bao giờ thấy tên, email hay tài khoản của bạn.
- Khi một builder báo với chúng tôi rằng họ quan tâm tới một nhu cầu công khai, chỉ đội ngũ của chúng tôi thấy điều đó. Client không thấy, trừ khi chúng tôi mời builder đó.
- Công cụ tìm kiếm và các trang khác có thể giữ bản sao của một trang công khai trong một thời gian sau khi chúng tôi đóng hoặc gỡ nó. Chúng tôi yêu cầu công cụ tìm kiếm không lập chỉ mục các nhu cầu đã đóng, nhưng không thể xóa bản sao mà bên khác đang giữ.
- Khi bạn bấm link tới một partner, bạn rời VNX.SI. Partner thấy được bạn đến từ VNX.SI, và mã bấm nếu link có mang. Họ xử lý dữ liệu của bạn theo chính sách quyền riêng tư của họ, và có thể đặt cookie hoặc theo dõi riêng khi bạn vào trang của họ.
- Tin nhắn gửi qua form liên hệ chỉ đội ngũ VNX.SI đọc; một bản được chuyển tới hộp thư của chúng tôi qua Resend.
- Các nhà cung cấp dịch vụ xử lý dữ liệu thay chúng tôi: **Cloudflare** (hosting, cơ sở dữ liệu, lưu trữ file, bảo mật, gồm cả kiểm tra chống bot Turnstile) và **Resend** (gửi email). Họ có thể xử lý dữ liệu ngoài quốc gia của bạn.
- Chúng tôi không bán dữ liệu cá nhân. Chúng tôi chỉ cung cấp cho cơ quan chức năng khi pháp luật yêu cầu.

**5. Cookie**
Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động, và một cookie để đếm lượt truy cập.
- `__Host-vnx_session`: giữ bạn đăng nhập, tối đa 30 ngày.
- `__Host-vnx_invite`: ghi nhớ link mời builder trong 1 giờ.
- `__Host-vnx_oauth`: giữ an toàn cho lượt đăng nhập bằng Google, GitHub hoặc LinkedIn trong lúc bạn sang dịch vụ đó và quay lại, tối đa 10 phút.
- `__Host-vnx_vid`: một mã ngẫu nhiên, không gắn với tên, email hay tài khoản của bạn, chỉ dùng để đếm lượt truy cập trang product. Cookie hết hạn vào cuối ngày hiện tại (UTC). Chúng tôi không đặt cookie này nếu trình duyệt của bạn gửi tín hiệu Global Privacy Control (`Sec-GPC: 1`).

**6. Chúng tôi giữ bao lâu**
- Link đăng nhập: 15 phút. Phiên đăng nhập: tối đa 30 ngày, hoặc tới khi bạn đăng xuất.
- Tài khoản liên kết: tới khi bạn hủy liên kết hoặc tài khoản của bạn bị xóa.
- Bộ đếm giới hạn (gồm địa chỉ IP): được xóa định kỳ khi hết hạn.
- Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng.
- Bản ghi chống đếm trùng theo ngày: xóa sau 2 ngày.
- Yêu cầu và tin nhắn: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Yêu cầu bạn chưa xác nhận, và tài khoản tạo cho chúng mà chưa từng xác nhận: xóa sau 48 giờ.
- Nhu cầu và đề xuất: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Nhu cầu bạn chưa xác nhận: xóa sau 48 giờ.
- Nhu cầu công khai: hiển thị khi nhu cầu còn mở và trong 30 ngày sau khi đóng, trừ khi bạn hoặc chúng tôi gỡ sớm hơn. Sau đó, bản đã công khai và lựa chọn của bạn được giữ cùng nhu cầu, theo quy tắc ở trên. Bản ghi quan tâm: theo cùng quy tắc với nhu cầu.
- Câu hỏi và góp ý: tới khi chúng tôi đã trả lời và xử lý xong, cộng 12 tháng, hoặc tới khi bạn yêu cầu xóa.
- Tài khoản, hồ sơ và listing: trong thời gian tài khoản tồn tại. Khi bạn yêu cầu xóa, chúng tôi xóa hoặc ẩn danh, trừ các bản ghi phải giữ theo luật hoặc để bảo vệ trang.
- Danh sách chờ: tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi bạn yêu cầu gỡ.

**7. Quyền của bạn**
Bạn có thể yêu cầu xem, sửa, xuất hoặc xóa dữ liệu cá nhân, rút lại sự đồng ý, hoặc phản đối cách chúng tôi dùng dữ liệu. Gửi email tới contact@vnx.si từ địa chỉ bạn đã dùng với chúng tôi. Chúng tôi trả lời trong 30 ngày. Bạn cũng có thể khiếu nại với cơ quan bảo vệ dữ liệu nơi bạn sống.

**8. Bảo mật**
Phiên và link đăng nhập chỉ được lưu dạng hash, trang chỉ phục vụ qua HTTPS, và thao tác của admin được ghi lại. Chúng tôi gửi email cho bạn mỗi khi có tài khoản được liên kết hoặc hủy liên kết với tài khoản của bạn. Không hệ thống nào an toàn tuyệt đối; hãy báo cho chúng tôi qua contact@vnx.si nếu bạn phát hiện vấn đề.

**9. Trẻ em**
VNX.SI không dành cho trẻ em. Bạn phải từ 16 tuổi để vào danh sách chờ và từ 18 tuổi để làm builder.

**10. Thay đổi**
Khi thay đổi chính sách này, chúng tôi cập nhật ngày ở trên. Với thay đổi quan trọng, chúng tôi báo cho người dùng đã đăng nhập trước khi có hiệu lực.

**11. Ngôn ngữ**
Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng.
