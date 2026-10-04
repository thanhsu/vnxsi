# Privacy Policy — bản nháp

- **Trạng thái:** APPROVED bởi Owner 2026-10-04 (câu chữ và số liệu). **Bổ sung M5 (Inquiry, Turnstile): APPROVED bởi Owner 2026-10-04 (VNX-0508).** **Bổ sung M6 (request): APPROVED bởi Owner 2026-10-04.** Đây là bản soạn để bắt đầu, **không phải tư vấn pháp lý**; nên nhờ người có chuyên môn đọc lại trước khi dựa vào nó.
- **Task:** VNX-0705a. Implementer chuyển nguyên văn mục EN và VI vào `src/legal/content.ts`; `zh-Hans`, `zh-Hant` hiện bản EN kèm câu "bản tiếng Anh có hiệu lực" đã dịch.
- **Nguyên tắc:** chỉ ghi điều code thật sự làm **tại thời điểm go-live**. Mỗi khi M5 (Inquiry), M6 (request), M7 (lượt xem, `/go/`), EPIC 21 (partner) thêm dữ liệu, phải cập nhật trang này trong cùng task đó.
- **Đối chiếu code (`main` tại `5363766`):** session `__Host-vnx_session` 30 ngày (`auth/sessions.ts`); link đăng nhập 15 phút (`auth/tokens.ts`); `__Host-vnx_invite` 1 giờ (`auth/invite-cookie.ts`); rate limit lưu IP thô trong khóa `login:ip:*`, `waitlist:ip:*` và hash email `login:email:*` (`routes/auth.tsx`, `routes/landing.tsx`); waitlist lưu email, `personas`, `consent_at`, `lang`, `country`, `referrer` (host), `utm_*` (`db/waitlist.ts`).
- **Đối chiếu code M5 (`main` tại `89723e4`):** Inquiry lưu `client_name`, loại, nội dung, ngân sách, hạn chót, product/builder (`db/inquiries.ts`); builder chỉ thấy tên và tin nhắn, không thấy email (`InquirySummary`); email thông báo có nội dung tin nhắn (`notify/inquiry.ts`); chưa đăng nhập thì tạo tài khoản ngầm, Inquiry chờ và tài khoản chưa xác nhận bị xóa sau 48 giờ (`jobs/daily.ts`); Turnstile chỉ ở form khi chưa đăng nhập (`http/turnstile.ts`, Cloudflare nhận IP); bộ đếm `inquiry:ip:*` (IP thô) và `inquiry:email:*` (hash email) (`routes/inquiry-form.tsx`). Không có cookie mới.
- **Đối chiếu code M6 (`feat/m6-request` tại `2865d7e`):** request lưu `client_name`, `title`, `description`, `category`, `budget_band`, `deadline`, `languages`, gắn với tài khoản client qua `client_user_id` (`db/requests.ts` `createRequest`, migration `0008_requests`); đề xuất lưu `approach`, `price_cents`, `price_max_cents`, `price_note`, `timeline_days`, từ chối lưu `decline_reason` mà client không thấy (`proposeStatement`, `declineInviteStatement`, bảng `request_invites`); builder chỉ thấy tên đã che qua `builderFacingName` (`views/RequestFacts.tsx`, `views/hub/InvitationsPage.tsx`, email mời và nhắc ở `notify/request.ts`, Inquiry sinh ra ở `notify/inquiry.ts`), không thấy email; chưa đăng nhập thì tạo tài khoản ngầm, request chưa từng xác nhận (kể cả đã bị gỡ) và tài khoản chưa xác nhận bị xóa sau 48 giờ (`jobs/daily.ts` bước `pending_requests`, `ghost_users`: `deleteExpiredPendingRequests`, `deleteGhostUsers`); Turnstile chỉ ở form khi chưa đăng nhập (`routes/request-form.tsx`, `http/turnstile.ts`); bộ đếm `request:ip:*` (IP thô) và `request:email:*` (hash email) (`routes/request-form.tsx`). Không có cookie mới.
- **Điều kiện để câu về thời hạn giữ IP đúng:** cron dọn `rate_limits` (VNX-0505, M5) chạy trước go-live.
- **Owner chốt (2026-10-04):** trả lời yêu cầu trong 30 ngày; giữ waitlist tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi người dùng yêu cầu xóa.

---

## EN

### Privacy Policy

Last updated: {date}

**1. Who we are**
This policy explains how VNX.SI ("we") handles personal data on vnx.si. Contact for any privacy question or request: contact@vnx.si.

**2. What we collect**
- **Account:** your email address, the display name you choose, your language, whether you are an admin, and when you last signed in.
- **Sign-in:** one-time sign-in links (stored only as a hash, valid for 15 minutes) and session records (stored only as a hash).
- **Builder profile and products:** what you enter in your profile and listings (name, headline, bio, country, skills, rates, links, product descriptions, prices, images). This content is **public** once approved.
- **Inquiries:** when you contact a builder, the name you type, your messages, the type of request, your budget range, an optional deadline, and the product or builder it is about. If you are not signed in, we also take your email address and create an account for it; nothing reaches the builder until you confirm that email.
- **Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline and the languages you want to work in. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.
- **Proposals:** if you are a builder and we invite you to a request, the approach, price, timeline and notes you send, or that you declined.
- **Waitlist:** your email, the time you agreed to be contacted, the language of the page, your country as detected by our hosting provider, the website you came from (domain only, not the full address), and campaign tags (`utm_*`) if the link you followed had them.
- **Questions and feedback:** when you use our contact form, your email, the name you give (optional), whether you are a builder or a client, what your message is about, the message itself, the language of the page, and your account if you are signed in.
- **Security:** your IP address and a hash of your email in short-lived counters that limit how often a form can be used, and a record of actions taken by admins (for example approving a profile).
- **Bot check:** when you send an inquiry, a request or a contact message without signing in, Cloudflare Turnstile checks that you are a person. Cloudflare receives your IP address and information from your browser for this check.

We do not collect payment details. We do not use third-party analytics, advertising or tracking cookies.

**3. Why we use it**
- To sign you in and keep you signed in.
- To show builder profiles and products publicly, and to review them before they go public.
- To email you about your account, your listings, or, if you joined the waitlist, when the marketplace opens.
- To pass inquiries and replies between clients and builders, and to email the other side when there is a new message (the email includes the message).
- To match requests with builders: our team reads each request and invites up to five builders, who see the request and send proposals; when you pick a proposal we start an inquiry between you and that builder with the request and the proposal as the first message.
- To read and answer the questions and feedback you send us.
- To protect the site against spam and abuse.

We rely on your consent (waitlist, contact form), on what is needed to provide the service you asked for (account, listings), and on our legitimate interest in keeping the site secure.

**4. Who can see it**
- Builder profiles and approved products are public.
- Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request.
- Messages sent through the contact form are read only by the VNX.SI team; a copy is delivered to our mailbox through Resend.
- Service providers process data for us: **Cloudflare** (hosting, database, file storage, security, including the Turnstile bot check) and **Resend** (sending email). They may process data outside your country.
- We do not sell personal data. We share it with authorities only when the law requires it.

**5. Cookies**
We use only cookies that the site needs to work:
- `__Host-vnx_session`: keeps you signed in, for up to 30 days.
- `__Host-vnx_invite`: remembers a builder invite link for 1 hour.

**6. How long we keep it**
- Sign-in links: 15 minutes. Sessions: up to 30 days, or until you sign out.
- Rate-limit counters (including IP addresses): deleted regularly once they expire.
- Inquiries and their messages: while your account exists, under the same rule as your account below. Inquiries you never confirmed, and accounts created for them that were never confirmed: deleted after 48 hours.
- Requests and proposals: while your account exists, under the same rule as your account below. Requests you never confirmed: deleted after 48 hours.
- Questions and feedback: until we have answered and dealt with them, plus 12 months, or until you ask us to delete them.
- Account, profile and listings: while your account exists. When you ask us to delete it, we delete or anonymise it, except records we must keep by law or to protect the site.
- Waitlist: until the marketplace opens to clients plus 12 months, or until you ask us to remove you.

**7. Your rights**
You can ask to see, correct, export or delete your personal data, to withdraw your consent, or to object to how we use it. Email contact@vnx.si from the address you used with us. We reply within 30 days. You can also complain to the data protection authority where you live.

**8. Security**
Sessions and sign-in links are stored only as hashes, the site is served over HTTPS only, and admin actions are logged. No system is perfectly secure; tell us at contact@vnx.si if you find a problem.

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
- **Đăng nhập:** link đăng nhập dùng một lần (chỉ lưu dạng hash, hiệu lực 15 phút) và bản ghi phiên đăng nhập (chỉ lưu dạng hash).
- **Hồ sơ builder và sản phẩm:** những gì bạn nhập vào hồ sơ và listing (tên, tiêu đề, giới thiệu, quốc gia, kỹ năng, mức giá, link, mô tả sản phẩm, giá, hình ảnh). Nội dung này **công khai** sau khi được duyệt.
- **Yêu cầu (Inquiry):** khi bạn liên hệ một builder, tên bạn gõ, các tin nhắn, loại yêu cầu, khoảng ngân sách, hạn chót (nếu có), và sản phẩm hoặc builder được hỏi. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; builder chưa nhận được gì cho tới khi bạn xác nhận email.
- **Nhu cầu (request):** khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có) và các ngôn ngữ bạn muốn làm việc. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email.
- **Đề xuất:** nếu bạn là builder và được mời vào một nhu cầu, cách làm, giá, thời gian và ghi chú bạn gửi, hoặc việc bạn từ chối.
- **Danh sách chờ:** email, thời điểm bạn đồng ý nhận liên hệ, ngôn ngữ của trang, quốc gia do nhà cung cấp hosting nhận diện, trang web bạn đến từ đó (chỉ tên miền, không phải địa chỉ đầy đủ), và thẻ chiến dịch (`utm_*`) nếu link bạn bấm có.
- **Câu hỏi và góp ý:** khi bạn dùng form liên hệ, email của bạn, tên bạn cung cấp (không bắt buộc), bạn là builder hay client, tin nhắn nói về điều gì, nội dung tin nhắn, ngôn ngữ của trang, và tài khoản của bạn nếu đã đăng nhập.
- **Bảo mật:** địa chỉ IP và hash email của bạn trong các bộ đếm ngắn hạn để giới hạn số lần dùng form, và bản ghi thao tác của admin (ví dụ duyệt hồ sơ).
- **Kiểm tra chống bot:** khi bạn gửi yêu cầu, nhu cầu hoặc tin nhắn liên hệ mà chưa đăng nhập, Cloudflare Turnstile kiểm tra bạn là người thật. Cloudflare nhận địa chỉ IP và thông tin từ trình duyệt của bạn để kiểm tra.

Chúng tôi không thu thông tin thanh toán. Chúng tôi không dùng analytics, quảng cáo hay cookie theo dõi của bên thứ ba.

**3. Chúng tôi dùng để làm gì**
- Đăng nhập và giữ bạn đăng nhập.
- Hiển thị công khai hồ sơ builder và sản phẩm, và duyệt chúng trước khi công khai.
- Gửi email về tài khoản, listing của bạn, hoặc, nếu bạn vào danh sách chờ, báo khi chợ mở.
- Chuyển yêu cầu và trả lời giữa client và builder, và gửi email báo bên kia khi có tin nhắn mới (email có kèm nội dung tin nhắn).
- Ghép nhu cầu với builder: đội ngũ của chúng tôi đọc từng nhu cầu và mời tối đa năm builder; các builder đó xem nhu cầu và gửi đề xuất; khi bạn chọn một đề xuất, chúng tôi mở một yêu cầu giữa bạn và builder đó với nội dung nhu cầu và đề xuất làm tin nhắn đầu tiên.
- Đọc và trả lời các câu hỏi, góp ý bạn gửi cho chúng tôi.
- Bảo vệ trang khỏi spam và lạm dụng.

Căn cứ của chúng tôi là sự đồng ý của bạn (danh sách chờ, form liên hệ), nhu cầu để cung cấp dịch vụ bạn yêu cầu (tài khoản, listing), và lợi ích chính đáng trong việc giữ an toàn cho trang.

**4. Ai thấy được dữ liệu**
- Hồ sơ builder và sản phẩm đã duyệt là công khai.
- Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó.
- Tin nhắn gửi qua form liên hệ chỉ đội ngũ VNX.SI đọc; một bản được chuyển tới hộp thư của chúng tôi qua Resend.
- Các nhà cung cấp dịch vụ xử lý dữ liệu thay chúng tôi: **Cloudflare** (hosting, cơ sở dữ liệu, lưu trữ file, bảo mật, gồm cả kiểm tra chống bot Turnstile) và **Resend** (gửi email). Họ có thể xử lý dữ liệu ngoài quốc gia của bạn.
- Chúng tôi không bán dữ liệu cá nhân. Chúng tôi chỉ cung cấp cho cơ quan chức năng khi pháp luật yêu cầu.

**5. Cookie**
Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động:
- `__Host-vnx_session`: giữ bạn đăng nhập, tối đa 30 ngày.
- `__Host-vnx_invite`: ghi nhớ link mời builder trong 1 giờ.

**6. Chúng tôi giữ bao lâu**
- Link đăng nhập: 15 phút. Phiên đăng nhập: tối đa 30 ngày, hoặc tới khi bạn đăng xuất.
- Bộ đếm giới hạn (gồm địa chỉ IP): được xóa định kỳ khi hết hạn.
- Yêu cầu và tin nhắn: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Yêu cầu bạn chưa xác nhận, và tài khoản tạo cho chúng mà chưa từng xác nhận: xóa sau 48 giờ.
- Nhu cầu và đề xuất: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Nhu cầu bạn chưa xác nhận: xóa sau 48 giờ.
- Câu hỏi và góp ý: tới khi chúng tôi đã trả lời và xử lý xong, cộng 12 tháng, hoặc tới khi bạn yêu cầu xóa.
- Tài khoản, hồ sơ và listing: trong thời gian tài khoản tồn tại. Khi bạn yêu cầu xóa, chúng tôi xóa hoặc ẩn danh, trừ các bản ghi phải giữ theo luật hoặc để bảo vệ trang.
- Danh sách chờ: tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi bạn yêu cầu gỡ.

**7. Quyền của bạn**
Bạn có thể yêu cầu xem, sửa, xuất hoặc xóa dữ liệu cá nhân, rút lại sự đồng ý, hoặc phản đối cách chúng tôi dùng dữ liệu. Gửi email tới contact@vnx.si từ địa chỉ bạn đã dùng với chúng tôi. Chúng tôi trả lời trong 30 ngày. Bạn cũng có thể khiếu nại với cơ quan bảo vệ dữ liệu nơi bạn sống.

**8. Bảo mật**
Phiên và link đăng nhập chỉ được lưu dạng hash, trang chỉ phục vụ qua HTTPS, và thao tác của admin được ghi lại. Không hệ thống nào an toàn tuyệt đối; hãy báo cho chúng tôi qua contact@vnx.si nếu bạn phát hiện vấn đề.

**9. Trẻ em**
VNX.SI không dành cho trẻ em. Bạn phải từ 16 tuổi để vào danh sách chờ và từ 18 tuổi để làm builder.

**10. Thay đổi**
Khi thay đổi chính sách này, chúng tôi cập nhật ngày ở trên. Với thay đổi quan trọng, chúng tôi báo cho người dùng đã đăng nhập trước khi có hiệu lực.

**11. Ngôn ngữ**
Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng.

---

## Ghi chú cho Owner

- Mục 6 và 7 có hai con số cần bạn chốt: **12 tháng** giữ waitlist sau khi chợ mở, **30 ngày** trả lời yêu cầu. Nghị định 13/2023 của Việt Nam có thời hạn riêng cho một số yêu cầu; nên hỏi người chuyên môn.
- Câu "Bộ đếm giới hạn … được xóa định kỳ" chỉ đúng khi cron VNX-0505 chạy. Không go-live trước khi có cron đó.
- Nhật ký lỗi của Workers (observability) có thể chứa đường dẫn và metadata request; đã gộp vào "Cloudflare (hosting … security)". Nếu muốn nói rõ hơn thì thêm một dòng ở mục 4.
